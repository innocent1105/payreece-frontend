<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';

$input = ipay_json_input();
ipay_require_post();

$fullname   = trim((string)($input['username'] ?? ''));
$phone      = trim((string)($input['mobile_number'] ?? ''));
$password   = trim((string)($input['password'] ?? ''));
$gender     = strtolower(trim((string)($input['gender'] ?? 'other')));
$expo_token = trim((string)($input['expo_token'] ?? ''));
$role = strtolower(trim((string)($input['role'] ?? $input['account_type'] ?? 'user')));

if (!in_array($gender, ['male', 'female', 'other'], true)) {
    $gender = 'other';
}
if (!in_array($role, ['user', 'agent'], true)) {
    $role = 'user';
}

if (mb_strlen($fullname) < 4 || strlen($phone) < 10 || strlen($password) !== 6) {
    ipay_json([
        'success' => false,
        'message' => 'Invalid registration data. Name must be at least 4 characters, phone at least 10 digits, and PIN exactly 6 digits.'
    ], 400);
}

try {
    $stmt = $pdo->prepare("SELECT avatar FROM avatars ORDER BY RAND() LIMIT 1");
    $stmt->execute();
    $avatar = (string)($stmt->fetchColumn() ?: 'avatar1.jpg');

    $username = strtolower(preg_replace('/\s+/', '', $fullname));
    $publicId = bin2hex(random_bytes(16));
    $email    = $username . '@payreece.com';
    $pinHash  = password_hash($password, PASSWORD_BCRYPT);

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        INSERT INTO users (
            public_id, username, fullname, phone_number, password, email, gender, expo_push_token, avatar, marketplace_role
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $publicId,
        $username,
        $fullname,
        $phone,
        $pinHash,
        $email,
        $gender,
        $expo_token,
        $avatar,
        $role
    ]);

    $userId = $pdo->lastInsertId();

    $stmt = $pdo->prepare("INSERT INTO wallets (user_id, wallet_type, balance, currency, status) VALUES (?, 'main', 0.00, 'ZMW', 'active')");
    $stmt->execute([$userId]);

    $pdo->commit();

    ipay_json([
        'success' => true,
        'message' => 'Registration successful',
        'data' => [
            'public_id' => $publicId
        ]
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $message = 'This number is already registered or registration failed';
    if (($e->errorInfo[1] ?? null) === 1062) {
        $message = 'This phone number or username is already registered';
    }

    ipay_json(['success' => false, 'message' => $message], 409);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ipay_json(['success' => false, 'message' => 'Registration failed'], 500);
}
