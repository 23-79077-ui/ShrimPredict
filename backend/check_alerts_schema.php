<?php
require_once __DIR__ . '/config/database.php';

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    echo "DB Connection failed\n";
    exit(1);
}

try {
    $stmt = $conn->query("DESCRIBE alerts");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo "Alerts table error: " . $e->getMessage() . "\n";
}
