<?php
require_once __DIR__ . '/config/database.php';

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    echo "Database connection failed.\n";
    exit(1);
}

// 1. Ensure target_feed_kg column in ponds
try {
    $conn->exec("ALTER TABLE ponds ADD COLUMN target_feed_kg DECIMAL(10,2) DEFAULT 45.0");
} catch (Throwable $e) {}

// 2. Fetch existing pond IDs
$pondStmt = $conn->query("SELECT id FROM ponds");
$existingPondIds = $pondStmt->fetchAll(PDO::FETCH_COLUMN);

if (empty($existingPondIds)) {
    $conn->exec("INSERT INTO ponds (pond_name, target_feed_kg) VALUES ('Pond A1', 45.0), ('Pond A2', 50.0), ('Pond B1', 40.0), ('Pond B2', 35.0)");
    $pondStmt = $conn->query("SELECT id FROM ponds");
    $existingPondIds = $pondStmt->fetchAll(PDO::FETCH_COLUMN);
}

$p1 = $existingPondIds[0] ?? 1;
$p2 = $existingPondIds[1] ?? 2;
$p3 = $existingPondIds[2] ?? 3;
$p4 = $existingPondIds[3] ?? 4;

// 2. Check feeding records count
$countStmt = $conn->query("SELECT COUNT(*) FROM feeding_records");
$count = $countStmt->fetchColumn();

$today = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));
$twoDaysAgo = date('Y-m-d', strtotime('-2 days'));

$records = [
    // Today's Feeding Records (12 entries for Today)
    [$p1, 15.0, 'Tateh - Starter', '06:00 AM', 'Starter', 1, 'Vitamin C', $today, 'Morning feeding complete', 'Juan Dela Cruz'],
    [$p1, 15.0, 'Tateh - Starter', '11:00 AM', 'Starter', 0, 'None', $today, 'Noon feeding done', 'Juan Dela Cruz'],
    [$p1, 15.0, 'Tateh - Starter', '04:00 PM', 'Starter', 1, 'Multi-Vit', $today, 'Afternoon feeding done', 'Juan Dela Cruz'],

    [$p2, 18.0, 'Tateh - Grower', '06:30 AM', 'Grower', 1, 'Amino Boost', $today, 'High appetite observed', 'Maria Santos'],
    [$p2, 20.0, 'Tateh - Grower', '11:30 AM', 'Grower', 0, 'None', $today, 'Heavy feeding', 'Maria Santos'],
    [$p2, 20.0, 'Tateh - Grower', '04:30 PM', 'Grower', 1, 'Vitamin C', $today, 'Slight overfeeding warning', 'Maria Santos'],

    [$p3, 13.0, 'Tateh - Starter', '07:00 AM', 'Starter', 0, 'None', $today, 'Normal feeding', 'Pedro Penduko'],
    [$p3, 13.0, 'Tateh - Starter', '12:00 PM', 'Starter', 1, 'Vitamin C', $today, 'Good tray clearance', 'Pedro Penduko'],
    [$p3, 14.0, 'Tateh - Starter', '05:00 PM', 'Starter', 0, 'None', $today, 'Evening ration complete', 'Pedro Penduko'],

    [$p4, 9.0, 'Tateh - Grower', '07:30 AM', 'Grower', 0, 'None', $today, 'Lower feed response', 'Elena Cruz'],
    [$p4, 9.0, 'Tateh - Grower', '12:30 PM', 'Grower', 0, 'None', $today, 'Underfeeding alert', 'Elena Cruz'],
    [$p4, 10.0, 'Tateh - Grower', '05:30 PM', 'Grower', 1, 'Probiotics', $today, 'Probiotics added', 'Elena Cruz'],

    // Additional Today Records to total > 10 rows
    [$p1, 16.0, 'Tateh - Starter', '08:00 PM', 'Starter', 1, 'Vitamin C', $today, 'Night ration complete', 'Juan Dela Cruz'],
    [$p2, 22.0, 'Tateh - Grower', '08:30 PM', 'Grower', 0, 'None', $today, 'Late evening feeding', 'Maria Santos'],
    [$p3, 15.0, 'Tateh - Starter', '09:00 PM', 'Starter', 1, 'Amino Boost', $today, 'Final tray check complete', 'Pedro Penduko'],

    // Yesterday's Records
    [$p1, 45.0, 'Tateh - Starter', '06:00 AM', 'Starter', 1, 'Vitamin C', $yesterday, 'Full day feed ration', 'Juan Dela Cruz'],
    [$p2, 58.0, 'Tateh - Grower', '06:30 AM', 'Grower', 0, 'None', $yesterday, 'Full day feed ration', 'Maria Santos'],
    [$p3, 38.0, 'Tateh - Starter', '07:00 AM', 'Starter', 1, 'Multi-Vit', $yesterday, 'Full day feed ration', 'Pedro Penduko'],
];

$insertStmt = $conn->prepare("INSERT INTO feeding_records (pond_id, amount_kg, feed_type, feeding_time, product_code, has_vitamin, vitamin_name, record_date, notes, recorded_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

$inserted = 0;
foreach ($records as $r) {
    $insertStmt->execute($r);
    $inserted++;
}

echo "Successfully seeded {$inserted} feeding records into XAMPP MySQL shrim_predict_db!\n";
