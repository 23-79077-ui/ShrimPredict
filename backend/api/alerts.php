<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/storage.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
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

// POST Handler (Update Status, Assign Follow-up, Delete)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = isset($data['action']) ? $data['action'] : '';

    // Action 1: Update Status (Resolve / In Progress)
    if ($action === 'update_status') {
        $alertId = isset($data['alert_id']) ? (int)$data['alert_id'] : 0;
        $status = isset($data['status']) ? trim((string)$data['status']) : 'Resolved';

        if ($alertId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid alert ID.']);
            exit;
        }

        $stmt = $conn->prepare('UPDATE alerts SET status = :status WHERE id = :id');
        $stmt->execute([':status' => $status, ':id' => $alertId]);

        echo json_encode(['success' => true, 'message' => "Alert marked as {$status}."]);
        exit;
    }

    // Action 2: Assign Follow-up
    if ($action === 'assign_followup') {
        $alertId = isset($data['alert_id']) ? (int)$data['alert_id'] : 0;
        $caretaker = isset($data['assigned_caretaker_name']) ? trim((string)$data['assigned_caretaker_name']) : '';
        $notes = isset($data['follow_up_notes']) ? trim((string)$data['follow_up_notes']) : '';

        if ($alertId <= 0 || empty($caretaker)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Alert ID and Caretaker name are required.']);
            exit;
        }

        $stmt = $conn->prepare('
            UPDATE alerts 
            SET assigned_caretaker_name = :caretaker, follow_up_notes = :notes, status = "In Progress" 
            WHERE id = :id
        ');
        $stmt->execute([':caretaker' => $caretaker, ':notes' => $notes, ':id' => $alertId]);

        echo json_encode(['success' => true, 'message' => "Follow-up assigned to {$caretaker}."]);
        exit;
    }

    // Action 3: Delete Alert
    if ($action === 'delete_alert') {
        $alertId = isset($data['alert_id']) ? (int)$data['alert_id'] : 0;
        if ($alertId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid alert ID.']);
            exit;
        }

        $stmt = $conn->prepare('DELETE FROM alerts WHERE id = :id');
        $stmt->execute([':id' => $alertId]);

        echo json_encode(['success' => true, 'message' => 'Alert deleted successfully.']);
        exit;
    }
}

// GET Handler: Fetch alerts + summary statistics
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $conn->query('SELECT * FROM alerts ORDER BY id DESC');
    $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate Summary Metrics
    $criticalCount = 0;
    $warningCount = 0; // High + Medium
    $resolvedCount = 0;
    $pendingCount = 0;

    foreach ($alerts as &$a) {
        $sev = strtolower($a['severity'] ?? 'medium');
        $stat = strtolower($a['status'] ?? 'pending');

        if ($sev === 'critical') {
            $criticalCount++;
        } else if ($sev === 'high' || $sev === 'medium') {
            $warningCount++;
        }

        if ($stat === 'resolved') {
            $resolvedCount++;
        } else if ($stat === 'pending') {
            $pendingCount++;
        }

        // Format timestamp
        if (!empty($a['created_at'])) {
            $a['formatted_date'] = date('M d, Y h:i A', strtotime($a['created_at']));
            $a['time_ago'] = date('h:i A', strtotime($a['created_at']));
        } else {
            $a['formatted_date'] = 'Today 8:20 AM';
            $a['time_ago'] = '8:20 AM';
        }
    }

    // Fetch list of caretakers and ponds for filters
    $caretakersStmt = $conn->query("SELECT DISTINCT full_name FROM users WHERE role = 'caretaker' ORDER BY full_name ASC");
    $caretakers = $caretakersStmt->fetchAll(PDO::FETCH_COLUMN);

    $pondsStmt = $conn->query("SELECT id, pond_name FROM ponds ORDER BY pond_name ASC");
    $ponds = $pondsStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'alerts' => $alerts,
        'caretakers' => $caretakers,
        'ponds' => $ponds,
        'summary' => [
            'critical_alerts' => $criticalCount,
            'warnings' => $warningCount,
            'resolved' => $resolvedCount,
            'pending' => $pendingCount
        ]
    ]);
    exit;
}
