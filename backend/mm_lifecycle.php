<?php
require_once __DIR__ . '/mm_core.php';
require_once __DIR__ . '/mm_availability.php';

function mm_transaction_by_id(PDO $pdo, int $transactionId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM mm_transactions WHERE transaction_id = ? AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([$transactionId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function mm_require_transaction_access(PDO $pdo, int $transactionId, array $user, ?array $agent): array
{
    $tx = mm_transaction_by_id($pdo, $transactionId);
    if (!$tx) {
        mm_fail('Transaction not found.', 404, 'transaction_not_found');
    }
    if (!mm_can_access_transaction($tx, $user, $agent)) {
        mm_fail('You cannot access this transaction.', 403, 'forbidden');
    }
    return $tx;
}

function mm_transaction_details(PDO $pdo, array $tx, array $user, ?array $agent): array
{
    $viewerRole = (int)$tx['customer_id'] === (int)$user['user_id'] ? 'customer' : 'agent';
    if (mm_is_admin($user)) {
        $viewerRole = 'admin';
    }
    $payload = mm_transaction_public($pdo, $tx, $user);
    $payload['location'] = mm_location_for_transaction($pdo, $tx, $viewerRole);
    $payload['route'] = null;
    if ($tx['agent_id'] && $payload['location']) {
        $stmt = $pdo->prepare('SELECT lat, lng FROM agent_locations WHERE agent_id = ? LIMIT 1');
        $stmt->execute([$tx['agent_id']]);
        $agentLive = $stmt->fetch();
        if (!$agentLive) {
            $stmt = $pdo->prepare('SELECT lat, lng FROM agent_profiles WHERE agent_id = ? LIMIT 1');
            $stmt->execute([$tx['agent_id']]);
            $agentLive = $stmt->fetch();
        }
        $stmt = $pdo->prepare('SELECT pickup_lat, pickup_lng FROM mm_requests WHERE request_id = ? LIMIT 1');
        $stmt->execute([$tx['request_id']]);
        $pickup = $stmt->fetch();
        if ($agentLive && $pickup) {
            $agentPoint = [(float)$agentLive['lat'], (float)$agentLive['lng']];
            $pickupPoint = [(float)$pickup['pickup_lat'], (float)$pickup['pickup_lng']];
            if ($viewerRole === 'agent') {
                $payload['route'] = mm_route($pdo, $pickupPoint[0], $pickupPoint[1], $agentPoint[0], $agentPoint[1]);
            } else {
                $payload['route'] = mm_route($pdo, $agentPoint[0], $agentPoint[1], $pickupPoint[0], $pickupPoint[1]);
            }
        }
    }
    $stmt = $pdo->prepare('SELECT meeting_id, distance_m, met_at FROM mm_meetings WHERE transaction_id = ? LIMIT 1');
    $stmt->execute([$tx['transaction_id']]);
    $meetingRow = $stmt->fetch();
    $payload['meeting'] = $meetingRow ? [
        'meeting_id' => (int)$meetingRow['meeting_id'],
        'distance_m' => (float)$meetingRow['distance_m'],
        'met_at' => $meetingRow['met_at'],
    ] : null;
    $payload['timeline'] = [
        'accepted_at' => $tx['accepted_at'],
        'en_route_at' => $tx['en_route_at'],
        'arrived_at' => $tx['arrived_at'],
        'processing_at' => $tx['processing_at'],
        'completed_at' => $tx['completed_at'],
    ];
    return $payload;
}

function mm_agent_transition(PDO $pdo, array $user, array $agent, array $input): array
{
    $action = strtolower(trim((string)($input['action'] ?? '')));
    $target = [
        'en_route' => 'agent_en_route',
        'arrived' => 'arrived',
        'processing' => 'processing',
    ][$action] ?? '';
    if ($target === '') {
        mm_fail('Unknown agent transition.', 400, 'invalid_action');
    }

    $pdo->beginTransaction();
    try {
        $tx = mm_require_transaction_access($pdo, (int)($input['transaction_id'] ?? 0), $user, $agent);
        if ((int)$tx['agent_id'] !== (int)$agent['agent_id']) {
            mm_fail('This is not your assigned job.', 403, 'forbidden');
        }
        $updated = mm_transition($pdo, (int)$tx['transaction_id'], $target, 'agent', (int)$user['user_id']);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    return ['transaction_id' => (int)$updated['transaction_id'], 'state' => $updated['state']];
}

function mm_confirm_transaction(PDO $pdo, array $user, ?array $agent, array $input): array
{
    $transactionId = (int)($input['transaction_id'] ?? 0);
    $role = strtolower(trim((string)($input['role'] ?? '')));
    if (!in_array($role, ['customer', 'agent'], true)) {
        mm_fail('Confirmation role must be customer or agent.', 400, 'invalid_role');
    }

    $pdo->beginTransaction();
    try {
        $tx = mm_require_transaction_access($pdo, $transactionId, $user, $agent);
        if ($role === 'customer' && (int)$tx['customer_id'] !== (int)$user['user_id']) {
            mm_fail('Only the customer can confirm as customer.', 403, 'forbidden');
        }
        if ($role === 'agent' && (!$agent || (int)$tx['agent_id'] !== (int)$agent['agent_id'])) {
            mm_fail('Only the assigned agent can confirm as agent.', 403, 'forbidden');
        }
        if ($tx['state'] !== 'processing') {
            mm_fail('Confirmation is only available during processing.', 409, 'invalid_state');
        }

        if ($role === 'agent') {
            if (empty($tx['customer_confirmed_at'])) {
                mm_fail('Wait for the customer to confirm before entering the handover code.', 409, 'customer_not_confirmed');
            }
            if ($tx['handover_locked_until'] && strtotime($tx['handover_locked_until']) > time()) {
                mm_fail('Handover code is temporarily locked. Try again later.', 429, 'handover_locked');
            }
            $code = preg_replace('/\D/', '', (string)($input['handover_code'] ?? ''));
            if (!hash_equals((string)$tx['handover_code'], $code)) {
                $attempts = (int)$tx['handover_attempts'] + 1;
                $maxAttempts = mm_setting_int($pdo, 'handover_max_attempts', 5);
                $lockSeconds = mm_setting_int($pdo, 'handover_lock_seconds', 300);
                $updates = 'handover_attempts = ?';
                $params = [$attempts];
                if ($attempts >= $maxAttempts) {
                    $updates .= ', handover_locked_until = DATE_ADD(NOW(), INTERVAL ? SECOND), handover_attempts = 0';
                    $params[] = $lockSeconds;
                }
                $params[] = $transactionId;
                $stmt = $pdo->prepare('UPDATE mm_transactions SET ' . $updates . ' WHERE transaction_id = ?');
                $stmt->execute($params);
                mm_audit($pdo, 'mm_transaction', $transactionId, $transactionId, 'handover_code_failed', null, null, 'agent', (int)$user['user_id']);
                $pdo->commit();
                mm_fail('Handover code is incorrect.', 400, 'invalid_handover_code', ['attempts_left' => max(0, $maxAttempts - $attempts)]);
            }
            $stmt = $pdo->prepare('UPDATE mm_transactions SET handover_attempts = 0, handover_locked_until = NULL, agent_confirmed_at = NOW() WHERE transaction_id = ?');
            $stmt->execute([$transactionId]);
        } else {
            $stmt = $pdo->prepare('UPDATE mm_transactions SET customer_confirmed_at = NOW() WHERE transaction_id = ?');
            $stmt->execute([$transactionId]);
        }

        $stmt = $pdo->prepare('SELECT customer_confirmed_at, agent_confirmed_at FROM mm_transactions WHERE transaction_id = ? LIMIT 1');
        $stmt->execute([$transactionId]);
        $confirmations = $stmt->fetch();
        $state = 'processing';
        if ($confirmations['customer_confirmed_at'] && $confirmations['agent_confirmed_at']) {
            $updated = mm_transition($pdo, $transactionId, 'completed', 'system', null);
            $state = $updated['state'];
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return [
        'transaction_id' => $transactionId,
        'state' => $state,
        'customer_confirmed' => (bool)$confirmations['customer_confirmed_at'],
        'agent_confirmed' => (bool)$confirmations['agent_confirmed_at'],
    ];
}

function mm_cancel_transaction(PDO $pdo, array $user, ?array $agent, array $input): array
{
    $pdo->beginTransaction();
    try {
        $tx = mm_require_transaction_access($pdo, (int)($input['transaction_id'] ?? 0), $user, $agent);
        if (!in_array($tx['state'], ['searching', 'accepted', 'agent_en_route', 'arrived'], true)) {
            mm_fail('This transaction can no longer be cancelled.', 409, 'invalid_state');
        }
        $actorType = (int)$tx['customer_id'] === (int)$user['user_id'] ? 'customer' : 'agent';
        $reason = substr(trim((string)($input['reason'] ?? 'Cancelled by participant')), 0, 255);
        $updated = mm_transition($pdo, (int)$tx['transaction_id'], 'cancelled', $actorType, (int)$user['user_id'], ['reason' => $reason]);
        $stmt = $pdo->prepare("UPDATE mm_offers SET state = 'cancelled', responded_at = NOW() WHERE request_id = ? AND state = 'offered'");
        $stmt->execute([$tx['request_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    return ['transaction_id' => (int)$updated['transaction_id'], 'state' => $updated['state']];
}

function mm_dispute_transaction(PDO $pdo, array $user, ?array $agent, array $input): array
{
    $reason = trim((string)($input['reason'] ?? ''));
    if (mb_strlen($reason) < 5 || mb_strlen($reason) > 255) {
        mm_fail('Give a dispute reason between 5 and 255 characters.', 400, 'invalid_reason');
    }

    $pdo->beginTransaction();
    try {
        $tx = mm_require_transaction_access($pdo, (int)($input['transaction_id'] ?? 0), $user, $agent);
        if (!in_array($tx['state'], ['accepted', 'agent_en_route', 'arrived', 'processing'], true)) {
            mm_fail('This transaction cannot be disputed.', 409, 'invalid_state');
        }
        $actorType = (int)$tx['customer_id'] === (int)$user['user_id'] ? 'customer' : 'agent';
        $reportedUserId = $actorType === 'customer'
            ? (int)($agent ? $agent['user_id'] : 0)
            : (int)$tx['customer_id'];
        $updated = mm_transition($pdo, (int)$tx['transaction_id'], 'disputed', $actorType, (int)$user['user_id'], ['reason' => $reason]);
        $stmt = $pdo->prepare('INSERT INTO mm_reports (transaction_id, reporter_id, reported_user_id, reason, details) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$tx['transaction_id'], $user['user_id'], $reportedUserId ?: null, 'other', $reason]);
        $stmt = $pdo->prepare("UPDATE mm_offers SET state = 'cancelled', responded_at = NOW() WHERE request_id = ? AND state = 'offered'");
        $stmt->execute([$tx['request_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    return ['transaction_id' => (int)$updated['transaction_id'], 'state' => $updated['state']];
}

function mm_rate_transaction(PDO $pdo, array $user, ?array $agent, array $input): array
{
    $rating = (int)($input['rating'] ?? 0);
    $comment = trim((string)($input['comment'] ?? ''));
    if ($rating < 1 || $rating > 5) {
        mm_fail('Rating must be between 1 and 5.', 400, 'invalid_rating');
    }

    $pdo->beginTransaction();
    try {
        $tx = mm_require_transaction_access($pdo, (int)($input['transaction_id'] ?? 0), $user, $agent);
        if ((int)$tx['customer_id'] !== (int)$user['user_id']) {
            mm_fail('Only the customer can rate the agent.', 403, 'forbidden');
        }
        if ($tx['state'] !== 'completed') {
            mm_fail('You can only rate completed transactions.', 409, 'invalid_state');
        }
        if (!$tx['agent_id']) {
            mm_fail('This transaction has no agent to rate.', 409, 'agent_missing');
        }
        $stmt = $pdo->prepare('INSERT INTO mm_ratings (transaction_id, customer_id, agent_id, rating, comment) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$tx['transaction_id'], $user['user_id'], $tx['agent_id'], $rating, $comment !== '' ? $comment : null]);
        mm_refresh_agent_stats($pdo, (int)$tx['agent_id']);
        $stmt = $pdo->prepare('SELECT user_id FROM agent_profiles WHERE agent_id = ? LIMIT 1');
        $stmt->execute([$tx['agent_id']]);
        $agentUserId = (int)$stmt->fetchColumn();
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if (($e->errorInfo[1] ?? null) === 1062) {
            mm_fail('You have already rated this transaction.', 409, 'already_rated');
        }
        throw $e;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    if ($agentUserId) {
        mm_notify($pdo, $agentUserId, 'rating.new', 'New rating', 'A customer rated your service.', ['transaction_id' => (int)$tx['transaction_id'], 'rating' => $rating]);
    }
    return ['transaction_id' => (int)$tx['transaction_id'], 'rating' => $rating];
}

function mm_admin_transactions(PDO $pdo, string $status = ''): array
{
    $sql = 'SELECT * FROM mm_transactions';
    $params = [];
    if ($status !== '') {
        $sql .= ' WHERE state = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY created_at DESC LIMIT 200';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = [];
    foreach ($stmt->fetchAll() as $tx) {
        $rows[] = [
            'transaction_id' => (int)$tx['transaction_id'],
            'request_id' => (int)$tx['request_id'],
            'state' => $tx['state'],
            'direction' => $tx['direction'],
            'network' => $tx['network'],
            'amount' => $tx['amount'],
            'agent_id' => $tx['agent_id'] ? (int)$tx['agent_id'] : null,
            'customer_id' => (int)$tx['customer_id'],
            'created_at' => $tx['created_at'],
        ];
    }
    return $rows;
}

function mm_admin_resolve_transaction(PDO $pdo, array $user, array $input): array
{
    mm_require_admin($user);
    $decision = strtolower(trim((string)($input['decision'] ?? '')));
    if (!in_array($decision, ['complete', 'cancel'], true)) {
        mm_fail('Decision must be complete or cancel.', 400, 'invalid_decision');
    }

    $pdo->beginTransaction();
    try {
        $tx = mm_require_transaction_access($pdo, (int)($input['transaction_id'] ?? 0), $user, null);
        if ($tx['state'] !== 'disputed') {
            mm_fail('Only disputed transactions can be resolved.', 409, 'invalid_state');
        }
        $target = $decision === 'complete' ? 'completed' : 'cancelled';
        $updated = mm_transition($pdo, (int)$tx['transaction_id'], $target, 'admin', (int)$user['user_id'], ['reason' => substr(trim((string)($input['notes'] ?? 'Resolved by administrator')), 0, 255)]);
        $stmt = $pdo->prepare('UPDATE mm_transactions SET resolved_by = ?, resolved_at = NOW(), resolution_notes = ? WHERE transaction_id = ?');
        $stmt->execute([$user['user_id'], substr(trim((string)($input['notes'] ?? '')), 0, 1000), $tx['transaction_id']]);
        $stmt = $pdo->prepare("UPDATE mm_reports SET status = 'resolved', resolved_by = ?, resolved_at = NOW(), resolution_notes = ? WHERE transaction_id = ? AND status = 'open'");
        $stmt->execute([$user['user_id'], substr(trim((string)($input['notes'] ?? '')), 0, 1000), $tx['transaction_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    return ['transaction_id' => (int)$updated['transaction_id'], 'state' => $updated['state']];
}
