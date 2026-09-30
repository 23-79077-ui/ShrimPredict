<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';

if ($requestMethod === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. Include dynamic configuration file (Checks api/config.php and config/config.php)
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
} elseif (file_exists(__DIR__ . '/../config/config.php')) {
    require_once __DIR__ . '/../config/config.php';
}

if ($requestMethod !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'shrimp_detected' => false, 'shrimp_count' => 0, 'valid_shrimp_present' => false, 'message' => 'Method not allowed.']);
    exit;
}

if (!isset($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'shrimp_detected' => false, 'shrimp_count' => 0, 'valid_shrimp_present' => false, 'message' => 'Please upload or capture a shrimp image.']);
    exit;
}

// 2. Dynamic Flask URL resolution (Priority: ENV -> Config constant/variable -> Localhost fallback)
$flaskUrl = getenv('SHRIMP_AI_COUNT_URL')
    ?: (defined('FLASK_SHRIMP_COUNT_URL') ? FLASK_SHRIMP_COUNT_URL
    : (defined('FLASK_COUNT_URL') ? FLASK_COUNT_URL
    : (defined('FLASK_BASE_URL') ? FLASK_BASE_URL . '/count'
    : ($FLASK_SHRIMP_COUNT_URL ?? ($FLASK_URL ?? ($NGROK_BASE_URL ?? 'http://127.0.0.1:5001/count'))))));

if (!preg_match('#/(count|detect-preview)$#i', $flaskUrl)) {
    $flaskUrl = rtrim($flaskUrl, '/') . '/count';
}

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'shrimp_detected' => false, 'shrimp_count' => 0, 'valid_shrimp_present' => false, 'message' => 'PHP cURL is required to call the Flask preview API.']);
    exit;
}

$curl = curl_init($flaskUrl);
$file = new CURLFile(
    $_FILES['image']['tmp_name'],
    $_FILES['image']['type'] ?: 'image/jpeg',
    $_FILES['image']['name'] ?: 'shrimp-preview.jpg'
);

curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_POSTREDIR => CURL_REDIR_POST_ALL,
    CURLOPT_POSTFIELDS => ['image' => $file],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_HTTPHEADER => ['ngrok-skip-browser-warning: 1'],
]);

$rawResponse = curl_exec($curl);
$curlError = curl_error($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($rawResponse === false || $httpCode >= 400) {
    $decoded = $rawResponse ? json_decode($rawResponse, true) : null;
    http_response_code($httpCode >= 400 ? $httpCode : 503);
    echo json_encode([
        'success' => false,
        'shrimp_detected' => false,
        'shrimp_count' => 0,
        'valid_shrimp_present' => false,
        'message' => $decoded['message'] ?? ($curlError ?: 'Shrimp preview detection is unavailable. Verify your ngrok URL in config.php and restart Flask API.'),
    ]);
    exit;
}

$decoded = json_decode($rawResponse, true);
if (!$decoded || !is_array($decoded)) {
    http_response_code(502);
    echo json_encode(['success' => false, 'shrimp_detected' => false, 'shrimp_count' => 0, 'valid_shrimp_present' => false, 'message' => 'Invalid response from the shrimp preview API.']);
    exit;
}

$shrimpDetected = (bool)($decoded['shrimp_detected'] ?? $decoded['valid_shrimp_present'] ?? false);
$shrimpCount = isset($decoded['shrimp_count']) ? (int)$decoded['shrimp_count'] : ($shrimpDetected ? 1 : 0);

echo json_encode([
    'success' => true,
    'status' => $shrimpDetected && !($decoded['is_cooked'] ?? false) ? 'success' : (($decoded['is_cooked'] ?? false) ? 'cooked_shrimp' : 'no_shrimp'),
    'shrimp_detected' => $shrimpDetected,
    'shrimp_count' => max(0, $shrimpDetected ? max(1, $shrimpCount) : $shrimpCount),
    'valid_shrimp_present' => (bool)($decoded['valid_shrimp_present'] ?? $shrimpDetected),
    'is_cooked' => (bool)($decoded['is_cooked'] ?? false),
    'message' => $decoded['message'] ?? ($shrimpDetected ? 'Shrimp detected.' : 'No shrimp detected.'),
    'confidence' => (float)($decoded['confidence'] ?? 0.0),
]);
