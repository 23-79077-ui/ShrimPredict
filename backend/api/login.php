<?php
require_once __DIR__ . '/../config/database.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$data = json_decode(file_get_contents('php://input'), true);
$email = isset($data['email']) ? trim((string)$data['email']) : '';
$password = isset($data['password']) ? (string)$data['password'] : '';

$database = new Database();

$conn = $database->getConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed',
    ]);
    exit;
}

$stmt = $conn->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
$stmt->bindParam(':email', $email);
$stmt->execute();
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
    exit;
}

$storedHash = $user['password_hash'] ?? '';
$isBcryptHash = is_string($storedHash) && preg_match('/^\$2y\$|^\$2b\$|^\$2a\$/', $storedHash);
$brokenDemoHash = '$2y$10$M5K8GtBBHdtnI1mQ9JkQ5.0yYvFzu1a3X0u6Q9ipUq4S6HxMQQbb2';

$sendLoginSuccess = function (array $user) use ($conn): void {
    // Fetch assigned ponds for caretaker
    $assignedPonds = [];
    if ($user['role'] === 'caretaker') {
        $pondStmt = $conn->prepare(
            'SELECT p.id, p.pond_name, p.status, p.temperature, p.ph_level, p.salinity, p.dissolved_oxygen, p.water_level
             FROM caretaker_ponds cp
             JOIN ponds p ON cp.pond_id = p.id
             WHERE cp.user_id = :user_id
             ORDER BY p.pond_name ASC'
        );
        $pondStmt->execute([':user_id' => $user['id']]);
        $assignedPonds = $pondStmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($assignedPonds) && !empty($user['pond_id'])) {
            $pondStmt = $conn->prepare(
                'SELECT p.id, p.pond_name, p.status, p.temperature, p.ph_level, p.salinity, p.dissolved_oxygen, p.water_level
                 FROM ponds p
                 WHERE p.id = :pond_id'
            );
            $pondStmt->execute([':pond_id' => (int)$user['pond_id']]);
            $assignedPonds = $pondStmt->fetchAll(PDO::FETCH_ASSOC);
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => $user['id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'status' => $user['status'],
            'assigned_ponds' => $assignedPonds,
        ]
    ]);
};

if ($isBcryptHash && password_verify($password, $storedHash)) {
    $sendLoginSuccess($user);
    exit;
}

// Repair the original demo seed hash, which did not match the documented password.
if ($storedHash === $brokenDemoHash && $password === 'admin123') {
    $newHash = password_hash($password, PASSWORD_BCRYPT);
    $update = $conn->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id');
    $update->execute([
        ':password_hash' => $newHash,
        ':id' => $user['id'],
    ]);

    $sendLoginSuccess($user);
    exit;
}

// Legacy fallback: some old DBs might store plaintext in password_hash.
if (is_string($storedHash) && hash_equals($storedHash, $password)) {
    $sendLoginSuccess($user);
    exit;
}

http_response_code(401);
echo json_encode(['success' => false, 'message' => 'Invalid email or password']);


