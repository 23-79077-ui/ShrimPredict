<?php
require_once __DIR__ . '/config/database.php';

$db = new Database();
$pdo = $db->getConnection();

if (!$pdo) {
    die("Database connection failed.\n");
}

echo "=== FIXING 6:00 PM AND ALL FEEDING RECORDS ===\n\n";

// 1. Standardize feeding_time strings
$normalizeQueries = [
    "UPDATE feeding_records SET feeding_time = '3:00 PM' WHERE feeding_time IN ('15:00 PM', '15:00', '15:00:00', '03:00 PM')",
    "UPDATE feeding_records SET feeding_time = '6:00 PM' WHERE feeding_time IN ('18:00', '18:00:00', '06:00 PM')",
    "UPDATE feeding_records SET feeding_time = '6:00 AM' WHERE feeding_time IN ('06:00', '06:00:00', '06:00 AM')",
    "UPDATE feeding_records SET feeding_time = '9:00 AM' WHERE feeding_time IN ('09:00', '09:00:00', '09:00 AM')",
    "UPDATE feeding_records SET feeding_time = '12:00 PM' WHERE feeding_time IN ('12:00', '12:00:00')",
];

foreach ($normalizeQueries as $q) {
    $affected = $pdo->exec($q);
    echo "Query: $q -> $affected rows updated.\n";
}

// 2. Check missing 6:00 PM on 2026-09-26 for Pond 1
$stmtCheck = $pdo->prepare("SELECT id FROM feeding_records WHERE pond_id = 1 AND record_date = '2026-09-26' AND feeding_time = '6:00 PM'");
$stmtCheck->execute();
if (!$stmtCheck->fetch()) {
    echo "Adding missing 6:00 PM record for Pond 1 on 2026-09-26...\n";
    $insert26 = $pdo->prepare("INSERT INTO feeding_records 
        (pond_id, record_date, feeding_time, amount_kg, amount_grams, feed_type, product_code, has_vitamin, vitamin_name, shrimp_weight_grams, tray_count, tray_feed_grams, total_tray_feed_grams, broadcast_feed_kg, tray_monitoring_status, notes, recorded_by_name, user_id, created_at)
        VALUES 
        (1, '2026-09-26', '6:00 PM', 0.04, 40.0, 'Tateh - Finisher', 'Finisher', 0, 'None', 15.0, 4, 20.0, 80.0, 0.0, 'Normal (No adjustment)', 'DOC #48 [Grow-out]: Evening 6:00 PM feed carried over to next 6:00 AM', 'Cj Arroyo', 6, '2026-09-26 18:00:00')");
    $insert26->execute();
    echo "Inserted 6:00 PM for 2026-09-26 (ID: " . $pdo->lastInsertId() . ")\n";
}

// 3. Check missing 6:00 PM on 2026-09-27 for Pond 1
$stmtCheck2 = $pdo->prepare("SELECT id FROM feeding_records WHERE pond_id = 1 AND record_date = '2026-09-27' AND feeding_time = '6:00 PM'");
$stmtCheck2->execute();
if (!$stmtCheck2->fetch()) {
    echo "Adding missing 6:00 PM record for Pond 1 on 2026-09-27...\n";
    $insert27 = $pdo->prepare("INSERT INTO feeding_records 
        (pond_id, record_date, feeding_time, amount_kg, amount_grams, feed_type, product_code, has_vitamin, vitamin_name, shrimp_weight_grams, tray_count, tray_feed_grams, total_tray_feed_grams, broadcast_feed_kg, tray_monitoring_status, notes, recorded_by_name, user_id, created_at)
        VALUES 
        (1, '2026-09-27', '6:00 PM', 0.03, 30.0, 'Tateh - Finisher', 'Finisher', 0, 'None', 15.0, 4, 20.0, 80.0, 0.0, 'Normal (No adjustment)', 'DOC #49 [Grow-out]: Evening 6:00 PM feed carried over to next 6:00 AM', 'Cj Arroyo', 6, '2026-09-27 18:00:00')");
    $insert27->execute();
    echo "Inserted 6:00 PM for 2026-09-27 (ID: " . $pdo->lastInsertId() . ")\n";
}

// 4. Update check tray broadcasts across all records
$pdo->exec("UPDATE feeding_records 
    SET tray_count = 4,
        tray_feed_grams = 20.00,
        total_tray_feed_grams = 80.00,
        broadcast_feed_kg = ROUND(GREATEST(0, amount_kg - 0.08), 3)
    WHERE tray_count IS NULL OR tray_count = 0 OR total_tray_feed_grams != 80.00 OR broadcast_feed_kg != ROUND(GREATEST(0, amount_kg - 0.08), 3)");

// 5. Verification of DOC 1 to DOC 7
echo "\n=== VERIFYING DOC 1 TO DOC 7 IN DATABASE ===\n";
$expectedTotals = [
    '2026-08-10' => 1.50,
    '2026-08-11' => 3.25,
    '2026-08-12' => 3.50,
    '2026-08-13' => 3.75,
    '2026-08-14' => 4.00,
    '2026-08-15' => 4.25,
    '2026-08-16' => 4.50,
];

foreach ($expectedTotals as $date => $expected) {
    $stmt = $pdo->prepare("SELECT feeding_time, amount_kg, amount_grams FROM feeding_records WHERE pond_id = 1 AND record_date = ? ORDER BY id ASC");
    $stmt->execute([$date]);
    $slots = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $totalKg = 0;
    $timeSlots = [];
    foreach ($slots as $s) {
        $totalKg += (float)$s['amount_kg'];
        $timeSlots[] = $s['feeding_time'] . ' (' . number_format($s['amount_kg'], 2) . 'kg)';
    }
    $status = (abs($totalKg - $expected) < 0.001 && count($slots) === 5) ? 'PASS' : 'FAIL';
    echo sprintf("[%s] Date: %s | Slots: %d/5 | Sum: %.2f kg (Expected: %.2f kg) | Times: %s\n",
        $status, $date, count($slots), $totalKg, $expected, implode(', ', $timeSlots));
}

echo "\nDone!\n";
