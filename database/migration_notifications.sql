-- Migration script to update notifications table for Admin Caretaker Notifications System
USE shrim_predict_db;

CREATE TABLE IF NOT EXISTS notifications (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add missing columns if upgrading from legacy schema
ALTER TABLE notifications MODIFY COLUMN user_id INT DEFAULT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Notification' AFTER user_id;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS caretaker_name VARCHAR(150) DEFAULT NULL AFTER message;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_type VARCHAR(50) DEFAULT 'general' AFTER caretaker_name;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS pond_name VARCHAR(100) DEFAULT NULL AFTER action_type;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' AFTER is_read;
