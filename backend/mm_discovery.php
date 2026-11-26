<?php
require_once __DIR__ . '/mm_core.php';

function mm_update_customer_location(PDO $pdo, array $user, array $input): array
{
    [$lat, $lng] = mm_validate_coordinates($input['lat'] ?? null, $input['lng'] ?? null);
    $accuracy = isset($input['accuracy']) && is_numeric($input['accuracy']) ? max(0, min(10000, (float)$input['accuracy'])) : null;
    $heading = isset($input['heading']) && is_numeric($input['heading']) ? max(0, min(360, (float)$input['heading'])) : null;
    $speed = isset($input['speed']) && is_numeric($input['speed']) ? max(0, min(100, (float)$input['speed'])) : null;
    $mocked = !empty($input['mocked']) ? 1 : 0;

    $stmt = $pdo->prepare('
        INSERT INTO user_locations (user_id, lat, lng, accuracy, heading, speed, mocked, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), accuracy = VALUES(accuracy), heading = VALUES(heading), speed = VALUES(speed), mocked = VALUES(mocked), updated_at = NOW()
    ');
    $stmt->execute([
        (int)$user['user_id'],
        number_format($lat, 7, '.', ''),
        number_format($lng, 7, '.', ''),
        $accuracy,
        $heading,
        $speed,
        $mocked,
    ]);

    return [
        'user_id' => (int)$user['user_id'],
        'lat' => $lat,
        'lng' => $lng,
        'updated_at' => gmdate('Y-m-d H:i:s'),
        'next_update_seconds' => max(5, mm_setting_int($pdo, 'location_update_seconds', 12)),
    ];
}

function mm_nearby_agents(PDO $pdo, array $user, array $input): array
{
    [$lat, $lng] = mm_validate_coordinates($input['lat'] ?? null, $input['lng'] ?? null);
    $network = trim((string)($input['network'] ?? ''));
    if ($network !== '') {
        $network = mm_validate_network($network);
    }
    $direction = trim((string)($input['direction'] ?? ''));
    if ($direction !== '') {
        $direction = mm_validate_direction($direction);
    }
    $amount = null;
    if ($direction !== '' && $network !== '') {
        $amount = mm_parse_money($input['amount'] ?? null, 'amount', false);
    }

    $radiusM = max(1000, mm_setting_int($pdo, 'nearby_search_radius_km', 10) * 1000);
    $limit = max(1, mm_setting_int($pdo, 'nearby_agent_limit', 12));
    $staleSeconds = mm_setting_int($pdo, 'agent_location_stale_seconds', 60);

    $stmt = $pdo->prepare('
        SELECT a.agent_id, a.business_name, a.rating_avg, a.rating_count, a.vehicle_description,
               u.fullname, u.avatar, l.lat, l.lng, l.updated_at
        FROM agent_profiles a
        JOIN agent_locations l ON l.agent_id = a.agent_id
        JOIN users u ON u.user_id = a.user_id
        WHERE a.verification_status = \'verified\'
          AND a.availability = \'available\'
          AND a.deleted_at IS NULL
          AND a.user_id <> ?
          AND l.updated_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
          AND a.agent_id NOT IN (SELECT agent_id FROM mm_blocks WHERE customer_id = ?)
    ');
    $stmt->execute([(int)$user['user_id'], $staleSeconds, (int)$user['user_id']]);
    $rows = $stmt->fetchAll();

    $agents = [];
    foreach ($rows as $row) {
        $distance = mm_haversine_m($lat, $lng, (float)$row['lat'], (float)$row['lng']);
        if ($distance > $radiusM) {
            continue;
        }

        $networkStmt = $pdo->prepare('SELECT network, min_amount, max_amount FROM agent_networks WHERE agent_id = ? AND deleted_at IS NULL ORDER BY network');
        $networkStmt->execute([(int)$row['agent_id']]);
        $networkRows = $networkStmt->fetchAll();
        $networkCodes = array_column($networkRows, 'network');

        if ($network !== '' && !in_array($network, $networkCodes, true)) {
            continue;
        }

        if ($amount !== null) {
            $side = $direction === 'withdrawal' ? 'cash' : 'float';
            $balanceColumn = $side . '_balance';
            $reservedColumn = $side . '_reserved';
            $liquidityStmt = $pdo->prepare("
                SELECT n.min_amount, n.max_amount, l.{$balanceColumn}, l.{$reservedColumn}
                FROM agent_networks n
                JOIN agent_liquidity l ON l.agent_id = n.agent_id AND l.network = n.network
                WHERE n.agent_id = ? AND n.network = ? AND n.deleted_at IS NULL
                LIMIT 1
            ");
            $liquidityStmt->execute([(int)$row['agent_id'], $network]);
            $band = $liquidityStmt->fetch();
            if (!$band || $amount < mm_parse_money($band['min_amount']) || $amount > mm_parse_money($band['max_amount'])) {
                continue;
            }
            $headroom = mm_parse_money($band[$balanceColumn]) - mm_parse_money($band[$reservedColumn]);
            if ($headroom < $amount) {
                continue;
            }
        }

        [$visibleLat, $visibleLng] = mm_coarsen((float)$row['lat'], (float)$row['lng'], 300);
        $agents[] = [
            'agent_id' => (int)$row['agent_id'],
            'name' => $row['fullname'],
            'business_name' => $row['business_name'],
            'avatar' => $row['avatar'],
            'vehicle_description' => $row['vehicle_description'],
            'rating_avg' => (float)$row['rating_avg'],
            'rating_count' => (int)$row['rating_count'],
            'distance_m' => round($distance, 1),
            'lat' => $visibleLat,
            'lng' => $visibleLng,
            'networks' => $networkCodes,
            'amount_range' => [
                'min' => $network !== '' ? ($networkRows[array_search($network, $networkCodes, true)]['min_amount'] ?? null) : null,
                'max' => $network !== '' ? ($networkRows[array_search($network, $networkCodes, true)]['max_amount'] ?? null) : null,
            ],
        ];
    }

    usort($agents, static fn(array $a, array $b): int => $a['distance_m'] <=> $b['distance_m']);

    return [
        'user' => ['lat' => $lat, 'lng' => $lng],
        'radius_m' => $radiusM,
        'agents' => array_slice($agents, 0, $limit),
        'total' => count($agents),
    ];
}

function mm_check_meeting(PDO $pdo, array $user, array $input): array
{
    [$lat, $lng] = mm_validate_coordinates($input['lat'] ?? null, $input['lng'] ?? null);
    $transactionId = (int)($input['transaction_id'] ?? 0);
    $tx = mm_transaction_by_id($pdo, $transactionId);
    if (!$tx) {
        mm_fail('Transaction not found.', 404, 'transaction_not_found');
    }

    $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
    if (!mm_can_access_transaction($tx, $user, $agent)) {
        mm_fail('You cannot access this transaction.', 403, 'forbidden');
    }
    if (!$tx['agent_id']) {
        mm_fail('An agent has not been assigned yet.', 409, 'agent_missing');
    }
    if (!in_array($tx['state'], ['accepted', 'agent_en_route', 'arrived', 'processing'], true)) {
        mm_fail('This transaction is not active.', 409, 'invalid_state');
    }

    $isCustomer = (int)$tx['customer_id'] === (int)$user['user_id'];
    if ($isCustomer) {
        $stmt = $pdo->prepare('SELECT lat, lng FROM user_locations WHERE user_id = ? LIMIT 1');
        $stmt->execute([(int)$tx['customer_id']]);
        $own = $stmt->fetch();
        $counterpartStmt = $pdo->prepare('SELECT lat, lng FROM agent_locations WHERE agent_id = ? LIMIT 1');
        $counterpartStmt->execute([(int)$tx['agent_id']]);
    } else {
        $stmt = $pdo->prepare('SELECT lat, lng FROM agent_locations WHERE agent_id = ? LIMIT 1');
        $stmt->execute([(int)$agent['agent_id']]);
        $own = $stmt->fetch();
        $counterpartStmt = $pdo->prepare('SELECT lat, lng FROM user_locations WHERE user_id = ? LIMIT 1');
        $counterpartStmt->execute([(int)$tx['customer_id']]);
    }

    $table = $isCustomer ? 'user_locations' : 'agent_locations';
    $idColumn = $isCustomer ? 'user_id' : 'agent_id';
    $ownId = $isCustomer ? (int)$tx['customer_id'] : (int)$agent['agent_id'];
    $upsert = $pdo->prepare("
        INSERT INTO {$table} ({$idColumn}, lat, lng, updated_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), updated_at = NOW()
    ");
    $upsert->execute([$ownId, number_format($lat, 7, '.', ''), number_format($lng, 7, '.', '')]);

    $counterpart = $counterpartStmt->fetch();
    if (!$counterpart || !$own) {
        mm_fail('Counterpart location is not available yet.', 409, 'counterpart_location_missing');
    }

    $distance = mm_haversine_m((float)$own['lat'], (float)$own['lng'], (float)$counterpart['lat'], (float)$counterpart['lng']);
    $radius = max(0.5, mm_setting_float($pdo, 'meeting_radius_m', 1.0));
    $met = $distance <= $radius;
    $state = $tx['state'];

    if ($met) {
        $stmt = $pdo->prepare('
            INSERT IGNORE INTO mm_meetings
            (transaction_id, customer_id, agent_id, distance_m, customer_lat, customer_lng, agent_lat, agent_lng, met_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ');
        $customerLocation = $isCustomer ? ['lat' => $lat, 'lng' => $lng] : $counterpart;
        $agentLocation = $isCustomer ? $counterpart : ['lat' => $lat, 'lng' => $lng];
        $stmt->execute([
            $transactionId,
            (int)$tx['customer_id'],
            (int)$tx['agent_id'],
            number_format($distance, 2, '.', ''),
            number_format((float)$customerLocation['lat'], 7, '.', ''),
            number_format((float)$customerLocation['lng'], 7, '.', ''),
            number_format((float)$agentLocation['lat'], 7, '.', ''),
            number_format((float)$agentLocation['lng'], 7, '.', ''),
        ]);

        if ($stmt->rowCount() > 0) {
            $stmt = $pdo->prepare('SELECT * FROM mm_meetings WHERE transaction_id = ? LIMIT 1');
            $stmt->execute([$transactionId]);
            $meeting = $stmt->fetch();
            mm_notify($pdo, (int)$tx['customer_id'], 'transaction.met', 'You have met your agent', 'Meeting distance was ' . number_format($distance, 1) . ' metres.', ['transaction_id' => $transactionId]);
            $stmt = $pdo->prepare('SELECT user_id FROM agent_profiles WHERE agent_id = ? LIMIT 1');
            $stmt->execute([(int)$tx['agent_id']]);
            $agentUserId = (int)$stmt->fetchColumn();
            if ($agentUserId) {
                mm_notify($pdo, $agentUserId, 'transaction.met', 'You have met the customer', 'Meeting distance was ' . number_format($distance, 1) . ' metres.', ['transaction_id' => $transactionId]);
            }
            if (in_array($tx['state'], ['accepted', 'agent_en_route'], true)) {
                $updated = mm_transition($pdo, $transactionId, 'arrived', 'system', null, ['reason' => 'proximity_met']);
                $state = $updated['state'];
            }
        }
    }

    $stmt = $pdo->prepare('SELECT * FROM mm_meetings WHERE transaction_id = ? LIMIT 1');
    $stmt->execute([$transactionId]);
    $meeting = $stmt->fetch() ?: null;

    return [
        'met' => $met || $meeting !== null,
        'distance_m' => round($distance, 2),
        'radius_m' => $radius,
        'state' => $state,
        'meeting' => $meeting ? [
            'meeting_id' => (int)$meeting['meeting_id'],
            'distance_m' => (float)$meeting['distance_m'],
            'met_at' => $meeting['met_at'],
        ] : null,
    ];
}
