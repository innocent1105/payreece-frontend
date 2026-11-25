<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';

$input = ipay_json_input();
ipay_require_post();

$publicId = trim((string)($input['public_id'] ?? $input['token'] ?? ''));
$token    = trim((string)($input['token'] ?? $input['expo_token'] ?? ''));

if ($publicId === '' || $token === '') {
    ipay_json(['success' => false, 'message' => 'Missing public_id or token'], 400);
}

try {
    $stmt = $pdo->prepare('UPDATE users SET expo_push_token = ? WHERE public_id = ?');
    $stmt->execute([$token, $publicId]);

    if ($stmt->rowCount() === 0) {
        ipay_json(['success' => false, 'message' => 'User not found'], 404);
    }

    ipay_json(['success' => true]);
} catch (Throwable $e) {
    ipay_json(['success' => false, 'message' => 'Could not save token'], 500);
}
