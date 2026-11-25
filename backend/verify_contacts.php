<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';

$input = ipay_json_input();
ipay_require_post();

$phoneNumbers = $input['phone_numbers'] ?? [];

if (!is_array($phoneNumbers)) {
    ipay_json(['success' => false, 'message' => 'Invalid payload'], 400);
}

try {
    $normalize = static function ($value): array {
        $clean = preg_replace('/\D+/', '', (string)$value);
        $variants = [$clean];

        if (strlen($clean) === 9) {
            $variants[] = '0' . $clean;
            $variants[] = '260' . $clean;
        }
        if (strlen($clean) === 10 && str_starts_with($clean, '0')) {
            $variants[] = '260' . substr($clean, 1);
        }
        if (strlen($clean) === 12 && str_starts_with($clean, '260')) {
            $variants[] = '0' . substr($clean, 3);
        }

        return array_values(array_unique(array_filter($variants, 'strlen')));
    };

    $candidates = [];
    foreach ($phoneNumbers as $number) {
        foreach ($normalize($number) as $value) {
            $candidates[$value] = $value;
        }
    }

    if (empty($candidates)) {
        ipay_json(['success' => true, 'matched_users' => [], 'unmatched_numbers' => array_values($candidates)]);
    }

    $placeholders = implode(',', array_fill(0, count($candidates), '?'));
    $stmt = $pdo->prepare("
        SELECT user_id, public_id, username, fullname, phone_number, avatar
        FROM users
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone_number, '+', ''), ' ', ''), '-', ''), '00', '') IN ($placeholders)
           OR REPLACE(REPLACE(REPLACE(phone_number, '+', ''), ' ', ''), '-', '') IN ($placeholders)
    ");
    $stmt->execute(array_merge(array_values($candidates), array_values($candidates)));
    $matchedUsers = $stmt->fetchAll();

    $matchedNumbers = array_map(
        static fn($user) => preg_replace('/\D+/', '', $user['phone_number']),
        $matchedUsers
    );

    foreach ($matchedNumbers as $number) {
        foreach ($normalize($number) as $value) {
            unset($candidates[$value]);
        }
    }

    ipay_json([
        'success' => true,
        'matched_users' => $matchedUsers,
        'unmatched_numbers' => array_values($candidates)
    ]);
} catch (Throwable $e) {
    ipay_json(['success' => false, 'message' => 'Server error'], 500);
}
