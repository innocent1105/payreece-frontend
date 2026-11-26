<?php
$base = $argv[1] ?? 'http://127.0.0.1/ipay/backend';
$customerToken = '00000000-0000-4000-8000-0000000000d1';
$agentToken = '00000000-0000-4000-8000-0000000000b1';

function mm_http(string $url, string $method, string $token, array $payload = [], string $idempotency = ''): array
{
    $ch = curl_init($url);
    $headers = ['Accept: application/json', 'Authorization: Bearer ' . $token, 'Content-Type: application/json'];
    if ($idempotency !== '') {
        $headers[] = 'Idempotency-Key: ' . $idempotency;
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $payload ? json_encode($payload) : null,
        CURLOPT_TIMEOUT => 15,
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$status, json_decode((string)$body, true)];
}

$pdo = new PDO(
    'mysql:host=' . (getenv('IPAY_DB_HOST') ?: 'localhost') . ';dbname=' . (getenv('IPAY_DB_NAME') ?: 'payper') . ';charset=utf8mb4',
    getenv('IPAY_DB_USER') ?: 'root',
    getenv('IPAY_DB_PASS') !== false ? getenv('IPAY_DB_PASS') : '',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
foreach ([$customerToken, $agentToken] as $token) {
    $pdo->prepare('DELETE FROM users WHERE public_id = ?')->execute([$token]);
}

function mm_user(PDO $pdo, string $token, string $username, string $name): int
{
    $stmt = $pdo->prepare('INSERT INTO users (public_id, username, fullname, phone_number, password, email, expo_push_token) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$token, $username, $name, '260' . substr(str_replace('-', '', $token), -9), password_hash('not-used', PASSWORD_DEFAULT), $username . '@example.test', null]);
    return (int)$pdo->lastInsertId();
}

$customerId = mm_user($pdo, $customerToken, 'ph5_customer', 'Phase5 Customer');
$agentUserId = mm_user($pdo, $agentToken, 'ph5_agent', 'Phase5 Agent');
$stmt = $pdo->prepare("INSERT INTO agent_profiles (user_id,business_name,address_text,lat,lng,nrc_number,selfie_path,verification_status,availability) VALUES (?, 'Phase5 Agent', 'Lusaka', -15.388, 28.323, 'PH5-001', 'dummy.jpg', 'verified', 'available')");
$stmt->execute([$agentUserId]);
$agentId = (int)$pdo->lastInsertId();
$pdo->prepare('INSERT INTO agent_locations (agent_id,lat,lng,accuracy,updated_at) VALUES (?, -15.388, 28.323, 10, NOW())')->execute([$agentId]);
$pdo->prepare("INSERT INTO agent_networks (agent_id,network) VALUES (?, 'MTN')")->execute([$agentId]);
$pdo->prepare("INSERT INTO agent_liquidity (agent_id,network,cash_balance,float_balance) VALUES (?, 'MTN', 2000.00, 2000.00)")->execute([$agentId]);

$results = [];
$payload = ['direction' => 'withdrawal', 'network' => 'MTN', 'amount' => '120.00', 'pickup_lat' => -15.3875, 'pickup_lng' => 28.3228, 'pickup_address' => 'Cairo Road, Lusaka'];

function mm_start_job(string $base, string $customerToken, string $agentToken, array $payload, string $key, int $agentId): array
{
    [$status, $response] = mm_http($base . '/marketplace.php?action=customer.request.create', 'POST', $customerToken, $payload, $key);
    $requestId = (int)($response['data']['request_id'] ?? 0);
    [$offerStatus, $offers] = mm_http($base . '/marketplace.php?action=agent.offers', 'GET', $agentToken);
    $offerId = (int)($offers['data']['offers'][0]['offer_id'] ?? 0);
    [$acceptStatus, $accept] = mm_http($base . '/marketplace.php?action=agent.offer.respond', 'POST', $agentToken, ['offer_id' => $offerId, 'decision' => 'accept']);
    return [$status === 200 && $offerStatus === 200 && $acceptStatus === 200, $requestId, (int)($accept['data']['transaction_id'] ?? 0), $offerId];
}

[$setupOk, $txOneRequestId, $txOneId] = mm_start_job($base, $customerToken, $agentToken, $payload, 'phase5-create-1', $agentId);
$results['setup'] = $setupOk && $txOneId > 0;
echo ($results['setup'] ? 'PASS' : 'FAIL') . ": setup accepted transaction" . PHP_EOL;

foreach (['en_route' => 'agent_en_route', 'arrived' => 'arrived', 'processing' => 'processing'] as $action => $expected) {
    [$status, $response] = mm_http($base . '/marketplace.php?action=transaction.transition', 'POST', $agentToken, ['transaction_id' => $txOneId, 'action' => $action]);
    $results['transition_' . $action] = $status === 200 && ($response['data']['state'] ?? '') === $expected;
    echo ($results['transition_' . $action] ? 'PASS' : 'FAIL') . ": transition $action HTTP $status" . PHP_EOL;
}

[$status, $response] = mm_http($base . '/marketplace.php?action=transaction.get&transaction_id=' . $txOneId, 'GET', $customerToken);
$code = (string)($response['data']['handover_code'] ?? '');
$results['code_visible'] = $status === 200 && strlen($code) === 6;
echo ($results['code_visible'] ? 'PASS' : 'FAIL') . ": customer sees handover code HTTP $status" . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=transaction.confirm', 'POST', $customerToken, ['transaction_id' => $txOneId, 'role' => 'customer']);
$results['customer_confirm'] = $status === 200 && !empty($response['data']['customer_confirmed']);
echo ($results['customer_confirm'] ? 'PASS' : 'FAIL') . ": customer confirm HTTP $status " . json_encode($response) . PHP_EOL;
$stmt = $pdo->prepare('SELECT customer_confirmed_at, agent_confirmed_at FROM mm_transactions WHERE transaction_id = ?');
$stmt->execute([$txOneId]);
$stmt->fetch();

$wrongCode = str_pad((string)(((int)$code + 1) % 1000000), 6, '0', STR_PAD_LEFT);
[$status, $response] = mm_http($base . '/marketplace.php?action=transaction.confirm', 'POST', $agentToken, ['transaction_id' => $txOneId, 'role' => 'agent', 'handover_code' => $wrongCode]);
$results['wrong_code'] = $status === 400 && ($response['code'] ?? '') === 'invalid_handover_code';
echo ($results['wrong_code'] ? 'PASS' : 'FAIL') . ": wrong handover code HTTP $status " . json_encode($response) . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=transaction.confirm', 'POST', $agentToken, ['transaction_id' => $txOneId, 'role' => 'agent', 'handover_code' => $code]);
$results['complete'] = $status === 200 && ($response['data']['state'] ?? '') === 'completed';
echo ($results['complete'] ? 'PASS' : 'FAIL') . ": dual confirmation completes HTTP $status " . json_encode($response) . PHP_EOL;

$stmt = $pdo->prepare("SELECT COUNT(*) FROM liquidity_reservations WHERE agent_id = ? AND state = 'settled'");
$stmt->execute([$agentId]);
$results['settled'] = (int)$stmt->fetchColumn() === 1;
$stmt = $pdo->prepare("SELECT COUNT(*) FROM liquidity_ledger WHERE agent_id = ? AND reason IN ('settlement_out','settlement_in')");
$stmt->execute([$agentId]);
$results['ledger'] = (int)$stmt->fetchColumn() === 2;
echo ($results['settled'] && $results['ledger'] ? 'PASS' : 'FAIL') . ": settlement and ledger written" . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=transaction.rate', 'POST', $customerToken, ['transaction_id' => $txOneId, 'rating' => 5, 'comment' => 'Great service']);
$results['rate'] = $status === 200;
[$dupStatus, $dupResponse] = mm_http($base . '/marketplace.php?action=transaction.rate', 'POST', $customerToken, ['transaction_id' => $txOneId, 'rating' => 4]);
$results['rate_once'] = $dupStatus === 409 && ($dupResponse['code'] ?? '') === 'already_rated';
echo ($results['rate'] && $results['rate_once'] ? 'PASS' : 'FAIL') . ": rating once HTTP $status/$dupStatus" . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=agent.availability', 'PUT', $agentToken, ['availability' => 'available']);
$results['agent_available_again'] = $status === 200;
[$setupOk2, $txTwoRequestId, $txTwoId] = mm_start_job($base, $customerToken, $agentToken, $payload, 'phase5-create-2', $agentId);
$results['setup_2'] = $setupOk2 && $txTwoId > 0;
[$status, $response] = mm_http($base . '/marketplace.php?action=transaction.dispute', 'POST', $customerToken, ['transaction_id' => $txTwoId, 'reason' => 'Cash amount was not as agreed']);
$results['dispute'] = $status === 200 && ($response['data']['state'] ?? '') === 'disputed';
echo ($results['dispute'] ? 'PASS' : 'FAIL') . ": customer dispute HTTP $status " . json_encode($response) . PHP_EOL;

$envAdmin = 'e04ca5f5e2a8f16c7d10d10d1645ed10';
$cmd = 'set IPAY_MM_ADMINS=' . $envAdmin . '&& "' . PHP_BINARY . '" "' . __DIR__ . '\\..\\tools\\admin_transaction.php" cancel "' . $envAdmin . '" ' . $txTwoId . ' "admin reviewed"';
$adminOutput = shell_exec($cmd);
$admin = json_decode((string)$adminOutput, true);
$results['admin_resolve'] = ($admin['state'] ?? '') === 'cancelled';
echo ($results['admin_resolve'] ? 'PASS' : 'FAIL') . ": admin resolve " . trim((string)$adminOutput) . PHP_EOL;

$requestIds = [$txOneRequestId, $txTwoRequestId];
foreach ($requestIds as $id) {
    $stmt = $pdo->prepare('SELECT transaction_id FROM mm_transactions WHERE request_id = ?');
    $stmt->execute([$id]);
    $txId = (int)$stmt->fetchColumn();
    if ($txId) {
        $pdo->prepare('DELETE FROM mm_ratings WHERE transaction_id = ?')->execute([$txId]);
        $pdo->prepare('DELETE FROM mm_reports WHERE transaction_id = ?')->execute([$txId]);
        $pdo->prepare('DELETE FROM transaction_audit_logs WHERE transaction_id = ?')->execute([$txId]);
    }
    $stmt = $pdo->prepare('SELECT offer_id FROM mm_offers WHERE request_id = ?');
    $stmt->execute([$id]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $offerId) {
        $pdo->prepare('DELETE FROM transaction_audit_logs WHERE entity_type = ? AND entity_id = ?')->execute(['mm_offer', $offerId]);
    }
    $pdo->prepare('DELETE FROM liquidity_ledger WHERE agent_id = ?')->execute([$agentId]);
    $pdo->prepare('DELETE FROM liquidity_reservations WHERE request_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM agent_location_history WHERE transaction_id = ?')->execute([$txId]);
    $pdo->prepare('DELETE FROM mm_offers WHERE request_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM mm_transactions WHERE request_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM mm_requests WHERE request_id = ?')->execute([$id]);
}
foreach ([$customerId, $agentUserId] as $id) {
    $pdo->prepare('DELETE FROM idempotency_keys WHERE user_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM user_notifications WHERE user_id = ?')->execute([$id]);
}
$pdo->prepare('DELETE FROM transaction_audit_logs WHERE entity_type = ? AND entity_id = ?')->execute(['agent_profile', $agentId]);
$pdo->prepare('DELETE FROM agent_location_history WHERE agent_id = ?')->execute([$agentId]);
$pdo->prepare('DELETE FROM agent_locations WHERE agent_id = ?')->execute([$agentId]);
$pdo->prepare('DELETE FROM agent_networks WHERE agent_id = ?')->execute([$agentId]);
$pdo->prepare('DELETE FROM agent_liquidity WHERE agent_id = ?')->execute([$agentId]);
$pdo->prepare('DELETE FROM agent_profiles WHERE agent_id = ?')->execute([$agentId]);
foreach ([$customerToken, $agentToken] as $token) {
    $pdo->prepare('DELETE FROM users WHERE public_id = ?')->execute([$token]);
}

$passed = !in_array(false, $results, true);
echo $passed ? 'LIFECYCLE_SMOKE_OK' . PHP_EOL : 'LIFECYCLE_SMOKE_FAILED' . PHP_EOL;
exit($passed ? 0 : 1);
