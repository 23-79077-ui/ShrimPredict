<?php
require_once __DIR__ . '/../config/database.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$database = new Database();
$conn = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // GET /caretaker_ponds.php?user_id=X - get assigned ponds for a caretaker
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

    if ($userId > 0) {
        $stmt = $conn->prepare(
            'SELECT p.id, p.pond_name, p.status, p.temperature, p.ph_level, p.salinity, p.dissolved_oxygen, p.water_level
             FROM caretaker_ponds cp
             JOIN ponds p ON cp.pond_id = p.id
             WHERE cp.user_id = :user_id
             ORDER BY p.pond_name ASC'
        );
        $stmt->execute([':user_id' => $userId]);
        $ponds = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'ponds' => $ponds,
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'user_id is required']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // POST /caretaker_ponds.php - assign ponds to a caretaker (max 3)
    $data = json_decode(file_get_contents('php://input'), true);

    $userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;
    $pondIds = isset($data['pond_ids']) ? $data['pond_ids'] : [];

    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'user_id is required']);
        exit;
    }

    if (!is_array($pondIds)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'pond_ids must be an array']);
        exit;
    }

    if (count($pondIds) > 3) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Maximum of 3 ponds allowed per caretaker']);
        exit;
    }

    // Validate that the user exists and is a caretaker
    $userCheck = $conn->prepare('SELECT id, role FROM users WHERE id = :id');
    $userCheck->execute([':id' => $userId]);
    $user = $userCheck->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }

    if ($user['role'] !== 'caretaker') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'User is not a caretaker']);
        exit;
    }

    // Validate pond IDs exist
    if (!empty($pondIds)) {
        $placeholders = implode(',', array_fill(0, count($pondIds), '?'));
        $pondCheck = $conn->prepare("SELECT id FROM ponds WHERE id IN ($placeholders)");
        $pondCheck->execute(array_map('intval', $pondIds));
        $existingPonds = $pondCheck->fetchAll(PDO::FETCH_COLUMN);

        if (count($existingPonds) !== count($pondIds)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'One or more pond IDs are invalid']);
            exit;
        }
    }

    // Begin transaction
    $conn->beginTransaction();

    try {
        // Delete existing assignments
        $delete = $conn->prepare('DELETE FROM caretaker_ponds WHERE user_id = :user_id');
        $delete->execute([':user_id' => $userId]);

        // Insert new assignments
        if (!empty($pondIds)) {
            $insert = $conn->prepare('INSERT INTO caretaker_ponds (user_id, pond_id) VALUES (:user_id, :pond_id)');
            foreach ($pondIds as $pondId) {
                $insert->execute([':user_id' => $userId, ':pond_id' => (int)$pondId]);
            }
        }

        $conn->commit();

        // Fetch the updated pond names
        $pondNames = [];
        if (!empty($pondIds)) {
            $placeholders = implode(',', array_fill(0, count($pondIds), '?'));
            $nameStmt = $conn->prepare("SELECT pond_name FROM ponds WHERE id IN ($placeholders) ORDER BY pond_name ASC");
            $nameStmt->execute(array_map('intval', $pondIds));
            $pondNames = $nameStmt->fetchAll(PDO::FETCH_COLUMN);
            // Update pond_id field in users table to first pond for backward compatibility
            $updatePond = $conn->prepare('UPDATE users SET pond_id = :pond_id WHERE id = :user_id');
            $updatePond->execute([':pond_id' => (int)$pondIds[0], ':user_id' => $userId]);
        } else {
            $updatePond = $conn->prepare('UPDATE users SET pond_id = NULL WHERE id = :user_id');
            $updatePond->execute([':user_id' => $userId]);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Ponds assigned successfully',
            'ponds' => $pondNames,
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);

