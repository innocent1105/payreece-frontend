<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';

$input = ipay_json_input();
ipay_require_post();

$token = trim((string)($input['token'] ?? ''));

if ($token === '') {
    ipay_json(['success' => false, 'message' => 'Invalid token'], 401);
}

try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE public_id = ? LIMIT 1");
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        ipay_json(['success' => false, 'message' => 'User not found'], 404);
    }

    $fields = ['fullname', 'username', 'email', 'phone_number', 'student_id', 'gender'];
    $updateData = [];

    foreach ($fields as $field) {
        if (array_key_exists($field, $input) && trim((string)$input[$field]) !== '') {
            $updateData[$field] = trim((string)$input[$field]);
        }
    }

    if (isset($updateData['gender'])) {
        $updateData['gender'] = strtolower($updateData['gender']);
        if (!in_array($updateData['gender'], ['male', 'female', 'other'], true)) {
            ipay_json(['success' => false, 'message' => 'Invalid gender value'], 400);
        }
    }

    if (isset($input['avatar']) && is_string($input['avatar'])) {
        if (preg_match('/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.*)$/s', $input['avatar'], $matches)) {
            $data = base64_decode($matches[2], true);

            if ($data === false || strlen($data) > 5 * 1024 * 1024) {
                ipay_json(['success' => false, 'message' => 'Invalid or oversized image data'], 400);
            }

            $ext = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
            $filename = uniqid('avatar_') . '.' . $ext;
            $filepath = __DIR__ . '/avatars/' . $filename;

            if (!file_put_contents($filepath, $data)) {
                ipay_json(['success' => false, 'message' => 'Failed to save avatar'], 500);
            }

            if (!empty($user['avatar']) && basename($user['avatar']) === $user['avatar'] && file_exists(__DIR__ . '/avatars/' . $user['avatar'])) {
                @unlink(__DIR__ . '/avatars/' . $user['avatar']);
            }

            $updateData['avatar'] = $filename;
        } elseif (str_starts_with($input['avatar'], 'data:')) {
            ipay_json(['success' => false, 'message' => 'Unsupported image format'], 400);
        }
    }

    if (!empty($updateData)) {
        $columns = [];
        foreach (array_keys($updateData) as $field) {
            $columns[] = "$field = :$field";
        }
        $updateData['public_id'] = $user['public_id'];
        $stmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $columns) . ' WHERE public_id = :public_id');
        $stmt->execute($updateData);
    }

    $stmt = $pdo->prepare("SELECT public_id, fullname, username, email, phone_number, student_id, gender, avatar FROM users WHERE public_id = ? LIMIT 1");
    $stmt->execute([$user['public_id']]);
    $updatedUser = $stmt->fetch();
    $updatedUser['full_name'] = $updatedUser['fullname'];

    ipay_json([
        'success' => true,
        'message' => 'Profile updated successfully',
        'updated_user' => $updatedUser
    ]);
} catch (PDOException $e) {
    $message = 'Failed to update profile';
    if (($e->errorInfo[1] ?? null) === 1062) {
        $message = 'That username, email or phone number is already in use';
    }
    ipay_json(['success' => false, 'message' => $message], 409);
} catch (Throwable $e) {
    ipay_json(['success' => false, 'message' => 'Failed to update profile'], 500);
}
