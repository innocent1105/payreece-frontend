<?php
require_once __DIR__ . '/mm_core.php';

function mm_upload_dir(): string
{
    $dir = getenv('IPAY_MM_UPLOAD_DIR');
    if (!$dir) {
        $dir = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'ipay_private' . DIRECTORY_SEPARATOR . 'mm';
    }
    return rtrim($dir, DIRECTORY_SEPARATOR);
}

function mm_store_agent_image(string $field, int $userId, string $label): ?string
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field]) || ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES[$field];
    if (($file['error'] ?? 0) !== UPLOAD_ERR_OK || ($file['size'] ?? 0) <= 0 || ($file['size'] ?? 0) > 5 * 1024 * 1024) {
        mm_fail('Invalid ' . $label . ' upload (max 5 MB).', 400, 'invalid_upload');
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
        mm_fail($label . ' must be a JPG, PNG, or WEBP image.', 400, 'invalid_upload_type');
    }

    $size = @getimagesize($file['tmp_name']);
    if (!$size || $size[0] < 120 || $size[1] < 120 || $size[0] > 8000 || $size[1] > 8000) {
        mm_fail($label . ' image dimensions are invalid.', 400, 'invalid_upload_image');
    }

    $source = match ($mime) {
        'image/jpeg' => @imagecreatefromjpeg($file['tmp_name']),
        'image/png' => @imagecreatefrompng($file['tmp_name']),
        'image/webp' => @imagecreatefromwebp($file['tmp_name']),
        default => false,
    };

    if (!$source) {
        mm_fail('Could not process ' . $label . '. Enable GD in PHP.', 500, 'image_processing_unavailable');
    }

    $maxDimension = 1600;
    $ratio = min(1, $maxDimension / max($size[0], $size[1]));
    $width = max(1, (int)round($size[0] * $ratio));
    $height = max(1, (int)round($size[1] * $ratio));
    $encoded = imagecreatetruecolor($width, $height);
    imagefill($encoded, 0, 0, imagecolorallocate($encoded, 255, 255, 255));
    imagecopyresampled($encoded, $source, 0, 0, 0, 0, $width, $height, $size[0], $size[1]);

    $directory = mm_upload_dir() . DIRECTORY_SEPARATOR . 'agents' . DIRECTORY_SEPARATOR . $userId;
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        mm_fail('Could not create secure upload directory.', 500, 'upload_directory_error');
    }

    $filename = bin2hex(random_bytes(16)) . '.jpg';
    $path = $directory . DIRECTORY_SEPARATOR . $filename;
    if (!imagejpeg($encoded, $path, 85)) {
        mm_fail('Could not save ' . $label . '.', 500, 'upload_save_error');
    }

    imagedestroy($source);
    imagedestroy($encoded);
    return $filename;
}

function mm_serve_private_image(PDO $pdo, array $user, string $filename): never
{
    $filename = basename($filename);
    if (!preg_match('/^[a-f0-9]{32}\.jpg$/', $filename)) {
        mm_fail('Invalid document reference.', 404, 'document_not_found');
    }

    $stmt = $pdo->prepare('
        SELECT a.user_id FROM agent_profiles a
        WHERE a.nrc_front_path = ? OR a.nrc_back_path = ? OR a.selfie_path = ?
        LIMIT 1
    ');
    $stmt->execute([$filename, $filename, $filename]);
    $ownerId = (int)$stmt->fetchColumn();

    if ($ownerId <= 0 || ($ownerId !== (int)$user['user_id'] && !mm_is_admin($user))) {
        mm_fail('Document not found.', 404, 'document_not_found');
    }

    $path = mm_upload_dir() . DIRECTORY_SEPARATOR . 'agents' . DIRECTORY_SEPARATOR . $ownerId . DIRECTORY_SEPARATOR . $filename;
    if (!is_file($path)) {
        mm_fail('Document not found.', 404, 'document_not_found');
    }

    header('Content-Type: image/jpeg');
    header('Cache-Control: private, no-store');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}
