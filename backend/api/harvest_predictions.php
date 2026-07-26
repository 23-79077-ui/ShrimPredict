<?php
require_once __DIR__ . '/../config/database.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($requestMethod === 'OPTIONS') { http_response_code(200); exit; }

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

const FEED_REFERENCE_KG = 15000;
const TARGET_HARVEST_KG = 11000;
const BASELINE_RATIO = 0.7333333333;
const PREDICTION_METHOD = 'Caretaker Historical Feed-to-Harvest Baseline';

function ensureHarvestTables(PDO $conn): void {
    $conn->exec("
        CREATE TABLE IF NOT EXISTS harvest_predictions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pond_id INT NOT NULL,
            estimated_harvest DECIMAL(10,2) NOT NULL DEFAULT 0,
            average_weight DECIMAL(10,2) NOT NULL DEFAULT 0,
            biomass DECIMAL(10,2) NOT NULL DEFAULT 0,
            survival_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            recommendation TEXT,
            prediction_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE,
            INDEX idx_harvest_date (prediction_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $columns = $conn->query('SHOW COLUMNS FROM harvest_predictions')->fetchAll(PDO::FETCH_COLUMN);
    $migrations = [
        ['total_feed_consumed_kg', "ALTER TABLE harvest_predictions ADD COLUMN total_feed_consumed_kg DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER pond_id"],
        ['baseline_ratio', "ALTER TABLE harvest_predictions ADD COLUMN baseline_ratio DECIMAL(8,4) NOT NULL DEFAULT 0.7333 AFTER total_feed_consumed_kg"],
        ['baseline_harvest_kg', "ALTER TABLE harvest_predictions ADD COLUMN baseline_harvest_kg DECIMAL(12,4) NOT NULL DEFAULT 0 AFTER baseline_ratio"],
        ['adjusted_harvest_kg', "ALTER TABLE harvest_predictions ADD COLUMN adjusted_harvest_kg DECIMAL(12,4) NOT NULL DEFAULT 0 AFTER baseline_harvest_kg"],
        ['predicted_harvest_tons', "ALTER TABLE harvest_predictions ADD COLUMN predicted_harvest_tons DECIMAL(10,4) NOT NULL DEFAULT 0 AFTER adjusted_harvest_kg"],
        ['feed_progress_percentage', "ALTER TABLE harvest_predictions ADD COLUMN feed_progress_percentage DECIMAL(8,2) NOT NULL DEFAULT 0 AFTER predicted_harvest_tons"],
        ['readiness_status', "ALTER TABLE harvest_predictions ADD COLUMN readiness_status VARCHAR(50) NOT NULL DEFAULT 'Not Ready' AFTER feed_progress_percentage"],
        ['adjustment_percentage', "ALTER TABLE harvest_predictions ADD COLUMN adjustment_percentage DECIMAL(8,2) NOT NULL DEFAULT 0 AFTER readiness_status"],
        ['adjustment_reason', "ALTER TABLE harvest_predictions ADD COLUMN adjustment_reason TEXT AFTER adjustment_percentage"],
        ['prediction_method', "ALTER TABLE harvest_predictions ADD COLUMN prediction_method VARCHAR(150) NOT NULL DEFAULT 'Caretaker Historical Feed-to-Harvest Baseline' AFTER adjustment_reason"],
        ['calculated_at', "ALTER TABLE harvest_predictions ADD COLUMN calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP AFTER prediction_method"],
        ['created_by', "ALTER TABLE harvest_predictions ADD COLUMN created_by VARCHAR(100) DEFAULT 'System' AFTER calculated_at"],
    ];

    foreach ($migrations as [$column, $sql]) {
        if (!in_array($column, $columns, true)) {
            try { $conn->exec($sql); } catch (Throwable $e) {}
        }
    }

    $conn->exec("
        CREATE TABLE IF NOT EXISTS harvest_history (
            harvest_id INT AUTO_INCREMENT PRIMARY KEY,
            pond_id INT NOT NULL,
            total_feed_consumed_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
            predicted_harvest_kg DECIMAL(12,4) NOT NULL DEFAULT 0,
            actual_harvest_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
            absolute_error_kg DECIMAL(12,4) NOT NULL DEFAULT 0,
            percentage_error DECIMAL(8,2) NOT NULL DEFAULT 0,
            actual_harvest_date DATE NOT NULL,
            recorded_by VARCHAR(100) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $conn->exec("
        CREATE TABLE IF NOT EXISTS harvest_adjustments (
            adjustment_id INT AUTO_INCREMENT PRIMARY KEY,
            pond_id INT NOT NULL,
            adjustment_type VARCHAR(80) NOT NULL,
            percentage DECIMAL(8,2) NOT NULL DEFAULT 0,
            reason TEXT NOT NULL,
            supporting_record_id INT DEFAULT NULL,
            created_by VARCHAR(100) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function readinessStatus(float $progress): string {
    if ($progress >= 100) return 'Feed Reference Reached';
    if ($progress >= 85) return 'Nearly Ready';
    if ($progress >= 60) return 'Developing';
    return 'Not Ready';
}

function dataCompleteness(?string $lastFeedingDate, float $totalFeed): string {
    if ($totalFeed <= 0) return 'No feeding records yet';
    if (!$lastFeedingDate) return 'Incomplete';
    $daysSince = (new DateTime($lastFeedingDate))->diff(new DateTime())->days;
    return $daysSince <= 7 ? 'Current feeding records' : 'Needs recent feeding update';
}

function savePrediction(PDO $conn, array $item): void {
    $today = date('Y-m-d');
    $existing = $conn->prepare('SELECT id FROM harvest_predictions WHERE pond_id = :pond_id AND prediction_date = :prediction_date ORDER BY id DESC LIMIT 1');
    $existing->execute([':pond_id' => $item['pond_id'], ':prediction_date' => $today]);
    $id = $existing->fetchColumn();

    $params = [
        ':pond_id' => $item['pond_id'],
        ':total_feed_consumed_kg' => $item['total_feed_consumed_kg'],
        ':baseline_ratio' => BASELINE_RATIO,
        ':baseline_harvest_kg' => $item['baseline_harvest_kg'],
        ':adjusted_harvest_kg' => $item['adjusted_harvest_kg'],
        ':predicted_harvest_tons' => $item['predicted_harvest_tons'],
        ':feed_progress_percentage' => $item['feed_progress_percentage'],
        ':readiness_status' => $item['readiness_status'],
        ':adjustment_percentage' => $item['adjustment_percentage'],
        ':adjustment_reason' => $item['adjustment_reason'],
        ':prediction_method' => PREDICTION_METHOD,
        ':estimated_harvest' => round($item['adjusted_harvest_kg'], 2),
        ':recommendation' => $item['recommendation'],
        ':prediction_date' => $today,
    ];

    if ($id) {
        $params[':id'] = $id;
        unset($params[':pond_id']);
        unset($params[':prediction_date']);
        $stmt = $conn->prepare("
            UPDATE harvest_predictions
            SET total_feed_consumed_kg = :total_feed_consumed_kg,
                baseline_ratio = :baseline_ratio,
                baseline_harvest_kg = :baseline_harvest_kg,
                adjusted_harvest_kg = :adjusted_harvest_kg,
                predicted_harvest_tons = :predicted_harvest_tons,
                feed_progress_percentage = :feed_progress_percentage,
                readiness_status = :readiness_status,
                adjustment_percentage = :adjustment_percentage,
                adjustment_reason = :adjustment_reason,
                prediction_method = :prediction_method,
                estimated_harvest = :estimated_harvest,
                recommendation = :recommendation,
                calculated_at = NOW()
            WHERE id = :id
        ");
    } else {
        $stmt = $conn->prepare("
            INSERT INTO harvest_predictions (
                pond_id, total_feed_consumed_kg, baseline_ratio, baseline_harvest_kg,
                adjusted_harvest_kg, predicted_harvest_tons, feed_progress_percentage,
                readiness_status, adjustment_percentage, adjustment_reason, prediction_method,
                estimated_harvest, average_weight, biomass, survival_rate, recommendation, prediction_date,
                calculated_at, created_by
            ) VALUES (
                :pond_id, :total_feed_consumed_kg, :baseline_ratio, :baseline_harvest_kg,
                :adjusted_harvest_kg, :predicted_harvest_tons, :feed_progress_percentage,
                :readiness_status, :adjustment_percentage, :adjustment_reason, :prediction_method,
                :estimated_harvest, 0, 0, 0, :recommendation, :prediction_date, NOW(), 'System'
            )
        ");
    }
    $stmt->execute($params);
}

ensureHarvestTables($conn);

$caretakerId = isset($_GET['caretaker_id']) ? (int)$_GET['caretaker_id'] : 0;
if ($caretakerId <= 0 && isset($_GET['user_id'])) {
    $caretakerId = (int)$_GET['user_id'];
}

$pondColumns = $conn->query('SHOW COLUMNS FROM ponds')->fetchAll(PDO::FETCH_COLUMN);
$stockingDateSelect = in_array('stocking_date', $pondColumns, true) ? 'p.stocking_date' : 'NULL';

$caretakerStmt = $conn->query("
    SELECT DISTINCT u.id, u.full_name
    FROM users u
    JOIN feeding_records fr ON fr.user_id = u.id
    WHERE u.role = 'caretaker'
    ORDER BY u.full_name ASC
");
$caretakers = $caretakerStmt->fetchAll(PDO::FETCH_ASSOC);

$params = [];
$caretakerFilterSql = '';
if ($caretakerId > 0) {
    $caretakerFilterSql = ' AND u.id = :caretaker_id';
    $params[':caretaker_id'] = $caretakerId;
}

$feedStmt = $conn->prepare("
    SELECT
        p.id AS pond_id,
        p.pond_name,
        p.status,
        {$stockingDateSelect} AS stocking_date,
        p.temperature,
        p.ph_level,
        p.salinity,
        p.dissolved_oxygen,
        COALESCE(SUM(fr.amount_kg), 0) AS total_feed_consumed_kg,
        COUNT(fr.id) AS feeding_record_count,
        MAX(fr.record_date) AS last_feeding_date,
        GROUP_CONCAT(DISTINCT u.id ORDER BY u.full_name SEPARATOR ',') AS caretaker_ids,
        GROUP_CONCAT(DISTINCT u.full_name ORDER BY u.full_name SEPARATOR ', ') AS caretaker_names
    FROM feeding_records fr
    JOIN users u ON fr.user_id = u.id AND u.role = 'caretaker'
    JOIN ponds p ON fr.pond_id = p.id
    WHERE 1 = 1 {$caretakerFilterSql}
    GROUP BY p.id
    ORDER BY p.id ASC
");
$feedStmt->execute($params);

$adjustmentStmt = $conn->prepare("
    SELECT COALESCE(SUM(percentage), 0) AS adjustment_percentage,
           GROUP_CONCAT(CONCAT(adjustment_type, ': ', percentage, '% - ', reason) SEPARATOR '; ') AS adjustment_reason
    FROM harvest_adjustments
    WHERE pond_id = :pond_id
");

$predictions = [];
$summary = [
    'total_feed_consumed_kg' => 0,
    'baseline_harvest_kg' => 0,
    'adjusted_harvest_kg' => 0,
    'remaining_feed_kg' => 0,
    'pond_count' => 0,
    'feed_reference_kg' => FEED_REFERENCE_KG,
    'target_harvest_kg_per_pond' => TARGET_HARVEST_KG,
    'target_harvest_tons_per_pond' => round(TARGET_HARVEST_KG / 1000, 2),
];

foreach ($feedStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $totalFeed = (float)$row['total_feed_consumed_kg'];
    $baselineHarvest = $totalFeed * BASELINE_RATIO;
    $progress = $totalFeed > 0 ? ($totalFeed / FEED_REFERENCE_KG) * 100 : 0;
    $remainingFeed = max(0, FEED_REFERENCE_KG - $totalFeed);

    $adjustmentStmt->execute([':pond_id' => $row['pond_id']]);
    $adjustment = $adjustmentStmt->fetch(PDO::FETCH_ASSOC) ?: ['adjustment_percentage' => 0, 'adjustment_reason' => null];
    $adjustmentPercentage = (float)$adjustment['adjustment_percentage'];
    $adjustedHarvest = $baselineHarvest * (1 + ($adjustmentPercentage / 100));
    if ($adjustedHarvest < 0) $adjustedHarvest = 0;

    $cultureDays = null;
    if (!empty($row['stocking_date'])) {
        $cultureDays = (new DateTime($row['stocking_date']))->diff(new DateTime())->days;
    }

    $item = [
        'pond_id' => (int)$row['pond_id'],
        'pond_name' => $row['pond_name'],
        'caretaker_ids' => $row['caretaker_ids'] ?: '',
        'caretaker_names' => $row['caretaker_names'] ?: 'Caretaker account',
        'total_feed_consumed_kg' => round($totalFeed, 2),
        'baseline_ratio' => BASELINE_RATIO,
        'feed_reference_kg' => FEED_REFERENCE_KG,
        'target_harvest_kg' => TARGET_HARVEST_KG,
        'target_harvest_tons' => round(TARGET_HARVEST_KG / 1000, 2),
        'baseline_harvest_kg' => round($baselineHarvest, 4),
        'adjusted_harvest_kg' => round($adjustedHarvest, 4),
        'predicted_harvest_tons' => round($adjustedHarvest / 1000, 4),
        'feed_progress_percentage' => round($progress, 2),
        'feed_progress_visual_percentage' => round(min(100, $progress), 2),
        'remaining_feed_kg' => round($remainingFeed, 2),
        'readiness_status' => readinessStatus($progress),
        'prediction_method' => PREDICTION_METHOD,
        'prediction_label' => 'Harvest Estimate Based on Caretaker Historical Feeding Data',
        'prediction_date' => date('Y-m-d'),
        'calculated_at' => date('Y-m-d H:i:s'),
        'data_completeness_status' => dataCompleteness($row['last_feeding_date'], $totalFeed),
        'feeding_record_count' => (int)$row['feeding_record_count'],
        'last_feeding_date' => $row['last_feeding_date'],
        'culture_days' => $cultureDays,
        'pond_condition_summary' => sprintf(
            'Status: %s, Temp: %s C, pH: %s, Salinity: %s ppt, DO: %s mg/L',
            $row['status'] ?: 'Unknown',
            $row['temperature'] ?? 'N/A',
            $row['ph_level'] ?? 'N/A',
            $row['salinity'] ?? 'N/A',
            $row['dissolved_oxygen'] ?? 'N/A'
        ),
        'adjustment_percentage' => round($adjustmentPercentage, 2),
        'adjustment_reason' => $adjustment['adjustment_reason'] ?: 'None',
        'recommendation' => 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.',
    ];

    if ($caretakerId <= 0) {
        savePrediction($conn, $item);
    }
    $predictions[] = $item;

    $summary['total_feed_consumed_kg'] += $totalFeed;
    $summary['baseline_harvest_kg'] += $baselineHarvest;
    $summary['adjusted_harvest_kg'] += $adjustedHarvest;
    $summary['remaining_feed_kg'] += $remainingFeed;
    $summary['pond_count']++;
}

foreach (['total_feed_consumed_kg', 'baseline_harvest_kg', 'adjusted_harvest_kg', 'remaining_feed_kg'] as $key) {
    $summary[$key] = round($summary[$key], 2);
}
$summary['predicted_harvest_tons'] = round($summary['adjusted_harvest_kg'] / 1000, 2);
$summary['average_feed_progress_percentage'] = $summary['pond_count'] > 0
    ? round(array_sum(array_column($predictions, 'feed_progress_percentage')) / $summary['pond_count'], 2)
    : 0;

echo json_encode([
    'success' => true,
    'method' => PREDICTION_METHOD,
    'label' => 'Harvest Estimate Based on Caretaker Historical Feeding Data',
    'formula' => 'predicted_harvest_kg = total_feed_consumed_kg * (11000 / 15000)',
    'historical_baseline' => 'Caretaker historical data indicates that about 15,000 kg of feed produces around 11 tons of shrimp harvest per pond.',
    'feed_reference_kg' => FEED_REFERENCE_KG,
    'target_harvest_kg' => TARGET_HARVEST_KG,
    'target_harvest_tons' => round(TARGET_HARVEST_KG / 1000, 2),
    'baseline_ratio' => BASELINE_RATIO,
    'disclaimer' => 'This is an operational estimate based on caretaker historical feeding data. Final harvest readiness must be confirmed by the farm administrator.',
    'selected_caretaker_id' => $caretakerId,
    'caretakers' => $caretakers,
    'summary' => $summary,
    'predictions' => $predictions,
]);
