<?php
require_once __DIR__ . '/../config/database.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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

    try {
        $idCol = $conn->query("SHOW COLUMNS FROM harvest_predictions WHERE Field = 'id'")->fetch(PDO::FETCH_ASSOC);
        if ($idCol && strpos(strtolower($idCol['Extra'] ?? ''), 'auto_increment') === false) {
            $conn->exec("ALTER TABLE harvest_predictions MODIFY id INT(11) NOT NULL AUTO_INCREMENT");
        }
    } catch (Throwable $e) {}

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

function readinessStatus(float $progress, float $weight = 0.0): string {
    // Both 15,000 kg feed consumption (progress >= 100%) AND 23g+ average body weight from sampling are required
    if ($progress >= 100 && $weight >= 23.0) return 'Ready to Harvest';
    if ($progress >= 85 && $weight >= 20.0) return 'Nearly Ready';
    if ($progress >= 60 || $weight >= 15.0) return 'Developing';
    return 'Not Ready';
}

function ensureAlertsTable(PDO $conn): void {
    try {
        $conn->exec("
            CREATE TABLE IF NOT EXISTS alerts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pond_id INT NULL,
                alert_type VARCHAR(50) DEFAULT 'General',
                title VARCHAR(150) NOT NULL,
                message TEXT NOT NULL,
                severity VARCHAR(20) DEFAULT 'Medium',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                category VARCHAR(50) DEFAULT 'General',
                affected_pond_name VARCHAR(50) DEFAULT NULL,
                assigned_caretaker_name VARCHAR(100) DEFAULT NULL,
                confidence_pct INT DEFAULT 0,
                recommended_action TEXT DEFAULT NULL,
                status VARCHAR(30) DEFAULT 'Pending',
                follow_up_notes TEXT DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $cols = $conn->query('SHOW COLUMNS FROM alerts')->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('pond_id', $cols, true)) {
            try { $conn->exec('ALTER TABLE alerts ADD COLUMN pond_id INT NULL AFTER id'); } catch (Throwable $ignored) {}
        }
        if (!in_array('alert_type', $cols, true)) {
            try { $conn->exec("ALTER TABLE alerts ADD COLUMN alert_type VARCHAR(50) NULL DEFAULT 'General' AFTER pond_id"); } catch (Throwable $ignored) {}
        }
        $idCol = $conn->query("SHOW COLUMNS FROM alerts WHERE Field = 'id'")->fetch(PDO::FETCH_ASSOC);
        if ($idCol && strpos(strtolower($idCol['Extra'] ?? ''), 'auto_increment') === false) {
            $maxId = (int)$conn->query("SELECT MAX(id) FROM alerts WHERE id > 0")->fetchColumn();
            $conn->exec("UPDATE alerts SET id = " . ($maxId + 1) . " WHERE id = 0");
            $conn->exec("ALTER TABLE alerts MODIFY id INT(11) NOT NULL AUTO_INCREMENT");
        }
    } catch (Throwable $e) {}
}

function ensureNotificationsTable(PDO $conn): void {
    $conn->exec("
        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            caretaker_name VARCHAR(150) DEFAULT NULL,
            action_type VARCHAR(50) DEFAULT 'general',
            pond_name VARCHAR(100) DEFAULT NULL,
            target_id INT DEFAULT NULL,
            is_read TINYINT(1) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notification_user (user_id),
            INDEX idx_notification_status (status),
            INDEX idx_notification_read (is_read),
            INDEX idx_notification_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function getAssignedCaretakersForPond(PDO $conn, int $pondId): array {
    $stmt = $conn->prepare("
        SELECT DISTINCT u.id, u.full_name
        FROM users u
        LEFT JOIN ponds p ON p.id = :pond_id_join
        WHERE u.role = 'caretaker'
          AND COALESCE(u.status, 'Active') != 'Archived'
          AND (
              u.id IN (SELECT cp.user_id FROM caretaker_ponds cp WHERE cp.pond_id = :pond_id_cp)
              OR u.pond_id = :pond_id_user
              OR (
                  p.assigned_caretaker_name IS NOT NULL
                  AND TRIM(p.assigned_caretaker_name) <> ''
                  AND LOWER(TRIM(u.full_name)) = LOWER(TRIM(p.assigned_caretaker_name))
              )
          )
        ORDER BY u.full_name ASC
    ");
    $stmt->execute([
        ':pond_id_join' => $pondId,
        ':pond_id_cp' => $pondId,
        ':pond_id_user' => $pondId,
    ]);
    $caretakers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($caretakers)) {
        $fallback = $conn->prepare("
            SELECT DISTINCT u.id, u.full_name
            FROM feeding_records fr
            JOIN users u ON u.id = fr.user_id
            WHERE fr.pond_id = :pond_id
              AND u.role = 'caretaker'
              AND COALESCE(u.status, 'Active') != 'Archived'
            ORDER BY u.full_name ASC
        ");
        $fallback->execute([':pond_id' => $pondId]);
        $caretakers = $fallback->fetchAll(PDO::FETCH_ASSOC);
    }

    return array_map(fn($r) => [
        'id' => (int)$r['id'],
        'full_name' => (string)$r['full_name'],
    ], $caretakers);
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

    $averageWeight = round((float)($item['average_weight'] ?? 0), 2);

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
        ':average_weight' => $averageWeight,
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
                average_weight = :average_weight,
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
                :estimated_harvest, :average_weight, 0, 0, :recommendation, :prediction_date, NOW(), 'System'
            )
        ");
    }
    $stmt->execute($params);
}

ensureHarvestTables($conn);
ensureNotificationsTable($conn);
// Auto-ensure operational_status column has sufficient width
try {
    $conn->exec("ALTER TABLE ponds MODIFY COLUMN operational_status VARCHAR(50) NOT NULL DEFAULT 'Active'");
} catch (Throwable $e) {}

ensureAlertsTable($conn);

if ($requestMethod === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload) || empty($payload)) {
        $payload = $_POST;
    }

    $action = isset($payload['action']) ? trim((string)$payload['action']) : '';

    if ($action === 'acknowledge_harvest_prep') {
        $pondId = isset($payload['pond_id']) ? (int)$payload['pond_id'] : 0;
        $pondNameParam = isset($payload['pond_name']) ? trim((string)$payload['pond_name']) : '';
        $userId = isset($payload['user_id']) ? (int)$payload['user_id'] : 0;
        $caretakerName = isset($payload['caretaker_name']) && trim((string)$payload['caretaker_name']) !== ''
            ? trim((string)$payload['caretaker_name'])
            : 'Caretaker';

        // Robust pond resolution: by ID, by pond_name, or by caretaker assignment
        $pondRow = null;
        if ($pondId > 0) {
            $pondStmt = $conn->prepare('SELECT id, pond_name FROM ponds WHERE id = :id LIMIT 1');
            $pondStmt->execute([':id' => $pondId]);
            $pondRow = $pondStmt->fetch(PDO::FETCH_ASSOC);
        }
        if (!$pondRow && $pondNameParam !== '') {
            $pondStmt = $conn->prepare('SELECT id, pond_name FROM ponds WHERE pond_name = :pname LIMIT 1');
            $pondStmt->execute([':pname' => $pondNameParam]);
            $pondRow = $pondStmt->fetch(PDO::FETCH_ASSOC);
        }
        if (!$pondRow && $userId > 0) {
            $pondStmt = $conn->prepare('
                SELECT p.id, p.pond_name
                FROM caretaker_ponds cp
                JOIN ponds p ON cp.pond_id = p.id
                WHERE cp.user_id = :uid
                ORDER BY p.id ASC LIMIT 1
            ');
            $pondStmt->execute([':uid' => $userId]);
            $pondRow = $pondStmt->fetch(PDO::FETCH_ASSOC);
        }

        if (!$pondRow) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Pond not found.']);
            exit;
        }

        $resolvedPondId = (int)$pondRow['id'];
        $pondName = (string)$pondRow['pond_name'];

        try {
            $conn->beginTransaction();

            $updatePond = $conn->prepare("UPDATE ponds SET operational_status = 'Harvesting in Progress' WHERE id = :id");
            $updatePond->execute([':id' => $resolvedPondId]);

            // Mark caretaker's harvest notification as read
            if ($userId > 0) {
                $markRead = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = :uid AND action_type = 'harvest_ready' AND pond_name = :pname");
                $markRead->execute([':uid' => $userId, ':pname' => $pondName]);
            }

            // Create real-time notification for Admin (user_id = null)
            $notifTitle = "Harvest Prep Started : {$pondName}";
            $notifMsg = "✓ Caretaker {$caretakerName} has acknowledged {$pondName} Harvest Alert and started site preparations.";
            $adminNotif = $conn->prepare("
                INSERT INTO notifications (
                    user_id, title, message, caretaker_name, action_type,
                    pond_name, target_id, is_read, status, created_at
                ) VALUES (
                    NULL, :title, :message, :caretaker_name, 'harvest_prep',
                    :pond_name, :target_id, 0, 'active', NOW()
                )
            ");
            $adminNotif->execute([
                ':title' => $notifTitle,
                ':message' => $notifMsg,
                ':caretaker_name' => $caretakerName,
                ':pond_name' => $pondName,
                ':target_id' => $resolvedPondId,
            ]);
            $adminNotifId = (int)$conn->lastInsertId();

            if ($conn->inTransaction()) {
                $conn->commit();
            }

            echo json_encode([
                'success' => true,
                'message' => "Harvest preparation acknowledged for {$pondName}.",
                'pond_id' => $resolvedPondId,
                'pond_name' => $pondName,
                'operational_status' => 'Harvesting in Progress',
                'admin_notification_id' => $adminNotifId,
            ]);
            exit;
        } catch (Throwable $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to acknowledge harvest preparation: ' . $e->getMessage(),
            ]);
            exit;
        }
    }

    if ($action !== 'notify_harvest_ready') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Unsupported action for harvest_predictions.php.']);
        exit;
    }

    $pondId = isset($payload['pond_id']) ? (int)$payload['pond_id'] : 0;
    if ($pondId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid pond_id is required.']);
        exit;
    }

    $pondStmt = $conn->prepare('SELECT id, pond_name, assigned_caretaker_name FROM ponds WHERE id = :id LIMIT 1');
    $pondStmt->execute([':id' => $pondId]);
    $pondRow = $pondStmt->fetch(PDO::FETCH_ASSOC);
    if (!$pondRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Pond not found.']);
        exit;
    }

    $feedCheckStmt = $conn->prepare('SELECT COALESCE(SUM(amount_kg), 0) FROM feeding_records WHERE pond_id = :pond_id');
    $feedCheckStmt->execute([':pond_id' => $pondId]);
    $totalFeed = (float)$feedCheckStmt->fetchColumn();
    $progress = $totalFeed > 0 ? ($totalFeed / FEED_REFERENCE_KG) * 100.0 : 0.0;

    if ($progress < 100.0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This pond has not yet completed the 15,000 kg feeding target required for harvest readiness.',
            'feed_progress_percentage' => round($progress, 2),
        ]);
        exit;
    }

    $adjStmt = $conn->prepare('SELECT COALESCE(SUM(percentage), 0) FROM harvest_adjustments WHERE pond_id = :pond_id');
    $adjStmt->execute([':pond_id' => $pondId]);
    $adjPct = (float)$adjStmt->fetchColumn();
    $baselineHarvestKg = $totalFeed * BASELINE_RATIO;
    $estHarvestKg = max(0.0, $baselineHarvestKg * (1 + ($adjPct / 100.0)));
    $estHarvestTons = $estHarvestKg / 1000.0;

    $pondName = (string)$pondRow['pond_name'];
    $adminName = isset($payload['admin_name']) && trim((string)$payload['admin_name']) !== ''
        ? trim((string)$payload['admin_name'])
        : 'Administrator';

    $assignedCaretakers = getAssignedCaretakersForPond($conn, $pondId);
    $caretakerNames = array_values(array_unique(array_filter(array_map(
        fn($c) => trim((string)$c['full_name']),
        $assignedCaretakers
    ))));
    $caretakerSummary = !empty($caretakerNames)
        ? implode(', ', $caretakerNames)
        : (trim((string)($pondRow['assigned_caretaker_name'] ?? '')) ?: 'Assigned Caretaker');

    $totalFeedFmt = number_format($totalFeed, 0);
    $estKgFmt = number_format($estHarvestKg, 0);
    $estTonsFmt = number_format($estHarvestTons, 2);

    $alertTitle = "Harvest Ready: {$pondName}";
    $alertMsg = "{$adminName} marked {$pondName} as Ready to Harvest ({$totalFeedFmt} kg feed completed, est. yield {$estKgFmt} kg / {$estTonsFmt} tons). Prepare harvest equipment and coordinate pond drainage/harvest.";
    $recommendedAction = 'Prepare nets, containers, and aerators; coordinate immediate pond harvest schedule with the farm administrator.';

    try {
        $conn->beginTransaction();

        ensureAlertsTable($conn);
        $alertCols = $conn->query('SHOW COLUMNS FROM alerts')->fetchAll(PDO::FETCH_COLUMN);
        $hasPondId = in_array('pond_id', $alertCols, true);
        $hasAlertType = in_array('alert_type', $alertCols, true);

        $colsList = ['title', 'message', 'severity', 'category', 'affected_pond_name', 'assigned_caretaker_name', 'confidence_pct', 'recommended_action', 'status', 'created_at'];
        $valList = [':title', ':message', "'High'", "'Harvest'", ':pond_name', ':caretaker_name', '100', ':recommended_action', "'Pending'", 'NOW()'];
        $alertParams = [
            ':title' => $alertTitle,
            ':message' => $alertMsg,
            ':pond_name' => $pondName,
            ':caretaker_name' => $caretakerSummary,
            ':recommended_action' => $recommendedAction,
        ];

        if ($hasPondId) {
            array_unshift($colsList, 'pond_id');
            array_unshift($valList, ':pond_id');
            $alertParams[':pond_id'] = $pondId;
        }
        if ($hasAlertType) {
            $insertIdx = $hasPondId ? 1 : 0;
            array_splice($colsList, $insertIdx, 0, 'alert_type');
            array_splice($valList, $insertIdx, 0, "'harvest_ready'");
        }

        $alertInsert = $conn->prepare("
            INSERT INTO alerts (" . implode(', ', $colsList) . ")
            VALUES (" . implode(', ', $valList) . ")
        ");
        $alertInsert->execute($alertParams);
        $alertId = (int)$conn->lastInsertId();

        $notificationIds = [];
        $notifInsert = $conn->prepare("
            INSERT INTO notifications (
                user_id, title, message, caretaker_name, action_type,
                pond_name, target_id, is_read, status, created_at
            ) VALUES (
                :user_id, :title, :message, :caretaker_name, 'harvest_ready',
                :pond_name, :target_id, 0, 'active', NOW()
            )
        ");
        foreach ($assignedCaretakers as $ct) {
            $notifInsert->execute([
                ':user_id' => $ct['id'],
                ':title' => "Ready for Harvest: {$pondName}",
                ':message' => $alertMsg,
                ':caretaker_name' => $ct['full_name'],
                ':pond_name' => $pondName,
                ':target_id' => $alertId,
            ]);
            $notificationIds[] = (int)$conn->lastInsertId();
        }

        $updatePondStmt = $conn->prepare("UPDATE ponds SET operational_status = 'Ready for Harvest' WHERE id = :pond_id");
        $updatePondStmt->execute([':pond_id' => $pondId]);

        if ($conn->inTransaction()) {
            $conn->commit();
        }

        echo json_encode([
            'success' => true,
            'message' => !empty($caretakerNames)
                ? "Harvest alert sent to {$caretakerSummary} for {$pondName}."
                : "Harvest alert logged for {$pondName} (no active user account matched for targeted push).",
            'pond_id' => $pondId,
            'pond_name' => $pondName,
            'alert_id' => $alertId,
            'notified_caretakers' => $assignedCaretakers,
            'notification_ids' => $notificationIds,
            'alerted_at' => date('Y-m-d H:i:s'),
        ]);
    } catch (Throwable $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to dispatch harvest alert: ' . $e->getMessage()]);
    }
    exit;
}

$caretakerId = isset($_GET['caretaker_id']) && $_GET['caretaker_id'] !== 'all' ? (int)$_GET['caretaker_id'] : 0;
if ($caretakerId <= 0 && isset($_GET['user_id'])) {
    $caretakerId = (int)$_GET['user_id'];
}
$pondId = isset($_GET['pond_id']) && $_GET['pond_id'] !== 'all' ? (int)$_GET['pond_id'] : 0;

$pondColumns = $conn->query('SHOW COLUMNS FROM ponds')->fetchAll(PDO::FETCH_COLUMN);
$stockingDateSelect = in_array('stocking_date', $pondColumns, true) ? 'p.stocking_date' : 'NULL';

$pondsStmt = $conn->query("SELECT id, pond_name FROM ponds ORDER BY id ASC");
$ponds = $pondsStmt->fetchAll(PDO::FETCH_ASSOC);

$caretakerStmt = $conn->query("
    SELECT DISTINCT u.id, u.full_name
    FROM users u
    JOIN feeding_records fr ON fr.user_id = u.id
    WHERE u.role = 'caretaker'
    ORDER BY u.full_name ASC
");
$caretakers = $caretakerStmt->fetchAll(PDO::FETCH_ASSOC);

$params = [];
$filterSql = '';
if ($caretakerId > 0) {
    $filterSql .= ' AND u.id = :caretaker_id';
    $params[':caretaker_id'] = $caretakerId;
}
if ($pondId > 0) {
    $filterSql .= ' AND p.id = :pond_id';
    $params[':pond_id'] = $pondId;
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
        COUNT(DISTINCT fr.id) AS feeding_record_count,
        COUNT(DISTINCT DATE(fr.record_date)) AS active_feeding_days,
        MAX(fr.record_date) AS last_feeding_date,
        COALESCE((
            SELECT shrimp_weight_grams 
            FROM feeding_records 
            WHERE pond_id = p.id AND shrimp_weight_grams IS NOT NULL AND shrimp_weight_grams > 0 
            ORDER BY record_date DESC, id DESC LIMIT 1
        ), 0) AS average_weight,
        GROUP_CONCAT(DISTINCT u.id ORDER BY u.full_name SEPARATOR ',') AS caretaker_ids,
        GROUP_CONCAT(DISTINCT u.full_name ORDER BY u.full_name SEPARATOR ', ') AS caretaker_names
    FROM feeding_records fr
    JOIN (SELECT DISTINCT id, full_name, role FROM users WHERE role = 'caretaker') u ON fr.user_id = u.id
    JOIN (SELECT DISTINCT id, pond_name, status, stocking_date, temperature, ph_level, salinity, dissolved_oxygen FROM ponds) p ON fr.pond_id = p.id
    WHERE 1 = 1 {$filterSql}
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

$alertHistoryByPond = [];
try {
    $alertHistStmt = $conn->query("
        SELECT pond_id, MAX(created_at) AS last_alerted_at, COUNT(*) AS alert_count
        FROM alerts
        WHERE alert_type = 'harvest_ready' AND pond_id IS NOT NULL
        GROUP BY pond_id
    ");
    foreach ($alertHistStmt->fetchAll(PDO::FETCH_ASSOC) as $ahRow) {
        $alertHistoryByPond[(int)$ahRow['pond_id']] = [
            'last_alerted_at' => $ahRow['last_alerted_at'],
            'alert_count' => (int)$ahRow['alert_count'],
        ];
    }
} catch (Throwable $e) {
    $alertHistoryByPond = [];
}

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

    $activeDays = max(1, (int)($row['active_feeding_days'] ?? 0));
    $dailyFeedRate = $totalFeed > 0 ? round($totalFeed / $activeDays, 2) : 0.0;
    if ($remainingFeed <= 0) {
        $estimatedDaysRemaining = 0;
    } elseif ($dailyFeedRate > 0) {
        $estimatedDaysRemaining = (int)min(365, max(1, ceil($remainingFeed / $dailyFeedRate)));
    } elseif ($cultureDays !== null) {
        $estimatedDaysRemaining = (int)max(0, 120 - $cultureDays);
    } else {
        $estimatedDaysRemaining = 90;
    }
    $predictedHarvestDate = date('Y-m-d', strtotime("+{$estimatedDaysRemaining} days"));
    $assignedCtList = getAssignedCaretakersForPond($conn, (int)$row['pond_id']);
    $assignedCtNames = !empty($assignedCtList)
        ? implode(', ', array_map(fn($c) => $c['full_name'], $assignedCtList))
        : ($row['caretaker_names'] ?: 'Caretaker account');
    $alertHist = $alertHistoryByPond[(int)$row['pond_id']] ?? null;

    $item = [
        'pond_id' => (int)$row['pond_id'],
        'pond_name' => $row['pond_name'],
        'caretaker_ids' => $row['caretaker_ids'] ?: implode(',', array_map(fn($c) => (string)$c['id'], $assignedCtList)),
        'caretaker_names' => $assignedCtNames,
        'assigned_caretakers' => $assignedCtList,
        'total_feed_consumed_kg' => round($totalFeed, 2),
        'daily_feed_rate_kg' => $dailyFeedRate,
        'baseline_ratio' => BASELINE_RATIO,
        'feed_reference_kg' => FEED_REFERENCE_KG,
        'target_harvest_kg' => TARGET_HARVEST_KG,
        'target_harvest_tons' => round(TARGET_HARVEST_KG / 1000, 2),
        'baseline_harvest_kg' => round($baselineHarvest, 4),
        'adjusted_harvest_kg' => round($adjustedHarvest, 4),
        'predicted_harvest_tons' => round($adjustedHarvest / 1000, 4),
        'average_weight' => round((float)($row['average_weight'] ?? 0), 2),
        'feed_progress_percentage' => round($progress, 2),
        'feed_progress_visual_percentage' => round(min(100, $progress), 2),
        'remaining_feed_kg' => round($remainingFeed, 2),
        'estimated_days_to_harvest' => $estimatedDaysRemaining,
        'predicted_harvest_date' => $predictedHarvestDate,
        'readiness_status' => readinessStatus($progress, (float)($row['average_weight'] ?? 0)),
        'is_ready_to_harvest' => ($progress >= 100.0 && (float)($row['average_weight'] ?? 0) >= 23.0),
        'harvest_alert_sent' => ($alertHist !== null && $alertHist['alert_count'] > 0),
        'last_harvest_alert_at' => $alertHist ? $alertHist['last_alerted_at'] : null,
        'prediction_method' => PREDICTION_METHOD,
        'model_type' => 'Linear Feed-Rate Projection & Caretaker Historical Baseline',
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
    'selected_pond_id' => $pondId,
    'ponds' => $ponds,
    'caretakers' => $caretakers,
    'summary' => $summary,
    'predictions' => $predictions,
]);
