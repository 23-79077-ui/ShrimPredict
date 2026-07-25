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

function ensureDiseaseReportsSchema($conn) {
    $conn->exec("
        CREATE TABLE IF NOT EXISTS disease_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            caretaker_name VARCHAR(150) DEFAULT NULL,
            pond_name VARCHAR(150) DEFAULT NULL,
            disease_name VARCHAR(100) NOT NULL,
            confidence_score DECIMAL(5,2) DEFAULT 0,
            risk_level VARCHAR(20) DEFAULT 'Low',
            recommendation TEXT,
            status VARCHAR(20) DEFAULT 'Pending',
            image_path VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_disease_risk (risk_level),
            INDEX idx_disease_user (user_id)
        )
    ");

    $columns = $conn->query("SHOW COLUMNS FROM disease_reports")->fetchAll(PDO::FETCH_COLUMN);
    $alterations = [
        'user_id' => "ALTER TABLE disease_reports ADD COLUMN user_id INT DEFAULT NULL AFTER id",
        'caretaker_name' => "ALTER TABLE disease_reports ADD COLUMN caretaker_name VARCHAR(150) DEFAULT NULL AFTER user_id",
        'pond_name' => "ALTER TABLE disease_reports ADD COLUMN pond_name VARCHAR(150) DEFAULT NULL AFTER caretaker_name",
    ];

    foreach ($alterations as $column => $sql) {
        if (!in_array($column, $columns, true)) {
            $conn->exec($sql);
        }
    }
}

ensureDiseaseReportsSchema($conn);

function backfillDiseaseReportCaretakers($conn) {
    $reportsStmt = $conn->query("
        SELECT id, disease_name, created_at
        FROM disease_reports
        WHERE (caretaker_name IS NULL OR caretaker_name = '' OR caretaker_name = 'Caretaker' OR user_id IS NULL)
        ORDER BY created_at DESC, id DESC
        LIMIT 200
    ");
    $reports = $reportsStmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$reports) return;

    $notificationStmt = $conn->prepare("
        SELECT caretaker_name, pond_name
        FROM notifications
        WHERE action_type = 'disease_scan'
          AND caretaker_name IS NOT NULL
          AND caretaker_name <> ''
          AND ABS(TIMESTAMPDIFF(SECOND, created_at, :created_at)) <= 86400
        ORDER BY ABS(TIMESTAMPDIFF(SECOND, created_at, :created_at)) ASC, id DESC
        LIMIT 1
    ");
    $userStmt = $conn->prepare("SELECT id FROM users WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(:full_name)) AND role = 'caretaker' LIMIT 1");
    $updateStmt = $conn->prepare("
        UPDATE disease_reports
        SET caretaker_name = COALESCE(NULLIF(:caretaker_name, ''), caretaker_name),
            pond_name = COALESCE(NULLIF(:pond_name, ''), pond_name),
            user_id = COALESCE(:user_id, user_id)
        WHERE id = :id
    ");

    foreach ($reports as $report) {
        $notificationStmt->execute([':created_at' => $report['created_at']]);
        $notification = $notificationStmt->fetch(PDO::FETCH_ASSOC);
        if (!$notification || empty($notification['caretaker_name'])) continue;

        $userId = null;
        $userStmt->execute([':full_name' => $notification['caretaker_name']]);
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        if ($user && isset($user['id'])) {
            $userId = (int)$user['id'];
        }

        $updateStmt->execute([
            ':caretaker_name' => $notification['caretaker_name'],
            ':pond_name' => $notification['pond_name'] ?? '',
            ':user_id' => $userId,
            ':id' => (int)$report['id'],
        ]);
    }
}

backfillDiseaseReportCaretakers($conn);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $params = [];

    $hasUserFilter = isset($_GET['user_id']) && $_GET['user_id'] !== '' && $_GET['user_id'] !== 'all';
    $hasCaretakerNameFilter = isset($_GET['caretaker_name']) && trim((string)$_GET['caretaker_name']) !== '' && $_GET['caretaker_name'] !== 'all';

    if ($hasUserFilter && $hasCaretakerNameFilter) {
        $where[] = '(user_id = :user_id OR caretaker_name = :caretaker_name)';
        $params[':user_id'] = (int)$_GET['user_id'];
        $params[':caretaker_name'] = trim((string)$_GET['caretaker_name']);
    } else if ($hasUserFilter) {
        $where[] = 'user_id = :user_id';
        $params[':user_id'] = (int)$_GET['user_id'];
    } else if ($hasCaretakerNameFilter) {
        $where[] = 'caretaker_name = :caretaker_name';
        $params[':caretaker_name'] = trim((string)$_GET['caretaker_name']);
    }

    if (isset($_GET['risk_level']) && $_GET['risk_level'] !== '' && $_GET['risk_level'] !== 'all') {
        $where[] = 'risk_level = :risk_level';
        $params[':risk_level'] = $_GET['risk_level'];
    }

    if (isset($_GET['status']) && $_GET['status'] !== '' && $_GET['status'] !== 'all') {
        $where[] = 'status = :status';
        $params[':status'] = $_GET['status'];
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $stmt = $conn->prepare("SELECT * FROM disease_reports {$whereSql} ORDER BY created_at DESC, id DESC");
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawBody = file_get_contents('php://input');
    $jsonData = json_decode($rawBody, true);

    $diseaseName = $_POST['disease_name'] ?? ($jsonData['disease_name'] ?? 'Unknown Disease');
    $confidenceScore = $_POST['confidence_score'] ?? ($jsonData['confidence_score'] ?? 0);
    $confidenceScore = is_numeric($confidenceScore) ? (float)$confidenceScore : (float)str_replace('%', '', (string)$confidenceScore);
    $riskLevel = $_POST['risk_level'] ?? ($jsonData['risk_level'] ?? 'Low');
    $recommendation = $_POST['recommendation'] ?? ($jsonData['recommendation'] ?? 'Monitor closely');
    $status = $_POST['status'] ?? ($jsonData['status'] ?? 'Pending');
    $userId = $_POST['user_id'] ?? ($jsonData['user_id'] ?? null);
    $userId = is_numeric($userId) ? (int)$userId : null;
    $caretakerName = $_POST['caretaker_name'] ?? ($jsonData['caretaker_name'] ?? ($jsonData['recorded_by'] ?? 'Caretaker'));
    $pondName = $_POST['pond_name'] ?? ($jsonData['pond_name'] ?? 'General Pond');

    $imagePath = 'uploads/sample.jpg';

    if (isset($_FILES['image']) && $_FILES['image']['tmp_name']) {
        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
        $fileName = time() . '_' . basename($_FILES['image']['name']);
        $target = $uploadDir . $fileName;
        if (move_uploaded_file($_FILES['image']['tmp_name'], $target)) {
            $imagePath = 'uploads/' . $fileName;
        }
    } else if (isset($jsonData['image_path'])) {
        $imagePath = $jsonData['image_path'];
    }

    $stmt = $conn->prepare('INSERT INTO disease_reports (user_id, caretaker_name, pond_name, disease_name, confidence_score, risk_level, recommendation, status, image_path, created_at) VALUES (:user_id, :caretaker_name, :pond_name, :disease_name, :confidence_score, :risk_level, :recommendation, :status, :image_path, NOW())');
    $stmt->execute([
        ':user_id' => $userId,
        ':caretaker_name' => $caretakerName,
        ':pond_name' => $pondName,
        ':disease_name' => $diseaseName,
        ':confidence_score' => $confidenceScore,
        ':risk_level' => $riskLevel,
        ':recommendation' => $recommendation,
        ':status' => $status,
        ':image_path' => $imagePath
    ]);
    $reportId = $conn->lastInsertId();

    // Trigger Admin Notification
    $notifMsg = "{$caretakerName} scanned for disease: {$diseaseName} with {$confidenceScore}% confidence ({$riskLevel} Risk).";
    createNotification($conn, 'Disease Scan Submitted', $notifMsg, $caretakerName, 'disease_scan', $pondName);

    echo json_encode(['success' => true, 'message' => 'Disease report saved', 'id' => $reportId]);
}
