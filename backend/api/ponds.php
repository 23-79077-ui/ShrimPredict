<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/notifications_helper.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $conn->query('
            SELECT p.*, 
                   COALESCE(u_cp.full_name, u_legacy.full_name, p.assigned_caretaker_name, "Juan Dela Cruz") AS caretaker_name
            FROM ponds p
            LEFT JOIN caretaker_ponds cp ON p.id = cp.pond_id
            LEFT JOIN users u_cp ON cp.user_id = u_cp.id
            LEFT JOIN users u_legacy ON p.id = u_legacy.pond_id
            GROUP BY p.id
            ORDER BY p.id ASC
        ');
        $rawPonds = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $now = new DateTime();
        $totalFeedSum = 0;
        $totalAgeSum = 0;
        $healthyCount = 0;
        $warningCount = 0;
        $criticalCount = 0;
        $diseaseAlertsCount = 0;

        $ponds = [];
        foreach ($rawPonds as $p) {
            $status = $p['status'] ?? 'Healthy';
            if ($status === 'Healthy') $healthyCount++;
            else if ($status === 'Warning') $warningCount++;
            else if ($status === 'Critical') $criticalCount++;

            // Calculate age in days
            $stockingDateStr = !empty($p['stocking_date']) ? $p['stocking_date'] : '2026-04-02';
            $stockingDt = new DateTime($stockingDateStr);
            $ageDays = $stockingDt->diff($now)->days;
            $totalAgeSum += $ageDays;

            // Readiness status
            $readiness = floatval($p['harvest_readiness'] ?? 85.0);
            $readinessCategory = 'Not Ready';
            if ($readiness >= 100) {
                $readinessCategory = 'Ready to Harvest';
            } else if ($readiness >= 95) {
                $readinessCategory = 'Upcoming';
            }

            // Disease alerts count
            $disease = $p['disease_detection'] ?? 'Healthy';
            if (strtolower($disease) !== 'healthy' && strtolower($disease) !== 'none') {
                $diseaseAlertsCount++;
            }

            $feedToday = floatval($p['feed_today_kg'] ?? 12.0);
            $totalFeedSum += $feedToday;

            $ponds[] = [
                'id' => (int)$p['id'],
                'pond_name' => $p['pond_name'],
                'location' => $p['location'],
                'temperature' => floatval($p['temperature']),
                'ph_level' => floatval($p['ph_level']),
                'salinity' => floatval($p['salinity']),
                'dissolved_oxygen' => floatval($p['dissolved_oxygen']),
                'water_level' => floatval($p['water_level']),
                'status' => $status,
                'area_sqm' => (int)($p['area_sqm'] ?? 500),
                'stocking_date' => $stockingDateStr,
                'current_age_days' => $ageDays,
                'growth_percentage' => floatval($p['growth_percentage'] ?? 85.0),
                'disease_detection' => $disease,
                'disease_confidence' => floatval($p['disease_confidence'] ?? 0.0),
                'harvest_readiness' => $readiness,
                'harvest_readiness_status' => $readinessCategory,
                'expected_harvest_date' => !empty($p['expected_harvest_date']) ? $p['expected_harvest_date'] : '2026-08-10',
                'feed_today_kg' => $feedToday,
                'total_feed_kg' => floatval($p['total_feed_kg'] ?? 450.0),
                'latest_image' => !empty($p['latest_image']) ? $p['latest_image'] : 'uploads/sample.jpg',
                'assigned_caretaker_name' => $p['caretaker_name']
            ];
        }

        $totalPonds = count($ponds);
        $avgFeedToday = $totalPonds > 0 ? round($totalFeedSum / $totalPonds, 1) : 0;
        $avgPondAge = $totalPonds > 0 ? round($totalAgeSum / $totalPonds) : 0;

        $healthyPct = $totalPonds > 0 ? round(($healthyCount / $totalPonds) * 100) : 0;
        $warningPct = $totalPonds > 0 ? round(($warningCount / $totalPonds) * 100) : 0;
        $criticalPct = $totalPonds > 0 ? (100 - $healthyPct - $warningPct) : 0;

        echo json_encode([
            'success' => true,
            'ponds' => $ponds,
            'summary' => [
                'total_ponds' => $totalPonds,
                'healthy_ponds' => $healthyCount,
                'warning_ponds' => $warningCount,
                'critical_ponds' => $criticalCount,
                'average_feed_today' => $avgFeedToday,
                'average_pond_age' => $avgPondAge,
                'disease_alerts' => $diseaseAlertsCount,
                'pie_chart' => [
                    'healthy_pct' => $healthyPct,
                    'warning_pct' => $warningPct,
                    'critical_pct' => $criticalPct
                ]
            ]
        ]);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error fetching ponds: ' . $e->getMessage()]);
        exit;
    }
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $providedName = trim((string)($data['pond_name'] ?? ''));

    if (empty($providedName) || $providedName === 'Pond' || preg_match('/^Pond\s*\d+$/i', $providedName)) {
        // Compute next sequence name (A1, A2, A3, B1, B2, B3, C1, C2, C3...)
        $countStmt = $conn->query("SELECT COUNT(*) FROM ponds");
        $totalPonds = (int)$countStmt->fetchColumn();

        $letters = range('A', 'Z');
        $letterIdx = floor($totalPonds / 3);
        $numberIdx = ($totalPonds % 3) + 1;
        $letter = $letters[$letterIdx % 26];
        if ($letterIdx >= 26) {
            $letter .= (floor($letterIdx / 26));
        }
        $pondName = "Pond {$letter}{$numberIdx}";
    } else {
        $pondName = $providedName;
    }
    $location = $data['location'] ?? '';
    $temp = $data['temperature'] ?? 29.0;
    $ph = $data['ph_level'] ?? 7.5;
    $salinity = $data['salinity'] ?? 18.0;
    $do = $data['dissolved_oxygen'] ?? 6.5;
    $waterLevel = $data['water_level'] ?? 1.2;
    $status = $data['status'] ?? 'Healthy';
    $caretakerName = $data['assigned_caretaker_name'] ?? ($data['recorded_by_name'] ?? 'Juan Dela Cruz');
    $areaSqm = $data['area_sqm'] ?? 500;
    $stockingDate = $data['stocking_date'] ?? date('Y-m-d');
    $growthPct = $data['growth_percentage'] ?? 80.0;
    $diseaseDetection = $data['disease_detection'] ?? 'Healthy';
    $diseaseConf = $data['disease_confidence'] ?? 0.0;
    $harvestReadiness = $data['harvest_readiness'] ?? 80.0;
    $expectedHarvest = $data['expected_harvest_date'] ?? date('Y-m-d', strtotime('+30 days'));
    $feedToday = $data['feed_today_kg'] ?? 10.0;
    $totalFeed = $data['total_feed_kg'] ?? 300.0;

    $stmt = $conn->prepare('
        INSERT INTO ponds (
            pond_name, location, temperature, ph_level, salinity, dissolved_oxygen, water_level, status,
            area_sqm, stocking_date, growth_percentage, disease_detection, disease_confidence, harvest_readiness,
            expected_harvest_date, feed_today_kg, total_feed_kg, assigned_caretaker_name, created_at
        ) VALUES (
            :pond_name, :location, :temperature, :ph_level, :salinity, :dissolved_oxygen, :water_level, :status,
            :area_sqm, :stocking_date, :growth_percentage, :disease_detection, :disease_confidence, :harvest_readiness,
            :expected_harvest_date, :feed_today_kg, :total_feed_kg, :assigned_caretaker_name, NOW()
        )
    ');
    $stmt->execute([
        ':pond_name' => $pondName,
        ':location' => $location,
        ':temperature' => $temp,
        ':ph_level' => $ph,
        ':salinity' => $salinity,
        ':dissolved_oxygen' => $do,
        ':water_level' => $waterLevel,
        ':status' => $status,
        ':area_sqm' => $areaSqm,
        ':stocking_date' => $stockingDate,
        ':growth_percentage' => $growthPct,
        ':disease_detection' => $diseaseDetection,
        ':disease_confidence' => $diseaseConf,
        ':harvest_readiness' => $harvestReadiness,
        ':expected_harvest_date' => $expectedHarvest,
        ':feed_today_kg' => $feedToday,
        ':total_feed_kg' => $totalFeed,
        ':assigned_caretaker_name' => $caretakerName
    ]);
    $pondId = $conn->lastInsertId();

    $notifMsg = "{$caretakerName} updated pond status for {$pondName} (Status: {$status}, Growth: {$growthPct}%).";
    createNotification($conn, 'Pond Status Logged', $notifMsg, $caretakerName, 'water_quality', $pondName);

    echo json_encode(['success' => true, 'message' => 'Pond created successfully', 'id' => $pondId]);
}
