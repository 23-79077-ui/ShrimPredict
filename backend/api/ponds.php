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
    $stmt = $conn->query('SELECT * FROM ponds ORDER BY id DESC');
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $pondName = $data['pond_name'] ?? 'Pond';
    $location = $data['location'] ?? '';
    $temp = $data['temperature'] ?? 0;
    $ph = $data['ph_level'] ?? 0;
    $salinity = $data['salinity'] ?? 0;
    $do = $data['dissolved_oxygen'] ?? 0;
    $waterLevel = $data['water_level'] ?? 0;
    $status = $data['status'] ?? 'Healthy';
    $caretakerName = $data['recorded_by_name'] ?? ($data['caretaker_name'] ?? 'Caretaker');

    $stmt = $conn->prepare('INSERT INTO ponds (pond_name, location, temperature, ph_level, salinity, dissolved_oxygen, water_level, status, created_at) VALUES (:pond_name, :location, :temperature, :ph_level, :salinity, :dissolved_oxygen, :water_level, :status, NOW())');
    $stmt->execute([
        ':pond_name' => $pondName,
        ':location' => $location,
        ':temperature' => $temp,
        ':ph_level' => $ph,
        ':salinity' => $salinity,
        ':dissolved_oxygen' => $do,
        ':water_level' => $waterLevel,
        ':status' => $status
    ]);
    $pondId = $conn->lastInsertId();

    $notifMsg = "{$caretakerName} updated water quality for {$pondName} (Temp: {$temp}°C, pH: {$ph}, Salinity: {$salinity}ppt, Status: {$status}).";
    createNotification($conn, 'Pond Conditions Logged', $notifMsg, $caretakerName, 'water_quality', $pondName);

    echo json_encode(['success' => true, 'message' => 'Pond created', 'id' => $pondId]);
}
