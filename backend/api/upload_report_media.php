<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

if (empty($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No file uploaded.']);
    exit;
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'File upload error code: ' . $file['error']]);
    exit;
}

$targetDir = __DIR__ . '/../uploads/reports/';
if (!file_exists($targetDir)) {
    @mkdir($targetDir, 0777, true);
}

$filename = basename($file['name']);
$ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

$allowedImages = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$allowedVideos = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

$type = 'unknown';
if (in_array($ext, $allowedImages, true)) {
    $type = 'image';
} elseif (in_array($ext, $allowedVideos, true)) {
    $type = 'video';
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid file extension. Allowed: JPG, PNG, WEBP, MP4, WEBM, MOV']);
    exit;
}

$newFileName = 'report_' . time() . '_' . substr(md5(uniqid()), 0, 8) . '.' . $ext;
$targetPath = $targetDir . $newFileName;

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $webUrl = "{$protocol}://{$host}/shrim_predict_api/backend/uploads/reports/" . $newFileName;

    echo json_encode([
        'success' => true,
        'file_url' => $webUrl,
        'file_name' => $newFileName,
        'file_type' => $type,
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file on server.']);
}
