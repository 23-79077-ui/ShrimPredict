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
$pondStmt = $conn->query("SELECT id FROM ponds ORDER BY id ASC");
$existingPondIds = $pondStmt->fetchAll(PDO::FETCH_COLUMN);

if (empty($existingPondIds)) {
    $conn->exec("INSERT INTO ponds (pond_name, target_feed_kg) VALUES ('Pond A1', 45.0), ('Pond A2', 45.0), ('Pond B1', 45.0), ('Pond B2', 45.0)");
    $pondStmt = $conn->query("SELECT id FROM ponds ORDER BY id ASC");
    $existingPondIds = $pondStmt->fetchAll(PDO::FETCH_COLUMN);
}

// Clear old feeding records
$conn->exec("DELETE FROM feeding_records");
$conn->exec("ALTER TABLE feeding_records AUTO_INCREMENT = 1");

$today = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));

// Standard 5 Feeding Sessions: 6:00 AM, 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM
$standardSlots = [
    ['time' => '6:00 AM',  'vitamin' => 'None',           'notes' => '1st feeding session (Morning)'],
    ['time' => '9:00 AM',  'vitamin' => 'Vitamin C',      'notes' => '2nd feeding session (Mid-Morning)'],
    ['time' => '12:00 PM', 'vitamin' => 'None',           'notes' => '3rd feeding session (Noon)'],
    ['time' => '3:00 PM',  'vitamin' => 'Sanolife PRO-2', 'notes' => '4th feeding session (Afternoon)'],
    ['time' => '6:00 PM',  'vitamin' => 'None',           'notes' => '5th feeding session (Evening)'],
];

$insertStmt = $conn->prepare("
    INSERT INTO feeding_records 
    (pond_id, amount_kg, feed_type, feeding_time, product_code, has_vitamin, vitamin_name, record_date, notes, recorded_by_name, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");

$totalInserted = 0;
foreach ($existingPondIds as $pId) {
    foreach ($standardSlots as $idx => $slot) {
        $hasVit = ($slot['vitamin'] !== 'None') ? 1 : 0;
        $createdAtToday = "{$today} " . sprintf("%02d:00:00", ($idx * 3) + 6);
        $insertStmt->execute([
            $pId, 9.00, 'Tateh - Starter', $slot['time'], 'Starter', $hasVit, $slot['vitamin'], $today, $slot['notes'], 'Caretaker Staff', $createdAtToday
        ]);
        $totalInserted++;

        $createdAtYest = "{$yesterday} " . sprintf("%02d:00:00", ($idx * 3) + 6);
        $insertStmt->execute([
            $pId, 9.00, 'Tateh - Starter', $slot['time'], 'Starter', $hasVit, $slot['vitamin'], $yesterday, $slot['notes'], 'Caretaker Staff', $createdAtYest
        ]);
        $totalInserted++;
    }
}

echo "Successfully seeded {$totalInserted} standard 5-session feeding records into MySQL database!\n";
