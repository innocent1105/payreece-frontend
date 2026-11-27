<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';

$input = ipay_json_input();
ipay_require_post();

$publicId = trim((string)($input['public_id'] ?? $input['token'] ?? ''));
$token    = trim((string)($input['expo_token'] ?? $input['token'] ?? ''));

if ($publicId === '' || $token === '') {
    ipay_json(['success' => false, 'message' => 'Missing public_id or token'], 400);
}

try {
    $stmt = $pdo->prepare('SELECT user_id FROM users WHERE public_id = ? LIMIT 1');
    $stmt->execute([$publicId]);
    $userId = (int)$stmt->fetchColumn();

    if ($userId === 0) {
        ipay_json(['success' => false, 'message' => 'User not found'], 404);
    }

    $stmt = $pdo->prepare('UPDATE users SET expo_push_token = ? WHERE public_id = ?');
    $stmt->execute([$token, $publicId]);

    $stmt = $pdo->prepare('INSERT INTO user_push_tokens (user_id, expo_token, active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE active = 1, expo_token = VALUES(expo_token)');
    $stmt->execute([$userId, $token]);

    ipay_json(['success' => true]);
} catch (Throwable $e) {
    ipay_json(['success' => false, 'message' => 'Could not save token'], 500);
}
