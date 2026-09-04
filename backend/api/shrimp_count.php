<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'shrimp_detected' => false, 'shrimp_count' => 0, 'valid_shrimp_present' => false, 'message' => 'Method not allowed.']);
    exit;
}

if (!isset($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'shrimp_detected' => false, 'shrimp_count' => 0, 'valid_shrimp_present' => false, 'message' => 'Please upload or capture a shrimp image.']);
    exit;
}

$flaskUrl = getenv('SHRIMP_AI_COUNT_URL') ?: 'http://127.0.0.1:5001/count';

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
    CURLOPT_POSTFIELDS => ['image' => $file],
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
        'message' => $decoded['message'] ?? ($curlError ?: 'Shrimp preview detection is unavailable. Start the Flask API and retry.'),
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
    'status' => $shrimpDetected ? 'success' : 'no_shrimp',
    'shrimp_detected' => $shrimpDetected,
    'shrimp_count' => max(0, $shrimpDetected ? max(1, $shrimpCount) : $shrimpCount),
    'valid_shrimp_present' => (bool)($decoded['valid_shrimp_present'] ?? $shrimpDetected),
    'message' => $decoded['message'] ?? ($shrimpDetected ? 'Shrimp detected.' : 'No shrimp detected.'),
    'confidence' => (float)($decoded['confidence'] ?? 0.0),
]);
