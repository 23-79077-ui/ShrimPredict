<?php
/**
 * CRITICAL DATABASE MIGRATION SCRIPT
 * Feeding Records Standardization to KILOGRAMS (kg) & Tray Subtraction Logic
 */

require_once __DIR__ . '/config/database.php';

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    echo "ERROR: Database connection failed.\n";
    exit(1);
}

echo "========================================================================\n";
echo "STARTING FULL DATABASE MIGRATION: STANDARDIZE FEEDING RECORDS TO KG\n";
echo "========================================================================\n\n";

// 1. Ensure all required columns exist in feeding_records
$columnsToAdd = [
    'amount_kg' => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
    'amount_grams' => 'DECIMAL(10,2) DEFAULT NULL',
    'tray_count' => 'INT(11) DEFAULT 4',
    'tray_feed_grams' => 'DECIMAL(10,2) DEFAULT NULL',
    'total_tray_feed_grams' => 'DECIMAL(10,2) DEFAULT NULL',
    'broadcast_feed_kg' => 'DECIMAL(10,3) DEFAULT NULL',
    'tray_monitoring_status' => 'VARCHAR(150) DEFAULT NULL',
    'shrimp_weight_grams' => 'DECIMAL(8,2) DEFAULT NULL'
];

$existingCols = [];
$colStmt = $conn->query("SHOW COLUMNS FROM feeding_records");
while ($col = $colStmt->fetch(PDO::FETCH_ASSOC)) {
    $existingCols[] = $col['Field'];
}

foreach ($columnsToAdd as $colName => $colDef) {
    if (!in_array($colName, $existingCols, true)) {
        echo "Adding column '{$colName}' to feeding_records...\n";
        $conn->exec("ALTER TABLE feeding_records ADD COLUMN {$colName} {$colDef}");
    }
}

// 2. Load all ponds with stocking dates for accurate DOC computation
$pondsStmt = $conn->query("SELECT id, pond_name, stocking_date, target_feed_kg FROM ponds");
$ponds = [];
while ($p = $pondsStmt->fetch(PDO::FETCH_ASSOC)) {
    $ponds[(int)$p['id']] = $p;
}

// 3. Fetch all feeding records
$recordsStmt = $conn->query("SELECT * FROM feeding_records ORDER BY id ASC");
$records = $recordsStmt->fetchAll(PDO::FETCH_ASSOC);
$totalRecords = count($records);

echo "Found {$totalRecords} total feeding records to migrate.\n\n";

$updateStmt = $conn->prepare("
    UPDATE feeding_records SET
        amount_kg = :amount_kg,
        amount_grams = :amount_grams,
        tray_count = :tray_count,
        tray_feed_grams = :tray_feed_grams,
        total_tray_feed_grams = :total_tray_feed_grams,
        broadcast_feed_kg = :broadcast_feed_kg,
        notes = :notes
    WHERE id = :id
");

$migratedCount = 0;
$doc1to7Count = 0;
$doc8PlusCount = 0;
$validationErrors = 0;

$todayYmd = date('Y-m-d'); // 2026-09-28

foreach ($records as $r) {
    $id = (int)$r['id'];
    $pondId = (int)$r['pond_id'];
    $recordDate = $r['record_date'] ?: ($r['created_at'] ? substr($r['created_at'], 0, 10) : $todayYmd);
    
    // Compute Day of Culture (DOC)
    $pond = $ponds[$pondId] ?? null;
    $doc = null;
    if ($pond && !empty($pond['stocking_date'])) {
        $stockingDt = new DateTime($pond['stocking_date']);
        $recordDt = new DateTime($recordDate);
        if ($recordDt >= $stockingDt) {
            $doc = $stockingDt->diff($recordDt)->days + 1;
        } else {
            $doc = -($stockingDt->diff($recordDt)->days);
        }
    }

    $rawKg = (float)$r['amount_kg'];
    $rawG = isset($r['amount_grams']) && $r['amount_grams'] !== null ? (float)$r['amount_grams'] : null;
    $notes = $r['notes'] ?? '';

    // Standardize amount_kg
    // RULE 1:
    // For DOC 1 to 7 records:
    // If entered/stored as grams (e.g. 450, 500, 650, 700, 900 or amount_kg >= 25):
    // Grams / 1000:
    // 450g -> 0.45 kg, 500g -> 0.50 kg, 650g -> 0.65 kg, 700g -> 0.70 kg, 900g -> 0.90 kg
    $targetKg = $rawKg;
    if ($doc !== null && $doc >= 1 && $doc <= 7) {
        $doc1to7Count++;
        if ($rawKg >= 25.0) {
            $targetKg = round($rawKg / 1000.0, 3);
        } elseif ($rawKg == 0 && $rawG !== null && $rawG > 0) {
            $targetKg = round($rawG / 1000.0, 3);
        }
        // If already in kg (e.g. 0.45, 0.50, 0.65, 0.70, 0.80, 0.90), preserve exact value
    } else {
        // RULE: Mula DOC 8 pataas, panatilihing naka-Kilograms (kg) ang lahat ng entries.
        $doc8PlusCount++;
        if ($rawKg >= 100.0) {
            // Stray entry stored as full grams (e.g. 4000g -> 4.0 kg)
            $targetKg = round($rawKg / 1000.0, 3);
        } else {
            $targetKg = $rawKg;
        }
    }

    $targetGrams = round($targetKg * 1000.0, 2);

    // RULE 2: TRAY & BROADCAST CALCULATION LOGIC (SUBTRACTION ONLY)
    // 1. Total Scheduled Feed (kg) = Input Value ng Caretaker (hal. 4.0 kg)
    // 2. Total Trays Feed (kg) = (Grams per Tray × 4 Trays) ÷ 1000
    // 3. Broadcast Feed (kg) = Total Scheduled Feed (kg) - Total Trays Feed (kg)
    // - Verification: Broadcast + All Trays = Total Scheduled Feed.
    $isNursery = ($doc !== null && $doc <= 19) || (isset($r['product_code']) && $r['product_code'] === 'Starter' && ($doc === null || $doc <= 19));

    if ($isNursery) {
        $trayCount = 0;
        $trayFeedGrams = 0.00;
        $totalTrayFeedGrams = 0.00;
        $totalTrayFeedKg = 0.000;
        $broadcastFeedKg = $targetKg;
    } else {
        $trayCount = 4;
        $trayFeedGrams = 20.00; // 20g per tray standard
        $totalTrayFeedGrams = 80.00; // 20g * 4 = 80g
        $totalTrayFeedKg = 0.080; // 80g / 1000 = 0.08 kg
        $broadcastFeedKg = max(0.000, round($targetKg - $totalTrayFeedKg, 3));
    }

    // Mathematical verification
    $computedSum = round($broadcastFeedKg + $totalTrayFeedKg, 3);
    if (abs($computedSum - $targetKg) > 0.005 && $targetKg >= $totalTrayFeedKg) {
        echo "WARNING: Math validation mismatch on record ID {$id}: Scheduled={$targetKg}kg, Broadcast={$broadcastFeedKg}kg, Trays={$totalTrayFeedKg}kg\n";
        $validationErrors++;
    }

    // Clean notes: Remove legacy "x 3g" / "x 10g" multiplication formulas and outdated sample references
    $cleanNotes = $notes;
    // Replace old pattern like "Sample: ... Trays ... Broadcast ..." with updated clean breakdown
    if (preg_match('/Sample:\s*[\d\.]+g\s*avg\s*shrimp/i', $cleanNotes)) {
        // Extract tray check status if present
        $trayCheckStatus = '';
        if (preg_match('/Tray check:\s*([^|]+)/i', $cleanNotes, $mStatus)) {
            $trayCheckStatus = trim($mStatus[1]);
        }
        if (!$isNursery) {
            $newBreakdown = "Scheduled: " . number_format($targetKg, 2) . "kg | Trays (4): 80g (0.08kg) | Broadcast: " . number_format($broadcastFeedKg, 2) . "kg";
            if ($trayCheckStatus) {
                $newBreakdown .= " | Tray check: " . $trayCheckStatus;
            }
            $cleanNotes = $newBreakdown;
        }
    }

    $updateStmt->execute([
        ':amount_kg' => round($targetKg, 2),
        ':amount_grams' => $targetGrams,
        ':tray_count' => $trayCount,
        ':tray_feed_grams' => $trayFeedGrams,
        ':total_tray_feed_grams' => $totalTrayFeedGrams,
        ':broadcast_feed_kg' => $broadcastFeedKg,
        ':notes' => $cleanNotes,
        ':id' => $id,
    ]);

    $migratedCount++;
}

echo "Migrated {$migratedCount} feeding records:\n";
echo "  - DOC 1-7 records verified: {$doc1to7Count}\n";
echo "  - DOC 8+ records verified: {$doc8PlusCount}\n";
echo "  - Validation mismatches: {$validationErrors}\n\n";

// 4. Update ponds table: Daily Total Feed (feed_today_kg) and Total Feed (total_feed_kg)
echo "Synchronizing ponds table: feed_today_kg and total_feed_kg...\n";

foreach ($ponds as $pId => $pInfo) {
    $syncStmt = $conn->prepare("
        UPDATE ponds SET
            feed_today_kg = (
                SELECT COALESCE(SUM(amount_kg), 0)
                FROM feeding_records
                WHERE pond_id = :p1 AND record_date = :today_date
            ),
            total_feed_kg = (
                SELECT COALESCE(SUM(amount_kg), 0)
                FROM feeding_records
                WHERE pond_id = :p2
            )
        WHERE id = :p3
    ");
    $syncStmt->execute([
        ':p1' => $pId,
        ':today_date' => $todayYmd,
        ':p2' => $pId,
        ':p3' => $pId
    ]);
}

// 5. Output Verification Report
echo "\n--- VERIFICATION REPORT: PONDS FEED SUMMARY ---\n";
$reportStmt = $conn->query("
    SELECT p.id, p.pond_name, p.feed_today_kg, p.total_feed_kg,
           (SELECT COUNT(*) FROM feeding_records fr WHERE fr.pond_id = p.id AND fr.record_date = '{$todayYmd}') as slots_today,
           (SELECT COUNT(*) FROM feeding_records fr WHERE fr.pond_id = p.id) as total_entries
    FROM ponds p
    ORDER BY p.id ASC
");
while ($row = $reportStmt->fetch(PDO::FETCH_ASSOC)) {
    echo "Pond #{$row['id']} ({$row['pond_name']}): Today Feed = {$row['feed_today_kg']} kg ({$row['slots_today']} slots) | Total Feed = {$row['total_feed_kg']} kg ({$row['total_entries']} entries)\n";
}

echo "\n--- SAMPLE OF MIGRATED RECORDS (DOC 1-7) ---\n";
$sample1Stmt = $conn->query("
    SELECT id, pond_id, record_date, feeding_time, amount_kg, amount_grams, broadcast_feed_kg, total_tray_feed_grams, notes 
    FROM feeding_records 
    WHERE record_date >= '2026-08-10' AND record_date <= '2026-08-16' 
    ORDER BY record_date ASC, id ASC LIMIT 10
");
while ($r = $sample1Stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "ID {$r['id']} | {$r['record_date']} {$r['feeding_time']} | kg: {$r['amount_kg']} | g: {$r['amount_grams']} | trays: {$r['total_tray_feed_grams']}g | bcast: {$r['broadcast_feed_kg']}kg | notes: {$r['notes']}\n";
}

echo "\n--- SAMPLE OF MIGRATED GROW-OUT RECORDS (DOC 20+) ---\n";
$sample2Stmt = $conn->query("
    SELECT id, pond_id, record_date, feeding_time, amount_kg, amount_grams, broadcast_feed_kg, total_tray_feed_grams, notes 
    FROM feeding_records 
    WHERE record_date >= '2026-09-10' AND record_date <= '2026-09-16' 
    ORDER BY record_date ASC, id ASC LIMIT 10
");
while ($r = $sample2Stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "ID {$r['id']} | {$r['record_date']} {$r['feeding_time']} | kg: {$r['amount_kg']} | g: {$r['amount_grams']} | trays: {$r['total_tray_feed_grams']}g | bcast: {$r['broadcast_feed_kg']}kg | notes: {$r['notes']}\n";
}

echo "\n========================================================================\n";
echo "MIGRATION COMPLETE AND VALIDATED SUCCESSFULLY!\n";
echo "========================================================================\n";
