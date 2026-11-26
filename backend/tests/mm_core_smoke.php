<?php
require_once __DIR__ . '/../mm_core.php';

function mm_test_assert(bool $condition, string $label): void
{
    echo ($condition ? 'PASS' : 'FAIL') . ': ' . $label . PHP_EOL;
    if (!$condition) {
        exit(1);
    }
}

$pdo->beginTransaction();
try {
    $publicId = bin2hex(random_bytes(16));
    $phone = '9' . random_int(100000000, 999999999);
    $stmt = $pdo->prepare('INSERT INTO users (public_id, username, fullname, phone_number, password, email) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$publicId, 'mmtest' . substr($publicId, 0, 8), 'MM Test User', $phone, password_hash('123456', PASSWORD_BCRYPT), $publicId . '@example.test']);
    $userId = (int)$pdo->lastInsertId();
    $user = ['user_id' => $userId, 'public_id' => $publicId, 'fullname' => 'MM Test User'];

    mm_test_assert(count(mm_settings($pdo)) >= 30, 'settings seeded');
    mm_test_assert(mm_parse_money('100.50', 'amount', false) === 10050, 'decimal money parses to integer ngwee');
    mm_test_assert(mm_ngwee_to_decimal(10050) === '100.50', 'ngwee formats back to decimal string');

    $quote = mm_fee_quote($pdo, 'MTN', 'withdrawal', 10000);
    mm_test_assert($quote['platform_fee'] === 100 && $quote['agent_commission'] === 200, 'fee quote matches schedule');

    $bucket = 'test_' . substr($publicId, 0, 8);
    mm_rate_limit($pdo, $bucket, 3, 60, 'test:' . $userId);
    mm_rate_limit($pdo, $bucket, 3, 60, 'test:' . $userId);
    $stmt = $pdo->prepare('SELECT hits FROM api_rate_limits WHERE bucket = ? LIMIT 1');
    $stmt->execute([$bucket]);
    mm_test_assert((int)$stmt->fetchColumn() === 2, 'rate limiter increments atomically');

    $idemId = mm_idempotency_begin($pdo, $user, 'test_create', 'key-' . $publicId, ['amount' => '10.00']);
    $idemId2 = mm_idempotency_begin($pdo, $user, 'test_create', 'key-' . $publicId, ['amount' => '10.00']);
    mm_test_assert($idemId === $idemId2, 'idempotency key is stable for identical payload');

    $notificationId = mm_notify($pdo, $userId, 'test', 'Test', 'Core smoke test', ['ok' => true]);
    mm_test_assert($notificationId > 0, 'notification is persisted');

    $stmt = $pdo->prepare('INSERT INTO agent_profiles (user_id, business_name, address_text, lat, lng, nrc_number, verification_status, availability) VALUES (?, ?, ?, ?, ?, ?, \'verified\', \'busy\')');
    $stmt->execute([$userId, 'Test Agent', 'Lusaka', -15.3875000, 28.3228000, 'NRC-TEST']);
    $agentId = (int)$pdo->lastInsertId();

    $stmt = $pdo->prepare('INSERT INTO agent_networks (agent_id, network, min_amount, max_amount) VALUES (?, \'MTN\', 10.00, 5000.00)');
    $stmt->execute([$agentId]);
    $stmt = $pdo->prepare('INSERT INTO agent_liquidity (agent_id, network, cash_balance, float_balance) VALUES (?, \'MTN\', 1000.00, 1000.00)');
    $stmt->execute([$agentId]);

    $stmt = $pdo->prepare('INSERT INTO mm_requests (public_id, customer_id, direction, network, amount, pickup_lat, pickup_lng, pickup_address, search_deadline) VALUES (?, ?, \'withdrawal\', \'MTN\', 100.00, -15.3900000, 28.3200000, \'Lusaka\', DATE_ADD(NOW(), INTERVAL 5 MINUTE))');
    $stmt->execute([bin2hex(random_bytes(16)), $userId]);
    $requestId = (int)$pdo->lastInsertId();

    $stmt = $pdo->prepare('INSERT INTO mm_transactions (request_id, customer_id, direction, network, amount, state) VALUES (?, ?, \'withdrawal\', \'MTN\', 100.00, \'searching\')');
    $stmt->execute([$requestId, $userId]);
    $transactionId = (int)$pdo->lastInsertId();

    $stmt = $pdo->prepare('SELECT * FROM mm_transactions WHERE transaction_id = ? FOR UPDATE');
    $stmt->execute([$transactionId]);
    $tx = $stmt->fetch();
    $tx['agent_id'] = $agentId;

    $reservationId = mm_reserve_liquidity($pdo, $tx, $userId);
    mm_test_assert($reservationId > 0, 'liquidity reservation created');

    $stmt = $pdo->prepare('SELECT cash_reserved FROM agent_liquidity WHERE agent_id = ? AND network = \'MTN\'');
    $stmt->execute([$agentId]);
    mm_test_assert(mm_parse_money($stmt->fetchColumn()) === 10000, 'reservation increases reserved by amount');

    $tx['reservation_id'] = $reservationId;
    mm_settle_reservation($pdo, $tx, $userId);

    $stmt = $pdo->prepare('SELECT cash_balance, float_balance, cash_reserved FROM agent_liquidity WHERE agent_id = ? AND network = \'MTN\'');
    $stmt->execute([$agentId]);
    $liquidity = $stmt->fetch();
    mm_test_assert(mm_parse_money($liquidity['cash_balance']) === 90000, 'withdrawal settlement decreases cash');
    mm_test_assert(mm_parse_money($liquidity['float_balance']) === 110000, 'withdrawal settlement increases float');
    mm_test_assert(mm_parse_money($liquidity['cash_reserved']) === 0, 'settlement consumes reservation');

    $stmt = $pdo->prepare("SELECT side, SUM(delta_amount) AS total FROM liquidity_ledger WHERE agent_id = ? AND reason IN ('settlement_in','settlement_out') GROUP BY side");
    $stmt->execute([$agentId]);
    $deltas = [];
    foreach ($stmt->fetchAll() as $row) {
        $deltas[$row['side']] = mm_parse_money($row['total'], 'ledger delta', true, true);
    }
    mm_test_assert(($deltas['cash'] ?? 0) === -10000 && ($deltas['float'] ?? 0) === 10000, 'ledger settlement deltas match balances');

    $route = mm_route($pdo, -15.3875, 28.3228, -15.39, 28.32);
    mm_test_assert(count($route['polyline']) === 2 && $route['distance_m'] > 0, 'routing fallback produces usable route');

    echo 'CORE_SMOKE_OK' . PHP_EOL;
} catch (Throwable $e) {
    echo 'FAIL: exception ' . $e->getMessage() . PHP_EOL;
    exit(1);
} finally {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
}
