<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/database.php';

$database = new Database();
$db = $database->getConnection();

if (!$db) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database connection failed."]);
    exit();
}

// Ensure table contact_messages exists
try {
    $createTableQuery = "CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('unread', 'read', 'replied') DEFAULT 'unread',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $db->exec($createTableQuery);
} catch (PDOException $e) {
    // Table creation log silent failover
}

// Get POST data
$inputData = json_decode(file_get_contents("php://input"), true);

$name = trim($inputData['name'] ?? $_POST['name'] ?? '');
$email = trim($inputData['email'] ?? $_POST['email'] ?? '');
$subject = trim($inputData['subject'] ?? $_POST['subject'] ?? '');
$message = trim($inputData['message'] ?? $_POST['message'] ?? '');

if (empty($name) || empty($email) || empty($subject) || empty($message)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "All fields (Name, Email, Subject, Message) are required."
    ]);
    exit();
}

try {
    // Insert into contact_messages
    $stmt = $db->prepare("INSERT INTO contact_messages (name, email, subject, message, status) VALUES (:name, :email, :subject, :message, 'unread')");
    $stmt->bindParam(":name", $name);
    $stmt->bindParam(":email", $email);
    $stmt->bindParam(":subject", $subject);
    $stmt->bindParam(":message", $message);
    $stmt->execute();

    $insertedId = $db->lastInsertId();

    // Insert admin notification if notifications table exists
    try {
        $notifStmt = $db->prepare("INSERT INTO notifications (title, message, type, is_read) VALUES (:title, :notif_message, 'info', 0)");
        $notifTitle = "New Inquiry: " . substr($subject, 0, 40);
        $notifBody = "From " . $name . " (" . $email . "): " . substr($message, 0, 100);
        $notifStmt->bindParam(":title", $notifTitle);
        $notifStmt->bindParam(":notif_message", $notifBody);
        $notifStmt->execute();
    } catch (Exception $ex) {
        // Notification table insert fallback
    }

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "message" => "Thank you! Your message has been saved successfully.",
        "data" => [
            "id" => $insertedId,
            "name" => $name,
            "email" => $email,
            "subject" => $subject,
            "created_at" => date("Y-m-d H:i:s")
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
