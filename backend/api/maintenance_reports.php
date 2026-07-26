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

// Auto-ensure maintenance_reports table schema
$ensureMaintenanceSchema = function ($conn): void {
    $conn->exec(
        "CREATE TABLE IF NOT EXISTS maintenance_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            caretaker_name VARCHAR(150) NOT NULL,
            pond_id INT DEFAULT NULL,
            pond_name VARCHAR(100) NOT NULL,
            problem_type VARCHAR(100) NOT NULL,
            specific_issue VARCHAR(255) NOT NULL,
            severity_level VARCHAR(50) NOT NULL DEFAULT 'Medium',
            description TEXT NOT NULL,
            suggested_action TEXT DEFAULT NULL,
            photo_url TEXT DEFAULT NULL,
            video_url VARCHAR(255) DEFAULT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'Pending',
            admin_notes TEXT DEFAULT NULL,
            resolved_by VARCHAR(150) DEFAULT NULL,
            resolved_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mr_user (user_id),
            INDEX idx_mr_status (status),
            INDEX idx_mr_severity (severity_level),
            INDEX idx_mr_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $columns = $conn->query("SHOW COLUMNS FROM maintenance_reports")->fetchAll(PDO::FETCH_ASSOC);
    $idColumn = null;
    foreach ($columns as $column) {
        if ($column['Field'] === 'id') {
            $idColumn = $column;
            break;
        }
    }

    if ($idColumn && stripos($idColumn['Extra'] ?? '', 'auto_increment') === false) {
        $conn->exec("ALTER TABLE maintenance_reports MODIFY id INT NOT NULL AUTO_INCREMENT");
    }
};

$ensureMaintenanceSchema($conn);

$method = $_SERVER['REQUEST_METHOD'];

$getPayload = function () {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (is_array($data)) return $data;
    return $_POST;
};

if ($method === 'GET') {
    $status = isset($_GET['status']) ? trim((string)$_GET['status']) : 'all';
    $severity = isset($_GET['severity']) ? trim((string)$_GET['severity']) : 'all';
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    $dateFilter = isset($_GET['date']) ? trim((string)$_GET['date']) : '';

    $where = [];
    $params = [];

    if ($status && $status !== 'all') {
        $where[] = 'status = :status';
        $params[':status'] = $status;
    }

    if ($severity && $severity !== 'all') {
        $where[] = 'severity_level = :severity';
        $params[':severity'] = $severity;
    }

    if ($userId > 0) {
        $where[] = 'user_id = :user_id';
        $params[':user_id'] = $userId;
    }

    if ($dateFilter) {
        $where[] = 'DATE(created_at) = :date_filter';
        $params[':date_filter'] = $dateFilter;
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $query = "SELECT * FROM maintenance_reports {$whereSql} ORDER BY created_at DESC, id DESC";

    try {
        $stmt = $conn->prepare($query);
        $stmt->execute($params);
        $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Counts
        $totalStmt = $conn->query("SELECT COUNT(*) FROM maintenance_reports");
        $totalCount = (int)$totalStmt->fetchColumn();

        $pendingStmt = $conn->query("SELECT COUNT(*) FROM maintenance_reports WHERE status = 'Pending'");
        $pendingCount = (int)$pendingStmt->fetchColumn();

        $inProgressStmt = $conn->query("SELECT COUNT(*) FROM maintenance_reports WHERE status = 'In Progress'");
        $inProgressCount = (int)$inProgressStmt->fetchColumn();

        $doneStmt = $conn->query("SELECT COUNT(*) FROM maintenance_reports WHERE status = 'Done'");
        $doneCount = (int)$doneStmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'reports' => $reports,
            'counts' => [
                'total' => $totalCount,
                'pending' => $pendingCount,
                'in_progress' => $inProgressCount,
                'done' => $doneCount,
            ],
        ]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST') {
    $payload = $getPayload();
    $action = isset($payload['action']) ? trim((string)$payload['action']) : 'create';

    if ($action === 'create') {
        $caretakerName = isset($payload['caretaker_name']) ? trim((string)$payload['caretaker_name']) : 'Caretaker';
        $pondName = isset($payload['pond_name']) ? trim((string)$payload['pond_name']) : 'Pond';
        $pondId = isset($payload['pond_id']) ? (int)$payload['pond_id'] : null;
        $userId = isset($payload['user_id']) ? (int)$payload['user_id'] : null;
        $problemType = isset($payload['problem_type']) ? trim((string)$payload['problem_type']) : 'General Maintenance';
        $specificIssue = isset($payload['specific_issue']) ? trim((string)$payload['specific_issue']) : 'Pond Issue';
        $severityLevel = isset($payload['severity_level']) ? trim((string)$payload['severity_level']) : 'Medium';
        $description = isset($payload['description']) ? trim((string)$payload['description']) : '';
        $suggestedAction = isset($payload['suggested_action']) ? trim((string)$payload['suggested_action']) : '';
        $photoUrl = isset($payload['photo_url']) ? trim((string)$payload['photo_url']) : '';
        $videoUrl = isset($payload['video_url']) ? trim((string)$payload['video_url']) : '';

        if (empty($description)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Description is required.']);
            exit;
        }

        try {
            $stmt = $conn->prepare(
                "INSERT INTO maintenance_reports (user_id, caretaker_name, pond_id, pond_name, problem_type, specific_issue, severity_level, description, suggested_action, photo_url, video_url, status, created_at)
                 VALUES (:user_id, :caretaker_name, :pond_id, :pond_name, :problem_type, :specific_issue, :severity_level, :description, :suggested_action, :photo_url, :video_url, 'Pending', NOW())"
            );
            $stmt->execute([
                ':user_id' => $userId,
                ':caretaker_name' => $caretakerName,
                ':pond_id' => $pondId,
                ':pond_name' => $pondName,
                ':problem_type' => $problemType,
                ':specific_issue' => $specificIssue,
                ':severity_level' => $severityLevel,
                ':description' => $description,
                ':suggested_action' => $suggestedAction,
                ':photo_url' => $photoUrl,
                ':video_url' => $videoUrl,
            ]);
            $newId = $conn->lastInsertId();

            // Trigger Admin Notification automatically
            $notifTitle = "New Maintenance Report: {$severityLevel} Severity";
            $notifMsg = "{$caretakerName} reported an issue for {$pondName}: {$specificIssue} ({$problemType}).";
            createNotification($conn, $notifTitle, $notifMsg, $caretakerName, 'maintenance', $pondName, $userId, $newId);

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Maintenance report submitted successfully.',
                'id' => $newId,
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'update_status') {
        $id = isset($payload['id']) ? (int)$payload['id'] : 0;
        $newStatus = isset($payload['status']) ? trim((string)$payload['status']) : 'Pending';
        $adminNotes = isset($payload['admin_notes']) ? trim((string)$payload['admin_notes']) : '';
        $resolvedBy = isset($payload['resolved_by']) ? trim((string)$payload['resolved_by']) : 'Admin';

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Report ID required.']);
            exit;
        }

        try {
            if ($newStatus === 'Done') {
                $stmt = $conn->prepare(
                    "UPDATE maintenance_reports 
                     SET status = :status, admin_notes = :admin_notes, resolved_by = :resolved_by, resolved_at = NOW() 
                     WHERE id = :id"
                );
            } else {
                $stmt = $conn->prepare(
                    "UPDATE maintenance_reports 
                     SET status = :status, admin_notes = :admin_notes, resolved_by = :resolved_by 
                     WHERE id = :id"
                );
            }
            $stmt->execute([
                ':status' => $newStatus,
                ':admin_notes' => $adminNotes,
                ':resolved_by' => $resolvedBy,
                ':id' => $id,
            ]);

            echo json_encode([
                'success' => true,
                'message' => "Report status updated to {$newStatus}.",
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'delete') {
        $id = isset($payload['id']) ? (int)$payload['id'] : 0;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Report ID required.']);
            exit;
        }
        try {
            $stmt = $conn->prepare("DELETE FROM maintenance_reports WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Report deleted successfully.']);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }
}
