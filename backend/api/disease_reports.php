<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/notifications_helper.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$database = new Database();
$conn = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $conn->query('SELECT * FROM disease_reports ORDER BY id DESC');
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawBody = file_get_contents('php://input');
    $jsonData = json_decode($rawBody, true);

    $diseaseName = $_POST['disease_name'] ?? ($jsonData['disease_name'] ?? 'Unknown Disease');
    $confidenceScore = $_POST['confidence_score'] ?? ($jsonData['confidence_score'] ?? 0);
    $riskLevel = $_POST['risk_level'] ?? ($jsonData['risk_level'] ?? 'Low');
    $recommendation = $_POST['recommendation'] ?? ($jsonData['recommendation'] ?? 'Monitor closely');
    $status = $_POST['status'] ?? ($jsonData['status'] ?? 'Pending');
    $caretakerName = $_POST['caretaker_name'] ?? ($jsonData['caretaker_name'] ?? ($jsonData['recorded_by'] ?? 'Caretaker'));
    $pondName = $_POST['pond_name'] ?? ($jsonData['pond_name'] ?? 'General Pond');

    $imagePath = 'uploads/sample.jpg';

    if (isset($_FILES['image']) && $_FILES['image']['tmp_name']) {
        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
        $fileName = time() . '_' . basename($_FILES['image']['name']);
        $target = $uploadDir . $fileName;
        if (move_uploaded_file($_FILES['image']['tmp_name'], $target)) {
            $imagePath = 'uploads/' . $fileName;
        }
    } else if (isset($jsonData['image_path'])) {
        $imagePath = $jsonData['image_path'];
    }

    $stmt = $conn->prepare('INSERT INTO disease_reports (disease_name, confidence_score, risk_level, recommendation, status, image_path, created_at) VALUES (:disease_name, :confidence_score, :risk_level, :recommendation, :status, :image_path, NOW())');
    $stmt->execute([
        ':disease_name' => $diseaseName,
        ':confidence_score' => $confidenceScore,
        ':risk_level' => $riskLevel,
        ':recommendation' => $recommendation,
        ':status' => $status,
        ':image_path' => $imagePath
    ]);
    $reportId = $conn->lastInsertId();

    // Trigger Admin Notification
    $notifMsg = "{$caretakerName} scanned for disease: {$diseaseName} with {$confidenceScore}% confidence ({$riskLevel} Risk).";
    createNotification($conn, 'Disease Scan Submitted', $notifMsg, $caretakerName, 'disease_scan', $pondName);

    echo json_encode(['success' => true, 'message' => 'Disease report saved', 'id' => $reportId]);
}
