<?php
require_once __DIR__ . '/config/database.php';

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    echo "Database connection failed.\n";
    exit(1);
}

// 1. Ensure target_feed_kg column exists in ponds table
try {
    $conn->exec("ALTER TABLE ponds ADD COLUMN target_feed_kg DECIMAL(10,2) DEFAULT 45.0");
} catch (Throwable $e) {}

// 2. Fetch all ponds with their actual assigned caretaker
$stmt = $conn->query('
    SELECT p.id, p.pond_name,
           COALESCE(GROUP_CONCAT(DISTINCT u_cp.full_name ORDER BY u_cp.full_name SEPARATOR ", "), u_legacy.full_name, p.assigned_caretaker_name) AS caretaker_name
    FROM ponds p
    LEFT JOIN caretaker_ponds cp ON p.id = cp.pond_id
    LEFT JOIN users u_cp ON cp.user_id = u_cp.id
    LEFT JOIN users u_legacy ON p.id = u_legacy.pond_id
    GROUP BY p.id
    ORDER BY p.id ASC
');
$ponds = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($ponds)) {
    echo "No ponds found in database.\n";
    exit(0);
}

// 3. Clear old/invalid feeding records
$conn->exec("DELETE FROM feeding_records");
$conn->exec("ALTER TABLE feeding_records AUTO_INCREMENT = 1");

$today = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));

// The 5 Official Shrimp Aquaculture Feeding Time Slots (6:00 AM, 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM)
$standardTimeSlots = [
    ['time' => '6:00 AM',  'ratio' => 0.20, 'vitamin' => 'None',           'notes' => '1st feeding session (Morning)'],
    ['time' => '9:00 AM',  'ratio' => 0.20, 'vitamin' => 'Vitamin C',      'notes' => '2nd feeding session (Mid-Morning)'],
    ['time' => '12:00 PM', 'ratio' => 0.20, 'vitamin' => 'None',           'notes' => '3rd feeding session (Noon)'],
    ['time' => '3:00 PM',  'ratio' => 0.20, 'vitamin' => 'Sanolife PRO-2', 'notes' => '4th feeding session (Afternoon)'],
    ['time' => '6:00 PM',  'ratio' => 0.20, 'vitamin' => 'None',           'notes' => '5th feeding session (Evening)'],
];

$insertStmt = $conn->prepare("
    INSERT INTO feeding_records 
    (pond_id, amount_kg, feed_type, feeding_time, product_code, has_vitamin, vitamin_name, record_date, notes, recorded_by_name, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");

$totalInserted = 0;

foreach ($ponds as $pond) {
    $pondId = (int)$pond['id'];
    $pondName = $pond['pond_name'];
    $caretakerName = !empty($pond['caretaker_name']) ? $pond['caretaker_name'] : 'Caretaker Staff';
    $targetKg = 45.0; // standard daily feed target per pond

    // Determine feed type based on pond name
    $feedType = (strpos($pondName, 'B2') !== false || strpos($pondName, 'C1') !== false) ? 'Tateh - Grower' : 'Tateh - Starter';
    $productCode = (strpos($feedType, 'Grower') !== false) ? 'Grower' : 'Starter';

    // Insert 5 official feeding logs for Today
    foreach ($standardTimeSlots as $idx => $slot) {
        // Exactly 9.0 kg per slot (Total 45.0 kg per pond/day = 100% Target)
        $portionKg = 9.00;
        $hasVit = ($slot['vitamin'] !== 'None') ? 1 : 0;
        $createdAt = "{$today} " . sprintf("%02d:00:00", ($idx * 3) + 6);

        $insertStmt->execute([
            $pondId,
            $portionKg,
            $feedType,
            $slot['time'],
            $productCode,
            $hasVit,
            $slot['vitamin'],
            $today,
            $slot['notes'],
            $caretakerName,
            $createdAt
        ]);
        $totalInserted++;
    }

    // Insert 5 official feeding logs for Yesterday
    foreach ($standardTimeSlots as $idx => $slot) {
        $portionKg = 9.00;
        $hasVit = ($slot['vitamin'] !== 'None') ? 1 : 0;
        $createdAt = "{$yesterday} " . sprintf("%02d:00:00", ($idx * 3) + 6);

        $insertStmt->execute([
            $pondId,
            $portionKg,
            $feedType,
            $slot['time'],
            $productCode,
            $hasVit,
            $slot['vitamin'],
            $yesterday,
            $slot['notes'],
            $caretakerName,
            $createdAt
        ]);
        $totalInserted++;
    }
}

echo "Successfully reset and seeded {$totalInserted} standard 5-session feeding records for " . count($ponds) . " ponds in MySQL database!\n";
