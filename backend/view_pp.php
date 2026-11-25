<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

$filename = basename((string)($_GET['file'] ?? ''));

if ($filename === '') {
    ipay_json(['success' => false, 'message' => 'No file specified'], 400);
}

$filepath = __DIR__ . '/avatars/' . $filename;

if (!file_exists($filepath) || !is_file($filepath)) {
    ipay_json(['success' => false, 'message' => 'File not found'], 404);
}

$mime = mime_content_type($filepath) ?: 'application/octet-stream';

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($filepath));
header('Cache-Control: public, max-age=3600');
readfile($filepath);
exit;
