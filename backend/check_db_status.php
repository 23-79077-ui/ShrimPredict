<?php
require_once __DIR__ . '/config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    echo "Database connection successful!\n";

    $tables = ['disease_reports', 'notifications', 'ponds', 'users', 'feeding_records', 'alerts', 'system_settings'];
    foreach ($tables as $table) {
        $stmt = $conn->query("SELECT COUNT(*) FROM {$table}");
        $count = $stmt->fetchColumn();
        echo "Table '{$table}': {$count} rows.\n";
    }

    echo "\nLatest Disease Scans:\n";
    $scans = $conn->query("SELECT id, caretaker_name, pond_name, disease_name, confidence_score, risk_level, status, created_at FROM disease_reports ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    print_r($scans);

} catch (Exception $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
}
