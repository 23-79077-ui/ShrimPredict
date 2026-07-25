CREATE DATABASE IF NOT EXISTS shrim_predict_db;
USE shrim_predict_db;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_email (email)
);

CREATE TABLE pond_caretakers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  assigned_pond_id INT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_caretaker_email (email)
);

CREATE TABLE ponds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pond_name VARCHAR(100) NOT NULL,
  location VARCHAR(150) NOT NULL,
  temperature DECIMAL(5,2) DEFAULT 0,
  ph_level DECIMAL(5,2) DEFAULT 0,
  salinity DECIMAL(5,2) DEFAULT 0,
  dissolved_oxygen DECIMAL(5,2) DEFAULT 0,
  water_level DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Healthy',
  area_sqm INT DEFAULT 500,
  stocking_date DATE DEFAULT '2026-04-02',
  growth_percentage DECIMAL(5,2) DEFAULT 85.00,
  disease_detection VARCHAR(150) DEFAULT 'Healthy',
  disease_confidence DECIMAL(5,2) DEFAULT 0.00,
  harvest_readiness DECIMAL(5,2) DEFAULT 85.00,
  expected_harvest_date DATE DEFAULT '2026-08-10',
  feed_today_kg DECIMAL(10,2) DEFAULT 12.00,
  total_feed_kg DECIMAL(10,2) DEFAULT 450.00,
  latest_image VARCHAR(255) DEFAULT 'uploads/sample.jpg',
  assigned_caretaker_name VARCHAR(100) DEFAULT 'Juan Dela Cruz',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pond_status (status)
);

CREATE TABLE feeding_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  amount_kg DECIMAL(10,2) NOT NULL,
  feed_type VARCHAR(100) NOT NULL,
  feeding_time VARCHAR(20) DEFAULT NULL,
  product_code VARCHAR(20) DEFAULT NULL,
  has_vitamin TINYINT(1) DEFAULT 0,
  vitamin_name VARCHAR(100) DEFAULT NULL,
  record_date DATE NOT NULL,
  notes TEXT,
  recorded_by_name VARCHAR(100) DEFAULT NULL,
  user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_feeding_date (record_date)
);

CREATE TABLE disease_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  caretaker_name VARCHAR(150) DEFAULT NULL,
  pond_name VARCHAR(150) DEFAULT NULL,
  disease_name VARCHAR(100) NOT NULL,
  confidence_score DECIMAL(5,2) DEFAULT 0,
  risk_level VARCHAR(20) DEFAULT 'Low',
  recommendation TEXT,
  status VARCHAR(20) DEFAULT 'Pending',
  image_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_disease_risk (risk_level),
  INDEX idx_disease_user (user_id)
);

CREATE TABLE harvest_predictions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  estimated_harvest DECIMAL(10,2) NOT NULL,
  average_weight DECIMAL(10,2) NOT NULL,
  biomass DECIMAL(10,2) NOT NULL,
  survival_rate DECIMAL(5,2) NOT NULL,
  recommendation TEXT,
  prediction_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE,
  INDEX idx_harvest_date (prediction_date)
);

CREATE TABLE alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'Medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alert_severity (severity)
);

CREATE TABLE notifications (
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
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'caretaker',
  status VARCHAR(20) DEFAULT 'Active',
  phone VARCHAR(30) DEFAULT '09123456789',
  position VARCHAR(100) DEFAULT 'System Administrator',
  avatar_path VARCHAR(255) DEFAULT NULL,
  two_factor_enabled TINYINT(1) DEFAULT 0,
  last_login TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  pond_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE SET NULL,
  INDEX idx_user_role (role)
);

CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE caretaker_ponds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  pond_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_pond (user_id, pond_id),
  INDEX idx_caretaker_ponds_user (user_id)
);

CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(150) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_user (user_id)
);

INSERT INTO roles (role_name, description) VALUES
('admin', 'Administrator role'),
('caretaker', 'Pond caretaker role');

INSERT INTO admins (full_name, email, password_hash, phone, status) VALUES
('System Admin', 'admin@shrimpredict.com', '$2y$10$eHnwobsFGe1hdLaqndWzFe.ZRY59SOmiF/oaLP/ENn/X2UNG1XOsa', '09123456789', 'Active');

INSERT INTO ponds (pond_name, location, temperature, ph_level, salinity, dissolved_oxygen, water_level, status) VALUES
('Pond A1', 'Northern Bay - Section 1', 29.5, 7.8, 18.0, 6.8, 1.2, 'Healthy'),
('Pond A2', 'Northern Bay - Section 2', 28.8, 7.6, 17.5, 6.5, 1.1, 'Healthy'),
('Pond A3', 'Northern Bay - Section 3', 30.0, 7.9, 18.5, 6.9, 1.3, 'Healthy'),
('Pond B1', 'Eastern Lagoon - Section 1', 31.0, 7.4, 22.5, 5.4, 1.0, 'Warning'),
('Pond B2', 'Eastern Lagoon - Section 2', 30.5, 7.3, 21.0, 5.6, 0.9, 'Warning'),
('Pond B3', 'Eastern Lagoon - Section 3', 31.5, 7.5, 23.0, 5.2, 1.1, 'Warning'),
('Pond C1', 'Western Basin - Section 1', 33.2, 7.1, 24.0, 4.8, 0.8, 'Critical'),
('Pond C2', 'Western Basin - Section 2', 32.8, 7.0, 23.5, 4.5, 0.7, 'Critical'),
('Pond C3', 'Western Basin - Section 3', 33.5, 7.2, 24.5, 4.6, 0.9, 'Critical');

INSERT INTO feeding_records (pond_id, amount_kg, feed_type, record_date, notes) VALUES
(1, 12.5, 'Starter Feed', '2026-07-16', 'Morning feeding completed'),
(2, 11.0, 'Grower Feed', '2026-07-16', 'Adjusted due to temperature'),
(3, 9.5, 'Grower Feed', '2026-07-16', 'Critical water condition');

INSERT INTO disease_reports (user_id, caretaker_name, pond_name, disease_name, confidence_score, risk_level, recommendation, status, image_path) VALUES
(1, 'Maria Santos', 'Pond A1', 'White Spot Syndrome', 93.00, 'High', 'Increase water quality checks and isolate affected pond.', 'Pending', 'uploads/sample.jpg'),
(1, 'Maria Santos', 'Pond A1', 'Black Gill Disease', 74.00, 'Medium', 'Adjust salinity and monitor shrimp behavior.', 'Reviewed', 'uploads/sample2.jpg');

INSERT INTO harvest_predictions (pond_id, estimated_harvest, average_weight, biomass, survival_rate, recommendation, prediction_date) VALUES
(1, 420.50, 32.0, 1800.0, 88.0, 'Maintain current feeding and water quality.', '2026-09-10'),
(2, 360.20, 29.0, 1500.0, 81.0, 'Monitor closely for stress signs.', '2026-09-15');

INSERT INTO alerts (title, message, severity) VALUES
('Water Quality Warning', 'Pond B salinity has exceeded safe thresholds.', 'High'),
('Disease Risk', 'Possible disease symptoms detected in Pond C.', 'Critical');

INSERT INTO notifications (user_id, title, message, caretaker_name, action_type, pond_name, is_read, status, created_at) VALUES
(NULL, 'Feeding Record Logged', 'Maria Santos logged 12.50kg of Starter feed for Pond A1 at 6:00 AM.', 'Maria Santos', 'feeding', 'Pond A1', 0, 'active', NOW()),
(NULL, 'Disease Scan Submitted', 'Maria Santos scanned for disease: White Spot Syndrome with 93.00% confidence (High Risk).', 'Maria Santos', 'disease_scan', 'Pond C1', 0, 'active', NOW()),
(NULL, 'Pond Conditions Logged', 'Maria Santos updated water quality for Pond B1 (Temp: 31.00°C, pH: 7.40, Salinity: 22.50ppt, Status: Warning).', 'Maria Santos', 'water_quality', 'Pond B1', 1, 'active', NOW());

INSERT INTO users (full_name, email, password_hash, role, status, pond_id) VALUES
('Maria Santos', 'caretaker@shrimpredict.com', '$2y$10$eHnwobsFGe1hdLaqndWzFe.ZRY59SOmiF/oaLP/ENn/X2UNG1XOsa', 'caretaker', 'Active', 1),
('System Admin', 'admin@shrimpredict.com', '$2y$10$eHnwobsFGe1hdLaqndWzFe.ZRY59SOmiF/oaLP/ENn/X2UNG1XOsa', 'admin', 'Active', NULL);

INSERT INTO activity_logs (user_id, action, details) VALUES
(1, 'Logged in', 'Admin logged into the system'),
(2, 'Recorded feeding', 'Feeding record added for Pond A');
