<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';
require_once __DIR__ . '/lib_dashboard.php';

$input = ipay_json_input();
ipay_require_post();

$token = trim((string)($input['token'] ?? ''));

if ($token === '') {
    ipay_json(['success' => false, 'message' => 'Invalid token'], 401);
}

try {
    ipay_json([
        'success' => true,
        'message' => 'User data fetched successfully.',
        'data'    => ipay_transaction_payload($pdo, $token, 0)
    ]);
} catch (Throwable $e) {
    ipay_json([
        'success' => false,
        'message' => 'Database error: Could not fetch data.'
    ], 500);
}
