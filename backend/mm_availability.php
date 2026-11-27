<?php
require_once __DIR__ . '/mm_core.php';

function mm_has_liquidity(PDO $pdo, int $agentId): bool
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM agent_liquidity WHERE agent_id = ? AND (cash_balance > 0 OR float_balance > 0)');
    $stmt->execute([$agentId]);
    return (int)$stmt->fetchColumn() > 0;
}

function mm_has_active_job(PDO $pdo, int $agentId): bool
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM mm_transactions WHERE agent_id = ? AND state IN ('accepted','agent_en_route','arrived','processing')");
    $stmt->execute([$agentId]);
    return (int)$stmt->fetchColumn() > 0;
}

function mm_set_availability(PDO $pdo, array $user, array $agent, string $state): array
{
    $state = strtolower(trim($state));
    if (!in_array($state, ['available', 'busy', 'offline'], true)) {
        mm_fail('Availability must be available, busy, or offline.', 400, 'invalid_availability');
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM agent_profiles WHERE agent_id = ? FOR UPDATE');
        $stmt->execute([$agent['agent_id']]);
        $current = $stmt->fetch();

        if ($current['verification_status'] !== 'verified') {
            mm_fail('Only verified agents can change availability.', 403, 'agent_not_verified');
        }

        $activeJob = mm_has_active_job($pdo, (int)$current['agent_id']);
        $hasLiquidity = mm_has_liquidity($pdo, (int)$current['agent_id']);

        if ($state === 'available') {
            if ($activeJob) {
                mm_fail('Finish or dispute the active job before going available.', 409, 'active_job_exists');
            }
            if (!$hasLiquidity) {
                mm_fail('Declare cash or float liquidity before going available.', 409, 'liquidity_required');
            }
            $staleSeconds = mm_setting_int($pdo, 'agent_location_stale_seconds', 60);
            $stmt = $pdo->prepare('SELECT updated_at FROM agent_locations WHERE agent_id = ? LIMIT 1');
            $stmt->execute([$current['agent_id']]);
            $locationUpdatedAt = $stmt->fetchColumn();
            if (!$locationUpdatedAt || (time() - strtotime((string)$locationUpdatedAt)) > $staleSeconds) {
                mm_fail('A fresh foreground location is required before going available.', 409, 'fresh_location_required');
            }
        }

        if ($state === 'busy' && !$activeJob) {
            mm_fail('Busy is set automatically when a job is accepted.', 409, 'invalid_availability');
        }

        $stmt = $pdo->prepare('UPDATE agent_profiles SET availability = ? WHERE agent_id = ?');
        $stmt->execute([$state, $current['agent_id']]);

        mm_audit($pdo, 'agent_profile', (int)$current['agent_id'], null, 'availability', $current['availability'], $state, 'agent', (int)$user['user_id']);

        if ($state === 'offline') {
            $stmt = $pdo->prepare('DELETE FROM agent_locations WHERE agent_id = ?');
            $stmt->execute([$current['agent_id']]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return [
        'agent_id' => (int)$current['agent_id'],
        'availability' => $state,
        'location_required' => $state === 'available',
        'message' => $state === 'available'
            ? 'Keep the app open while available. If you leave the app, your location becomes stale and you stop receiving offers.'
            : null,
    ];
}

function mm_update_location(PDO $pdo, array $user, array $agent, array $input): array
{
    [$lat, $lng] = mm_validate_coordinates($input['lat'] ?? null, $input['lng'] ?? null);
    $accuracy = isset($input['accuracy']) && is_numeric($input['accuracy']) ? max(0, min(10000, (float)$input['accuracy'])) : null;
    $heading = isset($input['heading']) && is_numeric($input['heading']) ? max(0, min(360, (float)$input['heading'])) : null;
    $speed = isset($input['speed']) && is_numeric($input['speed']) ? max(0, min(100, (float)$input['speed'])) : null;
    $mocked = !empty($input['mocked']) ? 1 : 0;
    $transactionId = (int)($input['transaction_id'] ?? 0);

    $interval = max(5, mm_setting_int($pdo, 'location_update_seconds', 12));
    mm_rate_limit($pdo, 'agent_location', 3, $interval, 'agent:' . $agent['agent_id']);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM agent_locations WHERE agent_id = ? FOR UPDATE');
        $stmt->execute([$agent['agent_id']]);
        $previous = $stmt->fetch();

        if ($previous) {
            $elapsed = max(1, time() - strtotime($previous['updated_at']));
            $distance = mm_haversine_m((float)$previous['lat'], (float)$previous['lng'], $lat, $lng);
            $jumpLimit = mm_setting_int($pdo, 'max_location_jump_meters', 1500) * max(1, (int)ceil($elapsed / $interval));
            if ($distance > $jumpLimit && $elapsed < 60) {
                mm_fail('Location jump rejected as impossible.', 422, 'impossible_location_jump');
            }
        }

        if ($agent['verification_status'] !== 'verified') {
            mm_fail('Only verified agents can send location updates.', 403, 'agent_not_verified');
        }

        $stmt = $pdo->prepare('
            INSERT INTO agent_locations (agent_id, lat, lng, accuracy, heading, speed, mocked, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), accuracy = VALUES(accuracy), heading = VALUES(heading), speed = VALUES(speed), mocked = VALUES(mocked), updated_at = NOW()
        ');
        $stmt->execute([
            $agent['agent_id'],
            number_format($lat, 7, '.', ''),
            number_format($lng, 7, '.', ''),
            $accuracy,
            $heading,
            $speed,
            $mocked,
        ]);

        if ($transactionId > 0 && mm_has_active_job($pdo, (int)$agent['agent_id'])) {
            $stmt = $pdo->prepare('SELECT 1 FROM mm_transactions WHERE transaction_id = ? AND agent_id = ? AND state IN (\'accepted\',\'agent_en_route\',\'arrived\',\'processing\') LIMIT 1');
            $stmt->execute([$transactionId, $agent['agent_id']]);
            if ($stmt->fetchColumn()) {
                $stmt = $pdo->prepare('INSERT INTO agent_location_history (agent_id, transaction_id, lat, lng, accuracy, heading) VALUES (?, ?, ?, ?, ?, ?)');
                $stmt->execute([$agent['agent_id'], $transactionId, number_format($lat, 7, '.', ''), number_format($lng, 7, '.', ''), $accuracy, $heading]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return [
        'agent_id' => (int)$agent['agent_id'],
        'updated_at' => gmdate('Y-m-d H:i:s'),
        'next_update_seconds' => $interval,
    ];
}

function mm_location_for_transaction(PDO $pdo, array $tx, string $viewerRole): ?array
{
    if (!in_array($tx['state'], ['accepted', 'agent_en_route', 'arrived', 'processing', 'completed'], true)) {
        return null;
    }

    if ($viewerRole === 'agent') {
        $stmt = $pdo->prepare('SELECT lat, lng, updated_at FROM user_locations WHERE user_id = ? LIMIT 1');
        $stmt->execute([(int)$tx['customer_id']]);
        $row = $stmt->fetch();
        if (!$row) {
            $stmt = $pdo->prepare('SELECT pickup_lat AS lat, pickup_lng AS lng, created_at AS updated_at FROM mm_requests WHERE request_id = ? LIMIT 1');
            $stmt->execute([$tx['request_id']]);
            $row = $stmt->fetch();
        }
    } elseif ($viewerRole === 'customer' && !empty($tx['agent_id'])) {
        $stmt = $pdo->prepare('SELECT lat, lng, accuracy, heading, updated_at FROM agent_locations WHERE agent_id = ? LIMIT 1');
        $stmt->execute([$tx['agent_id']]);
        $row = $stmt->fetch();
        if (!$row) {
            $stmt = $pdo->prepare('SELECT lat, lng, NULL AS accuracy, NULL AS heading, NULL AS updated_at FROM agent_profiles WHERE agent_id = ? LIMIT 1');
            $stmt->execute([$tx['agent_id']]);
            $row = $stmt->fetch();
        }
    } else {
        return null;
    }

    if (!$row) {
        return null;
    }

    return [
        'lat' => $row['lat'],
        'lng' => $row['lng'],
        'accuracy' => $row['accuracy'] ?? null,
        'heading' => $row['heading'] ?? null,
        'updated_at' => $row['updated_at'],
    ];
}
