<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';

$input = ipay_json_input();
ipay_require_post();

$phoneNumber = trim((string)($input['phone_number'] ?? ''));

if ($phoneNumber === '') {
    ipay_json(['success' => false, 'message' => 'Phone number is required'], 400);
}

try {
    $digits = preg_replace('/\D+/', '', $phoneNumber);
    $terms = array_values(array_unique(array_filter([$phoneNumber, $digits, ltrim($digits, '0'), '0' . ltrim($digits, '0')], 'strlen')));

    $clauses = [];
    $params = [];
    foreach ($terms as $term) {
        $clauses[] = "REPLACE(REPLACE(REPLACE(phone_number, '+', ''), ' ', ''), '-', '') LIKE ?";
        $params[] = $term . '%';
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE ' . implode(' OR ', $clauses) . ' LIMIT 10');
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $users = [];
    foreach ($rows as $row) {
        $users[] = [
            'p_id'         => $row['public_id'],
            'public_id'    => $row['public_id'],
            'username'     => $row['username'],
            'fullname'     => $row['fullname'],
            'phone_number' => $row['phone_number'],
            'avatar'       => $row['avatar']
        ];
    }

    ipay_json(['success' => true, 'message' => 'Found', 'users' => $users]);
} catch (Throwable $e) {
    ipay_json(['success' => false, 'message' => 'Search failed'], 500);
}
