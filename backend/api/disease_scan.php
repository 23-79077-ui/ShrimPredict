<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/notifications_helper.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please upload or capture a shrimp image.']);
    exit;
}

$aiUrl = getenv('SHRIMP_AI_API_URL') ?: 'http://127.0.0.1:5001/predict';

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'PHP cURL is required to call the AI model API.']);
    exit;
}

$curl = curl_init($aiUrl);
$file = new CURLFile(
    $_FILES['image']['tmp_name'],
    $_FILES['image']['type'] ?: 'image/jpeg',
    $_FILES['image']['name'] ?: 'shrimp-scan.jpg'
);

curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_POSTFIELDS => ['image' => $file],
]);

$aiResponse = curl_exec($curl);
$curlError = curl_error($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($aiResponse === false || $httpCode >= 400) {
    $parsedAi = $aiResponse ? json_decode($aiResponse, true) : null;
    $errorMsg = $parsedAi['message'] ?? ($curlError ?: 'AI disease model is unavailable. Start the Flask model API after training.');
    http_response_code($httpCode >= 400 ? $httpCode : 503);
    echo json_encode([
        'success' => false,
        'message' => $errorMsg,
        'ai_response' => $parsedAi
    ]);
    exit;
}

$prediction = json_decode($aiResponse, true);
if (!$prediction || empty($prediction['success'])) {
    http_response_code(502);
    echo json_encode(['success' => false, 'message' => 'Invalid AI model response.', 'ai_response' => $prediction]);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/disease_scans/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
$safeName = preg_replace('/[^A-Za-z0-9_.-]/', '_', basename($_FILES['image']['name'] ?: 'shrimp-scan.jpg'));
$targetName = time() . '_' . bin2hex(random_bytes(4)) . '_' . $safeName;
$targetPath = $uploadDir . $targetName;
$imagePath = 'uploads/disease_scans/' . $targetName;

if (!move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to save uploaded image.']);
    exit;
}

$database = new Database();
$conn = $database->getConnection();

function ensureDiseaseReportsSchema($conn) {
    $conn->exec("
        CREATE TABLE IF NOT EXISTS disease_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            caretaker_name VARCHAR(150) DEFAULT NULL,
            pond_name VARCHAR(150) DEFAULT NULL,
            disease_name VARCHAR(100) NOT NULL,
            confidence_score DECIMAL(5,2) DEFAULT 0,
            risk_level VARCHAR(20) DEFAULT 'Low',
            recommendation TEXT,
            status VARCHAR(20) DEFAULT 'Pending',
            model_used VARCHAR(100) DEFAULT NULL,
            health_status VARCHAR(50) DEFAULT NULL,
            description TEXT,
            image_path VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_disease_risk (risk_level),
            INDEX idx_disease_user (user_id)
        )
    ");

    $columns = $conn->query("SHOW COLUMNS FROM disease_reports")->fetchAll(PDO::FETCH_COLUMN);
    $alterations = [
        'user_id' => "ALTER TABLE disease_reports ADD COLUMN user_id INT DEFAULT NULL AFTER id",
        'caretaker_name' => "ALTER TABLE disease_reports ADD COLUMN caretaker_name VARCHAR(150) DEFAULT NULL AFTER user_id",
        'pond_name' => "ALTER TABLE disease_reports ADD COLUMN pond_name VARCHAR(150) DEFAULT NULL AFTER caretaker_name",
        'model_used' => "ALTER TABLE disease_reports ADD COLUMN model_used VARCHAR(100) DEFAULT NULL AFTER status",
        'health_status' => "ALTER TABLE disease_reports ADD COLUMN health_status VARCHAR(50) DEFAULT NULL AFTER model_used",
        'description' => "ALTER TABLE disease_reports ADD COLUMN description TEXT AFTER health_status",
    ];

    foreach ($alterations as $column => $sql) {
        if (!in_array($column, $columns, true)) {
            try {
                $conn->exec($sql);
            } catch (Exception $e) {}
        }
    }
}

ensureDiseaseReportsSchema($conn);

$diseaseName = $prediction['prediction'] ?? $prediction['disease_name'] ?? 'Unknown Disease';
$confidenceScore = isset($prediction['confidence_score']) ? (float)$prediction['confidence_score'] : (isset($prediction['confidence']) ? (float)$prediction['confidence'] : 0);
$riskLevel = $prediction['risk_level'] ?? 'Low';
$recommendation = $prediction['recommendation'] ?? 'Monitor closely.';
$status = $_POST['status'] ?? 'Pending';
$modelUsed = $prediction['model_used'] ?? 'Desktop/Shrimp Trained Model';
$healthStatus = $prediction['status'] ?? ($riskLevel === 'Low' ? 'Healthy' : 'Diseased');
$description = $prediction['description'] ?? "Shrimp scan evaluated with {$confidenceScore}% confidence.";
$userId = isset($_POST['user_id']) && is_numeric($_POST['user_id']) ? (int)$_POST['user_id'] : null;
$caretakerName = $_POST['caretaker_name'] ?? 'Caretaker';
$pondName = $_POST['pond_name'] ?? 'Assigned Pond';

$stmt = $conn->prepare('INSERT INTO disease_reports (user_id, caretaker_name, pond_name, disease_name, confidence_score, risk_level, recommendation, status, model_used, health_status, description, image_path, created_at) VALUES (:user_id, :caretaker_name, :pond_name, :disease_name, :confidence_score, :risk_level, :recommendation, :status, :model_used, :health_status, :description, :image_path, NOW())');
$stmt->execute([
    ':user_id' => $userId,
    ':caretaker_name' => $caretakerName,
    ':pond_name' => $pondName,
    ':disease_name' => $diseaseName,
    ':confidence_score' => $confidenceScore,
    ':risk_level' => $riskLevel,
    ':recommendation' => $recommendation,
    ':status' => $status,
    ':model_used' => $modelUsed,
    ':health_status' => $healthStatus,
    ':description' => $description,
    ':image_path' => $imagePath
]);

$reportId = $conn->lastInsertId();
$notifMsg = "{$caretakerName} scanned for disease: {$diseaseName} ({$healthStatus}) using {$modelUsed} with {$confidenceScore}% confidence.";
createNotification($conn, 'Disease Scan Submitted', $notifMsg, $caretakerName, 'disease_scan', $pondName, $userId, $reportId);

echo json_encode([
    'success' => true,
    'message' => 'Disease scan completed and saved.',
    'prediction' => $prediction,
    'report' => [
        'id' => $reportId,
        'disease_name' => $diseaseName,
        'confidence_score' => $confidenceScore,
        'risk_level' => $riskLevel,
        'recommendation' => $recommendation,
        'status' => $status,
        'model_used' => $modelUsed,
        'health_status' => $healthStatus,
        'description' => $description,
        'user_id' => $userId,
        'caretaker_name' => $caretakerName,
        'pond_name' => $pondName,
        'image_path' => $imagePath
    ]
]);
