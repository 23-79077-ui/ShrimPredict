<?php
require_once __DIR__ . '/config/database.php';

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    echo "Database connection failed.\n";
    exit(1);
}

$email = 'admin@shrimpredict.com';
$password = 'admin123';
$fullName = 'Administrator';
$role = 'admin';
$status = 'Active';

$passwordHash = password_hash($password, PASSWORD_BCRYPT);

// 1. Ensure users table exists
$conn->exec("
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'caretaker',
        status VARCHAR(20) DEFAULT 'Active',
        phone VARCHAR(20) DEFAULT '09123456789',
        pond_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// 2. Check if admin user already exists
$stmt = $conn->prepare("SELECT id FROM users WHERE email = :email");
$stmt->execute([':email' => $email]);
$existingUser = $stmt->fetch(PDO::FETCH_ASSOC);

if ($existingUser) {
    // Update existing user
    $updateStmt = $conn->prepare("
        UPDATE users 
        SET full_name = :full_name, 
            password_hash = :password_hash, 
            role = :role, 
            status = :status 
        WHERE email = :email
    ");
    $updateStmt->execute([
        ':full_name' => $fullName,
        ':password_hash' => $passwordHash,
        ':role' => $role,
        ':status' => $status,
        ':email' => $email
    ]);
    echo "Successfully updated Admin Account ({$email}) in XAMPP MySQL database!\n";
} else {
    // Insert new admin user
    $insertStmt = $conn->prepare("
        INSERT INTO users (full_name, email, password_hash, role, status) 
        VALUES (:full_name, :email, :password_hash, :role, :status)
    ");
    $insertStmt->execute([
        ':full_name' => $fullName,
        ':email' => $email,
        ':password_hash' => $passwordHash,
        ':role' => $role,
        ':status' => $status
    ]);
    echo "Successfully created fresh Admin Account ({$email}) in XAMPP MySQL database!\n";
}
