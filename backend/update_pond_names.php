<?php
require_once __DIR__ . '/config/database.php';

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    echo "Database connection failed.\n";
    exit(1);
}

function getPondCode($index) {
    $letters = range('A', 'Z');
    $letterIdx = floor($index / 3);
    $numberIdx = ($index % 3) + 1;
    $letter = $letters[$letterIdx % 26];
    if ($letterIdx >= 26) {
        $letter .= (floor($letterIdx / 26));
    }
    return "Pond {$letter}{$numberIdx}";
}

// 1. Fetch all existing ponds
$stmt = $conn->query("SELECT id, pond_name FROM ponds ORDER BY id ASC");
$ponds = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($ponds)) {
    // If no ponds exist, insert 9 ponds: Pond A1 to Pond C3
    for ($i = 0; $i < 9; $i++) {
        $pName = getPondCode($i);
        $insertStmt = $conn->prepare("INSERT INTO ponds (pond_name, target_feed_kg) VALUES (?, 45.0)");
        $insertStmt->execute([$pName]);
    }
    echo "Inserted default 9 ponds (Pond A1 to Pond C3).\n";
} else {
    // Update existing ponds
    foreach ($ponds as $idx => $p) {
        $newName = getPondCode($idx);
        $updateStmt = $conn->prepare("UPDATE ponds SET pond_name = ? WHERE id = ?");
        $updateStmt->execute([$newName, $p['id']]);
        echo "Updated Pond ID {$p['id']} -> {$newName}\n";
    }
}

// 2. Update feeding_records table to reflect updated pond names if needed
$conn->exec("
    UPDATE feeding_records fr 
    JOIN ponds p ON fr.pond_id = p.id 
    SET fr.notes = fr.notes
");

echo "Successfully updated all pond names in XAMPP MySQL database!\n";
