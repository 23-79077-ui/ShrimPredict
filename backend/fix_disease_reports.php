<?php
require_once __DIR__ . '/config/database.php';

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    echo "Database connection failed.\n";
    exit(1);
}

// 1. Ensure table and columns exist
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
        image_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_disease_risk (risk_level),
        INDEX idx_disease_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// 2. Map existing 'Pond 7' or generic pond names to real active ponds
$pondsMap = [
    'Pond A1' => 'Juan Dela Cruz',
    'Pond A2' => 'Maria Santos',
    'Pond A3' => 'Juan Dela Cruz',
    'Pond B1' => 'Maria Santos',
    'Pond B2' => 'Pedro Penduko',
    'Pond B3' => 'Pedro Penduko',
    'Pond C1' => 'Lara Camille',
];

$activePondNames = array_keys($pondsMap);

// Fetch all existing records
$stmt = $conn->query("SELECT id, pond_name, caretaker_name FROM disease_reports ORDER BY id ASC");
$reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

$updateStmt = $conn->prepare("UPDATE disease_reports SET pond_name = :pname, caretaker_name = :cname WHERE id = :id");

foreach ($reports as $index => $r) {
    $pName = trim((string)$r['pond_name']);
    $cName = trim((string)$r['caretaker_name']);

    if (empty($pName) || $pName === 'Pond 7' || $pName === 'General Pond' || $pName === 'Assigned Pond') {
        $assignedPond = $activePondNames[$index % count($activePondNames)];
        $assignedCaretaker = !empty($cName) && $cName !== 'Test Caretaker' ? $cName : $pondsMap[$assignedPond];

        $updateStmt->execute([
            ':pname' => $assignedPond,
            ':cname' => $assignedCaretaker,
            ':id' => $r['id']
        ]);
    }
}

echo "Successfully updated and assigned real pond names (Pond A1..C1) to disease scan history records!\n";
