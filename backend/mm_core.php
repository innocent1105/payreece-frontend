<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/connection.php';

function mm_fail(string $message, int $status = 400, string $code = 'bad_request', array $extra = []): never
{
    ipay_json(array_merge([
        'success' => false,
        'message' => $message,
        'code' => $code,
    ], $extra), $status);
}

function mm_ok(array $data = [], string $message = 'OK', array $extra = []): never
{
    ipay_json(array_merge([
        'success' => true,
        'message' => $message,
        'data' => $data,
    ], $extra));
}

function mm_current_user(PDO $pdo): array
{
    $input = ipay_json_input();
    $token = trim((string)($input['token'] ?? $_POST['token'] ?? $_GET['token'] ?? ''));

    if ($token === '') {
        $auth = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if ($auth === '' && function_exists('getallheaders')) {
            $headers = getallheaders();
            foreach ($headers as $name => $value) {
                if (strtolower((string)$name) === 'authorization') {
                    $auth = (string)$value;
                    break;
                }
            }
        }
        if (preg_match('/^Bearer\s+(.+)$/i', $auth, $matches)) {
            $token = trim($matches[1]);
        }
    }

    if ($token === '') {
        mm_fail('Authentication token is required.', 401, 'unauthenticated');
    }

    $stmt = $pdo->prepare('SELECT user_id, public_id, username, fullname, phone_number, avatar, expo_push_token FROM users WHERE public_id = ? LIMIT 1');
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        mm_fail('Invalid authentication token.', 401, 'unauthenticated');
    }

    return $user;
}

function mm_is_admin(array $user): bool
{
    $allowlist = array_filter(array_map('trim', explode(',', (string)(getenv('IPAY_MM_ADMINS') ?: ''))));
    return in_array($user['public_id'], $allowlist, true);
}

function mm_require_admin(array $user): void
{
    if (!mm_is_admin($user)) {
        mm_fail('Administrator access required.', 403, 'forbidden');
    }
}

function mm_agent_for_user(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM agent_profiles WHERE user_id = ? AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function mm_require_agent(PDO $pdo, array $user): array
{
    $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
    if (!$agent) {
        mm_fail('Agent profile not found.', 404, 'agent_not_found');
    }
    return $agent;
}

function mm_settings(PDO $pdo): array
{
    $settings = [];
    foreach ($pdo->query('SELECT setting_key, setting_value FROM mm_settings') as $row) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }
    return $settings;
}

function mm_setting(PDO $pdo, string $key, string $default = ''): string
{
    $stmt = $pdo->prepare('SELECT setting_value FROM mm_settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute([$key]);
    $value = $stmt->fetchColumn();
    return $value === false ? $default : (string)$value;
}

function mm_setting_int(PDO $pdo, string $key, int $default): int
{
    $value = mm_setting($pdo, $key, (string)$default);
    return (int)$value > 0 ? (int)$value : $default;
}

function mm_setting_float(PDO $pdo, string $key, float $default): float
{
    $value = mm_setting($pdo, $key, (string)$default);
    return is_numeric($value) ? (float)$value : $default;
}

function mm_setting_money(PDO $pdo, string $key, int $defaultNgwee): int
{
    $value = mm_setting($pdo, $key, mm_ngwee_to_decimal($defaultNgwee));
    return mm_parse_money($value);
}

function mm_setting_flag(PDO $pdo, string $key, bool $default = false): bool
{
    $value = mm_setting($pdo, $key, $default ? '1' : '0');
    return in_array($value, ['1', 'true', 'yes'], true);
}

function mm_ngwee_to_decimal(int $ngwee): string
{
    $negative = $ngwee < 0;
    $abs = abs($ngwee);
    $value = intdiv($abs, 100) . '.' . str_pad((string)($abs % 100), 2, '0', STR_PAD_LEFT);
    return $negative ? '-' . $value : $value;
}

function mm_parse_money($value, string $field = 'amount', bool $allowZero = true, bool $allowNegative = false): int
{
    if (is_int($value)) {
        $string = (string)$value;
    } elseif (is_string($value)) {
        $string = trim($value);
    } else {
        mm_fail(ucfirst($field) . ' must be a decimal money value.', 400, 'invalid_amount');
    }

    $pattern = $allowNegative ? '/^-?\d{1,12}(?:\.\d{1,2})?$/' : '/^\d{1,12}(?:\.\d{1,2})?$/';
    if (!preg_match($pattern, $string)) {
        mm_fail(ucfirst($field) . ' must be a positive ZMW amount with at most 2 decimals.', 400, 'invalid_amount');
    }

    $parts = explode('.', $string);
    $ngwee = ((int)$parts[0] * 100) + (int)str_pad($parts[1] ?? '', 2, '0', STR_PAD_LEFT);
    if (!$allowZero && $ngwee <= 0) {
        mm_fail(ucfirst($field) . ' must be greater than zero.', 400, 'invalid_amount');
    }
    return $ngwee;
}

function mm_apply_percent(int $ngwee, string $percent): int
{
    $raw = bcmul((string)$ngwee, $percent, 4);
    return (int)bcadd($raw, '0.5', 0);
}

function mm_validate_network($value): string
{
    $network = strtoupper(trim((string)$value));
    if (!in_array($network, ['MTN', 'AIRTEL', 'ZAMTEL'], true)) {
        mm_fail('Unsupported mobile money network.', 400, 'invalid_network');
    }
    return $network;
}

function mm_validate_direction($value): string
{
    $direction = strtolower(trim((string)$value));
    if (!in_array($direction, ['withdrawal', 'deposit'], true)) {
        mm_fail('Direction must be withdrawal or deposit.', 400, 'invalid_direction');
    }
    return $direction;
}

function mm_validate_coordinates($lat, $lng): array
{
    if (!is_numeric($lat) || !is_numeric($lng)) {
        mm_fail('Valid latitude and longitude are required.', 400, 'invalid_coordinates');
    }
    $latValue = (float)$lat;
    $lngValue = (float)$lng;
    if ($latValue < -90 || $latValue > 90 || $lngValue < -180 || $lngValue > 180) {
        mm_fail('Coordinates are outside valid ranges.', 400, 'invalid_coordinates');
    }
    return [$latValue, $lngValue];
}

function mm_haversine_m(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $radius = 6371000.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return $radius * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function mm_coarsen(float $lat, float $lng, int $meters = 400): array
{
    $latStep = $meters / 111320.0;
    $lngStep = $meters / max(1000.0, 111320.0 * cos(deg2rad($lat)));
    return [
        round($lat / $latStep) * $latStep,
        round($lng / $lngStep) * $lngStep,
    ];
}

function mm_client_ip(): string
{
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

function mm_request_header(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    $value = (string)($_SERVER[$key] ?? '');
    if ($value === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $headerName => $headerValue) {
            if (strtolower((string)$headerName) === strtolower($name)) {
                return (string)$headerValue;
            }
        }
    }
    return $value;
}

function mm_rate_limit(PDO $pdo, string $bucket, int $limit, int $windowSeconds, string $actorKey): void
{
    $windowStart = gmdate('Y-m-d H:i:s', (int)(floor(time() / $windowSeconds) * $windowSeconds));

    $update = $pdo->prepare('UPDATE api_rate_limits SET hits = hits + 1 WHERE bucket = ? AND actor_key = ? AND window_start = ? AND hits < ?');
    $update->execute([$bucket, $actorKey, $windowStart, $limit]);
    if ($update->rowCount() > 0) {
        return;
    }

    $insert = $pdo->prepare('INSERT IGNORE INTO api_rate_limits (bucket, actor_key, window_start, hits) VALUES (:bucket, :actor_key, :window_start, 1)');
    $insert->execute([':bucket' => $bucket, ':actor_key' => $actorKey, ':window_start' => $windowStart]);

    $select = $pdo->prepare('SELECT hits FROM api_rate_limits WHERE bucket = ? AND actor_key = ? AND window_start = ? LIMIT 1');
    $select->execute([$bucket, $actorKey, $windowStart]);
    if ((int)$select->fetchColumn() >= $limit) {
        mm_fail('Too many requests. Please slow down.', 429, 'rate_limited');
    }
}

function mm_rate_limit_for_user(PDO $pdo, array $user, string $bucket, int $limit, int $windowSeconds): void
{
    mm_rate_limit($pdo, $bucket, $limit, $windowSeconds, 'user:' . $user['user_id']);
}

function mm_idempotency_begin(PDO $pdo, array $user, string $endpoint, string $key, array $payload): int
{
    if ($key === '') {
        mm_fail('Idempotency-Key header is required.', 400, 'idempotency_required');
    }
    if (strlen($key) > 120) {
        mm_fail('Idempotency-Key is too long.', 400, 'invalid_idempotency_key');
    }

    $hash = hash('sha256', $endpoint . '|' . json_encode($payload, JSON_UNESCAPED_SLASHES));
    $stmt = $pdo->prepare('SELECT idempotency_id, request_hash, response_json, status_code, expires_at FROM idempotency_keys WHERE user_id = ? AND endpoint = ? AND idempotency_key = ? LIMIT 1');
    $stmt->execute([$user['user_id'], $endpoint, $key]);
    $existing = $stmt->fetch();

    if ($existing && strtotime($existing['expires_at']) > time()) {
        if ($existing['request_hash'] !== $hash) {
            mm_fail('Idempotency-Key was already used with different data.', 409, 'idempotency_conflict');
        }
        if ($existing['response_json'] !== null) {
            http_response_code((int)($existing['status_code'] ?: 200));
            echo $existing['response_json'];
            exit;
        }
        return (int)$existing['idempotency_id'];
    }

    if ($existing) {
        $delete = $pdo->prepare('DELETE FROM idempotency_keys WHERE idempotency_id = ?');
        $delete->execute([$existing['idempotency_id']]);
    }

    try {
        $insert = $pdo->prepare('INSERT INTO idempotency_keys (user_id, endpoint, idempotency_key, request_hash, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))');
        $insert->execute([$user['user_id'], $endpoint, $key, $hash]);
        return (int)$pdo->lastInsertId();
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? null) !== 1062) {
            throw $e;
        }
        $stmt->execute([$user['user_id'], $endpoint, $key]);
        $row = $stmt->fetch();
        if (!$row || $row['request_hash'] !== $hash) {
            mm_fail('Idempotency-Key was already used with different data.', 409, 'idempotency_conflict');
        }
        return (int)$row['idempotency_id'];
    }
}

function mm_idempotency_respond(PDO $pdo, int $idempotencyId, array $payload, int $status = 200): never
{
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    $stmt = $pdo->prepare('UPDATE idempotency_keys SET response_json = ?, status_code = ? WHERE idempotency_id = ?');
    $stmt->execute([$json, $status, $idempotencyId]);
    http_response_code($status);
    echo $json;
    exit;
}

function mm_audit(PDO $pdo, string $entityType, ?int $entityId, ?int $transactionId, string $action, ?string $from, ?string $to, string $actorType, ?int $actorId, array $before = [], array $after = []): void
{
    $stmt = $pdo->prepare('
        INSERT INTO transaction_audit_logs
        (entity_type, entity_id, transaction_id, action, from_state, to_state, actor_type, actor_id, before_json, after_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $entityType,
        $entityId,
        $transactionId,
        $action,
        $from,
        $to,
        $actorType,
        $actorId,
        $before ? json_encode($before, JSON_UNESCAPED_SLASHES) : null,
        $after ? json_encode($after, JSON_UNESCAPED_SLASHES) : null,
        mm_client_ip(),
    ]);
}

function mm_push_send(PDO $pdo, int $userId, string $title, string $body, array $payload): void
{
    if (!mm_setting_flag($pdo, 'push_enabled')) {
        return;
    }

    $stmt = $pdo->prepare('SELECT expo_token FROM user_push_tokens WHERE user_id = ? AND active = 1');
    $stmt->execute([$userId]);
    $tokens = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if (!$tokens) {
        return;
    }

    $messages = [];
    foreach ($tokens as $token) {
        $messages[] = [
            'to' => $token,
            'title' => $title,
            'body' => $body,
            'data' => $payload,
            'sound' => 'default',
        ];
    }

    try {
        $ch = curl_init('https://exp.host/--/api/v2/push/send');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'Authorization: Bearer ' . (string)(getenv('EXPO_PUSH_ACCESS_TOKEN') ?: ''),
            ],
            CURLOPT_POSTFIELDS => json_encode($messages),
        ]);
        curl_exec($ch);
        curl_close($ch);
    } catch (Throwable $e) {
        return;
    }
}

function mm_notify(PDO $pdo, int $userId, string $type, string $title, string $body, array $payload = []): int
{
    $stmt = $pdo->prepare('INSERT INTO user_notifications (user_id, type, title, body, payload_json) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$userId, $type, $title, $body, json_encode($payload, JSON_UNESCAPED_SLASHES)]);
    $notificationId = (int)$pdo->lastInsertId();

    mm_push_send($pdo, $userId, $title, $body, $payload);
    $update = $pdo->prepare('UPDATE user_notifications SET push_sent = 1 WHERE notification_id = ?');
    $update->execute([$notificationId]);
    return $notificationId;
}

function mm_fee_quote(PDO $pdo, string $network, string $direction, int $amountNgwee): array
{
    $decimal = mm_ngwee_to_decimal($amountNgwee);
    $stmt = $pdo->prepare('
        SELECT * FROM mm_fee_schedule
        WHERE active = 1 AND direction = ? AND network IN (?, \'ALL\') AND ? >= min_amount AND ? <= max_amount
        ORDER BY network = ? DESC, min_amount DESC
        LIMIT 1
    ');
    $stmt->execute([$direction, $network, $decimal, $decimal, $network]);
    $fee = $stmt->fetch();

    if (!$fee) {
        mm_fail('No fee schedule is configured for this transaction.', 409, 'fee_schedule_missing');
    }

    $platformFee = mm_parse_money($fee['flat_fee']) + mm_apply_percent($amountNgwee, (string)$fee['percent_fee']);
    $agentCommission = mm_parse_money($fee['agent_flat']) + mm_apply_percent($amountNgwee, (string)$fee['agent_percent']);

    return [
        'platform_fee' => $platformFee,
        'agent_commission' => $agentCommission,
    ];
}

function mm_transaction_state_map(): array
{
    return [
        'searching' => ['accepted' => ['agent', 'system'], 'cancelled' => ['customer', 'system', 'admin'], 'expired' => ['system'], 'rejected' => ['agent', 'system']],
        'accepted' => ['agent_en_route' => ['agent'], 'cancelled' => ['customer', 'agent'], 'disputed' => ['customer', 'agent', 'system', 'admin']],
        'agent_en_route' => ['arrived' => ['agent'], 'cancelled' => ['customer', 'agent'], 'disputed' => ['customer', 'agent', 'system', 'admin']],
        'arrived' => ['processing' => ['agent'], 'cancelled' => ['customer', 'agent'], 'disputed' => ['customer', 'agent', 'system', 'admin']],
        'processing' => ['completed' => ['system', 'admin'], 'cancelled' => ['admin'], 'disputed' => ['customer', 'agent', 'system', 'admin']],
        'disputed' => ['completed' => ['admin'], 'cancelled' => ['admin']],
    ];
}

function mm_reserve_liquidity(PDO $pdo, array $tx, int $actorId): int
{
    $side = $tx['direction'] === 'withdrawal' ? 'cash' : 'float';
    $balanceColumn = $side . '_balance';
    $reservedColumn = $side . '_reserved';

    $stmt = $pdo->prepare("SELECT * FROM agent_liquidity WHERE agent_id = ? AND network = ? FOR UPDATE");
    $stmt->execute([$tx['agent_id'], $tx['network']]);
    $liquidity = $stmt->fetch();
    if (!$liquidity) {
        mm_fail('Agent has no liquidity configured for this network.', 409, 'liquidity_missing');
    }

    $balance = mm_parse_money($liquidity[$balanceColumn]);
    $reserved = mm_parse_money($liquidity[$reservedColumn]);
    $amount = mm_parse_money($tx['amount']);
    if ($balance - $reserved < $amount) {
        mm_fail('Insufficient available agent liquidity.', 409, 'insufficient_liquidity');
    }

    $newReserved = $reserved + $amount;
    $update = $pdo->prepare("UPDATE agent_liquidity SET {$reservedColumn} = ? WHERE liquidity_id = ?");
    $update->execute([mm_ngwee_to_decimal($newReserved), $liquidity['liquidity_id']]);

    $insert = $pdo->prepare('
        INSERT INTO liquidity_reservations (request_id, agent_id, network, side, amount, expires_at)
        VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
    ');
    $insert->execute([
        $tx['request_id'],
        $tx['agent_id'],
        $tx['network'],
        $side,
        $tx['amount'],
        mm_setting_int($pdo, 'confirm_timeout_seconds', 900) + mm_setting_int($pdo, 'offer_timeout_seconds', 30),
    ]);
    $reservationId = (int)$pdo->lastInsertId();

    mm_audit($pdo, 'liquidity_reservation', $reservationId, (int)$tx['transaction_id'], 'reserve', null, 'active', 'agent', $actorId, [], [
        'side' => $side,
        'amount' => $tx['amount'],
        'reserved_before' => mm_ngwee_to_decimal($reserved),
        'reserved_after' => mm_ngwee_to_decimal($newReserved),
    ]);

    $ledger = $pdo->prepare('
        INSERT INTO liquidity_ledger
        (agent_id, network, side, before_amount, after_amount, delta_amount, reserved_before, reserved_after, reserved_delta, reason, ref_type, ref_id, actor_type, actor_id, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $ledger->execute([
        $tx['agent_id'], $tx['network'], $side,
        $tx['amount'], $tx['amount'], '0.00',
        mm_ngwee_to_decimal($reserved), mm_ngwee_to_decimal($newReserved), $tx['amount'],
        'reservation', 'mm_transaction', $tx['transaction_id'], 'agent', $actorId, mm_client_ip(),
    ]);

    return $reservationId;
}

function mm_release_reservation(PDO $pdo, array $tx, string $actorType, ?int $actorId, string $reason): void
{
    if (!$tx['reservation_id']) {
        return;
    }

    $stmt = $pdo->prepare('SELECT * FROM liquidity_reservations WHERE reservation_id = ? FOR UPDATE');
    $stmt->execute([$tx['reservation_id']]);
    $reservation = $stmt->fetch();
    if (!$reservation || $reservation['state'] !== 'active') {
        return;
    }

    $side = $reservation['side'];
    $reservedColumn = $side . '_reserved';
    $stmt = $pdo->prepare("SELECT * FROM agent_liquidity WHERE agent_id = ? AND network = ? FOR UPDATE");
    $stmt->execute([$reservation['agent_id'], $reservation['network']]);
    $liquidity = $stmt->fetch();
    if (!$liquidity) {
        return;
    }

    $amount = mm_parse_money($reservation['amount']);
    $reservedBefore = mm_parse_money($liquidity[$reservedColumn]);
    $reservedAfter = max(0, $reservedBefore - $amount);
    $update = $pdo->prepare("UPDATE agent_liquidity SET {$reservedColumn} = ? WHERE liquidity_id = ?");
    $update->execute([mm_ngwee_to_decimal($reservedAfter), $liquidity['liquidity_id']]);

    $update = $pdo->prepare("UPDATE liquidity_reservations SET state = 'released', released_at = NOW() WHERE reservation_id = ?");
    $update->execute([$reservation['reservation_id']]);

    $ledger = $pdo->prepare('
        INSERT INTO liquidity_ledger
        (agent_id, network, side, before_amount, after_amount, delta_amount, reserved_before, reserved_after, reserved_delta, reason, ref_type, ref_id, actor_type, actor_id, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $ledger->execute([
        $reservation['agent_id'], $reservation['network'], $side,
        mm_ngwee_to_decimal($reservedBefore), mm_ngwee_to_decimal($reservedBefore), '0.00',
        mm_ngwee_to_decimal($reservedBefore), mm_ngwee_to_decimal($reservedAfter), '-' . mm_ngwee_to_decimal($amount),
        $reason, 'mm_transaction', $tx['transaction_id'], $actorType, $actorId, mm_client_ip(),
    ]);
}

function mm_settle_reservation(PDO $pdo, array $tx, int $actorId): void
{
    /*
     * Settlement semantics (human-confirmed completion only; no mobile money is sent or verified here):
     * - Withdrawal: customer takes physical cash, sends e-money to agent => agent cash balance decreases by amount, agent float balance increases by amount.
     * - Deposit: customer hands over physical cash, receives e-money => agent float balance decreases by amount, agent cash balance increases by amount.
     * The active reservation is consumed by subtracting the same amount from reserved on the source side.
     */
    if (!$tx['reservation_id']) {
        return;
    }

    $stmt = $pdo->prepare('SELECT * FROM liquidity_reservations WHERE reservation_id = ? FOR UPDATE');
    $stmt->execute([$tx['reservation_id']]);
    $reservation = $stmt->fetch();
    if (!$reservation || $reservation['state'] !== 'active') {
        return;
    }

    $sourceSide = $reservation['side'];
    $targetSide = $sourceSide === 'cash' ? 'float' : 'cash';
    $amount = mm_parse_money($reservation['amount']);

    $stmt = $pdo->prepare('SELECT * FROM agent_liquidity WHERE agent_id = ? AND network = ? FOR UPDATE');
    $stmt->execute([$reservation['agent_id'], $reservation['network']]);
    $liquidity = $stmt->fetch();
    if (!$liquidity) {
        return;
    }

    $sourceBalance = mm_parse_money($liquidity[$sourceSide . '_balance']);
    $targetBalance = mm_parse_money($liquidity[$targetSide . '_balance']);
    $reservedBefore = mm_parse_money($liquidity[$sourceSide . '_reserved']);
    $sourceAfter = $sourceBalance - $amount;
    $targetAfter = $targetBalance + $amount;
    $reservedAfter = max(0, $reservedBefore - $amount);

    $update = $pdo->prepare("UPDATE agent_liquidity SET {$sourceSide}_balance = ?, {$sourceSide}_reserved = ?, {$targetSide}_balance = ? WHERE liquidity_id = ?");
    $update->execute([
        mm_ngwee_to_decimal($sourceAfter),
        mm_ngwee_to_decimal($reservedAfter),
        mm_ngwee_to_decimal($targetAfter),
        $liquidity['liquidity_id'],
    ]);

    $update = $pdo->prepare("UPDATE liquidity_reservations SET state = 'settled', settled_at = NOW() WHERE reservation_id = ?");
    $update->execute([$reservation['reservation_id']]);

    $ledger = $pdo->prepare('
        INSERT INTO liquidity_ledger
        (agent_id, network, side, before_amount, after_amount, delta_amount, reserved_before, reserved_after, reserved_delta, reason, ref_type, ref_id, actor_type, actor_id, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');

    $ledger->execute([
        $reservation['agent_id'], $reservation['network'], $sourceSide,
        mm_ngwee_to_decimal($sourceBalance), mm_ngwee_to_decimal($sourceAfter), '-' . mm_ngwee_to_decimal($amount),
        '0.00', '0.00', '0.00',
        'settlement_out', 'mm_transaction', $tx['transaction_id'], 'system', $actorId, mm_client_ip(),
    ]);

    $ledger->execute([
        $reservation['agent_id'], $reservation['network'], $targetSide,
        mm_ngwee_to_decimal($targetBalance), mm_ngwee_to_decimal($targetAfter), $tx['amount'],
        '0.00', '0.00', '0.00',
        'settlement_in', 'mm_transaction', $tx['transaction_id'], 'system', $actorId, mm_client_ip(),
    ]);

    $ledger->execute([
        $reservation['agent_id'], $reservation['network'], $sourceSide,
        mm_ngwee_to_decimal($reservedBefore), mm_ngwee_to_decimal($reservedBefore), '0.00',
        mm_ngwee_to_decimal($reservedBefore), mm_ngwee_to_decimal($reservedAfter), '-' . $tx['amount'],
        'reservation_settled', 'mm_transaction', $tx['transaction_id'], 'system', $actorId, mm_client_ip(),
    ]);
}

function mm_refresh_agent_stats(PDO $pdo, int $agentId): void
{
    $stmt = $pdo->prepare('
        SELECT
            COUNT(*) AS total_offers,
            SUM(o.state = \'accepted\') AS accepted_offers,
            COUNT(r.rating_id) AS rating_count,
            COALESCE(AVG(r.rating), 0) AS rating_avg
        FROM mm_offers o
        LEFT JOIN mm_transactions t ON t.request_id = o.request_id AND t.state IN (\'completed\',\'disputed\',\'cancelled\')
        LEFT JOIN mm_ratings r ON r.transaction_id = t.transaction_id
        WHERE o.agent_id = ?
    ');
    $stmt->execute([$agentId]);
    $stats = $stmt->fetch();

    $total = max(1, (int)$stats['total_offers']);
    $accepted = (int)$stats['accepted_offers'];
    $ratingCount = (int)$stats['rating_count'];

    $stmt = $pdo->prepare('
        UPDATE agent_profiles
        SET acceptance_rate = ?, rating_count = ?, rating_avg = ?,
            completion_rate = ROUND(CASE WHEN completed_count + cancelled_count + dispute_count = 0 THEN 0
                ELSE completed_count / (completed_count + cancelled_count + dispute_count) * 100 END, 2)
        WHERE agent_id = ?
    ');
    $stmt->execute([
        number_format(min(100, $accepted * 100 / $total), 2, '.', ''),
        $ratingCount,
        number_format((float)$stats['rating_avg'], 2, '.', ''),
        $agentId,
    ]);
}

function mm_transition(PDO $pdo, int $transactionId, string $toState, string $actorType, ?int $actorId, array $context = []): array
{
    $stmt = $pdo->prepare('SELECT * FROM mm_transactions WHERE transaction_id = ? FOR UPDATE');
    $stmt->execute([$transactionId]);
    $tx = $stmt->fetch();
    if (!$tx) {
        mm_fail('Transaction not found.', 404, 'transaction_not_found');
    }

    $fromState = $tx['state'];
    $map = mm_transaction_state_map();
    if (!isset($map[$fromState][$toState]) || !in_array($actorType, $map[$fromState][$toState], true)) {
        mm_fail('Invalid transaction transition.', 409, 'invalid_transition');
    }

    $before = [
        'state' => $fromState,
        'agent_id' => $tx['agent_id'],
        'reservation_id' => $tx['reservation_id'],
    ];

    $updates = ['state = ?'];
    $params = [$toState];

    if ($toState === 'accepted') {
        $agentId = (int)($context['agent_id'] ?? 0);
        if ($agentId <= 0) {
            mm_fail('An agent is required to accept.', 409, 'invalid_transition');
        }
        $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $updates[] = 'agent_id = ?';
        $params[] = $agentId;
        $updates[] = 'handover_code = ?';
        $params[] = $code;
        $updates[] = 'handover_attempts = 0';
        $updates[] = 'accepted_at = NOW()';
        $stmt = $pdo->prepare('SELECT * FROM mm_transactions WHERE transaction_id = ? FOR UPDATE');
        $stmt->execute([$transactionId]);
        $txForReserve = $stmt->fetch();
        $txForReserve['agent_id'] = $agentId;
        $reservationId = mm_reserve_liquidity($pdo, $txForReserve, (int)($actorId ?? 0));
        $updates[] = 'reservation_id = ?';
        $params[] = $reservationId;

        $stmt = $pdo->prepare("UPDATE agent_profiles SET availability = 'busy' WHERE agent_id = ?");
        $stmt->execute([$agentId]);
        $stmt = $pdo->prepare("UPDATE mm_requests SET state = 'matched' WHERE request_id = ?");
        $stmt->execute([$tx['request_id']]);
    } elseif ($toState === 'agent_en_route') {
        $updates[] = 'en_route_at = NOW()';
    } elseif ($toState === 'arrived') {
        $updates[] = 'arrived_at = NOW()';
    } elseif ($toState === 'processing') {
        $updates[] = 'processing_at = NOW()';
        $updates[] = 'confirm_deadline = NULL';
        $updates[] = 'customer_confirmed_at = NULL';
        $updates[] = 'agent_confirmed_at = NULL';
    } elseif ($toState === 'completed') {
        $updates[] = 'completed_at = NOW()';
        mm_settle_reservation($pdo, $tx, (int)($actorId ?? 0));
        $stmt = $pdo->prepare("UPDATE mm_requests SET state = 'completed' WHERE request_id = ?");
        $stmt->execute([$tx['request_id']]);
        if ($tx['agent_id']) {
            $stmt = $pdo->prepare('UPDATE agent_profiles SET completed_count = completed_count + 1 WHERE agent_id = ?');
            $stmt->execute([$tx['agent_id']]);
            if (mm_setting_flag($pdo, 'agent_auto_return_available')) {
                $stmt = $pdo->prepare("UPDATE agent_profiles SET availability = 'available' WHERE agent_id = ?");
                $stmt->execute([$tx['agent_id']]);
            }
            mm_refresh_agent_stats($pdo, (int)$tx['agent_id']);
        }
    } elseif (in_array($toState, ['cancelled', 'expired'], true)) {
        mm_release_reservation($pdo, $tx, $actorType, $actorId, $toState === 'expired' ? 'expiry_release' : 'cancellation_release');
        $updates[] = 'cancel_reason = ?';
        $params[] = substr((string)($context['reason'] ?? $toState), 0, 255);
        $requestState = $toState === 'expired' ? 'expired' : 'cancelled';
        $stmt = $pdo->prepare('UPDATE mm_requests SET state = ? WHERE request_id = ?');
        $stmt->execute([$requestState, $tx['request_id']]);
        if ($tx['agent_id']) {
            $stmt = $pdo->prepare('UPDATE agent_profiles SET cancelled_count = cancelled_count + 1 WHERE agent_id = ?');
            $stmt->execute([$tx['agent_id']]);
            if (mm_setting_flag($pdo, 'agent_auto_return_available')) {
                $stmt = $pdo->prepare("UPDATE agent_profiles SET availability = 'available' WHERE agent_id = ?");
                $stmt->execute([$tx['agent_id']]);
            }
            mm_refresh_agent_stats($pdo, (int)$tx['agent_id']);
        }
    } elseif ($toState === 'disputed') {
        $updates[] = 'dispute_reason = ?';
        $params[] = substr((string)($context['reason'] ?? 'Disputed'), 0, 255);
        $stmt = $pdo->prepare("UPDATE mm_requests SET state = 'disputed' WHERE request_id = ?");
        $stmt->execute([$tx['request_id']]);
        if ($tx['agent_id']) {
            $stmt = $pdo->prepare('UPDATE agent_profiles SET dispute_count = dispute_count + 1 WHERE agent_id = ?');
            $stmt->execute([$tx['agent_id']]);
        }
    }

    $updates[] = 'updated_at = NOW()';
    $params[] = $transactionId;
    $stmt = $pdo->prepare('UPDATE mm_transactions SET ' . implode(', ', $updates) . ' WHERE transaction_id = ?');
    $stmt->execute($params);

    $stmt = $pdo->prepare('SELECT * FROM mm_transactions WHERE transaction_id = ? LIMIT 1');
    $stmt->execute([$transactionId]);
    $updated = $stmt->fetch();

    mm_audit($pdo, 'mm_transaction', $transactionId, $transactionId, 'transition', $fromState, $toState, $actorType, $actorId, $before, [
        'state' => $toState,
        'agent_id' => $updated['agent_id'],
        'reservation_id' => $updated['reservation_id'],
    ]);

    $customerId = (int)$tx['customer_id'];
    $agentUserId = null;
    if ($tx['agent_id']) {
        $stmt = $pdo->prepare('SELECT user_id FROM agent_profiles WHERE agent_id = ? LIMIT 1');
        $stmt->execute([$tx['agent_id']]);
        $agentUserId = (int)$stmt->fetchColumn();
    }

    $messages = [
        'accepted' => ['Agent accepted', 'An agent accepted your request. Open the app to see the handover code.'],
        'agent_en_route' => ['Agent is on the way', 'Your agent is travelling to your pickup point.'],
        'arrived' => ['Agent has arrived', 'Your agent has arrived. Check the meeting-place safety tips.'],
        'processing' => ['Exchange in progress', 'Complete the physical exchange and confirm when done.'],
        'completed' => ['Exchange completed', 'Both parties confirmed. Thank you for using Payreece Agents.'],
        'cancelled' => ['Request cancelled', 'This transaction was cancelled and any reservation released.'],
        'expired' => ['Request expired', 'No nearby agent accepted in time.'],
        'disputed' => ['Transaction disputed', 'A dispute was opened. Your reserved liquidity is frozen.'],
    ];

    if (isset($messages[$toState])) {
        [$title, $body] = $messages[$toState];
        $payload = ['transaction_id' => $transactionId, 'state' => $toState];
        mm_notify($pdo, $customerId, 'transaction.' . $toState, $title, $body, $payload);
        if ($agentUserId) {
            mm_notify($pdo, $agentUserId, 'transaction.' . $toState, $title, $body, $payload);
        }
    }

    return $updated;
}

function mm_can_access_transaction(array $tx, array $user, ?array $agent): bool
{
    if ((int)$tx['customer_id'] === (int)$user['user_id']) {
        return true;
    }
    if ($agent && (int)$tx['agent_id'] === (int)$agent['agent_id']) {
        return true;
    }
    return mm_is_admin($user);
}

function mm_transaction_public(PDO $pdo, array $tx, array $viewer): array
{
    $isCustomer = (int)$tx['customer_id'] === (int)$viewer['user_id'];
    $agent = null;
    if ($tx['agent_id']) {
        $stmt = $pdo->prepare('
            SELECT a.agent_id, a.business_name, a.vehicle_description, a.rating_avg, a.rating_count,
                   u.fullname, u.phone_number, u.avatar
            FROM agent_profiles a JOIN users u ON u.user_id = a.user_id
            WHERE a.agent_id = ? LIMIT 1
        ');
        $stmt->execute([$tx['agent_id']]);
        $agent = $stmt->fetch();
    }

    $stmt = $pdo->prepare('SELECT fullname, phone_number FROM users WHERE user_id = ? LIMIT 1');
    $stmt->execute([$tx['customer_id']]);
    $customer = $stmt->fetch();

    return [
        'transaction_id' => (int)$tx['transaction_id'],
        'request_id' => (int)$tx['request_id'],
        'state' => $tx['state'],
        'direction' => $tx['direction'],
        'network' => $tx['network'],
        'amount' => $tx['amount'],
        'platform_fee' => $tx['platform_fee'],
        'agent_earning' => $tx['agent_earning'],
        'handover_code' => $isCustomer ? $tx['handover_code'] : null,
        'customer_confirmed_at' => $tx['customer_confirmed_at'],
        'agent_confirmed_at' => $tx['agent_confirmed_at'],
        'created_at' => $tx['created_at'],
        'accepted_at' => $tx['accepted_at'],
        'agent' => $agent ? [
            'agent_id' => (int)$agent['agent_id'],
            'name' => $agent['fullname'],
            'business_name' => $agent['business_name'],
            'avatar' => $agent['avatar'],
            'rating' => $agent['rating_avg'],
            'vehicle_description' => $agent['vehicle_description'],
            'phone' => $tx['state'] === 'searching' ? null : $agent['phone_number'],
        ] : null,
        'customer' => [
            'name' => $customer['fullname'] ?: 'Customer',
            'phone' => $agent !== null && $isCustomer === false ? ($customer['phone_number'] ?? null) : null,
        ],
    ];
}

function mm_process_expirations(PDO $pdo): int
{
    $pdo->beginTransaction();
    try {
        $count = 0;

        $stmt = $pdo->prepare("SELECT offer_id, request_id FROM mm_offers WHERE state = 'offered' AND expires_at <= NOW()");
        $stmt->execute();
        $expiredOffers = $stmt->fetchAll();

        $update = $pdo->prepare("UPDATE mm_offers SET state = 'expired', responded_at = NOW() WHERE offer_id = ? AND state = 'offered' AND expires_at <= NOW()");
        foreach ($expiredOffers as $offer) {
            $update->execute([$offer['offer_id']]);
            if ($update->rowCount() > 0) {
                $count++;
                mm_audit($pdo, 'mm_offer', (int)$offer['offer_id'], null, 'expire', 'offered', 'expired', 'system', null);
                if (function_exists('mm_dispatch_next_offer')) {
                    mm_dispatch_next_offer($pdo, (int)$offer['request_id'], true);
                }
            }
        }

        $stmt = $pdo->prepare("SELECT * FROM mm_transactions WHERE state = 'processing' AND confirm_deadline IS NOT NULL AND confirm_deadline <= NOW() AND (customer_confirmed_at IS NULL OR agent_confirmed_at IS NULL)");
        $stmt->execute();
        $timedOut = $stmt->fetchAll();
        foreach ($timedOut as $tx) {
            mm_transition($pdo, (int)$tx['transaction_id'], 'disputed', 'system', null, ['reason' => 'confirmation_timeout']);
            $count++;
        }

        $stmt = $pdo->prepare("SELECT * FROM mm_requests WHERE state = 'searching' AND search_deadline <= NOW()");
        $stmt->execute();
        $staleRequests = $stmt->fetchAll();
        foreach ($staleRequests as $request) {
            $stmt = $pdo->prepare("SELECT * FROM mm_transactions WHERE request_id = ? AND state = 'searching' LIMIT 1 FOR UPDATE");
            $stmt->execute([$request['request_id']]);
            $tx = $stmt->fetch();
            if ($tx) {
                mm_transition($pdo, (int)$tx['transaction_id'], 'expired', 'system', null, ['reason' => 'search_timeout']);
                $count++;
            }
        }

        $pdo->commit();
        return $count;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function mm_decode_polyline(string $encoded): array
{
    $points = [];
    $index = 0;
    $lat = 0;
    $lng = 0;
    $length = strlen($encoded);

    while ($index < $length) {
        $latDelta = 0;
        $shift = 0;
        do {
            $byte = ord($encoded[$index++]) - 63;
            $latDelta |= ($byte & 0x1f) << $shift;
            $shift += 5;
        } while ($byte >= 0x20 && $index < $length);

        $lngDelta = 0;
        $shift = 0;
        do {
            $byte = ord($encoded[$index++]) - 63;
            $lngDelta |= ($byte & 0x1f) << $shift;
            $shift += 5;
        } while ($byte >= 0x20 && $index < $length);

        $lat += ($latDelta & 1) ? ~($latDelta >> 1) : ($latDelta >> 1);
        $lng += ($lngDelta & 1) ? ~($lngDelta >> 1) : ($lngDelta >> 1);
        $points[] = [$lat / 1e5, $lng / 1e5];
    }
    return $points;
}

function mm_route(PDO $pdo, float $fromLat, float $fromLng, float $toLat, float $toLng): array
{
    $provider = mm_setting($pdo, 'routing_provider', 'none');
    $key = mm_setting($pdo, 'routing_api_key', '');
    $cacheKey = hash('sha256', $provider . '|' . number_format($fromLat, 6, '.', '') . ',' . number_format($fromLng, 6, '.', '') . '|' . number_format($toLat, 6, '.', '') . ',' . number_format($toLng, 6, '.', ''));

    $stmt = $pdo->prepare('SELECT * FROM mm_route_cache WHERE cache_key = ? AND expires_at > NOW() LIMIT 1');
    $stmt->execute([$cacheKey]);
    $cached = $stmt->fetch();
    if ($cached) {
        return [
            'provider' => $cached['provider'],
            'polyline' => json_decode($cached['polyline_json'], true) ?: [],
            'distance_m' => (float)$cached['distance_m'],
            'duration_s' => (int)$cached['duration_s'],
        ];
    }

    $distance = mm_haversine_m($fromLat, $fromLng, $toLat, $toLng);
    $speedKmh = max(5, mm_setting_int($pdo, 'average_speed_kmh', 25));
    $duration = (int)round(($distance / 1000 / $speedKmh) * 3600);
    $result = [
        'provider' => 'straight_line',
        'polyline' => [[$fromLat, $fromLng], [$toLat, $toLng]],
        'distance_m' => $distance,
        'duration_s' => $duration,
    ];

    if ($key !== '' && in_array($provider, ['google', 'openroute'], true)) {
        try {
            if ($provider === 'google') {
                $url = 'https://maps.googleapis.com/maps/api/directions/json?origin=' . rawurlencode($fromLat . ',' . $fromLng) . '&destination=' . rawurlencode($toLat . ',' . $toLng) . '&key=' . rawurlencode($key);
                $response = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 5]]));
                $decoded = $response ? json_decode($response, true) : null;
                if (!empty($decoded['routes'][0]['overview_polyline']['points'])) {
                    $leg = $decoded['routes'][0]['legs'][0] ?? [];
                    $result = [
                        'provider' => 'google',
                        'polyline' => mm_decode_polyline($decoded['routes'][0]['overview_polyline']['points']),
                        'distance_m' => (float)($leg['distance']['value'] ?? $distance),
                        'duration_s' => (int)($leg['duration']['value'] ?? $duration),
                    ];
                }
            } else {
                $url = 'https://api.openrouteservice.org/v2/directions/driving-car?api_key=' . rawurlencode($key) . '&start=' . rawurlencode($fromLng . ',' . $fromLat) . '&end=' . rawurlencode($toLng . ',' . $toLat);
                $response = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 5]]));
                $decoded = $response ? json_decode($response, true) : null;
                if (!empty($decoded['routes'][0]['geometry']['coordinates'])) {
                    $polyline = [];
                    foreach ($decoded['routes'][0]['geometry']['coordinates'] as $point) {
                        $polyline[] = [(float)$point[1], (float)$point[0]];
                    }
                    $summary = $decoded['routes'][0]['summary'] ?? [];
                    $result = [
                        'provider' => 'openroute',
                        'polyline' => $polyline,
                        'distance_m' => (float)($summary['distance'] ?? $distance),
                        'duration_s' => (int)($summary['duration'] ?? $duration),
                    ];
                }
            }
        } catch (Throwable $e) {
            $result['provider'] = 'straight_line_fallback';
        }
    }

    $cacheSeconds = mm_setting_int($pdo, 'routing_cache_seconds', 300);
    $stmt = $pdo->prepare('
        INSERT INTO mm_route_cache (cache_key, provider, polyline_json, distance_m, duration_s, expires_at)
        VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
        ON DUPLICATE KEY UPDATE provider = VALUES(provider), polyline_json = VALUES(polyline_json), distance_m = VALUES(distance_m), duration_s = VALUES(duration_s), expires_at = VALUES(expires_at), created_at = NOW()
    ');
    $stmt->execute([
        $cacheKey,
        $result['provider'],
        json_encode($result['polyline']),
        $result['distance_m'],
        $result['duration_s'],
        $cacheSeconds,
    ]);

    return $result;
}
