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
    $stmt = $conn->query('SELECT * FROM ponds ORDER BY id DESC');
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $conn->prepare('INSERT INTO ponds (pond_name, location, temperature, ph_level, salinity, dissolved_oxygen, water_level, status, created_at) VALUES (:pond_name, :location, :temperature, :ph_level, :salinity, :dissolved_oxygen, :water_level, :status, NOW())');
    $stmt->execute([
        ':pond_name' => $data['pond_name'] ?? '',
        ':location' => $data['location'] ?? '',
        ':temperature' => $data['temperature'] ?? 0,
        ':ph_level' => $data['ph_level'] ?? 0,
        ':salinity' => $data['salinity'] ?? 0,
        ':dissolved_oxygen' => $data['dissolved_oxygen'] ?? 0,
        ':water_level' => $data['water_level'] ?? 0,
        ':status' => $data['status'] ?? 'Healthy'
    ]);
    echo json_encode(['success' => true, 'message' => 'Pond created']);
}
