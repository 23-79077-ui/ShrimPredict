<?php
require_once __DIR__ . '/../config/database.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');

$database = new Database();
$conn = $database->getConnection();

$stmt = $conn->query('SELECT hp.*, p.pond_name FROM harvest_predictions hp LEFT JOIN ponds p ON hp.pond_id = p.id ORDER BY hp.id DESC');
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
