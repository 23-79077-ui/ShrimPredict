<?php
/**
 * Script to populate accurate feeding consumption and detailed 5-slot feeding records
 * for Pond B2, Pond B3, and Pond C1 based on their Days of Culture and shrimp weight.
 */
require_once 'C:/ShrimPredict/backend/config/database.php';

$database = new Database();
$db = $database->getConnection();
if (!$db) {
    die("Database connection failed.\n");
}

// Master daily feeding schedule template by DOC (identical to Pond A3 and B1)
function getDocFeedingSlots($doc) {
    if ($doc == 1) {
        return [
            ['time' => '6:00 AM',  'kg' => 0.00, 'prod' => 'Starter', 'vit' => 'None', 'has_vit' => 0],
            ['time' => '9:00 AM',  'kg' => 0.00, 'prod' => 'Starter', 'vit' => 'None', 'has_vit' => 0],
            ['time' => '12:00 PM', 'kg' => 0.50, 'prod' => 'Starter', 'vit' => 'Sanolife PRO-2', 'has_vit' => 1],
            ['time' => '3:00 PM',  'kg' => 0.50, 'prod' => 'Starter', 'vit' => 'Sanolife PRO-2', 'has_vit' => 1],
            ['time' => '6:00 PM',  'kg' => 0.50, 'prod' => 'Starter', 'vit' => 'Sanolife PRO-2', 'has_vit' => 1],
        ];
    }
    
    $rates = [
        2 => 0.65, 3 => 0.70, 4 => 0.75, 5 => 0.80, 6 => 0.85, 7 => 0.90,
        8 => 0.95, 9 => 0.95, 10 => 1.00, 11 => 1.00, 12 => 1.10, 13 => 1.10, 14 => 1.10,
        15 => 1.20, 16 => 1.20, 17 => 1.20, 18 => 1.20, 19 => 3.00, 20 => 3.00,
        21 => 3.00, 22 => 3.00, 23 => 3.00, 24 => [3.0, 3.0, 4.0, 4.0, 3.0],
        25 => 4.00, 26 => 4.00, 27 => 4.00, 28 => 4.00, 29 => 4.00, 30 => 4.00
    ];

    $prod = $doc <= 19 ? 'Starter' : 'Grower';
    $feedType = 'Tateh - ' . $prod;
    $vit = $doc <= 19 ? 'Sanolife PRO-2' : 'Sanolife PRO-2, Sano Top-S';

    $slotTimes = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
    $rate = $rates[$doc] ?? 4.00;

    $slots = [];
    foreach ($slotTimes as $idx => $t) {
        $amount = is_array($rate) ? $rate[$idx] : $rate;
        $slots[] = [
            'time' => $t,
            'kg' => $amount,
            'prod' => $prod,
            'vit' => $vit,
            'has_vit' => 1
        ];
    }
    return $slots;
}

$pondsToUpdate = [
    [
        'pond_id' => 5,
        'pond_name' => 'Pond B2',
        'stocking_date' => '2026-10-23',
        'shrimp_weight_g' => 2.80,
        'doc_today' => 24,
        'last_logged_doc' => 23, // Through 2026-11-14
        'caretaker_name' => 'Nicca Kate Arroyo',
        'user_id' => 7,
        'target_daily_feed' => 17.00
    ],
    [
        'pond_id' => 6,
        'pond_name' => 'Pond B3',
        'stocking_date' => '2026-10-21',
        'shrimp_weight_g' => 3.20,
        'doc_today' => 26,
        'last_logged_doc' => 25, // Through 2026-11-14
        'caretaker_name' => 'Nicca Kate Arroyo',
        'user_id' => 7,
        'target_daily_feed' => 20.00
    ],
    [
        'pond_id' => 7,
        'pond_name' => 'Pond C1',
        'stocking_date' => '2026-10-19',
        'shrimp_weight_g' => 3.60,
        'doc_today' => 28,
        'last_logged_doc' => 27, // Through 2026-11-14
        'caretaker_name' => 'Lara camille',
        'user_id' => 19,
        'target_daily_feed' => 20.00
    ]
];

$insertStmt = $db->prepare("
    INSERT INTO feeding_records (
        pond_id, amount_kg, amount_grams, feed_type, feeding_time, product_code,
        has_vitamin, vitamin_name, record_date, notes, created_at,
        recorded_by_name, user_id, tray_count, tray_feed_grams, total_tray_feed_grams,
        broadcast_feed_kg, tray_monitoring_status
    ) VALUES (
        :pond_id, :amount_kg, :amount_grams, :feed_type, :feeding_time, :product_code,
        :has_vitamin, :vitamin_name, :record_date, :notes, :created_at,
        :recorded_by_name, :user_id, :tray_count, :tray_feed_grams, :total_tray_feed_grams,
        :broadcast_feed_kg, :tray_monitoring_status
    )
");

foreach ($pondsToUpdate as $pInfo) {
    $pId = $pInfo['pond_id'];
    $pName = $pInfo['pond_name'];
    $sDate = new DateTime($pInfo['stocking_date']);
    
    // 1. Remove obsolete July dummy records for this pond
    $del = $db->prepare("DELETE FROM feeding_records WHERE pond_id = :p");
    $del->execute([':p' => $pId]);
    echo "Cleared old dummy records for {$pName}...\n";

    $totalFeedAccum = 0.0;
    $recordCount = 0;

    // 2. Generate daily feeding slots from stocking date up to 2026-11-14
    for ($doc = 1; $doc <= $pInfo['last_logged_doc']; $doc++) {
        $dateObj = clone $sDate;
        $dateObj->modify('+' . ($doc - 1) . ' days');
        $dateStr = $dateObj->format('Y-m-d');

        $slots = getDocFeedingSlots($doc);
        foreach ($slots as $slot) {
            $kg = (float)$slot['kg'];
            $grams = $kg * 1000.0;
            $feedType = 'Tateh - ' . $slot['prod'];
            $totalFeedAccum += $kg;
            $recordCount++;

            $timeOnly = $slot['time'];
            // Create realistic timestamp: e.g. 2026-10-23 06:00:00
            $timePart = date('H:i:s', strtotime($timeOnly));
            $createdTimestamp = "{$dateStr} {$timePart}";

            $isNursery = ($doc <= 19);
            $stageLabel = $isNursery ? "Nursery Stage (0/0 Trays)" : "DOC #{$doc} [Grow-out]";
            $trayStatus = $isNursery ? "0/0 Trays (Nursery)" : "Clean Tray (100% Consumed)";
            $trayGrams = $isNursery ? 20.0 : 50.0;
            $trayCount = 4;
            $totTray = $trayGrams * $trayCount;
            $broadcastKg = max(0.0, ($grams - $totTray) / 1000.0);

            $notes = "{$timeOnly}: {$stageLabel} | " . ($kg > 0 ? "{$grams}g {$slot['prod']} feed with {$slot['vit']}" : "Wala pang pakain (0g)");

            $insertStmt->execute([
                ':pond_id' => $pId,
                ':amount_kg' => $kg,
                ':amount_grams' => $grams,
                ':feed_type' => $feedType,
                ':feeding_time' => $timeOnly,
                ':product_code' => $slot['prod'],
                ':has_vitamin' => $slot['has_vit'],
                ':vitamin_name' => $slot['vit'],
                ':record_date' => $dateStr,
                ':notes' => $notes,
                ':created_at' => $createdTimestamp,
                ':recorded_by_name' => $pInfo['caretaker_name'],
                ':user_id' => $pInfo['user_id'],
                ':tray_count' => $trayCount,
                ':tray_feed_grams' => $trayGrams,
                ':total_tray_feed_grams' => $totTray,
                ':broadcast_feed_kg' => $broadcastKg,
                ':tray_monitoring_status' => $trayStatus
            ]);
        }
    }

    $remainingFeed = max(0.0, 15000.0 - $totalFeedAccum);

    // 3. Update ponds table
    $updPond = $db->prepare("
        UPDATE ponds
        SET total_feed_kg = :tot,
            remaining_feed_kg = :rem,
            target_feed_kg = :tgt,
            feed_today_kg = 0.0,
            shrimp_weight_g = :abw,
            growth_percentage = :growth,
            harvest_readiness = :readiness
        WHERE id = :id
    ");
    $updPond->execute([
        ':tot' => $totalFeedAccum,
        ':rem' => $remainingFeed,
        ':tgt' => $pInfo['target_daily_feed'],
        ':abw' => $pInfo['shrimp_weight_g'],
        ':growth' => round(($doc / 90.0) * 100, 1),
        ':readiness' => round(($totalFeedAccum / 15000.0) * 100, 2),
        ':id' => $pId
    ]);

    // 4. Update harvest_predictions table
    $updHp = $db->prepare("
        UPDATE harvest_predictions
        SET total_feed_consumed_kg = :tot,
            average_weight = :abw,
            feed_progress_percentage = :progress,
            baseline_harvest_kg = ROUND(:tot * 0.7333, 2),
            adjusted_harvest_kg = ROUND(:tot * 0.7333, 2),
            predicted_harvest_tons = ROUND((:tot * 0.7333) / 1000, 4)
        WHERE pond_id = :id
    ");
    $updHp->execute([
        ':tot' => $totalFeedAccum,
        ':abw' => $pInfo['shrimp_weight_g'],
        ':progress' => round(($totalFeedAccum / 15000.0) * 100, 2),
        ':id' => $pId
    ]);

    echo "✓ {$pName}: Added {$recordCount} records. Total Feed Consumed = {$totalFeedAccum} kg, Remaining = {$remainingFeed} kg, ABW = {$pInfo['shrimp_weight_g']}g\n";
}

echo "\nDone!\n";
