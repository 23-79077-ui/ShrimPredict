<?php
/**
 * Update stocking dates and culture parameters for Pond B2, Pond B3, and Pond C1
 * to bring their Days of Culture (DOC) to around 20-30 days.
 */
require_once __DIR__ . '/config/database.php';

$database = new Database();
$db = $database->getConnection();
if (!$db) {
    die("Database connection failed.\n");
}

$updates = [
    [
        'pond_name' => 'Pond B2',
        'id' => 5,
        'stocking_date' => '2026-10-23', // Day 24 on Nov 15, 2026
        'expected_harvest_date' => '2027-01-21',
        'shrimp_weight_g' => 2.80,
        'growth_percentage' => 26.6,
        'harvest_readiness' => 0.20
    ],
    [
        'pond_name' => 'Pond B3',
        'id' => 6,
        'stocking_date' => '2026-10-21', // Day 26 on Nov 15, 2026
        'expected_harvest_date' => '2027-01-19',
        'shrimp_weight_g' => 3.20,
        'growth_percentage' => 28.8,
        'harvest_readiness' => 0.22
    ],
    [
        'pond_name' => 'Pond C1',
        'id' => 7,
        'stocking_date' => '2026-10-19', // Day 28 on Nov 15, 2026
        'expected_harvest_date' => '2027-01-17',
        'shrimp_weight_g' => 3.60,
        'growth_percentage' => 31.1,
        'harvest_readiness' => 0.25
    ]
];

echo "Updating Ponds in MySQL database (shrim_predict_db)...\n";

$updateStmt = $db->prepare("
    UPDATE ponds 
    SET stocking_date = :stocking_date,
        expected_harvest_date = :expected_harvest_date,
        shrimp_weight_g = :shrimp_weight_g,
        growth_percentage = :growth_percentage,
        harvest_readiness = :harvest_readiness
    WHERE id = :id OR pond_name = :pond_name
");

foreach ($updates as $u) {
    $updateStmt->execute([
        ':stocking_date' => $u['stocking_date'],
        ':expected_harvest_date' => $u['expected_harvest_date'],
        ':shrimp_weight_g' => $u['shrimp_weight_g'],
        ':growth_percentage' => $u['growth_percentage'],
        ':harvest_readiness' => $u['harvest_readiness'],
        ':id' => $u['id'],
        ':pond_name' => $u['pond_name']
    ]);
    echo "✓ Updated {$u['pond_name']} (ID: {$u['id']}) -> Stocking Date: {$u['stocking_date']}\n";
}

echo "\n--- VERIFICATION OF ALL PONDS ---\n";
$stmt = $db->query("SELECT id, pond_name, stocking_date, expected_harvest_date, shrimp_weight_g, total_feed_kg, status FROM ponds ORDER BY id");
$ponds = $stmt->fetchAll(PDO::FETCH_ASSOC);

$today = new DateTime();
echo "Current Date: " . $today->format('Y-m-d') . "\n";
echo str_pad("ID", 4) . str_pad("Pond Name", 12) . str_pad("Stocking Date", 16) . str_pad("Calculated DOC", 16) . str_pad("ABW (g)", 10) . str_pad("Expected Harvest", 18) . "\n";
echo str_repeat("-", 76) . "\n";

foreach ($ponds as $p) {
    $doc = 'N/A';
    if (!empty($p['stocking_date'])) {
        $sDt = new DateTime($p['stocking_date']);
        $diff = $sDt->diff($today)->days + 1;
        $doc = "Day " . $diff;
    }
    echo str_pad($p['id'], 4) . 
         str_pad($p['pond_name'], 12) . 
         str_pad($p['stocking_date'] ?? 'NULL', 16) . 
         str_pad($doc, 16) . 
         str_pad($p['shrimp_weight_g'] ?? '0.0', 10) . 
         str_pad($p['expected_harvest_date'] ?? 'N/A', 18) . "\n";
}
