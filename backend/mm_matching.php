<?php
require_once __DIR__ . '/mm_core.php';
require_once __DIR__ . '/mm_availability.php';

function mm_uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function mm_request_by_public(PDO $pdo, string $publicId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM mm_requests WHERE public_id = ? AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([$publicId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function mm_transaction_for_request(PDO $pdo, int $requestId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM mm_transactions WHERE request_id = ? LIMIT 1');
    $stmt->execute([$requestId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function mm_request_payload(PDO $pdo, array $request, array $viewer): array
{
    $tx = mm_transaction_for_request($pdo, (int)$request['request_id']);
    $offer = null;
    $stmt = $pdo->prepare("SELECT * FROM mm_offers WHERE request_id = ? AND state = 'offered' AND expires_at > NOW() ORDER BY offer_id DESC LIMIT 1");
    $stmt->execute([$request['request_id']]);
    $row = $stmt->fetch();
    if ($row) {
        $offer = [
            'offer_id' => (int)$row['offer_id'],
            'distance_m' => (float)$row['distance_m'],
            'eta_minutes' => (int)$row['eta_minutes'],
            'expected_earning' => $row['expected_earning'],
            'visible_lat' => $row['visible_lat'],
            'visible_lng' => $row['visible_lng'],
            'expires_at' => $row['expires_at'],
        ];
    }

    $isCustomer = (int)$request['customer_id'] === (int)$viewer['user_id'];
    $payload = [
        'request_id' => (int)$request['request_id'],
        'public_id' => $request['public_id'],
        'state' => $request['state'],
        'direction' => $request['direction'],
        'network' => $request['network'],
        'amount' => $request['amount'],
        'platform_fee' => $request['platform_fee'],
        'agent_commission' => $request['agent_commission'],
        'pickup_address' => $request['pickup_address'],
        'search_deadline' => $request['search_deadline'],
        'offer' => $offer,
        'transaction' => $tx ? [
            'transaction_id' => (int)$tx['transaction_id'],
            'state' => $tx['state'],
            'handover_code' => $isCustomer ? $tx['handover_code'] : null,
        ] : null,
    ];

    if ($isCustomer) {
        $payload['pickup_lat'] = $request['pickup_lat'];
        $payload['pickup_lng'] = $request['pickup_lng'];
    }
    return $payload;
}

function mm_create_request(PDO $pdo, array $user, array $input, string $idempotencyKey): array
{
    $direction = mm_validate_direction($input['direction'] ?? '');
    $network = mm_validate_network($input['network'] ?? '');
    $amount = mm_parse_money($input['amount'] ?? null, 'amount', false);
    [$pickupLat, $pickupLng] = mm_validate_coordinates($input['pickup_lat'] ?? null, $input['pickup_lng'] ?? null);
    $address = trim((string)($input['pickup_address'] ?? ''));
    if (mb_strlen($address) < 3 || mb_strlen($address) > 255) {
        mm_fail('Enter a pickup address between 3 and 255 characters.', 400, 'invalid_pickup_address');
    }

    $minimum = mm_setting_money($pdo, 'min_amount', 1000);
    $maximum = mm_setting_money($pdo, 'max_amount', 500000);
    if ($amount < $minimum || $amount > $maximum) {
        mm_fail('Amount is outside the allowed ZMW ' . mm_ngwee_to_decimal($minimum) . ' to ' . mm_ngwee_to_decimal($maximum) . ' range.', 400, 'invalid_amount');
    }

    $keyPayload = [
        'direction' => $direction,
        'network' => $network,
        'amount' => mm_ngwee_to_decimal($amount),
        'pickup_lat' => number_format($pickupLat, 7, '.', ''),
        'pickup_lng' => number_format($pickupLng, 7, '.', ''),
        'pickup_address' => $address,
    ];
    $idempotencyId = mm_idempotency_begin($pdo, $user, 'customer.request.create', $idempotencyKey, $keyPayload);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM mm_transactions WHERE customer_id = ? AND state IN ('searching','accepted','agent_en_route','arrived','processing')");
        $stmt->execute([$user['user_id']]);
        if ((int)$stmt->fetchColumn() > 0) {
            mm_fail('You already have an active marketplace request.', 409, 'active_request_exists');
        }

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM mm_transactions WHERE customer_id = ? AND state IN ('accepted','agent_en_route','arrived','processing')");
        $stmt->execute([$user['user_id']]);
        $hasCustomerJob = (int)$stmt->fetchColumn() > 0;
        if ($hasCustomerJob && !mm_setting_flag($pdo, 'allow_dual_role_activity')) {
            mm_fail('Finish your active agent job before creating a customer request.', 409, 'dual_role_blocked');
        }

        $fees = mm_fee_quote($pdo, $network, $direction, $amount);
        $publicId = mm_uuid();
        $timeout = mm_setting_int($pdo, 'search_total_timeout_seconds', 180);
        $stmt = $pdo->prepare('
            INSERT INTO mm_requests
            (public_id, customer_id, direction, network, amount, pickup_lat, pickup_lng, pickup_address, state, platform_fee, agent_commission, search_deadline)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'searching\', ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
        ');
        $stmt->execute([
            $publicId,
            $user['user_id'],
            $direction,
            $network,
            mm_ngwee_to_decimal($amount),
            number_format($pickupLat, 7, '.', ''),
            number_format($pickupLng, 7, '.', ''),
            $address,
            mm_ngwee_to_decimal($fees['platform_fee']),
            mm_ngwee_to_decimal($fees['agent_commission']),
            $timeout,
        ]);
        $requestId = (int)$pdo->lastInsertId();

        $stmt = $pdo->prepare('
            INSERT INTO mm_transactions
            (request_id, customer_id, direction, network, amount, state, platform_fee, agent_earning)
            VALUES (?, ?, ?, ?, ?, \'searching\', ?, ?)
        ');
        $stmt->execute([
            $requestId,
            $user['user_id'],
            $direction,
            $network,
            mm_ngwee_to_decimal($amount),
            mm_ngwee_to_decimal($fees['platform_fee']),
            mm_ngwee_to_decimal($fees['agent_commission']),
        ]);

        $stmt = $pdo->prepare('SELECT * FROM mm_requests WHERE request_id = ? LIMIT 1');
        $stmt->execute([$requestId]);
        $request = $stmt->fetch();

        mm_audit($pdo, 'mm_request', $requestId, null, 'create', null, 'searching', 'customer', (int)$user['user_id'], [], $keyPayload);
        mm_notify($pdo, (int)$user['user_id'], 'request.searching', ucfirst($direction) . ' request sent', 'We are looking for a nearby verified ' . $network . ' agent for K' . mm_ngwee_to_decimal($amount) . '.', [
            'request_id' => $requestId,
            'screen' => 'marketplace',
            'direction' => $direction,
            'network' => $network,
            'amount' => mm_ngwee_to_decimal($amount),
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    mm_dispatch_next_offer($pdo, $requestId);

    $stmt = $pdo->prepare('SELECT * FROM mm_requests WHERE request_id = ? LIMIT 1');
    $stmt->execute([$requestId]);
    $request = $stmt->fetch();
    mm_idempotency_respond($pdo, $idempotencyId, ['success' => true, 'message' => 'Request created.', 'data' => mm_request_payload($pdo, $request, $user)]);
}

function mm_dispatch_next_offer(PDO $pdo, int $requestId, bool $alreadyInTransaction = false): ?int
{
    if (!$alreadyInTransaction) {
        $pdo->beginTransaction();
    }
    try {
        $stmt = $pdo->prepare('SELECT * FROM mm_requests WHERE request_id = ? AND state = \'searching\' FOR UPDATE');
        $stmt->execute([$requestId]);
        $request = $stmt->fetch();
        if (!$request) {
            if (!$alreadyInTransaction) {
                $pdo->commit();
            }
            return null;
        }

        if (strtotime($request['search_deadline']) <= time()) {
            $stmt = $pdo->prepare("SELECT * FROM mm_transactions WHERE request_id = ? AND state = 'searching' FOR UPDATE");
            $stmt->execute([$requestId]);
            $tx = $stmt->fetch();
            if ($tx) {
                mm_transition($pdo, (int)$tx['transaction_id'], 'expired', 'system', null, ['reason' => 'search_timeout']);
            }
            if (!$alreadyInTransaction) {
                $pdo->commit();
            }
            return null;
        }

        $stmt = $pdo->prepare('SELECT COUNT(*) FROM mm_offers WHERE request_id = ?');
        $stmt->execute([$requestId]);
        $attemptNo = (int)$stmt->fetchColumn() + 1;
        $maxAttempts = mm_setting_int($pdo, 'max_offer_attempts', 12);
        if ($attemptNo > $maxAttempts) {
            if (!$alreadyInTransaction) {
                $pdo->commit();
            }
            return null;
        }

        $steps = array_filter(array_map('intval', explode(',', mm_setting($pdo, 'radius_steps_km', '3,5,10'))));
        $steps = $steps ? array_values($steps) : [3, 5, 10];
        $radiusKm = $steps[min($attemptNo - 1, count($steps) - 1)];
        $radiusM = $radiusKm * 1000;
        $amount = mm_parse_money($request['amount']);
        $side = $request['direction'] === 'withdrawal' ? 'cash' : 'float';
        $balanceColumn = $side . '_balance';
        $reservedColumn = $side . '_reserved';
        $staleSeconds = mm_setting_int($pdo, 'agent_location_stale_seconds', 60);

        $stmt = $pdo->prepare("
            SELECT a.*, l.lat AS live_lat, l.lng AS live_lng,
                   al.{$balanceColumn} AS side_balance, al.{$reservedColumn} AS side_reserved
            FROM agent_profiles a
            JOIN agent_locations l ON l.agent_id = a.agent_id
            JOIN agent_networks an ON an.agent_id = a.agent_id AND an.deleted_at IS NULL
            JOIN agent_liquidity al ON al.agent_id = a.agent_id AND al.network = an.network
            WHERE a.verification_status = 'verified'
              AND a.availability = 'available'
              AND a.deleted_at IS NULL
              AND l.updated_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
              AND an.network = ?
              AND ? >= an.min_amount AND ? <= an.max_amount
              AND (al.{$balanceColumn} - al.{$reservedColumn}) >= ?
              AND a.agent_id NOT IN (SELECT agent_id FROM mm_offers WHERE request_id = ?)
              AND a.agent_id NOT IN (SELECT agent_id FROM mm_blocks WHERE customer_id = ?)
              AND a.user_id <> ?
        ");
        $stmt->execute([
            $staleSeconds,
            $request['network'],
            $request['amount'],
            $request['amount'],
            $request['amount'],
            $requestId,
            $request['customer_id'],
            $request['customer_id'],
        ]);
        $candidates = $stmt->fetchAll();

        $scored = [];
        foreach ($candidates as $candidate) {
            $distance = mm_haversine_m(
                (float)$candidate['live_lat'],
                (float)$candidate['live_lng'],
                (float)$request['pickup_lat'],
                (float)$request['pickup_lng']
            );
            if ($distance > $radiusM) {
                continue;
            }
            $headroom = mm_parse_money($candidate['side_balance']) - mm_parse_money($candidate['side_reserved']);
            $cap = mm_setting_money($pdo, 'liquidity_max_declaration', 50000000);
            $priorRating = (float)mm_setting($pdo, 'bayesian_prior_rating', '4.2');
            $priorWeight = max(1, mm_setting_int($pdo, 'bayesian_prior_weight', 10));
            $rating = ((float)$candidate['rating_avg'] * (int)$candidate['rating_count'] + $priorRating * $priorWeight) / ((int)$candidate['rating_count'] + $priorWeight);
            $score =
                mm_setting_float($pdo, 'weight_distance', 0.40) * (1 - min(1, $distance / max(1, $radiusM))) +
                mm_setting_float($pdo, 'weight_liquidity', 0.20) * min(1, $headroom / max(1, $cap)) +
                mm_setting_float($pdo, 'weight_acceptance', 0.15) * ((float)$candidate['acceptance_rate'] / 100) +
                mm_setting_float($pdo, 'weight_completion', 0.15) * ((float)$candidate['completion_rate'] / 100) +
                mm_setting_float($pdo, 'weight_rating', 0.10) * ($rating / 5);
            $scored[] = ['agent' => $candidate, 'distance' => $distance, 'score' => $score];
        }

        if (!$scored) {
            if (!$alreadyInTransaction) {
                $pdo->commit();
            }
            return null;
        }

        usort($scored, static fn(array $a, array $b): int => $b['score'] <=> $a['score']);
        $chosen = $scored[0]['agent'];
        $route = mm_route(
            $pdo,
            (float)$chosen['live_lat'],
            (float)$chosen['live_lng'],
            (float)$request['pickup_lat'],
            (float)$request['pickup_lng']
        );
        [$visibleLat, $visibleLng] = mm_coarsen((float)$chosen['live_lat'], (float)$chosen['live_lng'], 400);
        $offerTimeout = mm_setting_int($pdo, 'offer_timeout_seconds', 30);

        $stmt = $pdo->prepare('
            INSERT INTO mm_offers
            (request_id, agent_id, attempt_no, state, distance_m, eta_minutes, expected_earning, visible_lat, visible_lng, expires_at)
            VALUES (?, ?, ?, \'offered\', ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
        ');
        $stmt->execute([
            $requestId,
            $chosen['agent_id'],
            $attemptNo,
            number_format($scored[0]['distance'], 2, '.', ''),
            max(1, (int)ceil($route['duration_s'] / 60)),
            mm_ngwee_to_decimal(mm_parse_money($request['agent_commission'])),
            number_format($visibleLat, 7, '.', ''),
            number_format($visibleLng, 7, '.', ''),
            $offerTimeout,
        ]);
        $offerId = (int)$pdo->lastInsertId();

        mm_audit($pdo, 'mm_offer', $offerId, null, 'offer', null, 'offered', 'system', null, [], [
            'request_id' => $requestId,
            'agent_id' => (int)$chosen['agent_id'],
            'attempt_no' => $attemptNo,
            'distance_m' => number_format($scored[0]['distance'], 2, '.', ''),
            'radius_m' => $radiusM,
        ]);
        mm_notify($pdo, (int)$chosen['user_id'], 'offer.new', 'New ' . $request['network'] . ' request', 'K' . number_format((float)$request['amount'], 2) . ' ' . ucfirst($request['direction']) . ' · ' . (int)round($scored[0]['distance']) . 'm away. Accept or decline now.', [
            'offer_id' => $offerId,
            'request_id' => $requestId,
            'screen' => 'agent.request',
            'network' => $request['network'],
            'direction' => $request['direction'],
            'amount' => (string)$request['amount'],
        ]);
        if (!$alreadyInTransaction) {
            $pdo->commit();
        }
        return $offerId;
    } catch (Throwable $e) {
        if (!$alreadyInTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function mm_dispatch_pending_requests(PDO $pdo, int $limit = 10): int
{
    $limit = max(1, min(50, $limit));
    $stmt = $pdo->prepare('
        SELECT t.request_id
        FROM mm_transactions t
        JOIN mm_requests r ON r.request_id = t.request_id
        WHERE t.state = \'searching\'
          AND r.state = \'searching\'
          AND r.search_deadline > NOW()
          AND NOT EXISTS (
              SELECT 1 FROM mm_offers o
              WHERE o.request_id = t.request_id AND o.state = \'offered\' AND o.expires_at > NOW()
          )
        ORDER BY t.created_at ASC
        LIMIT ' . $limit
    );
    $stmt->execute();
    $requestIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

    $dispatched = 0;
    foreach ($requestIds as $requestId) {
        $stmt = $pdo->prepare("UPDATE mm_offers SET state = 'expired', responded_at = COALESCE(responded_at, NOW()) WHERE request_id = ? AND state = 'offered' AND expires_at <= NOW()");
        $stmt->execute([$requestId]);
        try {
            if (mm_dispatch_next_offer($pdo, $requestId)) {
                ++$dispatched;
            }
        } catch (Throwable $ignored) {
        }
    }

    return $dispatched;
}

function mm_agent_offers(PDO $pdo, array $agent): array
{
    $stmt = $pdo->prepare("
        SELECT o.*, r.direction, r.network, r.amount, r.pickup_address, r.pickup_lat, r.pickup_lng,
               u.fullname AS customer_name, u.avatar AS customer_avatar, u.phone_number AS customer_phone
        FROM mm_offers o
        JOIN mm_requests r ON r.request_id = o.request_id
        JOIN users u ON u.user_id = r.customer_id
        WHERE o.agent_id = ? AND o.state = 'offered' AND o.expires_at > NOW()
        ORDER BY o.expires_at ASC
    ");
    $stmt->execute([$agent['agent_id']]);
    $rows = $stmt->fetchAll();
    $offers = [];
    foreach ($rows as $row) {
        $offers[] = [
            'offer_id' => (int)$row['offer_id'],
            'request_id' => (int)$row['request_id'],
            'direction' => $row['direction'],
            'network' => $row['network'],
            'amount' => $row['amount'],
            'expected_earning' => $row['expected_earning'],
            'distance_m' => (float)$row['distance_m'],
            'eta_minutes' => (int)$row['eta_minutes'],
            'pickup_address' => $row['pickup_address'],
            'pickup_lat' => $row['pickup_lat'],
            'pickup_lng' => $row['pickup_lng'],
            'customer' => [
                'name' => $row['customer_name'],
                'avatar' => $row['customer_avatar'],
                'phone' => $row['customer_phone'],
            ],
            'expires_at' => $row['expires_at'],
        ];
    }
    return $offers;
}

function mm_respond_offer(PDO $pdo, array $user, array $agent, array $input): array
{
    $offerId = (int)($input['offer_id'] ?? 0);
    $decision = strtolower(trim((string)($input['decision'] ?? '')));
    if (!in_array($decision, ['accept', 'reject'], true)) {
        mm_fail('Decision must be accept or reject.', 400, 'invalid_decision');
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM mm_offers WHERE offer_id = ? FOR UPDATE');
        $stmt->execute([$offerId]);
        $offer = $stmt->fetch();
        if (!$offer || (int)$offer['agent_id'] !== (int)$agent['agent_id']) {
            mm_fail('Offer not found.', 404, 'offer_not_found');
        }
        if ($offer['state'] !== 'offered') {
            mm_fail('This offer is no longer pending.', 409, 'offer_not_pending');
        }
        if (strtotime($offer['expires_at']) <= time()) {
            $stmt = $pdo->prepare("UPDATE mm_offers SET state = 'expired', responded_at = NOW() WHERE offer_id = ? AND state = 'offered'");
            $stmt->execute([$offerId]);
            $pdo->commit();
            mm_fail('This offer has expired.', 409, 'offer_expired');
        }

        $stmt = $pdo->prepare('SELECT * FROM mm_requests WHERE request_id = ? FOR UPDATE');
        $stmt->execute([$offer['request_id']]);
        $request = $stmt->fetch();
        if (!$request || $request['state'] !== 'searching') {
            mm_fail('This request is no longer searching.', 409, 'request_not_searching');
        }

        $newState = $decision === 'accept' ? 'accepted' : 'rejected';
        $stmt = $pdo->prepare('UPDATE mm_offers SET state = ?, responded_at = NOW() WHERE offer_id = ?');
        $stmt->execute([$newState, $offerId]);

        if ($decision === 'reject') {
            mm_audit($pdo, 'mm_offer', $offerId, null, 'reject', 'offered', 'rejected', 'agent', (int)$user['user_id']);
            $pdo->commit();
            mm_dispatch_next_offer($pdo, (int)$offer['request_id']);
            return ['offer_id' => $offerId, 'decision' => 'rejected'];
        }

        $stmt = $pdo->prepare("UPDATE mm_offers SET state = 'cancelled', responded_at = NOW() WHERE request_id = ? AND offer_id <> ? AND state = 'offered'");
        $stmt->execute([$offer['request_id'], $offerId]);
        $stmt = $pdo->prepare("SELECT * FROM mm_transactions WHERE request_id = ? AND state = 'searching' FOR UPDATE");
        $stmt->execute([$offer['request_id']]);
        $tx = $stmt->fetch();
        if (!$tx) {
            mm_fail('Transaction is no longer available.', 409, 'transaction_not_searching');
        }
        $updated = mm_transition($pdo, (int)$tx['transaction_id'], 'accepted', 'agent', (int)$user['user_id'], ['agent_id' => $agent['agent_id']]);
        mm_audit($pdo, 'mm_offer', $offerId, (int)$updated['transaction_id'], 'accept', 'offered', 'accepted', 'agent', (int)$user['user_id']);
        $pdo->commit();

        return ['offer_id' => $offerId, 'decision' => 'accepted', 'transaction_id' => (int)$updated['transaction_id'], 'state' => $updated['state']];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function mm_cancel_request(PDO $pdo, array $user, array $input, string $idempotencyKey): array
{
    $publicId = trim((string)($input['public_id'] ?? ''));
    $request = $publicId !== '' ? mm_request_by_public($pdo, $publicId) : null;
    if (!$request || (int)$request['customer_id'] !== (int)$user['user_id']) {
        mm_fail('Request not found.', 404, 'request_not_found');
    }

    $idempotencyId = mm_idempotency_begin($pdo, $user, 'customer.request.cancel', $idempotencyKey, ['public_id' => $publicId]);
    $pdo->beginTransaction();
    try {
        if (!in_array($request['state'], ['searching', 'matched'], true)) {
            mm_fail('This request can no longer be cancelled.', 409, 'request_not_cancellable');
        }
        $stmt = $pdo->prepare('SELECT * FROM mm_transactions WHERE request_id = ? FOR UPDATE');
        $stmt->execute([$request['request_id']]);
        $tx = $stmt->fetch();
        if (!$tx || !in_array($tx['state'], ['searching', 'accepted'], true)) {
            mm_fail('This transaction can no longer be cancelled.', 409, 'transaction_not_cancellable');
        }
        $reason = substr(trim((string)($input['reason'] ?? 'Cancelled by customer')), 0, 255);
        $updated = mm_transition($pdo, (int)$tx['transaction_id'], 'cancelled', 'customer', (int)$user['user_id'], ['reason' => $reason]);
        $stmt = $pdo->prepare("UPDATE mm_offers SET state = 'cancelled', responded_at = NOW() WHERE request_id = ? AND state = 'offered'");
        $stmt->execute([$request['request_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    mm_idempotency_respond($pdo, $idempotencyId, ['success' => true, 'message' => 'Request cancelled.', 'data' => ['transaction_id' => (int)$updated['transaction_id'], 'state' => $updated['state']]]);
}

function mm_request_history(PDO $pdo, array $user, int $limit = 50): array
{
    $limit = max(1, min(100, $limit));
    $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
    $agentId = (int)($agent['agent_id'] ?? 0);

    $stmt = $pdo->prepare('
        SELECT t.transaction_id, t.request_id, r.public_id, t.state, t.direction, t.network, t.amount, t.created_at,
               t.customer_id, t.agent_id, t.platform_fee, t.agent_earning, t.cancel_reason,
               cu.fullname AS customer_name, cu.phone_number AS customer_phone, cu.avatar AS customer_avatar,
               ap.business_name AS agent_name, au.phone_number AS agent_phone, au.avatar AS agent_avatar,
               CASE WHEN t.customer_id = :viewer_id THEN "customer" ELSE "agent" END AS viewer_role
        FROM mm_transactions t
        INNER JOIN mm_requests r ON r.request_id = t.request_id
        LEFT JOIN users cu ON cu.user_id = t.customer_id
        LEFT JOIN agent_profiles ap ON ap.agent_id = t.agent_id
        LEFT JOIN users au ON au.user_id = ap.user_id
        WHERE (t.customer_id = :viewer_id_2 OR t.agent_id = :agent_id)
          AND t.deleted_at IS NULL
          AND r.deleted_at IS NULL
        ORDER BY t.created_at DESC, t.transaction_id DESC
        LIMIT ' . $limit
    );
    $stmt->execute(['viewer_id' => (int)$user['user_id'], 'viewer_id_2' => (int)$user['user_id'], 'agent_id' => $agentId]);
    $rows = $stmt->fetchAll();

    $history = [];
    foreach ($rows as $row) {
        $isCustomer = $row['viewer_role'] === 'customer';
        $history[] = [
            'transaction_id' => (int)$row['transaction_id'],
            'request_id' => (int)$row['request_id'],
            'public_id' => $row['public_id'],
            'state' => $row['state'],
            'direction' => $row['direction'],
            'network' => $row['network'],
            'amount' => $row['amount'],
            'date' => $row['created_at'],
            'role' => $row['viewer_role'],
            'platform_fee' => $row['platform_fee'],
            'earning' => $row['agent_earning'],
            'cancel_reason' => $row['cancel_reason'],
            'counterparty' => $isCustomer
                ? ($row['agent_name'] ?: 'Agent')
                : ($row['customer_name'] ?: 'Customer'),
            'counterparty_phone' => $isCustomer ? ($row['agent_phone'] ?? '') : ($row['customer_phone'] ?? ''),
            'counterparty_avatar' => $isCustomer ? ($row['agent_avatar'] ?? '') : ($row['customer_avatar'] ?? ''),
        ];
    }

    return ['history' => $history];
}
