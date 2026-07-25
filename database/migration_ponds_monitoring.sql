-- Migration for Pond Monitoring Enhancements
USE shrim_predict_db;

-- 1. Add missing columns to ponds table if they don't exist
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS area_sqm INT DEFAULT 500;
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS stocking_date DATE DEFAULT '2026-04-02';
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS growth_percentage DECIMAL(5,2) DEFAULT 85.00;
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS disease_detection VARCHAR(150) DEFAULT 'Healthy';
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS disease_confidence DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS harvest_readiness DECIMAL(5,2) DEFAULT 85.00;
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS expected_harvest_date DATE DEFAULT '2026-08-10';
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS feed_today_kg DECIMAL(10,2) DEFAULT 12.00;
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS total_feed_kg DECIMAL(10,2) DEFAULT 450.00;
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS latest_image VARCHAR(255) DEFAULT 'uploads/sample.jpg';
ALTER TABLE ponds ADD COLUMN IF NOT EXISTS assigned_caretaker_name VARCHAR(100) DEFAULT 'Juan Dela Cruz';

-- 2. Clear out old sample ponds and insert exact 7 Ponds matching thesis scenario (5 Healthy, 1 Warning, 1 Critical)
DELETE FROM ponds WHERE id > 0;

INSERT INTO ponds (
  id, pond_name, location, temperature, ph_level, salinity, dissolved_oxygen, water_level, status,
  area_sqm, stocking_date, growth_percentage, disease_detection, disease_confidence, harvest_readiness,
  expected_harvest_date, feed_today_kg, total_feed_kg, latest_image, assigned_caretaker_name
) VALUES
(1, 'Pond 1', 'Northern Bay - Section 1', 29.5, 7.8, 18.0, 6.8, 1.2, 'Healthy', 500, '2026-04-10', 88.00, 'Healthy', 0.00, 85.00, '2026-08-12', 12.00, 450.00, 'uploads/sample1.jpg', 'Juan Dela Cruz'),
(2, 'Pond 2', 'Northern Bay - Section 2', 28.8, 7.6, 17.5, 6.5, 1.1, 'Healthy', 500, '2026-04-15', 90.00, 'Healthy', 0.00, 88.00, '2026-08-15', 10.50, 390.00, 'uploads/sample2.jpg', 'Maria Santos'),
(3, 'Pond 3', 'Western Basin - Section 1', 33.2, 7.1, 24.0, 4.8, 0.8, 'Critical', 500, '2026-04-02', 92.00, 'Possible White Spot Disease', 95.00, 92.00, '2026-08-03', 11.00, 420.00, 'uploads/sample3.jpg', 'Juan Dela Cruz'),
(4, 'Pond 4', 'Eastern Lagoon - Section 1', 31.0, 7.4, 22.5, 5.4, 1.0, 'Warning', 500, '2026-03-28', 95.00, 'Suspected Black Gill', 74.00, 95.00, '2026-07-28', 14.00, 510.00, 'uploads/sample4.jpg', 'Maria Santos'),
(5, 'Pond 5', 'Northern Bay - Section 3', 30.0, 7.9, 18.5, 6.9, 1.3, 'Healthy', 500, '2026-03-20', 100.00, 'Healthy', 0.00, 100.00, '2026-07-25', 15.00, 600.00, 'uploads/sample5.jpg', 'Juan Dela Cruz'),
(6, 'Pond 6', 'Eastern Lagoon - Section 2', 29.0, 7.7, 18.2, 6.6, 1.2, 'Healthy', 500, '2026-04-20', 78.00, 'Healthy', 0.00, 72.00, '2026-08-25', 9.00, 320.00, 'uploads/sample6.jpg', 'Maria Santos'),
(7, 'Pond 7', 'Western Basin - Section 2', 29.2, 7.8, 18.0, 6.7, 1.2, 'Healthy', 500, '2026-04-12', 82.00, 'Healthy', 0.00, 79.00, '2026-08-18', 11.00, 380.00, 'uploads/sample7.jpg', 'Juan Dela Cruz');
