<?php
$base = $argv[1] ?? 'http://127.0.0.1/ipay/backend';
$customerToken = '00000000-0000-4000-8000-0000000000c1';
$agentOneToken = '00000000-0000-4000-8000-0000000000a1';
$agentTwoToken = '00000000-0000-4000-8000-0000000000a2';
$customerTwoToken = '00000000-0000-4000-8000-0000000000c2';

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

$userTokens = [$customerToken, $customerTwoToken, $agentOneToken, $agentTwoToken];
foreach ($userTokens as $publicId) {
    $stmt = $pdo->prepare('DELETE FROM users WHERE public_id = ?');
    $stmt->execute([$publicId]);
}

function mm_make_user(PDO $pdo, string $token, string $username, string $name): int
{
    $stmt = $pdo->prepare('INSERT INTO users (public_id, username, fullname, phone_number, password, email) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$token, $username, $name, '260' . substr(str_replace('-', '', $token), -9), password_hash('not-used', PASSWORD_DEFAULT), $username . '@example.test']);
    return (int)$pdo->lastInsertId();
}

$customerId = mm_make_user($pdo, $customerToken, 'ph4_customer', 'Phase4 Customer');
$customerTwoId = mm_make_user($pdo, $customerTwoToken, 'ph4_customer2', 'Phase4 Customer Two');
$agentOneUserId = mm_make_user($pdo, $agentOneToken, 'ph4_agent1', 'Phase4 Agent One');
$agentTwoUserId = mm_make_user($pdo, $agentTwoToken, 'ph4_agent2', 'Phase4 Agent Two');

function mm_make_agent(PDO $pdo, int $userId, string $nrc, string $lat, string $lng): int
{
    $stmt = $pdo->prepare("INSERT INTO agent_profiles (user_id,business_name,address_text,lat,lng,nrc_number,selfie_path,verification_status,availability) VALUES (?, 'Phase4 Agent', 'Lusaka', ?, ?, ?, 'dummy.jpg', 'verified', 'available')");
    $stmt->execute([$userId, $lat, $lng, $nrc]);
    $agentId = (int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO agent_locations (agent_id,lat,lng,accuracy,updated_at) VALUES (?, ?, ?, 10, NOW())")->execute([$agentId, $lat, $lng]);
    $pdo->prepare("INSERT INTO agent_networks (agent_id,network) VALUES (?, 'MTN')")->execute([$agentId]);
    $pdo->prepare("INSERT INTO agent_liquidity (agent_id,network,cash_balance,float_balance) VALUES (?, 'MTN', 2000.00, 2000.00)")->execute([$agentId]);
    return $agentId;
}

$agentOneId = mm_make_agent($pdo, $agentOneUserId, 'PH4-001', '-15.3880000', '28.3230000');
$agentTwoId = mm_make_agent($pdo, $agentTwoUserId, 'PH4-002', '-15.3890000', '28.3240000');

$results = [];
$requestPayload = [
    'direction' => 'withdrawal',
    'network' => 'MTN',
    'amount' => '150.00',
    'pickup_lat' => -15.3875,
    'pickup_lng' => 28.3228,
    'pickup_address' => 'Cairo Road, Lusaka',
];

[$status, $response] = mm_http($base . '/marketplace.php?action=customer.request.create', 'POST', $customerToken, $requestPayload, 'phase4-create-001');
$results['create'] = $status === 200 && ($response['data']['state'] ?? '') === 'searching' && !empty($response['data']['offer']);
$requestId = (int)($response['data']['request_id'] ?? 0);
echo ($results['create'] ? 'PASS' : 'FAIL') . ": request create HTTP $status " . json_encode($response) . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=customer.request.create', 'POST', $customerToken, $requestPayload, 'phase4-create-001');
$results['idempotent'] = $status === 200 && (int)($response['data']['request_id'] ?? 0) === $requestId;
echo ($results['idempotent'] ? 'PASS' : 'FAIL') . ": idempotent replay HTTP $status" . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=agent.offers', 'GET', $agentOneToken);
$agentOneOfferId = (int)($response['data']['offers'][0]['offer_id'] ?? 0);
$results['offer_created'] = $status === 200 && $agentOneOfferId > 0 && ($response['data']['offers'][0]['pickup_lat'] ?? '') !== '';
echo ($results['offer_created'] ? 'PASS' : 'FAIL') . ": agent one offer HTTP $status" . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=agent.offer.respond', 'POST', $agentOneToken, ['offer_id' => $agentOneOfferId, 'decision' => 'reject']);
$results['reject'] = $status === 200 && ($response['data']['decision'] ?? '') === 'rejected';
echo ($results['reject'] ? 'PASS' : 'FAIL') . ": agent reject HTTP $status " . json_encode($response) . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=agent.offers', 'GET', $agentTwoToken);
$agentTwoOfferId = (int)($response['data']['offers'][0]['offer_id'] ?? 0);
$results['next_offer'] = $status === 200 && $agentTwoOfferId > 0;
echo ($results['next_offer'] ? 'PASS' : 'FAIL') . ": next agent offer HTTP $status" . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=agent.offer.respond', 'POST', $agentTwoToken, ['offer_id' => $agentTwoOfferId, 'decision' => 'accept']);
$txId = (int)($response['data']['transaction_id'] ?? 0);
$results['accept'] = $status === 200 && ($response['data']['state'] ?? '') === 'accepted' && $txId > 0;
echo ($results['accept'] ? 'PASS' : 'FAIL') . ": agent accept HTTP $status " . json_encode($response) . PHP_EOL;

$stmt = $pdo->prepare('SELECT availability FROM agent_profiles WHERE agent_id = ?');
$stmt->execute([$agentTwoId]);
$results['agent_busy'] = $stmt->fetchColumn() === 'busy';
$stmt = $pdo->prepare('SELECT COUNT(*) FROM liquidity_reservations WHERE agent_id = ? AND state = \'active\'');
$stmt->execute([$agentTwoId]);
$results['reservation'] = (int)$stmt->fetchColumn() === 1;
echo ($results['agent_busy'] && $results['reservation'] ? 'PASS' : 'FAIL') . ": agent busy and liquidity reserved" . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=customer.request.status&request_id=' . $requestId, 'GET', $customerToken);
$results['status_code_visible'] = $status === 200 && strlen((string)($response['data']['transaction']['handover_code'] ?? '')) === 6;
echo ($results['status_code_visible'] ? 'PASS' : 'FAIL') . ": customer sees handover code HTTP $status" . PHP_EOL;

[$status, $response] = mm_http($base . '/marketplace.php?action=customer.request.create', 'POST', $customerTwoToken, $requestPayload, 'phase4-create-002');
$expiringRequestId = (int)($response['data']['request_id'] ?? 0);
$results['second_request'] = $status === 200 && $expiringRequestId > 0;
echo ($results['second_request'] ? 'PASS' : 'FAIL') . ": second customer request HTTP $status" . PHP_EOL;

$pdo->prepare("UPDATE mm_offers SET expires_at = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE request_id = ? AND state = 'offered'")->execute([$expiringRequestId]);
$cronOutput = shell_exec('"' . PHP_BINARY . '" "' . __DIR__ . '\\..\\tools\\cron_expire.php"');
$cron = json_decode((string)$cronOutput, true);
$stmt = $pdo->prepare("SELECT COUNT(*) FROM mm_offers WHERE request_id = ? AND state = 'expired'");
$stmt->execute([$expiringRequestId]);
$results['expiry'] = !empty($cron['success']) && (int)$stmt->fetchColumn() === 1;
echo ($results['expiry'] ? 'PASS' : 'FAIL') . ": expiry cron " . trim((string)$cronOutput) . PHP_EOL;

$requestIds = [$requestId, $expiringRequestId];
foreach ($requestIds as $id) {
    $stmt = $pdo->prepare('SELECT transaction_id FROM mm_transactions WHERE request_id = ?');
    $stmt->execute([$id]);
    $txIdForCleanup = (int)$stmt->fetchColumn();
    if ($txIdForCleanup) {
        $pdo->prepare('DELETE FROM transaction_audit_logs WHERE transaction_id = ?')->execute([$txIdForCleanup]);
        $pdo->prepare('DELETE FROM user_notifications WHERE payload_json LIKE ?')->execute(['%"transaction_id":' . $txIdForCleanup . '%']);
    }
    $pdo->prepare('DELETE FROM transaction_audit_logs WHERE entity_type = ? AND entity_id = ?')->execute(['mm_request', $id]);
    $stmt = $pdo->prepare('SELECT offer_id FROM mm_offers WHERE request_id = ?');
    $stmt->execute([$id]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $offerId) {
        $pdo->prepare('DELETE FROM transaction_audit_logs WHERE entity_type = ? AND entity_id = ?')->execute(['mm_offer', $offerId]);
    }
    $pdo->prepare('DELETE FROM liquidity_ledger WHERE agent_id IN (?, ?)')->execute([$agentOneId, $agentTwoId]);
    $pdo->prepare('DELETE FROM liquidity_reservations WHERE request_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM agent_location_history WHERE transaction_id = ?')->execute([$txIdForCleanup]);
    $pdo->prepare('DELETE FROM mm_offers WHERE request_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM mm_transactions WHERE request_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM mm_requests WHERE request_id = ?')->execute([$id]);
}
foreach ([$customerId, $customerTwoId, $agentOneUserId, $agentTwoUserId] as $id) {
    $pdo->prepare('DELETE FROM idempotency_keys WHERE user_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM user_notifications WHERE user_id = ?')->execute([$id]);
}
foreach ([$agentOneId, $agentTwoId] as $id) {
    $pdo->prepare('DELETE FROM transaction_audit_logs WHERE entity_type = ? AND entity_id = ?')->execute(['mm_offer', $id]);
    $pdo->prepare('DELETE FROM agent_location_history WHERE agent_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM agent_locations WHERE agent_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM agent_networks WHERE agent_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM agent_liquidity WHERE agent_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM agent_profiles WHERE agent_id = ?')->execute([$id]);
}
foreach ($userTokens as $publicId) {
    $stmt = $pdo->prepare('DELETE FROM users WHERE public_id = ?');
    $stmt->execute([$publicId]);
}

$passed = !in_array(false, $results, true);
echo $passed ? 'MATCHING_SMOKE_OK' . PHP_EOL : 'MATCHING_SMOKE_FAILED' . PHP_EOL;
exit($passed ? 0 : 1);
