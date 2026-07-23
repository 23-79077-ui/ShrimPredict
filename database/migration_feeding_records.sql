-- Add new columns to feeding_records table for caretaker feeding log
ALTER TABLE feeding_records 
ADD COLUMN IF NOT EXISTS feeding_time VARCHAR(20) DEFAULT NULL AFTER feed_type,
ADD COLUMN IF NOT EXISTS product_code VARCHAR(10) DEFAULT NULL AFTER feeding_time,
ADD COLUMN IF NOT EXISTS has_vitamin TINYINT(1) DEFAULT 0 AFTER product_code;

-- If the table doesn't have these columns yet, use this instead (for MySQL):
-- ALTER TABLE feeding_records 
-- ADD feeding_time VARCHAR(20) DEFAULT NULL AFTER feed_type,
-- ADD product_code VARCHAR(10) DEFAULT NULL AFTER feeding_time,
-- ADD has_vitamin TINYINT(1) DEFAULT 0 AFTER product_code;
