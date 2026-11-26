<?php
require_once __DIR__ . '/mm_core.php';
require_once __DIR__ . '/mm_uploads.php';

function mm_parse_network_list($value): array
{
    if (is_array($value)) {
        $raw = $value;
    } elseif (is_string($value)) {
        $decoded = json_decode($value, true);
        $raw = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode(',', $value)));
    } else {
        $raw = [];
    }

    $networks = [];
    foreach ($raw as $network) {
        $network = mm_validate_network($network);
        if (!in_array($network, $networks, true)) {
            $networks[] = $network;
        }
    }

    if (!$networks || count($networks) > 3) {
        mm_fail('Select one to three supported networks.', 400, 'invalid_networks');
    }
    return $networks;
}

function mm_agent_payload(PDO $pdo, array $agent, array $user): array
{
    $stmt = $pdo->prepare('SELECT network_id, network, agent_code, min_amount, max_amount FROM agent_networks WHERE agent_id = ? AND deleted_at IS NULL ORDER BY network');
    $stmt->execute([$agent['agent_id']]);
    $networks = $stmt->fetchAll();

    $stmt = $pdo->prepare('SELECT network, cash_balance, cash_reserved, float_balance, float_reserved FROM agent_liquidity WHERE agent_id = ? ORDER BY network');
    $stmt->execute([$agent['agent_id']]);
    $liquidityRows = $stmt->fetchAll();
    $liquidity = [];
    foreach ($liquidityRows as $row) {
        $cashBalance = mm_parse_money($row['cash_balance']);
        $cashReserved = mm_parse_money($row['cash_reserved']);
        $floatBalance = mm_parse_money($row['float_balance']);
        $floatReserved = mm_parse_money($row['float_reserved']);
        $liquidity[$row['network']] = [
            'cash_balance' => $row['cash_balance'],
            'cash_reserved' => $row['cash_reserved'],
            'cash_available' => mm_ngwee_to_decimal(max(0, $cashBalance - $cashReserved)),
            'float_balance' => $row['float_balance'],
            'float_reserved' => $row['float_reserved'],
            'float_available' => mm_ngwee_to_decimal(max(0, $floatBalance - $floatReserved)),
        ];
    }

    $stmt = $pdo->prepare('SELECT lat, lng, accuracy, heading, speed, mocked, updated_at FROM agent_locations WHERE agent_id = ? LIMIT 1');
    $stmt->execute([$agent['agent_id']]);
    $location = $stmt->fetch() ?: null;
    if ($location) {
        $staleSeconds = mm_setting_int($pdo, 'agent_location_stale_seconds', 60);
        $location['is_stale'] = (time() - strtotime($location['updated_at'])) > $staleSeconds;
    }

    return [
        'agent_id' => (int)$agent['agent_id'],
        'user_id' => (int)$user['user_id'],
        'name' => $user['fullname'],
        'phone' => $user['phone_number'],
        'avatar' => $user['avatar'],
        'business_name' => $agent['business_name'],
        'address_text' => $agent['address_text'],
        'lat' => $agent['lat'],
        'lng' => $agent['lng'],
        'nrc_number' => $agent['nrc_number'],
        'vehicle_description' => $agent['vehicle_description'],
        'verification_status' => $agent['verification_status'],
        'rejection_reason' => $agent['rejection_reason'],
        'reviewed_at' => $agent['reviewed_at'],
        'availability' => $agent['availability'],
        'location' => $location,
        'rating_avg' => $agent['rating_avg'],
        'rating_count' => (int)$agent['rating_count'],
        'acceptance_rate' => $agent['acceptance_rate'],
        'completion_rate' => $agent['completion_rate'],
        'networks' => $networks,
        'liquidity' => $liquidity,
        'documents' => [
            'nrc_front' => $agent['nrc_front_path'],
            'nrc_back' => $agent['nrc_back_path'],
            'selfie' => $agent['selfie_path'],
        ],
    ];
}

function mm_save_agent_profile(PDO $pdo, array $user, array $input): array
{
    $businessName = trim((string)($input['business_name'] ?? ''));
    $address = trim((string)($input['address_text'] ?? ''));
    $nrc = strtoupper(trim((string)($input['nrc_number'] ?? '')));
    $vehicle = trim((string)($input['vehicle_description'] ?? ''));

    if (mb_strlen($businessName) < 3 || mb_strlen($businessName) > 150) {
        mm_fail('Business name must be between 3 and 150 characters.', 400, 'invalid_business_name');
    }
    if (mb_strlen($address) < 3 || mb_strlen($address) > 255) {
        mm_fail('Business address must be between 3 and 255 characters.', 400, 'invalid_address');
    }
    if (!preg_match('/^[A-Z0-9\-]{6,30}$/', $nrc)) {
        mm_fail('Enter a valid NRC number.', 400, 'invalid_nrc');
    }
    [$lat, $lng] = mm_validate_coordinates($input['lat'] ?? null, $input['lng'] ?? null);
    $networks = mm_parse_network_list($input['networks'] ?? []);
    $codes = $input['agent_codes'] ?? [];
    if (is_string($codes)) {
        $decoded = json_decode($codes, true);
        $codes = is_array($decoded) ? $decoded : [];
    }

    $minGlobal = mm_setting_money($pdo, 'min_amount', 1000);
    $maxGlobal = mm_setting_money($pdo, 'max_amount', 500000);
    $bandInput = $input['network_bands'] ?? [];
    if (is_string($bandInput)) {
        $decoded = json_decode($bandInput, true);
        $bandInput = is_array($decoded) ? $decoded : [];
    }

    $stmt = $pdo->prepare('SELECT * FROM agent_profiles WHERE user_id = ? AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([$user['user_id']]);
    $existing = $stmt->fetch();

    if ($existing && $existing['verification_status'] === 'suspended') {
        mm_fail('Suspended agent profiles cannot be edited.', 403, 'agent_suspended');
    }

    $front = mm_store_agent_image('nrc_front', (int)$user['user_id'], 'NRC front');
    $back = mm_store_agent_image('nrc_back', (int)$user['user_id'], 'NRC back');
    $selfie = mm_store_agent_image('selfie', (int)$user['user_id'], 'Selfie');

    $front = $front ?: ($existing['nrc_front_path'] ?? null);
    $back = $back ?: ($existing['nrc_back_path'] ?? null);
    $selfie = $selfie ?: ($existing['selfie_path'] ?? null);

    if (!$selfie || (!$front && !$back)) {
        mm_fail('A selfie and at least one NRC photo are required.', 400, 'documents_required');
    }

    $kycChanged = !$existing
        || $nrc !== ($existing['nrc_number'] ?? '')
        || ($front && $front !== ($existing['nrc_front_path'] ?? null))
        || ($back && $back !== ($existing['nrc_back_path'] ?? null))
        || ($selfie && $selfie !== ($existing['selfie_path'] ?? null));

    $pdo->beginTransaction();
    try {
        if ($existing) {
            $status = $kycChanged ? 'pending' : $existing['verification_status'];
            $stmt = $pdo->prepare('
                UPDATE agent_profiles
                SET business_name = ?, address_text = ?, lat = ?, lng = ?, nrc_number = ?, nrc_front_path = ?, nrc_back_path = ?, selfie_path = ?,
                    vehicle_description = ?, verification_status = ?, rejection_reason = CASE WHEN ? = \'pending\' THEN NULL ELSE rejection_reason END,
                    reviewed_by = CASE WHEN ? = \'pending\' THEN NULL ELSE reviewed_by END,
                    reviewed_at = CASE WHEN ? = \'pending\' THEN NULL ELSE reviewed_at END
                WHERE agent_id = ?
            ');
            $stmt->execute([
                $businessName, $address, number_format($lat, 7, '.', ''), number_format($lng, 7, '.', ''), $nrc, $front, $back, $selfie,
                $vehicle ?: null, $status, $status, $status, $status, $existing['agent_id'],
            ]);
            $agentId = (int)$existing['agent_id'];
        } else {
            $stmt = $pdo->prepare('
                INSERT INTO agent_profiles (user_id, business_name, address_text, lat, lng, nrc_number, nrc_front_path, nrc_back_path, selfie_path, vehicle_description, verification_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'pending\')
            ');
            $stmt->execute([
                $user['user_id'], $businessName, $address, number_format($lat, 7, '.', ''), number_format($lng, 7, '.', ''), $nrc, $front, $back, $selfie, $vehicle ?: null,
            ]);
            $agentId = (int)$pdo->lastInsertId();
        }

        foreach ($networks as $network) {
            $band = $bandInput[$network] ?? [];
            $bandMin = isset($band['min_amount']) ? mm_parse_money($band['min_amount'], 'min_amount', false) : $minGlobal;
            $bandMax = isset($band['max_amount']) ? mm_parse_money($band['max_amount'], 'max_amount', false) : $maxGlobal;
            if ($bandMin < $minGlobal || $bandMax > $maxGlobal || $bandMin >= $bandMax) {
                mm_fail('Amount limits for ' . $network . ' are invalid.', 400, 'invalid_amount_band');
            }

            $code = isset($codes[$network]) ? substr(trim((string)$codes[$network]), 0, 100) : null;
            $stmt = $pdo->prepare('SELECT network_id FROM agent_networks WHERE agent_id = ? AND network = ? LIMIT 1');
            $stmt->execute([$agentId, $network]);
            $networkId = $stmt->fetchColumn();

            if ($networkId) {
                $stmt = $pdo->prepare('UPDATE agent_networks SET agent_code = ?, min_amount = ?, max_amount = ?, deleted_at = NULL WHERE network_id = ?');
                $stmt->execute([$code ?: null, mm_ngwee_to_decimal($bandMin), mm_ngwee_to_decimal($bandMax), $networkId]);
            } else {
                $stmt = $pdo->prepare('INSERT INTO agent_networks (agent_id, network, agent_code, min_amount, max_amount) VALUES (?, ?, ?, ?, ?)');
                $stmt->execute([$agentId, $network, $code ?: null, mm_ngwee_to_decimal($bandMin), mm_ngwee_to_decimal($bandMax)]);
            }

            $stmt = $pdo->prepare('INSERT IGNORE INTO agent_liquidity (agent_id, network) VALUES (?, ?)');
            $stmt->execute([$agentId, $network]);
        }

        $placeholders = implode(',', array_fill(0, count($networks), '?'));
        $params = array_merge([$agentId], $networks);
        $stmt = $pdo->prepare("UPDATE agent_networks SET deleted_at = NOW() WHERE agent_id = ? AND deleted_at IS NULL AND network NOT IN ($placeholders)");
        $stmt->execute($params);

        mm_audit($pdo, 'agent_profile', $agentId, null, $existing ? 'profile_update' : 'profile_create', null, $kycChanged ? 'pending' : ($existing['verification_status'] ?? 'pending'), 'agent', (int)$user['user_id']);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $stmt = $pdo->prepare('SELECT * FROM agent_profiles WHERE agent_id = ? LIMIT 1');
    $stmt->execute([$agentId]);
    return mm_agent_payload($pdo, $stmt->fetch(), $user);
}

function mm_update_liquidity(PDO $pdo, array $user, array $agent, array $input): array
{
    $network = mm_validate_network($input['network'] ?? '');
    $cash = mm_parse_money($input['cash_balance'] ?? null, 'cash_balance', true);
    $float = mm_parse_money($input['float_balance'] ?? null, 'float_balance', true);
    $cap = mm_setting_money($pdo, 'liquidity_max_declaration', 50000000);

    if ($cash > $cap || $float > $cap) {
        mm_fail('Declared liquidity exceeds the configured maximum.', 400, 'liquidity_cap_exceeded');
    }

    $stmt = $pdo->prepare('SELECT network_id FROM agent_networks WHERE agent_id = ? AND network = ? AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([$agent['agent_id'], $network]);
    if (!$stmt->fetchColumn()) {
        mm_fail('Network is not enabled on your agent profile.', 403, 'network_not_enabled');
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM agent_liquidity WHERE agent_id = ? AND network = ? FOR UPDATE');
        $stmt->execute([$agent['agent_id'], $network]);
        $liquidity = $stmt->fetch();
        if (!$liquidity) {
            mm_fail('Liquidity row not found.', 404, 'liquidity_missing');
        }

        $cashBefore = mm_parse_money($liquidity['cash_balance']);
        $floatBefore = mm_parse_money($liquidity['float_balance']);
        $cashReserved = mm_parse_money($liquidity['cash_reserved']);
        $floatReserved = mm_parse_money($liquidity['float_reserved']);

        if ($cash < $cashReserved || $float < $floatReserved) {
            mm_fail('Balance cannot be lower than the reserved amount.', 400, 'balance_below_reserved');
        }

        $stmt = $pdo->prepare('UPDATE agent_liquidity SET cash_balance = ?, float_balance = ? WHERE liquidity_id = ?');
        $stmt->execute([mm_ngwee_to_decimal($cash), mm_ngwee_to_decimal($float), $liquidity['liquidity_id']]);

        foreach ([['cash', $cashBefore, $cash], ['float', $floatBefore, $float]] as [$side, $before, $after]) {
            $stmt = $pdo->prepare('
                INSERT INTO liquidity_ledger
                (agent_id, network, side, before_amount, after_amount, delta_amount, reason, ref_type, actor_type, actor_id, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, \'agent_declared\', \'agent_liquidity\', \'agent\', ?, ?)
            ');
            $stmt->execute([
                $agent['agent_id'], $network, $side,
                mm_ngwee_to_decimal($before), mm_ngwee_to_decimal($after),
                mm_ngwee_to_decimal($after - $before),
                $user['user_id'], mm_client_ip(),
            ]);
        }

        mm_audit($pdo, 'agent_liquidity', (int)$liquidity['liquidity_id'], null, 'agent_declared_edit', null, null, 'agent', (int)$user['user_id'], [
            'cash_before' => mm_ngwee_to_decimal($cashBefore),
            'float_before' => mm_ngwee_to_decimal($floatBefore),
        ], [
            'cash_after' => mm_ngwee_to_decimal($cash),
            'float_after' => mm_ngwee_to_decimal($float),
        ]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return [
        'network' => $network,
        'cash_balance' => mm_ngwee_to_decimal($cash),
        'float_balance' => mm_ngwee_to_decimal($float),
        'note' => 'Agent-declared figures. Payreece does not verify external mobile money balances.',
    ];
}

function mm_agent_earnings(PDO $pdo, array $agent): array
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS jobs, COALESCE(SUM(agent_earning), 0) AS earnings, COALESCE(SUM(platform_fee), 0) AS fees
        FROM mm_transactions
        WHERE agent_id = ? AND state = 'completed'
    ");
    $stmt->execute([$agent['agent_id']]);
    $row = $stmt->fetch();

    $stmt = $pdo->prepare('SELECT network, cash_balance, float_balance FROM agent_liquidity WHERE agent_id = ? ORDER BY network');
    $stmt->execute([$agent['agent_id']]);

    return [
        'completed_jobs' => (int)$row['jobs'],
        'total_earnings' => $row['earnings'],
        'platform_fees_on_jobs' => $row['fees'],
        'liquidity' => $stmt->fetchAll(),
    ];
}

function mm_admin_agent_decision(PDO $pdo, array $admin, array $input): array
{
    mm_require_admin($admin);
    $agentId = (int)($input['agent_id'] ?? 0);
    $decision = strtolower(trim((string)($input['decision'] ?? '')));
    $reason = trim((string)($input['reason'] ?? ''));

    if (!in_array($decision, ['verify', 'reject', 'suspend', 'reinstate'], true)) {
        mm_fail('Unknown agent decision.', 400, 'invalid_decision');
    }

    $status = match ($decision) {
        'verify', 'reinstate' => 'verified',
        'reject' => 'rejected',
        'suspend' => 'suspended',
    };

    if (in_array($decision, ['reject', 'suspend'], true) && $reason === '') {
        mm_fail('A reason is required for rejection or suspension.', 400, 'reason_required');
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM agent_profiles WHERE agent_id = ? FOR UPDATE');
        $stmt->execute([$agentId]);
        $agent = $stmt->fetch();
        if (!$agent) {
            mm_fail('Agent profile not found.', 404, 'agent_not_found');
        }

        if ($status === 'verified') {
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM agent_networks WHERE agent_id = ? AND deleted_at IS NULL');
            $stmt->execute([$agentId]);
            if ((int)$stmt->fetchColumn() < 1 || !$agent['nrc_number'] || !$agent['selfie_path']) {
                mm_fail('Agent profile is incomplete.', 409, 'incomplete_profile');
            }
        }

        $stmt = $pdo->prepare('
            UPDATE agent_profiles
            SET verification_status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW(),
                availability = CASE WHEN ? = \'verified\' THEN availability ELSE \'offline\' END
            WHERE agent_id = ?
        ');
        $stmt->execute([$status, $reason ?: null, $admin['user_id'], $status, $agentId]);

        mm_audit($pdo, 'agent_profile', $agentId, null, 'admin_' . $decision, $agent['verification_status'], $status, 'admin', (int)$admin['user_id'], [
            'status' => $agent['verification_status'],
        ], ['status' => $status, 'reason' => $reason]);

        mm_notify($pdo, (int)$agent['user_id'], 'agent.' . $decision, 'Agent application ' . $decision, $reason ?: 'Your agent status is now ' . $status . '.', ['agent_id' => $agentId, 'status' => $status]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return ['agent_id' => $agentId, 'verification_status' => $status];
}

function mm_admin_agents(PDO $pdo, string $status = ''): array
{
    $sql = '
        SELECT a.agent_id, a.verification_status, a.availability, a.business_name, a.created_at,
               u.user_id, u.fullname, u.phone_number, u.public_id
        FROM agent_profiles a JOIN users u ON u.user_id = a.user_id
        WHERE a.deleted_at IS NULL
    ';
    $params = [];
    if ($status !== '') {
        $sql .= ' AND a.verification_status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY a.created_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}
