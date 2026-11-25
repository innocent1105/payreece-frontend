<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';

$input = ipay_json_input();
ipay_require_post();

$phone    = trim((string)($input['mobile_number'] ?? ''));
$password = trim((string)($input['password'] ?? ''));

if (strlen($phone) < 10 || $password === '') {
    ipay_json([
        'success' => false,
        'message' => 'Invalid mobile number or PIN format.'
    ], 400);
}

try {
    $stmt = $pdo->prepare("SELECT public_id, password FROM users WHERE phone_number = ? LIMIT 1");
    $stmt->execute([$phone]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        ipay_json([
            'success' => false,
            'message' => 'Invalid credentials.'
        ], 401);
    }

    ipay_json([
        'success'   => true,
        'message'   => 'Login successful',
        'token'     => $user['public_id'],
        'public_id' => $user['public_id']
    ]);
} catch (Throwable $e) {
    ipay_json([
        'success' => false,
        'message' => 'An internal server error occurred during login.'
    ], 500);
}
