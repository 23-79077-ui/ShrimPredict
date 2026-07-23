<?php
require_once __DIR__ . '/../config/database.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');

$database = new Database();
$conn = $database->getConnection();

if ($conn) {
    $reports = [
        'disease' => $conn->query('SELECT * FROM disease_reports ORDER BY id DESC LIMIT 5')->fetchAll(PDO::FETCH_ASSOC),
        'feeding' => $conn->query('SELECT * FROM feeding_records ORDER BY id DESC LIMIT 5')->fetchAll(PDO::FETCH_ASSOC),
        'harvest' => $conn->query('SELECT * FROM harvest_predictions ORDER BY id DESC LIMIT 5')->fetchAll(PDO::FETCH_ASSOC),
    ];
    echo json_encode($reports);
} else {
    echo json_encode(['disease' => [], 'feeding' => [], 'harvest' => []]);
}
