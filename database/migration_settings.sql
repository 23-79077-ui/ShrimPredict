-- Migration for Admin Settings & Profile Enhancements
USE shrim_predict_db;

-- 1. Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Insert default settings
INSERT INTO system_settings (setting_key, setting_value) VALUES
('max_ponds', '30'),
('default_pond_status', 'Healthy'),
('auto_assign_pond_number', 'ON'),
('target_harvest_age', '120'),
('harvest_ready_percentage', '95'),
('prediction_refresh', 'Daily'),
('receive_disease_alerts', 'ON'),
('receive_harvest_alerts', 'ON'),
('receive_feeding_alerts', 'ON'),
('receive_caretaker_activity_alerts', 'ON'),
('receive_email_notifications', 'OFF'),
('theme', 'Light'),
('language', 'English'),
('date_format', 'MM/DD/YYYY'),
('time_format', '12 Hours'),
('last_backup', '2026-07-23 10:00:00'),
('automatic_backup', 'ON'),
('backup_frequency', 'Weekly')
ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value);

-- 3. Add missing profile columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT '09123456789';
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100) DEFAULT 'System Administrator';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Update existing admin user if position or phone is empty
UPDATE users SET position = 'System Administrator', phone = '09123456789' WHERE role = 'admin' AND (position IS NULL OR position = '');
