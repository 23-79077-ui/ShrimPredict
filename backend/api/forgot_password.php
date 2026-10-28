<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/notifications_helper.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Auto-migrate schema for password history tracking
function ensurePasswordHistorySchema(PDO $conn): void {
    try {
        $cols = $conn->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_ASSOC);
        $names = array_column($cols, 'Field');
        if (!in_array('previous_password_hash', $names, true)) {
            $conn->exec("ALTER TABLE users ADD COLUMN previous_password_hash VARCHAR(255) DEFAULT NULL AFTER password_hash");
        }
        if (!in_array('password_changed_at', $names, true)) {
            $conn->exec("ALTER TABLE users ADD COLUMN password_changed_at DATETIME DEFAULT NULL AFTER previous_password_hash");
        }
        if (!in_array('password_history_json', $names, true)) {
            $conn->exec("ALTER TABLE users ADD COLUMN password_history_json TEXT DEFAULT NULL AFTER password_changed_at");
        }
    } catch (Throwable $e) {
        error_log("Failed to ensure password history schema: " . $e->getMessage());
    }
}

ensurePasswordHistorySchema($conn);

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$action = isset($data['action']) ? trim((string)$data['action']) : 'verify_email';
$rawEmail = isset($data['email']) ? trim((string)$data['email']) : '';

// Helper to look up user with demo email alias support
function findUserByEmail(PDO $conn, string $email): ?array {
    $clean = strtolower(trim($email));
    if (empty($clean)) return null;

    $stmt = $conn->prepare('SELECT * FROM users WHERE LOWER(email) = :email LIMIT 1');
    $stmt->execute([':email' => $clean]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user && $clean === 'caretaker@shrimpredict.com') {
        $stmt = $conn->prepare("SELECT * FROM users WHERE LOWER(email) = 'cj@gmail.com' LIMIT 1");
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    return $user ?: null;
}

// ==========================================
// 1. ACTION: VERIFY EMAIL (STEP 1)
// ==========================================
if ($action === 'verify_email') {
    if (empty($rawEmail)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Please enter an email address.']);
        exit;
    }

    if (!filter_var($rawEmail, FILTER_VALIDATE_EMAIL) && strtolower($rawEmail) !== 'caretaker@shrimpredict.com') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Please provide a valid email format.']);
        exit;
    }

    $user = findUserByEmail($conn, $rawEmail);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'No account found with this email address. Please verify your email and try again.'
        ]);
        exit;
    }

    if (isset($user['status']) && strtolower($user['status']) === 'archived') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'This account has been archived. Please contact farm management for assistance.'
        ]);
        exit;
    }

    $lastChangedFormatted = null;
    if (!empty($user['password_changed_at'])) {
        $lastChangedFormatted = date('M j, Y \a\t g:i A', strtotime($user['password_changed_at']));
    }

    echo json_encode([
        'success' => true,
        'message' => 'Account identified successfully.',
        'user' => [
            'id' => (int)$user['id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'position' => $user['position'] ?? ($user['role'] === 'admin' ? 'Farm Administrator' : 'Pond Caretaker'),
            'password_changed_at' => $user['password_changed_at'] ?? null,
            'last_changed_formatted' => $lastChangedFormatted,
        ]
    ]);
    exit;
}

// ==========================================
// 2. ACTION: RESET PASSWORD (STEP 2)
// ==========================================
if ($action === 'reset_password') {
    $newPassword = isset($data['new_password']) ? (string)$data['new_password'] : '';
    $confirmPassword = isset($data['confirm_password']) ? (string)$data['confirm_password'] : '';

    if (empty($rawEmail)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Email address is required.']);
        exit;
    }

    if (empty($newPassword) || empty($confirmPassword)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'New password and confirmation are required.']);
        exit;
    }

    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters long.']);
        exit;
    }

    if ($newPassword !== $confirmPassword) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Passwords do not match. Please re-enter both fields.']);
        exit;
    }

    $user = findUserByEmail($conn, $rawEmail);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User account not found.']);
        exit;
    }

    $currentHash = $user['password_hash'] ?? '';
    $isBcryptHash = is_string($currentHash) && preg_match('/^\$2y\$|^\$2b\$|^\$2a\$/', $currentHash);

    // SAFETY NET 1: Prevent setting the exact same password as the current active password
    $isSameAsCurrent = false;
    if ($isBcryptHash && password_verify($newPassword, $currentHash)) {
        $isSameAsCurrent = true;
    } elseif ($currentHash === $newPassword) {
        $isSameAsCurrent = true;
    } elseif ($currentHash === '$2y$10$M5K8GtBBHdtnI1mQ9JkQ5.0yYvFzu1a3X0u6Q9ipUq4S6HxMQQbb2' && $newPassword === 'admin123') {
        $isSameAsCurrent = true;
    }

    if ($isSameAsCurrent) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error_type' => 'SAME_AS_CURRENT',
            'message' => 'Your new password cannot be the same as your current password. Please choose a different password.'
        ]);
        exit;
    }

    // SAFETY NET 2: Check if new password matches previous password
    $isSameAsPrevious = false;
    $prevHash = $user['previous_password_hash'] ?? '';
    if (!empty($prevHash) && password_verify($newPassword, $prevHash)) {
        $isSameAsPrevious = true;
    }

    // Also check password history list if present
    if (!$isSameAsPrevious && !empty($user['password_history_json'])) {
        $history = json_decode($user['password_history_json'], true) ?: [];
        foreach ($history as $h) {
            if (!empty($h['hash']) && password_verify($newPassword, $h['hash'])) {
                $isSameAsPrevious = true;
                break;
            }
        }
    }

    if ($isSameAsPrevious) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error_type' => 'SAME_AS_PREVIOUS',
            'message' => 'You recently used this password. For your account security, please choose a new, unique password.'
        ]);
        exit;
    }

    // Build updated password history
    $historyList = [];
    if (!empty($user['password_history_json'])) {
        $historyList = json_decode($user['password_history_json'], true) ?: [];
    }
    if (!empty($currentHash)) {
        $historyList[] = [
            'hash' => $currentHash,
            'changed_at' => date('Y-m-d H:i:s')
        ];
        // Keep maximum of 5 recent passwords
        if (count($historyList) > 5) {
            $historyList = array_slice($historyList, -5);
        }
    }

    $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
    $historyJson = json_encode($historyList);

    $updateStmt = $conn->prepare("
        UPDATE users 
        SET password_hash = :new_hash,
            previous_password_hash = :prev_hash,
            password_changed_at = NOW(),
            password_history_json = :history_json
        WHERE id = :id
    ");

    $updateStmt->execute([
        ':new_hash' => $newHash,
        ':prev_hash' => $currentHash,
        ':history_json' => $historyJson,
        ':id' => $user['id'],
    ]);

    // Send internal security audit notification
    createNotification(
        $conn,
        'Security Alert: Password Changed',
        'Password was updated via Forgot Password verification.',
        $user['full_name'] ?? 'Account User',
        'security',
        '',
        $user['id']
    );

    $formattedNow = date('F j, Y \a\t g:i A');

    echo json_encode([
        'success' => true,
        'message' => 'Password reset successfully! You can now sign in with your new password.',
        'user' => [
            'id' => (int)$user['id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'changed_at' => $formattedNow,
        ]
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Invalid action request.']);
