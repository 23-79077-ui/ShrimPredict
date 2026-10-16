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

$conn->exec("
    CREATE TABLE IF NOT EXISTS shrimp_scan_actions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pond_name VARCHAR(150) NOT NULL,
        scan_date DATE NOT NULL,
        caretaker_user_id INT NOT NULL,
        caretaker_name VARCHAR(150) NOT NULL,
        admin_name VARCHAR(150) NOT NULL,
        decision TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_scan_action_pond_date (pond_name, scan_date),
        INDEX idx_scan_action_caretaker (caretaker_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$insertActionNotification = function ($conn, $title, $message, $actor, $actionType, $pondName, $userId, $targetId) {
    $stmt = $conn->prepare("
        INSERT INTO notifications
            (user_id, title, message, caretaker_name, action_type, pond_name, target_id, is_read, status, created_at)
        VALUES
            (:user_id, :title, :message, :actor, :action_type, :pond_name, :target_id, 0, 'active', NOW())
    ");
    return $stmt->execute([
        ':user_id' => $userId,
        ':title' => $title,
        ':message' => $message,
        ':actor' => $actor,
        ':action_type' => $actionType,
        ':pond_name' => $pondName,
        ':target_id' => $targetId,
    ]);
};

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where = [];
    $params = [];

    if (isset($_GET['date']) && trim((string)$_GET['date']) !== '') {
        $scanDate = trim((string)$_GET['date']);
        $parsedDate = DateTime::createFromFormat('Y-m-d', $scanDate);
        if (!$parsedDate || $parsedDate->format('Y-m-d') !== $scanDate) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'A valid scan date is required.']);
            exit;
        }
        $where[] = 'scan_date = :scan_date';
        $params[':scan_date'] = $scanDate;
    }

    if (isset($_GET['user_id']) && (int)$_GET['user_id'] > 0) {
        $where[] = 'caretaker_user_id = :user_id';
        $params[':user_id'] = (int)$_GET['user_id'];
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    try {
        $stmt = $conn->prepare("SELECT * FROM shrimp_scan_actions {$whereSql} ORDER BY id DESC");
        $stmt->execute($params);
        echo json_encode(['success' => true, 'actions' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (Throwable $error) {
        error_log('Unable to fetch shrimp scan actions: ' . $error->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to load caretaker actions.']);
    }
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    $payload = $_POST;
}
$action = trim((string)($payload['action'] ?? ''));

if ($action === 'create') {
    $pondName = trim((string)($payload['pond_name'] ?? ''));
    $scanDate = trim((string)($payload['scan_date'] ?? ''));
    $decision = trim((string)($payload['decision'] ?? ''));
    $adminName = trim((string)($payload['admin_name'] ?? 'System Admin'));
    $decisionLength = function_exists('mb_strlen') ? mb_strlen($decision, 'UTF-8') : strlen($decision);
    $adminName = $adminName !== '' ? $adminName : 'System Admin';
    $parsedDate = DateTime::createFromFormat('Y-m-d', $scanDate);

    if ($pondName === '' || $decision === '' || $decisionLength > 2000
        || !$parsedDate || $parsedDate->format('Y-m-d') !== $scanDate) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Pond, valid scan date, and a decision of 1 to 2000 characters are required.']);
        exit;
    }

    if ($scanDate !== date('Y-m-d')) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Actions can only be sent for today’s scan group.']);
        exit;
    }

    try {
        $scanStmt = $conn->prepare("
            SELECT user_id, caretaker_name
            FROM disease_reports
            WHERE pond_name = :pond_name AND DATE(created_at) = :scan_date
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ");
        $scanStmt->execute([':pond_name' => $pondName, ':scan_date' => $scanDate]);
        $scan = $scanStmt->fetch(PDO::FETCH_ASSOC);
        if (!$scan) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No shrimp scans were found for this pond today.']);
            exit;
        }

        $caretakerUserId = (int)($scan['user_id'] ?? 0);
        $caretakerName = trim((string)($scan['caretaker_name'] ?? ''));
        if ($caretakerUserId <= 0 && $caretakerName !== '') {
            $userStmt = $conn->prepare("
                SELECT id, full_name
                FROM users
                WHERE role = 'caretaker' AND LOWER(TRIM(full_name)) = LOWER(TRIM(:name))
                LIMIT 1
            ");
            $userStmt->execute([':name' => $caretakerName]);
            $caretaker = $userStmt->fetch(PDO::FETCH_ASSOC);
            if ($caretaker) {
                $caretakerUserId = (int)$caretaker['id'];
                $caretakerName = (string)$caretaker['full_name'];
            }
        }

        if ($caretakerUserId <= 0) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'The caretaker for this pond could not be identified.']);
            exit;
        }

        $verifyUser = $conn->prepare("SELECT full_name FROM users WHERE id = :id AND role = 'caretaker' LIMIT 1");
        $verifyUser->execute([':id' => $caretakerUserId]);
        $verifiedCaretakerName = $verifyUser->fetchColumn();
        if (!$verifiedCaretakerName) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'The assigned caretaker account is unavailable.']);
            exit;
        }
        $caretakerName = (string)$verifiedCaretakerName;
        ensureNotificationsSchema($conn);

        $conn->beginTransaction();
        $insert = $conn->prepare("
            INSERT INTO shrimp_scan_actions
                (pond_name, scan_date, caretaker_user_id, caretaker_name, admin_name, decision, status)
            VALUES
                (:pond_name, :scan_date, :caretaker_user_id, :caretaker_name, :admin_name, :decision, 'Pending')
        ");
        $insert->execute([
            ':pond_name' => $pondName,
            ':scan_date' => $scanDate,
            ':caretaker_user_id' => $caretakerUserId,
            ':caretaker_name' => $caretakerName,
            ':admin_name' => $adminName,
            ':decision' => $decision,
        ]);
        $actionId = (int)$conn->lastInsertId();
        $message = "{$adminName} assigned an action for {$pondName}: {$decision}";
        if (!$insertActionNotification($conn, "Admin Action: {$pondName}", $message, $adminName, 'scan_action', $pondName, $caretakerUserId, $actionId)) {
            throw new RuntimeException('Unable to notify the caretaker.');
        }
        $conn->commit();

        echo json_encode(['success' => true, 'id' => $actionId, 'caretaker_name' => $caretakerName]);
    } catch (Throwable $error) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log('Unable to send shrimp scan action: ' . $error->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to send action to caretaker.']);
    }
    exit;
}

if ($action === 'update_status') {
    $actionId = (int)($payload['id'] ?? 0);
    $userId = (int)($payload['user_id'] ?? 0);
    $status = trim((string)($payload['status'] ?? ''));

    if ($actionId <= 0 || $userId <= 0 || !in_array($status, ['In Progress', 'Done'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid action, caretaker, and status are required.']);
        exit;
    }

    try {
        $find = $conn->prepare('SELECT * FROM shrimp_scan_actions WHERE id = :id AND caretaker_user_id = :user_id LIMIT 1');
        $find->execute([':id' => $actionId, ':user_id' => $userId]);
        $scanAction = $find->fetch(PDO::FETCH_ASSOC);
        if (!$scanAction) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'This caretaker action was not found.']);
            exit;
        }
        if ($scanAction['status'] === 'Done' && $status !== 'Done') {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'A completed action cannot be moved back to in progress.']);
            exit;
        }
        if ($scanAction['status'] === $status) {
            echo json_encode(['success' => true, 'status' => $status]);
            exit;
        }

        ensureNotificationsSchema($conn);
        $conn->beginTransaction();
        $update = $conn->prepare('UPDATE shrimp_scan_actions SET status = :status WHERE id = :id');
        $update->execute([':status' => $status, ':id' => $actionId]);
        $message = "{$scanAction['caretaker_name']} marked the action for {$scanAction['pond_name']} as {$status}: {$scanAction['decision']}";
        if (!$insertActionNotification(
            $conn,
            "Caretaker Action {$status}: {$scanAction['pond_name']}",
            $message,
            $scanAction['caretaker_name'],
            'scan_action_update',
            $scanAction['pond_name'],
            null,
            $actionId
        )) {
            throw new RuntimeException('Unable to notify the admin.');
        }
        $conn->commit();

        echo json_encode(['success' => true, 'status' => $status]);
    } catch (Throwable $error) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log('Unable to update shrimp scan action: ' . $error->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to update caretaker action.']);
    }
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Unknown action.']);
