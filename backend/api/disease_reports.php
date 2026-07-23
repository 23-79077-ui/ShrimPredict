<?php
require_once __DIR__ . '/../config/database.php';
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
    $uploadDir = __DIR__ . '/../uploads/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

    $fileName = time() . '_' . basename($_FILES['image']['name']);
    $target = $uploadDir . $fileName;
    move_uploaded_file($_FILES['image']['tmp_name'], $target);

    $stmt = $conn->prepare('INSERT INTO disease_reports (disease_name, confidence_score, risk_level, recommendation, status, image_path, created_at) VALUES (:disease_name, :confidence_score, :risk_level, :recommendation, :status, :image_path, NOW())');
    $stmt->execute([
        ':disease_name' => $_POST['disease_name'] ?? 'Unknown',
        ':confidence_score' => $_POST['confidence_score'] ?? 0,
        ':risk_level' => $_POST['risk_level'] ?? 'Low',
        ':recommendation' => $_POST['recommendation'] ?? 'Monitor closely',
        ':status' => $_POST['status'] ?? 'Pending',
        ':image_path' => 'uploads/' . $fileName
    ]);

    echo json_encode(['success' => true, 'message' => 'Disease report saved']);
}
