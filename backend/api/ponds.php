<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/notifications_helper.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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

function ensurePondMonitoringColumns($conn) {
    $columns = $conn->query('SHOW COLUMNS FROM ponds')->fetchAll(PDO::FETCH_COLUMN);
    $needed = [
        'area_sqm' => 'ALTER TABLE ponds ADD COLUMN area_sqm INT DEFAULT NULL',
        'stocking_date' => 'ALTER TABLE ponds ADD COLUMN stocking_date DATE DEFAULT NULL',
        'growth_percentage' => 'ALTER TABLE ponds ADD COLUMN growth_percentage DECIMAL(5,2) DEFAULT NULL',
        'disease_detection' => 'ALTER TABLE ponds ADD COLUMN disease_detection VARCHAR(150) DEFAULT NULL',
        'disease_confidence' => 'ALTER TABLE ponds ADD COLUMN disease_confidence DECIMAL(5,2) DEFAULT NULL',
        'harvest_readiness' => 'ALTER TABLE ponds ADD COLUMN harvest_readiness DECIMAL(5,2) DEFAULT NULL',
        'expected_harvest_date' => 'ALTER TABLE ponds ADD COLUMN expected_harvest_date DATE DEFAULT NULL',
        'feed_today_kg' => 'ALTER TABLE ponds ADD COLUMN feed_today_kg DECIMAL(10,2) DEFAULT NULL',
        'total_feed_kg' => 'ALTER TABLE ponds ADD COLUMN total_feed_kg DECIMAL(10,2) DEFAULT NULL',
        'latest_image' => 'ALTER TABLE ponds ADD COLUMN latest_image VARCHAR(255) DEFAULT NULL',
        'assigned_caretaker_name' => 'ALTER TABLE ponds ADD COLUMN assigned_caretaker_name VARCHAR(100) DEFAULT NULL',
    ];

    foreach ($needed as $column => $sql) {
        if (!in_array($column, $columns, true)) {
            try {
                $conn->exec($sql);
            } catch (Throwable $e) {}
        }
    }
}

function tableExists($conn, $tableName) {
    try {
        $stmt = $conn->prepare('SHOW TABLES LIKE :table_name');
        $stmt->execute([':table_name' => $tableName]);
        return (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

function columnExists($conn, $tableName, $columnName) {
    try {
        $stmt = $conn->prepare("SHOW COLUMNS FROM `{$tableName}` LIKE :column_name");
        $stmt->execute([':column_name' => $columnName]);
        return (bool)$stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        return false;
    }
}

function countTableReferences($conn, $tableName, $columnName, $value) {
    if (!tableExists($conn, $tableName) || !columnExists($conn, $tableName, $columnName)) {
        return 0;
    }

    $stmt = $conn->prepare("SELECT COUNT(*) FROM `{$tableName}` WHERE `{$columnName}` = :value");
    $stmt->execute([':value' => $value]);
    return (int)$stmt->fetchColumn();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        ensurePondMonitoringColumns($conn);
        $stmt = $conn->query('
            SELECT p.*, 
                   GROUP_CONCAT(DISTINCT u_cp.id ORDER BY u_cp.full_name SEPARATOR ",") AS caretaker_ids,
                   COALESCE(GROUP_CONCAT(DISTINCT u_cp.full_name ORDER BY u_cp.full_name SEPARATOR ", "), u_legacy.full_name, p.assigned_caretaker_name) AS caretaker_name,
                   COALESCE(SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT u_cp.id ORDER BY u_cp.full_name SEPARATOR ","), ",", 1), u_legacy.id) AS caretaker_id
            FROM ponds p
            LEFT JOIN caretaker_ponds cp ON p.id = cp.pond_id
            LEFT JOIN users u_cp ON cp.user_id = u_cp.id
            LEFT JOIN users u_legacy ON p.id = u_legacy.pond_id
            GROUP BY p.id
            ORDER BY p.pond_name ASC
        ');
        $rawPonds = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $feedStmt = $conn->query('
            SELECT pond_id,
                   COALESCE(SUM(CASE WHEN DATE(record_date) = CURDATE() THEN amount_kg ELSE 0 END), 0) AS feed_today_kg,
                   COALESCE(SUM(amount_kg), 0) AS total_feed_kg,
                   MAX(record_date) AS latest_feed_date
            FROM feeding_records
            GROUP BY pond_id
        ');
        $feedByPond = [];
        foreach ($feedStmt->fetchAll(PDO::FETCH_ASSOC) as $feedRow) {
            $feedByPond[(int)$feedRow['pond_id']] = $feedRow;
        }

        $diseaseStmt = $conn->query('
            SELECT dr.*
            FROM disease_reports dr
            INNER JOIN (
                SELECT pond_name, MAX(id) AS latest_id
                FROM disease_reports
                WHERE pond_name IS NOT NULL
                  AND pond_name <> ""
                  AND disease_name IS NOT NULL
                  AND disease_name <> ""
                  AND disease_name <> "Unknown Disease"
                GROUP BY pond_name
            ) latest ON latest.latest_id = dr.id
        ');
        $diseaseByPondName = [];
        foreach ($diseaseStmt->fetchAll(PDO::FETCH_ASSOC) as $diseaseRow) {
            $diseaseByPondName[strtolower(trim($diseaseRow['pond_name']))] = $diseaseRow;
        }

        $now = new DateTime();
        $totalFeedSum = 0;
        $totalAgeSum = 0;
        $healthyCount = 0;
        $warningCount = 0;
        $criticalCount = 0;
        $diseaseAlertsCount = 0;

        $ponds = [];
        foreach ($rawPonds as $p) {
            $pondId = (int)$p['id'];
            $feedRow = $feedByPond[$pondId] ?? null;
            $diseaseRow = $diseaseByPondName[strtolower(trim((string)$p['pond_name']))] ?? null;

            $disease = $diseaseRow['disease_name'] ?? ($p['disease_detection'] ?? null);
            $diseaseConfidence = $diseaseRow && is_numeric($diseaseRow['confidence_score'])
                ? (float)$diseaseRow['confidence_score']
                : (is_numeric($p['disease_confidence'] ?? null) ? (float)$p['disease_confidence'] : 0.0);

            $status = $p['status'] ?? null;
            if (!$status) {
                $tempVal = is_numeric($p['temperature'] ?? null) ? (float)$p['temperature'] : null;
                $phVal = is_numeric($p['ph_level'] ?? null) ? (float)$p['ph_level'] : null;
                $doVal = is_numeric($p['dissolved_oxygen'] ?? null) ? (float)$p['dissolved_oxygen'] : null;
                $hasDisease = $disease && !in_array(strtolower($disease), ['healthy', 'none', 'no disease detected'], true);
                if ($hasDisease || ($doVal !== null && $doVal < 5.0) || ($tempVal !== null && $tempVal >= 33.0)) {
                    $status = 'Critical';
                } else if (($phVal !== null && ($phVal < 7.2 || $phVal > 8.4)) || ($doVal !== null && $doVal < 5.8)) {
                    $status = 'Warning';
                } else {
                    $status = 'Healthy';
                }
            }
            if ($status === 'Healthy') $healthyCount++;
            else if ($status === 'Warning') $warningCount++;
            else if ($status === 'Critical') $criticalCount++;

            $stockingDateStr = !empty($p['stocking_date']) ? $p['stocking_date'] : null;
            $ageDays = null;
            if ($stockingDateStr) {
                $stockingDt = new DateTime($stockingDateStr);
                $ageDays = $stockingDt->diff($now)->days;
                $totalAgeSum += $ageDays;
            }

            $readiness = is_numeric($p['harvest_readiness'] ?? null) ? (float)$p['harvest_readiness'] : 0.0;
            $readinessCategory = 'Not Ready';
            if ($readiness >= 100) {
                $readinessCategory = 'Ready to Harvest';
            } else if ($readiness >= 95) {
                $readinessCategory = 'Upcoming';
            }

            $diseaseNormalized = strtolower((string)($disease ?? ''));
            if ($diseaseNormalized !== '' && $diseaseNormalized !== 'healthy' && $diseaseNormalized !== 'none') {
                $diseaseAlertsCount++;
            }

            $feedToday = $feedRow ? (float)$feedRow['feed_today_kg'] : (is_numeric($p['feed_today_kg'] ?? null) ? (float)$p['feed_today_kg'] : 0.0);
            $totalFeed = $feedRow ? (float)$feedRow['total_feed_kg'] : (is_numeric($p['total_feed_kg'] ?? null) ? (float)$p['total_feed_kg'] : 0.0);
            $totalFeedSum += $feedToday;

            $ponds[] = [
                'id' => $pondId,
                'pond_name' => $p['pond_name'],
                'location' => $p['location'],
                'temperature' => is_numeric($p['temperature'] ?? null) ? (float)$p['temperature'] : null,
                'ph_level' => is_numeric($p['ph_level'] ?? null) ? (float)$p['ph_level'] : null,
                'salinity' => is_numeric($p['salinity'] ?? null) ? (float)$p['salinity'] : null,
                'dissolved_oxygen' => is_numeric($p['dissolved_oxygen'] ?? null) ? (float)$p['dissolved_oxygen'] : null,
                'water_level' => is_numeric($p['water_level'] ?? null) ? (float)$p['water_level'] : null,
                'status' => $status,
                'area_sqm' => is_numeric($p['area_sqm'] ?? null) ? (int)$p['area_sqm'] : null,
                'stocking_date' => $stockingDateStr,
                'current_age_days' => $ageDays,
                'growth_percentage' => is_numeric($p['growth_percentage'] ?? null) ? (float)$p['growth_percentage'] : null,
                'disease_detection' => $disease,
                'disease_confidence' => $diseaseConfidence,
                'harvest_readiness' => $readiness,
                'harvest_readiness_status' => $readinessCategory,
                'expected_harvest_date' => !empty($p['expected_harvest_date']) ? $p['expected_harvest_date'] : null,
                'feed_today_kg' => $feedToday,
                'total_feed_kg' => $totalFeed,
                'latest_feed_date' => $feedRow['latest_feed_date'] ?? null,
                'latest_image' => $diseaseRow['image_path'] ?? (!empty($p['latest_image']) ? $p['latest_image'] : null),
                'assigned_caretaker_name' => $p['caretaker_name'],
                'assigned_caretaker_id' => is_numeric($p['caretaker_id'] ?? null) ? (int)$p['caretaker_id'] : null
            ];
        }

        $totalPonds = count($ponds);
        $avgFeedToday = $totalPonds > 0 ? round($totalFeedSum / $totalPonds, 1) : 0;
        $agedPonds = count(array_filter($ponds, fn($pond) => $pond['current_age_days'] !== null));
        $avgPondAge = $agedPonds > 0 ? round($totalAgeSum / $agedPonds) : 0;

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
    $action = isset($data['action']) ? trim((string)$data['action']) : 'create';

    if ($action === 'update') {
        ensurePondMonitoringColumns($conn);

        $pondId = isset($data['id']) ? (int)$data['id'] : 0;
        $pondName = trim((string)($data['pond_name'] ?? ''));
        $location = trim((string)($data['location'] ?? ''));
        $status = trim((string)($data['status'] ?? 'Healthy'));
        $caretakerId = isset($data['assigned_caretaker_id']) && $data['assigned_caretaker_id'] !== ''
            ? (int)$data['assigned_caretaker_id']
            : null;

        if ($pondId <= 0 || $pondName === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Pond ID and pond name are required.']);
            exit;
        }

        $validStatuses = ['Healthy', 'Warning', 'Critical'];
        if (!in_array($status, $validStatuses, true)) {
            $status = 'Healthy';
        }

        $caretakerName = null;
        if ($caretakerId !== null) {
            $userStmt = $conn->prepare('SELECT id, full_name FROM users WHERE id = :id AND LOWER(role) = "caretaker" AND status <> "Archived" LIMIT 1');
            $userStmt->execute([':id' => $caretakerId]);
            $caretaker = $userStmt->fetch(PDO::FETCH_ASSOC);
            if (!$caretaker) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Selected caretaker was not found.']);
                exit;
            }
            $caretakerName = $caretaker['full_name'];
        }

        try {
            $conn->beginTransaction();

            $stmt = $conn->prepare('
                UPDATE ponds
                SET pond_name = :pond_name,
                    location = :location,
                    status = :status,
                    assigned_caretaker_name = :assigned_caretaker_name
                WHERE id = :id
            ');
            $stmt->execute([
                ':pond_name' => $pondName,
                ':location' => $location,
                ':status' => $status,
                ':assigned_caretaker_name' => $caretakerName,
                ':id' => $pondId
            ]);

            $removePondAssignments = $conn->prepare('DELETE FROM caretaker_ponds WHERE pond_id = :pond_id');
            $removePondAssignments->execute([':pond_id' => $pondId]);

            $clearLegacy = $conn->prepare('UPDATE users SET pond_id = NULL WHERE pond_id = :pond_id');
            $clearLegacy->execute([':pond_id' => $pondId]);

            if ($caretakerId !== null) {
                $assignStmt = $conn->prepare('INSERT INTO caretaker_ponds (user_id, pond_id) VALUES (:user_id, :pond_id)');
                $assignStmt->execute([':user_id' => $caretakerId, ':pond_id' => $pondId]);

                $legacyStmt = $conn->prepare('UPDATE users SET pond_id = :pond_id WHERE id = :user_id');
                $legacyStmt->execute([':pond_id' => $pondId, ':user_id' => $caretakerId]);
            }

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Pond updated successfully']);
        } catch (Throwable $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error updating pond: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'delete') {
        $pondId = isset($data['id']) ? (int)$data['id'] : 0;
        if ($pondId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid pond ID is required.']);
            exit;
        }

        $pondStmt = $conn->prepare('SELECT id, pond_name FROM ponds WHERE id = :id LIMIT 1');
        $pondStmt->execute([':id' => $pondId]);
        $pond = $pondStmt->fetch(PDO::FETCH_ASSOC);
        if (!$pond) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Pond not found.']);
            exit;
        }

        $pondName = $pond['pond_name'];
        $references = [
            'disease reports' => countTableReferences($conn, 'disease_reports', 'pond_name', $pondName),
            'feeding records' => countTableReferences($conn, 'feeding_records', 'pond_id', $pondId),
            'alerts' => countTableReferences($conn, 'alerts', 'affected_pond_name', $pondName) + countTableReferences($conn, 'alerts', 'pond_name', $pondName),
            'harvest records' => countTableReferences($conn, 'harvest_predictions', 'pond_id', $pondId),
            'maintenance reports' => countTableReferences($conn, 'maintenance_reports', 'pond_id', $pondId) + countTableReferences($conn, 'maintenance_reports', 'pond_name', $pondName),
            'caretaker assignments' => countTableReferences($conn, 'caretaker_ponds', 'pond_id', $pondId) + countTableReferences($conn, 'users', 'pond_id', $pondId),
        ];
        $blocking = array_filter($references, fn($count) => $count > 0);

        if (!empty($blocking)) {
            http_response_code(409);
            $parts = [];
            foreach ($blocking as $label => $count) {
                $parts[] = "{$count} {$label}";
            }
            echo json_encode([
                'success' => false,
                'message' => 'This pond cannot be deleted because it is referenced by ' . implode(', ', $parts) . '.'
            ]);
            exit;
        }

        $deleteStmt = $conn->prepare('DELETE FROM ponds WHERE id = :id');
        $deleteStmt->execute([':id' => $pondId]);

        echo json_encode(['success' => true, 'message' => 'Pond deleted successfully']);
        exit;
    }

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
    $location = trim((string)($data['location'] ?? ''));
    $temp = $data['temperature'] ?? 29.0;
    $ph = $data['ph_level'] ?? 7.5;
    $salinity = $data['salinity'] ?? 18.0;
    $do = $data['dissolved_oxygen'] ?? 6.5;
    $waterLevel = $data['water_level'] ?? 1.2;
    $status = $data['status'] ?? 'Healthy';
    $caretakerId = isset($data['assigned_caretaker_id']) && $data['assigned_caretaker_id'] !== ''
        ? (int)$data['assigned_caretaker_id']
        : null;
    $caretakerName = null;
    if ($caretakerId !== null) {
        $userStmt = $conn->prepare('SELECT id, full_name FROM users WHERE id = :id AND LOWER(role) = "caretaker" AND status <> "Archived" LIMIT 1');
        $userStmt->execute([':id' => $caretakerId]);
        $caretaker = $userStmt->fetch(PDO::FETCH_ASSOC);
        if (!$caretaker) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Selected caretaker was not found.']);
            exit;
        }
        $caretakerName = $caretaker['full_name'];
    } else if (isset($data['assigned_caretaker_name']) && trim((string)$data['assigned_caretaker_name']) !== '') {
        $caretakerName = trim((string)$data['assigned_caretaker_name']);
    } else if (isset($data['recorded_by_name']) && trim((string)$data['recorded_by_name']) !== '') {
        $caretakerName = trim((string)$data['recorded_by_name']);
    }
    $areaSqm = $data['area_sqm'] ?? 500;
    $stockingDate = $data['stocking_date'] ?? date('Y-m-d');
    $growthPct = $data['growth_percentage'] ?? 80.0;
    $diseaseDetection = $data['disease_detection'] ?? 'Healthy';
    $diseaseConf = $data['disease_confidence'] ?? 0.0;
    $harvestReadiness = $data['harvest_readiness'] ?? 80.0;
    $expectedHarvest = $data['expected_harvest_date'] ?? date('Y-m-d', strtotime('+30 days'));
    $feedToday = $data['feed_today_kg'] ?? 10.0;
    $totalFeed = $data['total_feed_kg'] ?? 300.0;

    try {
        $conn->beginTransaction();

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
        $pondId = (int)$conn->lastInsertId();

        if ($caretakerId !== null) {
            $assignStmt = $conn->prepare('INSERT INTO caretaker_ponds (user_id, pond_id) VALUES (:user_id, :pond_id)');
            $assignStmt->execute([':user_id' => $caretakerId, ':pond_id' => $pondId]);

            $legacyStmt = $conn->prepare('UPDATE users SET pond_id = :pond_id WHERE id = :user_id');
            $legacyStmt->execute([':pond_id' => $pondId, ':user_id' => $caretakerId]);
        }

        $conn->commit();
    } catch (Throwable $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error creating pond: ' . $e->getMessage()]);
        exit;
    }

    $notifActor = $caretakerName ?: 'Admin';
    $notifMsg = "{$notifActor} created {$pondName} (Status: {$status}, Growth: {$growthPct}%).";
    createNotification($conn, 'Pond Status Logged', $notifMsg, $notifActor, 'water_quality', $pondName);

    echo json_encode(['success' => true, 'message' => 'Pond created successfully', 'id' => $pondId]);
}
