<?php
require_once __DIR__ . '/../mm_core.php';
require_once __DIR__ . '/../mm_agents.php';

$command = $argv[1] ?? 'list';
$adminPublicId = $argv[2] ?? getenv('IPAY_MM_ADMIN_PUBLIC_ID') ?: '';

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

if ($command === 'list') {
    foreach (mm_admin_agents($pdo, $argv[3] ?? '') as $agent) {
        echo $agent['agent_id'] . "\t" . $agent['verification_status'] . "\t" . $agent['availability'] . "\t" . $agent['business_name'] . "\t" . $agent['fullname'] . PHP_EOL;
    }
    exit(0);
}

if (!in_array($command, ['verify', 'reject', 'suspend', 'reinstate'], true)) {
    fwrite(STDERR, "Usage: admin_agent.php list [status] | verify|reject|suspend|reinstate <agent_id> [reason]\n");
    exit(1);
}

$agentId = (int)($argv[3] ?? 0);
$reason = trim((string)($argv[4] ?? ''));
$result = mm_admin_agent_decision($pdo, $admin, ['agent_id' => $agentId, 'decision' => $command, 'reason' => $reason]);
echo json_encode($result) . PHP_EOL;
