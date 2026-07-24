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
    $vitaminName = isset($data['vitamin_name']) ? trim((string)$data['vitamin_name']) : (isset($data['vitamin']) ? trim((string)$data['vitamin']) : 'None');
    if ($vitaminName === '') {
        $vitaminName = 'None';
    }
    $hasVitamin = ($vitaminName && $vitaminName !== 'None') ? 1 : (isset($data['has_vitamin']) ? (int)$data['has_vitamin'] : 0);
    $recordDate = isset($data['record_date']) ? trim((string)$data['record_date']) : date('Y-m-d');
    $notes = isset($data['notes']) ? trim((string)$data['notes']) : '';
    $recordedByName = isset($data['recorded_by_name']) ? trim((string)$data['recorded_by_name']) : (isset($data['recorded_by']) ? trim((string)$data['recorded_by']) : '');
    $userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;

    if (!$pondId || !$amountKg || !$feedingTime || !$productCode) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Pond, amount, feeding time, and product code are required.']);
        exit;
    }

    // Validate product code (Starter, Grower, or legacy PO1-PO5)
    $validCodes = ['Starter', 'Grower', 'PO1', 'PO2', 'PO3', 'PO4', 'PO5'];
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

// GET: Fetch feeding records, optionally filter by pond_id or caretaker
$pondFilter = isset($_GET['pond_id']) ? (int)$_GET['pond_id'] : 0;
$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
$recordedByName = isset($_GET['recorded_by_name']) ? trim((string)$_GET['recorded_by_name']) : '';

if ($pondFilter) {
    $stmt = $conn->prepare(
        'SELECT fr.*, p.pond_name FROM feeding_records fr 
         LEFT JOIN ponds p ON fr.pond_id = p.id 
         WHERE fr.pond_id = :pond_id 
         ORDER BY fr.record_date DESC, fr.created_at DESC'
    );
    $stmt->execute([':pond_id' => $pondFilter]);
} elseif ($userId || $recordedByName) {
    $query = 'SELECT fr.*, p.pond_name FROM feeding_records fr LEFT JOIN ponds p ON fr.pond_id = p.id WHERE 1=1';
    $params = [];
    if ($userId && $recordedByName) {
        $query .= ' AND (fr.user_id = :user_id OR LOWER(fr.recorded_by_name) LIKE LOWER(CONCAT("%", :recorded_by_name, "%")))';
        $params[':user_id'] = $userId;
        $params[':recorded_by_name'] = $recordedByName;
    } elseif ($userId) {
        $query .= ' AND (fr.user_id = :user_id)';
        $params[':user_id'] = $userId;
    } elseif ($recordedByName) {
        $query .= ' AND (LOWER(fr.recorded_by_name) LIKE LOWER(CONCAT("%", :recorded_by_name, "%")))';
        $params[':recorded_by_name'] = $recordedByName;
    }
    $query .= ' ORDER BY fr.record_date DESC, fr.created_at DESC';
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
} else {
    $stmt = $conn->query(
        'SELECT fr.*, p.pond_name FROM feeding_records fr 
         LEFT JOIN ponds p ON fr.pond_id = p.id 
         ORDER BY fr.record_date DESC, fr.created_at DESC'
    );
}

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
