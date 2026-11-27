<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();
 
require_once __DIR__ . '/connection.php';
require_once __DIR__ . '/lib_lenco.php';

$input = ipay_json_input();
ipay_require_post();

$amount = round((float)($input['amount'] ?? 0), 2);
$phone  = trim((string)($input['phone'] ?? ''));
$pId    = trim((string)($input['p_id'] ?? $input['token'] ?? ''));

if ($amount <= 0 || $phone === '' || $pId === '') {
    ipay_json(['success' => false, 'message' => 'Invalid deposit data'], 400);
}

try {
    $stmt = $pdo->prepare("SELECT user_id, expo_push_token FROM users WHERE public_id = ? LIMIT 1");
    $stmt->execute([$pId]);
    $user = $stmt->fetch();

    if (!$user) {
        ipay_json(['success' => false, 'message' => 'User not found.'], 404);
    }

    $stmt = $pdo->prepare("SELECT wallet_id FROM wallets WHERE user_id = ? AND wallet_type = 'main' AND status = 'active' LIMIT 1");
    $stmt->execute([$user['user_id']]);
    $walletId = $stmt->fetchColumn();

    if (!$walletId) {
        ipay_json(['success' => false, 'message' => 'Active wallet not found.'], 404);
    }

    $reference = 'TXN_' . bin2hex(random_bytes(12));
    $telco = ipay_detect_telco($phone);

    $response = ipay_http_request(
        'POST',
        'https://api.lenco.co/access/v2/collections/mobile-money',
        [
            'Authorization' => 'Bearer ' . ipay_lenco_secret(),
            'Accept'        => 'application/json',
            'Content-Type'  => 'application/json'
        ],
        [
            'amount'    => $amount,
            'reference' => $reference,
            'phone'     => $phone,
            'operator'  => $telco,
            'country'   => 'zm',
            'bearer'    => 'merchant'
        ]
    );

    if ($response['status'] >= 400) {
        throw new RuntimeException('Could not initiate collection',$response['status'] );
    }

    $stmt = $pdo->prepare("
        INSERT INTO transactions (user_id, wallet_id, t_type, receiver_id, amount, status, reference)
        VALUES (?, ?, 'deposit', ?, ?, 'pending', ?)
    ");
    $stmt->execute([$user['user_id'], $walletId, $user['user_id'], $amount, $reference]);

    if (!empty($user['expo_push_token'])) {
        $payload = [
            'to' => $user['expo_push_token'],
            'sound' => 'default',
            'title' => 'Transaction Initiated',
            'body' => 'A deposit of ' . number_format($amount, 2) . ' ZMW has been initiated. Please complete the payment on your phone.'
        ];

        try {
            ipay_http_request('POST', 'https://exp.host/--/api/v2/push/send', ['Content-Type' => 'application/json'], $payload);
        } catch (Throwable $ignored) {
            // Push notification is best-effort.
            // echo "Failed to send push notification: " . $ignored->getMessage();
        }
    }

    ipay_json([
        'success'   => true,
        'status'    => 'pending',
        'message'   => 'Please check your phone for the PIN prompt',
        'reference' => $reference
    ]);
} catch (Throwable $e) {
    ipay_json(['success' => false, 'message' => $e->getMessage()], 502);
}
