<?php
$token = $argv[1] ?? getenv('MM_TEST_TOKEN') ?: '';
$base = $argv[2] ?? 'http://127.0.0.1:8099';

if ($token === '') {
    fwrite(STDERR, "Usage: php mm_availability_smoke.php <public_id-token> [base-url]\n");
    exit(1);
}

function mm_request(string $url, string $method, string $token, array $payload = []): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Authorization: Bearer ' . $token, 'Content-Type: application/json'],
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
$stmt = $pdo->prepare('SELECT user_id FROM users WHERE public_id = ? LIMIT 1');
$stmt->execute([$token]);
$userId = (int)$stmt->fetchColumn();
if (!$userId) {
    fwrite(STDERR, "Token did not resolve to a user.\n");
    exit(1);
}

$stmt = $pdo->prepare("INSERT INTO agent_profiles (user_id,business_name,address_text,lat,lng,nrc_number,selfie_path,verification_status,availability) VALUES (?, 'Phase 3 Agent', 'Lusaka', -15.3875, 28.3228, 'PH3-001', 'dummy.jpg', 'verified', 'offline')");
$stmt->execute([$userId]);
$agentId = (int)$pdo->lastInsertId();
$pdo->prepare("INSERT INTO agent_networks (agent_id,network) VALUES (?, 'MTN')")->execute([$agentId]);
$pdo->prepare("INSERT INTO agent_liquidity (agent_id,network,cash_balance,float_balance) VALUES (?, 'MTN', 1000.00, 1000.00)")->execute([$agentId]);

$results = [];

[$status, $response] = mm_request($base . '/marketplace.php?action=agent.availability', 'PUT', $token, ['availability' => 'available']);
$results['fresh_location_required'] = $status === 409 && ($response['code'] ?? '') === 'fresh_location_required';
echo ($results['fresh_location_required'] ? 'PASS' : 'FAIL') . ": available requires fresh location HTTP $status " . json_encode($response) . PHP_EOL;

[$status, $response] = mm_request($base . '/marketplace.php?action=agent.location', 'POST', $token, ['lat' => -15.3875, 'lng' => 28.3228, 'accuracy' => 12, 'heading' => 90]);
$results['location_first'] = $status === 200;
echo ($results['location_first'] ? 'PASS' : 'FAIL') . ": first location HTTP $status " . json_encode($response) . PHP_EOL;

[$status, $response] = mm_request($base . '/marketplace.php?action=agent.availability', 'PUT', $token, ['availability' => 'available']);
$results['availability_online'] = $status === 200 && ($response['data']['availability'] ?? '') === 'available';
echo ($results['availability_online'] ? 'PASS' : 'FAIL') . ": availability available HTTP $status " . json_encode($response) . PHP_EOL;

[$status, $response] = mm_request($base . '/marketplace.php?action=agent.location', 'POST', $token, ['lat' => -17.8252, 'lng' => 31.0335, 'accuracy' => 10]);
$results['jump_rejected'] = $status === 422 && ($response['code'] ?? '') === 'impossible_location_jump';
echo ($results['jump_rejected'] ? 'PASS' : 'FAIL') . ": impossible jump HTTP $status " . json_encode($response) . PHP_EOL;

[$status, $response] = mm_request($base . '/marketplace.php?action=agent.location', 'PUT', $token, ['lat' => -15.3880, 'lng' => 28.3230, 'accuracy' => 14]);
$results['location_put'] = $status === 200;
echo ($results['location_put'] ? 'PASS' : 'FAIL') . ": near location PUT HTTP $status " . json_encode($response) . PHP_EOL;

[$status, $response] = mm_request($base . '/marketplace.php?action=agent.location', 'POST', $token, ['lat' => -15.3881, 'lng' => 28.3231, 'accuracy' => 14]);
$results['rate_limited'] = $status === 429 && ($response['code'] ?? '') === 'rate_limited';
echo ($results['rate_limited'] ? 'PASS' : 'FAIL') . ": rate limit HTTP $status " . json_encode($response) . PHP_EOL;

[$status, $response] = mm_request($base . '/marketplace.php?action=agent.profile', 'GET', $token);
$results['profile_location'] = $status === 200 && !empty($response['data']['location']['lat']) && ($response['data']['location']['is_stale'] ?? true) === false;
echo ($results['profile_location'] ? 'PASS' : 'FAIL') . ": profile includes fresh location HTTP $status" . PHP_EOL;

[$status, $response] = mm_request($base . '/marketplace.php?action=agent.availability', 'PUT', $token, ['availability' => 'offline']);
$stmt = $pdo->prepare('SELECT COUNT(*) FROM agent_locations WHERE agent_id = ?');
$stmt->execute([$agentId]);
$results['offline_clears_location'] = $status === 200 && (int)$stmt->fetchColumn() === 0;
echo ($results['offline_clears_location'] ? 'PASS' : 'FAIL') . ": offline clears location HTTP $status" . PHP_EOL;

$pdo->exec('DELETE FROM agent_location_history WHERE agent_id = ' . $agentId);
$pdo->exec('DELETE FROM agent_locations WHERE agent_id = ' . $agentId);
$pdo->exec('DELETE FROM api_rate_limits WHERE actor_key = \'agent:' . $agentId . '\'');
$pdo->exec('DELETE FROM transaction_audit_logs WHERE entity_type = \'agent_profile\' AND entity_id = ' . $agentId);
$pdo->exec('DELETE FROM agent_networks WHERE agent_id = ' . $agentId);
$pdo->exec('DELETE FROM agent_liquidity WHERE agent_id = ' . $agentId);
$pdo->exec('DELETE FROM agent_profiles WHERE agent_id = ' . $agentId);

$passed = !in_array(false, $results, true);
echo $passed ? 'AVAILABILITY_SMOKE_OK' . PHP_EOL : 'AVAILABILITY_SMOKE_FAILED' . PHP_EOL;
exit($passed ? 0 : 1);
