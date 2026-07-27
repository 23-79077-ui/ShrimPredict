<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/notifications_helper.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }



$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

$ensureFeedingTable = function ($conn): void {
    $conn->exec(
        "CREATE TABLE IF NOT EXISTS feeding_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pond_id INT NOT NULL,
            amount_kg DECIMAL(10,2) NOT NULL,
            feed_type VARCHAR(100) NOT NULL,
            feeding_time VARCHAR(20) DEFAULT NULL,
            product_code VARCHAR(20) DEFAULT NULL,
            has_vitamin TINYINT(1) DEFAULT 0,
            vitamin_name VARCHAR(100) DEFAULT NULL,
            shrimp_weight_grams DECIMAL(8,2) DEFAULT NULL,
            tray_count INT DEFAULT 4,
            tray_feed_grams DECIMAL(10,2) DEFAULT NULL,
            total_tray_feed_grams DECIMAL(10,2) DEFAULT NULL,
            broadcast_feed_kg DECIMAL(10,3) DEFAULT NULL,
            tray_monitoring_status VARCHAR(50) DEFAULT NULL,
            record_date DATE NOT NULL,
            notes TEXT,
            recorded_by_name VARCHAR(100) DEFAULT NULL,
            user_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_feeding_date (record_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    try {
        $columnsStmt = $conn->query('SHOW COLUMNS FROM feeding_records');
        $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
        $columns = [];
    }

    $migrations = [
        ['feeding_time', "ALTER TABLE feeding_records ADD COLUMN feeding_time VARCHAR(20) DEFAULT NULL"],
        ['product_code', "ALTER TABLE feeding_records ADD COLUMN product_code VARCHAR(20) DEFAULT NULL"],
        ['has_vitamin', "ALTER TABLE feeding_records ADD COLUMN has_vitamin TINYINT(1) DEFAULT 0"],
        ['vitamin_name', "ALTER TABLE feeding_records ADD COLUMN vitamin_name VARCHAR(100) DEFAULT NULL"],
        ['shrimp_weight_grams', "ALTER TABLE feeding_records ADD COLUMN shrimp_weight_grams DECIMAL(8,2) DEFAULT NULL"],
        ['tray_count', "ALTER TABLE feeding_records ADD COLUMN tray_count INT DEFAULT 4"],
        ['tray_feed_grams', "ALTER TABLE feeding_records ADD COLUMN tray_feed_grams DECIMAL(10,2) DEFAULT NULL"],
        ['total_tray_feed_grams', "ALTER TABLE feeding_records ADD COLUMN total_tray_feed_grams DECIMAL(10,2) DEFAULT NULL"],
        ['broadcast_feed_kg', "ALTER TABLE feeding_records ADD COLUMN broadcast_feed_kg DECIMAL(10,3) DEFAULT NULL"],
        ['tray_monitoring_status', "ALTER TABLE feeding_records ADD COLUMN tray_monitoring_status VARCHAR(50) DEFAULT NULL"],
        ['record_date', "ALTER TABLE feeding_records ADD COLUMN record_date DATE NOT NULL DEFAULT (CURRENT_DATE)"],
        ['recorded_by_name', "ALTER TABLE feeding_records ADD COLUMN recorded_by_name VARCHAR(100) DEFAULT NULL"],
        ['user_id', "ALTER TABLE feeding_records ADD COLUMN user_id INT DEFAULT NULL"],
        ['created_at', "ALTER TABLE feeding_records ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"],
    ];

    foreach ($migrations as [$column, $sql]) {
        if (!in_array($column, $columns, true)) {
            try {
                $conn->exec($sql);
            } catch (Throwable $e) {
                // Ignore if the column already exists or SQL is not supported.
            }
        }
    }
};

$ensureFeedingTable($conn);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawBody = file_get_contents('php://input');
    $data = json_decode($rawBody, true);
    if (!is_array($data)) {
        $data = [];
    }

    if (empty($data)) {
        $data = $_POST;
    }

    $pondId = isset($data['pond_id']) ? (int)$data['pond_id'] : 0;
    $amountKg = isset($data['amount_kg']) ? (float)$data['amount_kg'] : 0;
    $feedingTime = isset($data['feeding_time']) ? trim((string)$data['feeding_time']) : '';
    $productCode = isset($data['product_code']) ? trim((string)$data['product_code']) : '';
    $normalizedProduct = strtolower($productCode);
    if ($normalizedProduct === 'starter') {
        $productCode = 'Starter';
    } elseif ($normalizedProduct === 'grower') {
        $productCode = 'Grower';
    }
    $vitaminName = isset($data['vitamin_name']) ? trim((string)$data['vitamin_name']) : (isset($data['vitamin']) ? trim((string)$data['vitamin']) : 'None');
    if ($vitaminName === '') {
        $vitaminName = 'None';
    }
    $hasVitamin = ($vitaminName && $vitaminName !== 'None') ? 1 : (isset($data['has_vitamin']) ? (int)$data['has_vitamin'] : 0);
    $recordDate = isset($data['record_date']) ? trim((string)$data['record_date']) : date('Y-m-d');
    $notes = isset($data['notes']) ? trim((string)$data['notes']) : '';
    $recordedByName = isset($data['recorded_by_name']) ? trim((string)$data['recorded_by_name']) : (isset($data['recorded_by']) ? trim((string)$data['recorded_by']) : '');
    $userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;
    $shrimpWeightGrams = isset($data['shrimp_weight_grams']) && is_numeric($data['shrimp_weight_grams']) ? (float)$data['shrimp_weight_grams'] : null;
    $trayCount = isset($data['tray_count']) && is_numeric($data['tray_count']) ? max(1, (int)$data['tray_count']) : 4;
    $trayFeedGrams = isset($data['tray_feed_grams']) && is_numeric($data['tray_feed_grams']) ? (float)$data['tray_feed_grams'] : null;
    $totalTrayFeedGrams = isset($data['total_tray_feed_grams']) && is_numeric($data['total_tray_feed_grams']) ? (float)$data['total_tray_feed_grams'] : null;
    $broadcastFeedKg = isset($data['broadcast_feed_kg']) && is_numeric($data['broadcast_feed_kg']) ? (float)$data['broadcast_feed_kg'] : null;
    $trayMonitoringStatus = isset($data['tray_monitoring_status']) ? trim((string)$data['tray_monitoring_status']) : '';

    if (!$pondId || !$amountKg || !$feedingTime || !$productCode) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Pond, amount, feeding time, and product code are required.']);
        exit;
    }

    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A valid caretaker account is required to save a feeding record.']);
        exit;
    }

    try {
        $userStmt = $conn->prepare('SELECT id, full_name, role, status FROM users WHERE id = :id LIMIT 1');
        $userStmt->execute([':id' => $userId]);
        $recordingUser = $userStmt->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        $recordingUser = null;
    }

    if (!$recordingUser || $recordingUser['role'] !== 'caretaker') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Only logged-in caretaker accounts can save feeding records.']);
        exit;
    }

    if ($recordedByName === '') {
        $recordedByName = $recordingUser['full_name'] ?? 'Caretaker';
    }

    // Tateh feed products accepted by the caretaker feeding log.
    $validCodes = ['Starter', 'Grower'];
    if (!in_array($productCode, $validCodes, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Product code must be Starter or Grower.']);
        exit;
    }

    try {
        $columnsStmt = $conn->query('SHOW COLUMNS FROM feeding_records');
        $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
        $columns = [];
    }
    $hasRecordedByName = in_array('recorded_by_name', $columns, true);
    $hasUserId = in_array('user_id', $columns, true);
    $hasCreatedAt = in_array('created_at', $columns, true);
    $hasVitaminName = in_array('vitamin_name', $columns, true);
    $hasShrimpWeightGrams = in_array('shrimp_weight_grams', $columns, true);
    $hasTrayCount = in_array('tray_count', $columns, true);
    $hasTrayFeedGrams = in_array('tray_feed_grams', $columns, true);
    $hasTotalTrayFeedGrams = in_array('total_tray_feed_grams', $columns, true);
    $hasBroadcastFeedKg = in_array('broadcast_feed_kg', $columns, true);
    $hasTrayMonitoringStatus = in_array('tray_monitoring_status', $columns, true);

    $insertFields = ['pond_id', 'amount_kg', 'feed_type', 'feeding_time', 'product_code', 'has_vitamin', 'record_date', 'notes'];
    $placeholders = [':pond_id', ':amount_kg', ':feed_type', ':feeding_time', ':product_code', ':has_vitamin', ':record_date', ':notes'];
    $params = [
        ':pond_id' => $pondId,
        ':amount_kg' => $amountKg,
        ':feed_type' => 'Tateh - ' . $productCode,
        ':feeding_time' => $feedingTime,
        ':product_code' => $productCode,
        ':has_vitamin' => $hasVitamin,
        ':record_date' => $recordDate,
        ':notes' => $notes,
    ];

    if ($hasVitaminName) {
        $insertFields[] = 'vitamin_name';
        $placeholders[] = ':vitamin_name';
        $params[':vitamin_name'] = $vitaminName;
    }

    if ($hasShrimpWeightGrams) {
        $insertFields[] = 'shrimp_weight_grams';
        $placeholders[] = ':shrimp_weight_grams';
        $params[':shrimp_weight_grams'] = $shrimpWeightGrams;
    }

    if ($hasTrayCount) {
        $insertFields[] = 'tray_count';
        $placeholders[] = ':tray_count';
        $params[':tray_count'] = $trayCount;
    }

    if ($hasTrayFeedGrams) {
        $insertFields[] = 'tray_feed_grams';
        $placeholders[] = ':tray_feed_grams';
        $params[':tray_feed_grams'] = $trayFeedGrams;
    }

    if ($hasTotalTrayFeedGrams) {
        $insertFields[] = 'total_tray_feed_grams';
        $placeholders[] = ':total_tray_feed_grams';
        $params[':total_tray_feed_grams'] = $totalTrayFeedGrams;
    }

    if ($hasBroadcastFeedKg) {
        $insertFields[] = 'broadcast_feed_kg';
        $placeholders[] = ':broadcast_feed_kg';
        $params[':broadcast_feed_kg'] = $broadcastFeedKg;
    }

    if ($hasTrayMonitoringStatus) {
        $insertFields[] = 'tray_monitoring_status';
        $placeholders[] = ':tray_monitoring_status';
        $params[':tray_monitoring_status'] = $trayMonitoringStatus;
    }

    if ($hasRecordedByName) {
        $insertFields[] = 'recorded_by_name';
        $placeholders[] = ':recorded_by_name';
        $params[':recorded_by_name'] = $recordedByName ?: 'Caretaker';
    }

    if ($hasUserId) {
        $insertFields[] = 'user_id';
        $placeholders[] = ':user_id';
        $params[':user_id'] = $userId;
    }

    if (!$hasRecordedByName && !$hasUserId && $recordedByName) {
        $params[':notes'] = trim($notes . ($notes ? ' | ' : '') . 'Recorded by: ' . $recordedByName);
    }

    if (!$hasCreatedAt) {
        $insertFields[] = 'created_at';
        $placeholders[] = ':created_at';
        $params[':created_at'] = date('Y-m-d H:i:s');
    }

    try {
        $stmt = $conn->prepare(
            'INSERT INTO feeding_records (' . implode(', ', $insertFields) . ') VALUES (' . implode(', ', $placeholders) . ')'
        );
        $stmt->execute($params);
        $newId = $conn->lastInsertId();

        // Helper to notify admin of caretaker feeding action
        $pondName = 'Pond #' . $pondId;
        try {
            $pondStmt = $conn->prepare("SELECT pond_name FROM ponds WHERE id = :pid");
            $pondStmt->execute([':pid' => $pondId]);
            if ($row = $pondStmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($row['pond_name'])) $pondName = $row['pond_name'];
            }
        } catch (Throwable $e) {}

        $cName = $recordedByName ?: 'Caretaker';
        $notifMsg = "{$cName} logged {$amountKg}kg of {$productCode} feed for {$pondName} at {$feedingTime}.";
        createNotification($conn, 'Feeding Record Logged', $notifMsg, $cName, 'feeding', $pondName, $userId ?: null);

        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'Feeding record saved.', 'id' => $newId]);
        exit;
    } catch (Throwable $e) {
        $fallbackStmt = $conn->prepare(
            'INSERT INTO feeding_records (pond_id, amount_kg, feed_type, feeding_time, product_code, has_vitamin, record_date, notes) VALUES (:pond_id, :amount_kg, :feed_type, :feeding_time, :product_code, :has_vitamin, :record_date, :notes)'
        );
        $fallbackStmt->execute([
            ':pond_id' => $pondId,
            ':amount_kg' => $amountKg,
            ':feed_type' => 'Tateh - ' . $productCode,
            ':feeding_time' => $feedingTime,
            ':product_code' => $productCode,
            ':has_vitamin' => $hasVitamin,
            ':record_date' => $recordDate,
            ':notes' => $notes,
        ]);
        $newId = $conn->lastInsertId();

        $cName = $recordedByName ?: 'Caretaker';
        $notifMsg = "{$cName} logged {$amountKg}kg of {$productCode} feed for Pond #{$pondId} at {$feedingTime}.";
        createNotification($conn, 'Feeding Record Logged', $notifMsg, $cName, 'feeding', 'Pond #' . $pondId, $userId ?: null);

        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'Feeding record saved with fallback insert.', 'id' => $newId]);
        exit;
    }
}

// GET: Fetch feeding records, optionally filter by pond_id, user_id, recorded_by_name, date, search
$pondFilter = isset($_GET['pond_id']) && $_GET['pond_id'] !== 'all' ? (int)$_GET['pond_id'] : 0;
$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
$recordedByName = isset($_GET['recorded_by_name']) ? trim((string)$_GET['recorded_by_name']) : '';
$dateFilter = isset($_GET['date']) ? trim((string)$_GET['date']) : '';
$searchFilter = isset($_GET['search']) ? trim((string)$_GET['search']) : '';

$query = 'SELECT fr.*, p.pond_name FROM feeding_records fr LEFT JOIN ponds p ON fr.pond_id = p.id WHERE 1=1';
$params = [];

if ($pondFilter > 0) {
    $query .= ' AND fr.pond_id = :pond_id';
    $params[':pond_id'] = $pondFilter;
}

if ($userId > 0 && $recordedByName !== '') {
    $query .= ' AND (fr.user_id = :user_id OR LOWER(fr.recorded_by_name) LIKE LOWER(CONCAT("%", :recorded_by_name, "%")))';
    $params[':user_id'] = $userId;
    $params[':recorded_by_name'] = $recordedByName;
} elseif ($userId > 0) {
    $query .= ' AND fr.user_id = :user_id';
    $params[':user_id'] = $userId;
} elseif ($recordedByName !== '') {
    $query .= ' AND LOWER(fr.recorded_by_name) LIKE LOWER(CONCAT("%", :recorded_by_name, "%"))';
    $params[':recorded_by_name'] = $recordedByName;
}

if ($dateFilter !== '') {
    $query .= ' AND fr.record_date = :record_date';
    $params[':record_date'] = $dateFilter;
}

if ($searchFilter !== '') {
    $query .= ' AND (LOWER(p.pond_name) LIKE LOWER(CONCAT("%", :search, "%")) OR LOWER(fr.feed_type) LIKE LOWER(CONCAT("%", :search, "%")) OR LOWER(fr.vitamin_name) LIKE LOWER(CONCAT("%", :search, "%")) OR LOWER(fr.notes) LIKE LOWER(CONCAT("%", :search, "%")) OR LOWER(fr.recorded_by_name) LIKE LOWER(CONCAT("%", :search, "%")))';
    $params[':search'] = $searchFilter;
}

$query .= ' ORDER BY fr.record_date DESC, fr.created_at DESC';
$stmt = $conn->prepare($query);
$stmt->execute($params);

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));

