<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';

$input = ipay_json_input();
ipay_require_post();

$phone    = trim((string)($input['phone_number'] ?? ''));
$password = (string)($input['password'] ?? '');
$senderId = trim((string)($input['sender_id'] ?? $input['token'] ?? ''));
$amount   = round((float)($input['amount'] ?? 0), 2);
$network  = strtolower(trim((string)($input['network'] ?? $input['selectedNetwork'] ?? '')));

if (strlen($phone) < 10 || $password === '' || $senderId === '' || $amount <= 0) {
    ipay_json(['success' => false, 'message' => 'Invalid transfer details.'], 400);
}

try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE public_id = ? LIMIT 1");
    $stmt->execute([$senderId]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        ipay_json(['success' => false, 'message' => 'Invalid credentials.'], 401);
    }

    $stmt = $pdo->prepare("SELECT balance, wallet_id FROM wallets WHERE user_id = ? AND wallet_type = 'main' AND status = 'active' LIMIT 1 FOR UPDATE");
    $stmt->execute([$user['user_id']]);
    $wallet = $stmt->fetch();

    $fee = 0.85;
    if (!$wallet || (float)$wallet['balance'] < $amount + $fee) {
        ipay_json(['success' => false, 'message' => 'Insufficient balance.'], 400);
    }

    ipay_json(['success' => false, 'message' => 'Mobile money transfers are not enabled yet. Use an iPay user transfer instead.'], 501);
} catch (Throwable $e) {
    ipay_json(['success' => false, 'message' => 'Transfer failed.'], 500);
}
