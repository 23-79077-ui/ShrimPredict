-- Migration script for Admin Alerts Action Center in shrim_predict_db

USE shrim_predict_db;

-- 1. Upgrade alerts table schema with Action Center fields
ALTER TABLE alerts 
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Pond Status',
  ADD COLUMN IF NOT EXISTS affected_pond_name VARCHAR(50) DEFAULT 'Pond 1',
  ADD COLUMN IF NOT EXISTS assigned_caretaker_name VARCHAR(100) DEFAULT 'Unassigned',
  ADD COLUMN IF NOT EXISTS confidence_pct INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommended_action TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

-- 2. Clear out old simple alerts and seed rich sample alerts
TRUNCATE TABLE alerts;

INSERT INTO alerts 
  (id, title, message, severity, category, affected_pond_name, assigned_caretaker_name, confidence_pct, recommended_action, status, follow_up_notes, created_at)
VALUES
  (1, 'Disease Detected', 'White Spot Disease Detected in Pond 3 tissue scan.', 'Critical', 'Disease', 'Pond 3', 'Cristel Javier', 96, 'Immediate water treatment, aeration boost & pond quarantine required.', 'Pending', 'Waiting for caretaker water treatment report.', NOW() - INTERVAL 1 HOUR),
  
  (2, 'Harvest Ready', 'Harvest readiness reached 100%. Optimal shrimp size achieved.', 'High', 'Harvest', 'Pond 1', 'Maria Santos', 100, 'Recommended harvest date: July 28. Prepare harvesting equipment and cold storage.', 'Pending', 'Harvest team notified.', NOW() - INTERVAL 3 HOUR),
  
  (3, 'Feeding Log Missing', 'No feeding log submitted today for Pond 4 afternoon schedule.', 'Medium', 'Feeding', 'Pond 4', 'Cristel Javier', 0, 'Notify caretaker Cristel Javier to submit feeding log immediately.', 'Pending', 'Alert notification sent to caretaker mobile app.', NOW() - INTERVAL 5 HOUR),
  
  (4, 'Shrimp Image Upload Delayed', 'Weekly shrimp growth photo upload past due for Pond 5.', 'Low', 'Image Upload', 'Pond 5', 'Nicca Kate Arroyo', 0, 'Remind caretaker Nicca Kate Arroyo to capture clear shrimp tissue photo.', 'In Progress', 'Caretaker scheduled image upload for 2:00 PM.', NOW() - INTERVAL 8 HOUR),
  
  (5, 'Low Dissolved Oxygen Alert', 'Dissolved oxygen dropped below safe threshold (4.2 mg/L).', 'Critical', 'Pond Status', 'Pond 3', 'Cristel Javier', 94, 'Activate secondary aerators and inspect paddlewheels immediately.', 'Pending', 'Secondary aerators toggled on.', NOW() - INTERVAL 12 HOUR),
  
  (6, 'Suspected Black Gill Disease', 'Early gill discoloration detected in Pond 4 image sample.', 'High', 'Disease', 'Pond 4', 'Cristel Javier', 82, 'Perform water parameter test and inspect shrimp gills physically.', 'In Progress', 'Caretaker taking water samples.', NOW() - INTERVAL 1 DAY),
  
  (7, 'Salinity Normalization Complete', 'Pond 2 salinity stabilized at safe target of 18 ppt.', 'Low', 'Pond Status', 'Pond 2', 'Maria Santos', 100, 'Maintain regular monitoring schedule.', 'Resolved', 'Resolved by Maria Santos during morning check.', NOW() - INTERVAL 2 DAY),
  
  (8, 'Late Attendance Logged', 'Caretaker checked in 45 minutes after scheduled shift.', 'Medium', 'Caretaker Activity', 'Pond 7', 'Lara Camille', 0, 'Verify caretaker on-site attendance and shift logs.', 'Resolved', 'Caretaker verified on-site.', NOW() - INTERVAL 2 DAY);
