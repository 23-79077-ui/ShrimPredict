<?php
require_once __DIR__ . '/../config/database.php';
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

// Helper to auto-ensure notifications table schema
$ensureNotificationsTable = function ($conn): void {
    $conn->exec(
        "CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            caretaker_name VARCHAR(150) DEFAULT NULL,
            action_type VARCHAR(50) DEFAULT 'general',
            pond_name VARCHAR(100) DEFAULT NULL,
            is_read TINYINT(1) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notification_user (user_id),
            INDEX idx_notification_status (status),
            INDEX idx_notification_read (is_read),
            INDEX idx_notification_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    try {
        $columnsStmt = $conn->query('SHOW COLUMNS FROM notifications');
        $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
        $columns = [];
    }

    $migrations = [
        ['user_id', "ALTER TABLE notifications MODIFY COLUMN user_id INT DEFAULT NULL"],
        ['title', "ALTER TABLE notifications ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'Notification' AFTER user_id"],
        ['caretaker_name', "ALTER TABLE notifications ADD COLUMN caretaker_name VARCHAR(150) DEFAULT NULL AFTER message"],
        ['action_type', "ALTER TABLE notifications ADD COLUMN action_type VARCHAR(50) DEFAULT 'general' AFTER caretaker_name"],
        ['pond_name', "ALTER TABLE notifications ADD COLUMN pond_name VARCHAR(100) DEFAULT NULL AFTER action_type"],
        ['target_id', "ALTER TABLE notifications ADD COLUMN target_id INT DEFAULT NULL AFTER pond_name"],
        ['status', "ALTER TABLE notifications ADD COLUMN status VARCHAR(20) DEFAULT 'active' AFTER is_read"],
    ];

    foreach ($migrations as [$column, $sql]) {
        if (!in_array($column, $columns, true)) {
            try {
                $conn->exec($sql);
            } catch (Throwable $e) {
                // Ignore if exists
            }
        }
    }
};

$ensureNotificationsTable($conn);

$method = $_SERVER['REQUEST_METHOD'];

// Helper to get body JSON or POST data
$getPayload = function () {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (is_array($data)) return $data;
    return $_POST;
};

if ($method === 'GET') {
    $statusFilter = isset($_GET['status']) ? trim((string)$_GET['status']) : 'active';
    $dateFilter = isset($_GET['date']) ? trim((string)$_GET['date']) : '';
    $unreadOnly = isset($_GET['unread_only']) && ($_GET['unread_only'] === '1' || $_GET['unread_only'] === 'true');
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

    $where = [];
    $params = [];

    if ($statusFilter && $statusFilter !== 'all') {
        $where[] = 'status = :status';
        $params[':status'] = $statusFilter;
    } else {
        $where[] = "status != 'deleted'";
    }

    if ($unreadOnly) {
        $where[] = 'is_read = 0';
    }

    if ($userId > 0) {
        // Caretakers ONLY receive targeted notifications sent BY ADMIN for status updates on their reported issues
        $where[] = 'user_id = :user_id';
        $where[] = "action_type NOT IN ('feeding', 'maintenance', 'disease_scan')";
        $params[':user_id'] = $userId;
    } else {
        // Admin receives all incoming reports, scans, feeding logs, and general alerts
        $where[] = '(user_id IS NULL OR user_id = 0 OR action_type IN (\'maintenance\', \'disease_scan\', \'feeding\', \'general\'))';
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $query = "SELECT * FROM notifications {$whereSql} ORDER BY created_at DESC, id DESC";

    try {
        $stmt = $conn->prepare($query);
        $stmt->execute($params);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Calculate summary counts
        if ($userId > 0) {
            $unreadStmt = $conn->prepare("SELECT COUNT(*) FROM notifications WHERE is_read = 0 AND status = 'active' AND user_id = :uid AND action_type NOT IN ('feeding', 'maintenance', 'disease_scan')");
            $unreadStmt->execute([':uid' => $userId]);
            $totalUnread = (int)$unreadStmt->fetchColumn();

            $activeStmt = $conn->prepare("SELECT COUNT(*) FROM notifications WHERE status = 'active' AND user_id = :uid AND action_type NOT IN ('feeding', 'maintenance', 'disease_scan')");
            $activeStmt->execute([':uid' => $userId]);
            $totalActive = (int)$activeStmt->fetchColumn();
        } else {
            $unreadStmt = $conn->query("SELECT COUNT(*) FROM notifications WHERE is_read = 0 AND status = 'active' AND (user_id IS NULL OR user_id = 0 OR action_type IN ('maintenance', 'disease_scan', 'feeding', 'general'))");
            $totalUnread = (int)$unreadStmt->fetchColumn();

            $activeStmt = $conn->query("SELECT COUNT(*) FROM notifications WHERE status = 'active' AND (user_id IS NULL OR user_id = 0 OR action_type IN ('maintenance', 'disease_scan', 'feeding', 'general'))");
            $totalActive = (int)$activeStmt->fetchColumn();
        }

        $archivedStmt = $conn->query("SELECT COUNT(*) FROM notifications WHERE status = 'archived'");
        $totalArchived = (int)$archivedStmt->fetchColumn();

        $deletedStmt = $conn->query("SELECT COUNT(*) FROM notifications WHERE status = 'deleted'");
        $totalDeleted = (int)$deletedStmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'notifications' => $notifications,
            'counts' => [
                'unread' => $totalUnread,
                'active' => $totalActive,
                'archived' => $totalArchived,
                'deleted' => $totalDeleted,
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

    if ($action === 'mark_all_read') {
        try {
            $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE is_read = 0 AND status != 'deleted'");
            $stmt->execute();
            echo json_encode(['success' => true, 'message' => 'All notifications marked as read.']);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'mark_read' || $action === 'mark_unread' || $action === 'archive' || $action === 'delete' || $action === 'restore' || $action === 'permanent_delete') {
        $id = isset($payload['id']) ? (int)$payload['id'] : 0;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Notification ID required.']);
            exit;
        }

        try {
            if ($action === 'mark_read') {
                $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE id = :id");
            } elseif ($action === 'mark_unread') {
                $stmt = $conn->prepare("UPDATE notifications SET is_read = 0 WHERE id = :id");
            } elseif ($action === 'archive') {
                $stmt = $conn->prepare("UPDATE notifications SET status = 'archived' WHERE id = :id");
            } elseif ($action === 'delete') {
                $stmt = $conn->prepare("UPDATE notifications SET status = 'deleted' WHERE id = :id");
            } elseif ($action === 'restore') {
                $stmt = $conn->prepare("UPDATE notifications SET status = 'active' WHERE id = :id");
            } elseif ($action === 'permanent_delete') {
                $stmt = $conn->prepare("DELETE FROM notifications WHERE id = :id");
            }
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'message' => "Notification updated successfully ({$action})."]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    // Default POST action: Create new notification
    $title = isset($payload['title']) ? trim((string)$payload['title']) : 'New Notification';
    $message = isset($payload['message']) ? trim((string)$payload['message']) : '';
    $caretakerName = isset($payload['caretaker_name']) ? trim((string)$payload['caretaker_name']) : (isset($payload['recorded_by']) ? trim((string)$payload['recorded_by']) : 'Caretaker');
    $actionType = isset($payload['action_type']) ? trim((string)$payload['action_type']) : 'general';
    $pondName = isset($payload['pond_name']) ? trim((string)$payload['pond_name']) : '';
    $userId = isset($payload['user_id']) ? (int)$payload['user_id'] : null;
    $targetId = isset($payload['target_id']) ? (int)$payload['target_id'] : (isset($payload['report_id']) ? (int)$payload['report_id'] : null);

    if (empty($message)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Message is required.']);
        exit;
    }

    try {
        $stmt = $conn->prepare(
            "INSERT INTO notifications (user_id, title, message, caretaker_name, action_type, pond_name, target_id, is_read, status, created_at)
             VALUES (:user_id, :title, :message, :caretaker_name, :action_type, :pond_name, :target_id, 0, 'active', NOW())"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':title' => $title,
            ':message' => $message,
            ':caretaker_name' => $caretakerName,
            ':action_type' => $actionType,
            ':pond_name' => $pondName,
            ':target_id' => $targetId,
        ]);
        $newId = $conn->lastInsertId();
        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'Notification created.', 'id' => $newId]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'PUT' || $method === 'DELETE') {
    $payload = $getPayload();
    $id = isset($payload['id']) ? (int)$payload['id'] : (isset($_GET['id']) ? (int)$_GET['id'] : 0);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Notification ID required.']);
        exit;
    }

    try {
        if ($method === 'DELETE') {
            $stmt = $conn->prepare("UPDATE notifications SET status = 'deleted' WHERE id = :id");
        } else {
            $isRead = isset($payload['is_read']) ? (int)$payload['is_read'] : 1;
            $status = isset($payload['status']) ? trim((string)$payload['status']) : 'active';
            $stmt = $conn->prepare("UPDATE notifications SET is_read = :is_read, status = :status WHERE id = :id");
            $stmt->bindValue(':is_read', $isRead, PDO::PARAM_INT);
            $stmt->bindValue(':status', $status);
        }
        $stmt->execute([':id' => $id]);
        echo json_encode(['success' => true, 'message' => 'Notification updated.']);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}
