<?php
require_once __DIR__ . '/../config/database.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$database = new Database();
$conn = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create a new caretaker user
    $data = json_decode(file_get_contents('php://input'), true);

    $fullName = isset($data['full_name']) ? trim((string)$data['full_name']) : '';
    $email = isset($data['email']) ? trim((string)$data['email']) : '';
    $password = isset($data['password']) ? (string)$data['password'] : '';
    $pondId = isset($data['pond_id']) ? (int)$data['pond_id'] : null;

    if (empty($fullName) || empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Full name, email, and password are required.']);
        exit;
    }

    // Check if email already exists
    $check = $conn->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute([':email' => $email]);
    if ($check->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Email already exists.']);
        exit;
    }

    // Hash password and insert
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $insert = $conn->prepare(
        'INSERT INTO users (full_name, email, password_hash, role, status, pond_id) 
         VALUES (:full_name, :email, :password_hash, :role, :status, :pond_id)'
    );
    $insert->execute([
        ':full_name' => $fullName,
        ':email' => $email,
        ':password_hash' => $passwordHash,
        ':role' => 'caretaker',
        ':status' => 'Active',
        ':pond_id' => $pondId,
    ]);

    $newId = $conn->lastInsertId();

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Caretaker created successfully.',
        'user' => [
            'id' => $newId,
            'full_name' => $fullName,
            'email' => $email,
            'role' => 'caretaker',
            'status' => 'Active',
            'pond_id' => $pondId,
        ]
    ]);
    exit;
}

// GET: Return all users + ponds list for dropdown
$users = [];
$stmt = $conn->query('SELECT u.*, p.pond_name FROM users u LEFT JOIN ponds p ON u.pond_id = p.id ORDER BY u.id DESC');
$usersRaw = $stmt->fetchAll(PDO::FETCH_ASSOC);
$users = [];

// Fetch assigned ponds for each user
$pondStmt = $conn->prepare(
    'SELECT p.id, p.pond_name FROM caretaker_ponds cp JOIN ponds p ON cp.pond_id = p.id WHERE cp.user_id = :user_id ORDER BY p.pond_name ASC'
);

foreach ($usersRaw as $user) {
    $pondStmt->execute([':user_id' => $user['id']]);
    $assignedPonds = $pondStmt->fetchAll(PDO::FETCH_ASSOC);
    if (empty($assignedPonds) && !empty($user['pond_id'])) {
        $singlePondStmt = $conn->prepare('SELECT id, pond_name FROM ponds WHERE id = :pond_id');
        $singlePondStmt->execute([':pond_id' => $user['pond_id']]);
        $sp = $singlePondStmt->fetch(PDO::FETCH_ASSOC);
        if ($sp) {
            $assignedPonds = [$sp];
        }
    }
    $user['assigned_ponds'] = $assignedPonds;
    $user['assigned_pond_ids'] = array_map(function($p) { return (int)$p['id']; }, $user['assigned_ponds']);
    $users[] = $user;
}

$ponds = [];
$pondStmt2 = $conn->query('
    SELECT p.id, p.pond_name, 
           COALESCE(cp.user_id, u_legacy.id) AS assigned_user_id, 
           COALESCE(u_cp.full_name, u_legacy.full_name) AS assigned_user_name
    FROM ponds p
    LEFT JOIN caretaker_ponds cp ON p.id = cp.pond_id
    LEFT JOIN users u_cp ON cp.user_id = u_cp.id
    LEFT JOIN users u_legacy ON p.id = u_legacy.pond_id
    GROUP BY p.id
    ORDER BY p.pond_name ASC
');
$ponds = $pondStmt2->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'users' => $users,
    'ponds' => $ponds,
]);

