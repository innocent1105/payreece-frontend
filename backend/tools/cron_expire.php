<?php
require_once __DIR__ . '/../mm_core.php';
require_once __DIR__ . '/../mm_matching.php';

$processed = mm_process_expirations($pdo);
echo json_encode(['success' => true, 'processed' => $processed]) . PHP_EOL;
