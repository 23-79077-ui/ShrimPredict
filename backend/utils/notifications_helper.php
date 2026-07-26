<?php
require_once __DIR__ . '/../config/database.php';

function ensureNotificationsSchema($conn) {
    if (!$conn) return;
    try {
        $conn->exec(
            "CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                title VARCHAR(255) NOT NULL DEFAULT 'Notification',
                message TEXT NOT NULL,
                caretaker_name VARCHAR(150) DEFAULT NULL,
                action_type VARCHAR(50) DEFAULT 'general',
                pond_name VARCHAR(100) DEFAULT NULL,
                is_read TINYINT(1) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_notification_user (user_id),
                INDEX idx_notification_status (status),
                INDEX idx_notification_read (is_read),
                INDEX idx_notification_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $columnsStmt = $conn->query('SHOW COLUMNS FROM notifications');
        $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);

        $migrations = [
            ['user_id', "ALTER TABLE notifications MODIFY COLUMN user_id INT DEFAULT NULL"],
            ['title', "ALTER TABLE notifications ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'Notification' AFTER user_id"],
            ['caretaker_name', "ALTER TABLE notifications ADD COLUMN caretaker_name VARCHAR(150) DEFAULT NULL AFTER message"],
            ['action_type', "ALTER TABLE notifications ADD COLUMN action_type VARCHAR(50) DEFAULT 'general' AFTER caretaker_name"],
            ['pond_name', "ALTER TABLE notifications ADD COLUMN pond_name VARCHAR(100) DEFAULT NULL AFTER action_type"],
            ['target_id', "ALTER TABLE notifications ADD COLUMN target_id INT DEFAULT NULL AFTER pond_name"],
            ['status', "ALTER TABLE notifications ADD COLUMN status VARCHAR(20) DEFAULT 'active' AFTER is_read"],
        ];

        foreach ($migrations as [$column, $sql]) {
            if ($column === 'user_id') {
                try { $conn->exec($sql); } catch (Throwable $e) {}
            } else if (!in_array($column, $columns, true)) {
                try { $conn->exec($sql); } catch (Throwable $e) {}
            }
        }
    } catch (Throwable $e) {}
}

function createNotification($conn, $title, $message, $caretakerName = 'Caretaker', $actionType = 'general', $pondName = '', $userId = null, $targetId = null) {
    if (!$conn) return false;
    ensureNotificationsSchema($conn);
    try {
        $stmt = $conn->prepare(
            "INSERT INTO notifications (user_id, title, message, caretaker_name, action_type, pond_name, target_id, is_read, status, created_at)
             VALUES (:user_id, :title, :message, :caretaker_name, :action_type, :pond_name, :target_id, 0, 'active', NOW())"
        );
        return $stmt->execute([
            ':user_id' => $userId,
            ':title' => $title,
            ':message' => $message,
            ':caretaker_name' => $caretakerName,
            ':action_type' => $actionType,
            ':pond_name' => $pondName,
            ':target_id' => $targetId,
        ]);
    } catch (Throwable $e) {
        error_log("Failed to insert notification: " . $e->getMessage());
        return false;
    }
}
