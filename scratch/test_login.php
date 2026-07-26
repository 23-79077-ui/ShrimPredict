<?php
require_once __DIR__ . '/../backend/config/database.php';

$database = new Database();
$conn = $database->getConnection();

$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->execute(['admin@shrimpredict.com']);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user) {
    $verify = password_verify('admin123', $user['password_hash']);
    echo "User Found! ID: {$user['id']}, Role: {$user['role']}, Password Valid: " . ($verify ? "YES (True)" : "NO (False)") . "\n";
} else {
    echo "User NOT found.\n";
}
