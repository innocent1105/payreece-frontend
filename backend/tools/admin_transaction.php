<?php
require_once __DIR__ . '/../mm_core.php';
require_once __DIR__ . '/../mm_lifecycle.php';

$decision = $argv[1] ?? '';
$adminPublicId = $argv[2] ?? getenv('IPAY_MM_ADMIN_PUBLIC_ID') ?: '';
$transactionId = (int)($argv[3] ?? 0);
$notes = trim((string)($argv[4] ?? 'Resolved by administrator'));

if ($adminPublicId === '') {
    fwrite(STDERR, "Set IPAY_MM_ADMIN_PUBLIC_ID or pass the admin public_id as argument 2.\n");
    exit(1);
}

$stmt = $pdo->prepare('SELECT user_id, public_id, fullname FROM users WHERE public_id = ? LIMIT 1');
$stmt->execute([$adminPublicId]);
$admin = $stmt->fetch();
if (!$admin || !mm_is_admin($admin)) {
    fwrite(STDERR, "Public id is not in IPAY_MM_ADMINS.\n");
    exit(1);
}

echo json_encode(mm_admin_resolve_transaction($pdo, $admin, [
    'decision' => $decision,
    'transaction_id' => $transactionId,
    'notes' => $notes,
])) . PHP_EOL;
