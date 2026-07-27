<?php
require_once __DIR__ . '/config/database.php';
$database = new Database();
$conn = $database->getConnection();

// Find an archived user or any user in DB
$stmt = $conn->query("SELECT id, full_name, role, status FROM users WHERE LOWER(role) = 'caretaker' ORDER BY id DESC LIMIT 5");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Caretaker users in DB:\n";
print_r($users);

if (!empty($users)) {
    $testId = $users[0]['id'];
    echo "\nTesting details API for user_id = {$testId}...\n";
    $_GET['action'] = 'details';
    $_GET['user_id'] = $testId;
    $_SERVER['REQUEST_METHOD'] = 'GET';
    
    try {
        include __DIR__ . '/api/archived_caretakers.php';
    } catch (Throwable $e) {
        echo "\nCATCH ERROR: " . $e->getMessage() . "\n";
        echo $e->getTraceAsString() . "\n";
    }
}
