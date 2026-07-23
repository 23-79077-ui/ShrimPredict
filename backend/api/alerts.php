<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/storage.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');

$database = new Database();
$conn = $database->getConnection();

if ($conn) {
    $stmt = $conn->query('SELECT * FROM alerts ORDER BY id DESC');
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} else {
    $path = __DIR__ . '/../storage/alerts.json';
    echo json_encode(loadJson($path, [
        ['id' => 1, 'title' => 'Salinity warning', 'message' => 'Pond B is above the safe range.', 'severity' => 'High']
    ]));
}
