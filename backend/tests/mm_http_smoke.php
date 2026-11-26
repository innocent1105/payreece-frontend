<?php
$token = $argv[1] ?? getenv('MM_TEST_TOKEN') ?: '';
$base = $argv[2] ?? 'http://127.0.0.1:8099';

if ($token === '') {
    fwrite(STDERR, "Usage: php mm_http_smoke.php <public_id-token> [base-url]\n");
    exit(1);
}

function mm_http_request(string $url, string $method, $payload = null, ?array $files = null, string $token = ''): array
{
    $ch = curl_init($url);
    $headers = ['Accept: application/json', 'Authorization: Bearer ' . $token];
    $options = [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => $headers];

    if ($files !== null) {
        $options[CURLOPT_POSTFIELDS] = $payload + $files;
    } elseif ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
        $options[CURLOPT_HTTPHEADER] = $headers;
        $options[CURLOPT_POSTFIELDS] = json_encode($payload);
    }

    curl_setopt_array($ch, $options);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$status, json_decode((string)$body, true)];
}

function mm_make_jpeg(string $path): void
{
    $image = imagecreatetruecolor(320, 240);
    imagefill($image, 0, 0, imagecolorallocate($image, 40, 42, 104));
    imagejpeg($image, $path, 85);
    imagedestroy($image);
}

$dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mm_http_' . bin2hex(random_bytes(4));
mkdir($dir, 0700, true);
$front = $dir . DIRECTORY_SEPARATOR . 'front.jpg';
$selfie = $dir . DIRECTORY_SEPARATOR . 'selfie.jpg';
mm_make_jpeg($front);
mm_make_jpeg($selfie);

[$status, $response] = mm_http_request($base . '/marketplace.php?action=agent.register', 'POST', [
    'token' => $token,
    'business_name' => 'HTTP Test Agent',
    'address_text' => 'Cairo Road, Lusaka',
    'lat' => '-15.3875000',
    'lng' => '28.3228000',
    'nrc_number' => 'TEST-123456',
    'networks' => json_encode(['MTN', 'AIRTEL']),
    'vehicle_description' => 'Blue motorbike',
], [
    'nrc_front' => new CURLFile($front, 'image/jpeg', 'front.jpg'),
    'selfie' => new CURLFile($selfie, 'image/jpeg', 'selfie.jpg'),
], $token);

$ok = $status === 200 && !empty($response['success']);
echo ($ok ? 'PASS' : 'FAIL') . ": agent.register HTTP $status " . json_encode($response) . PHP_EOL;

$agentId = (int)($response['data']['agent_id'] ?? 0);

if ($ok) {
    [$status, $response] = mm_http_request($base . '/marketplace.php?action=agent.liquidity', 'PUT', [
        'token' => $token,
        'network' => 'MTN',
        'cash_balance' => '2500.00',
        'float_balance' => '1800.00',
    ], null, $token);
    $liquidityOk = $status === 200 && !empty($response['success']);
    echo ($liquidityOk ? 'PASS' : 'FAIL') . ": agent.liquidity HTTP $status " . json_encode($response) . PHP_EOL;

    [$status, $response] = mm_http_request($base . '/marketplace.php?action=agent.profile', 'GET', null, null, $token);
    $profileOk = $status === 200 && ($response['data']['liquidity']['MTN']['cash_balance'] ?? '') === '2500.00';
    echo ($profileOk ? 'PASS' : 'FAIL') . ": agent.profile HTTP $status" . PHP_EOL;
}

if ($agentId > 0) {
    $pdo = new PDO(
        'mysql:host=' . (getenv('IPAY_DB_HOST') ?: 'localhost') . ';dbname=' . (getenv('IPAY_DB_NAME') ?: 'payper') . ';charset=utf8mb4',
        getenv('IPAY_DB_USER') ?: 'root',
        getenv('IPAY_DB_PASS') !== false ? getenv('IPAY_DB_PASS') : '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $stmt = $pdo->prepare('SELECT nrc_front_path, nrc_back_path, selfie_path FROM agent_profiles WHERE agent_id = ?');
    $stmt->execute([$agentId]);
    $paths = $stmt->fetch(PDO::FETCH_ASSOC);
    $stmt = $pdo->prepare('SELECT user_id FROM agent_profiles WHERE agent_id = ?');
    $stmt->execute([$agentId]);
    $ownerId = (int)$stmt->fetchColumn();
    $pdo->exec('DELETE FROM liquidity_ledger WHERE agent_id = ' . $agentId);
    $pdo->exec('DELETE FROM transaction_audit_logs WHERE entity_type = \'agent_profile\' AND entity_id = ' . $agentId);
    $pdo->exec('DELETE FROM transaction_audit_logs WHERE entity_type = \'agent_liquidity\' AND entity_id IN (SELECT liquidity_id FROM agent_liquidity WHERE agent_id = ' . $agentId . ')');
    $pdo->exec('DELETE FROM agent_networks WHERE agent_id = ' . $agentId);
    $pdo->exec('DELETE FROM agent_liquidity WHERE agent_id = ' . $agentId);
    $pdo->exec('DELETE FROM agent_profiles WHERE agent_id = ' . $agentId);
    $uploadDir = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'ipay_private' . DIRECTORY_SEPARATOR . 'mm' . DIRECTORY_SEPARATOR . 'agents' . DIRECTORY_SEPARATOR . $ownerId;
    if (is_dir($uploadDir)) {
        foreach (glob($uploadDir . DIRECTORY_SEPARATOR . '*.jpg') ?: [] as $file) {
            if ($paths && in_array(basename($file), array_filter($paths), true)) {
                unlink($file);
            }
        }
    }
}

array_map('unlink', [$front, $selfie]);
rmdir($dir);

echo ($ok && ($liquidityOk ?? false) && ($profileOk ?? false)) ? 'HTTP_SMOKE_OK' . PHP_EOL : 'HTTP_SMOKE_FAILED' . PHP_EOL;
exit(($ok && ($liquidityOk ?? false) && ($profileOk ?? false)) ? 0 : 1);
