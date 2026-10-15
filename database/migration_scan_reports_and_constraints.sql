-- ==============================================================================
-- ShrimPredict Database Migration: Scan Reports, Feeding Logs Reports,
-- Harvest Forecast Views & Primary Key / Auto-Increment Constraint Alignment
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Primary Keys & Auto-Increment Constraints
ALTER TABLE `ponds` ADD PRIMARY KEY IF NOT EXISTS (`id`);
ALTER TABLE `ponds` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `users` ADD PRIMARY KEY IF NOT EXISTS (`id`);
ALTER TABLE `users` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `maintenance_reports` ADD PRIMARY KEY IF NOT EXISTS (`id`);
ALTER TABLE `maintenance_reports` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `water_quality_records` ADD PRIMARY KEY IF NOT EXISTS (`id`);
ALTER TABLE `water_quality_records` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `system_settings` ADD PRIMARY KEY IF NOT EXISTS (`id`);
ALTER TABLE `system_settings` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `roles` ADD PRIMARY KEY IF NOT EXISTS (`id`);
ALTER TABLE `roles` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `pond_caretakers` ADD PRIMARY KEY IF NOT EXISTS (`id`);
ALTER TABLE `pond_caretakers` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `feeding_records` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `alerts` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `activity_logs` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `admins` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `caretaker_ponds` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `contact_messages` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `harvest_adjustments` MODIFY `adjustment_id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `harvest_history` MODIFY `harvest_id` int(11) NOT NULL AUTO_INCREMENT;

-- 2. Terminology Views for Scan Reports, Feeding Logs Reports, & Harvest Forecast
CREATE OR REPLACE VIEW `scan_reports` AS 
    SELECT * FROM `disease_reports`;

CREATE OR REPLACE VIEW `feeding_logs_reports` AS 
    SELECT * FROM `feeding_records`;

CREATE OR REPLACE VIEW `harvest_forecast` AS 
    SELECT * FROM `harvest_predictions`;

-- 3. Water Quality Reports Column & View
ALTER TABLE `water_quality_records` ADD COLUMN IF NOT EXISTS `status` VARCHAR(30) DEFAULT 'Safe';
ALTER TABLE `water_quality_records` MODIFY COLUMN `status` VARCHAR(30) DEFAULT 'Safe';

CREATE OR REPLACE VIEW `water_quality_reports` AS 
    SELECT 
        wqr.id,
        wqr.pond_id,
        p.pond_name,
        wqr.caretaker_id,
        wqr.recorded_by_name,
        wqr.dissolved_oxygen,
        wqr.temperature,
        wqr.ph_level,
        wqr.salinity,
        wqr.status,
        wqr.capture_mode,
        wqr.ocr_confidence,
        wqr.image_path,
        wqr.raw_ocr_text,
        wqr.notes,
        wqr.record_date,
        wqr.recorded_at,
        wqr.created_at
    FROM `water_quality_records` wqr
    LEFT JOIN `ponds` p ON wqr.pond_id = p.id;

-- 4. Pond Reports Columns & View
ALTER TABLE `ponds` ADD COLUMN IF NOT EXISTS `shrimp_weight_g` DECIMAL(6,2) DEFAULT 18.50;
ALTER TABLE `ponds` ADD COLUMN IF NOT EXISTS `cycle_target_feed_kg` DECIMAL(10,2) DEFAULT 800.00;
ALTER TABLE `ponds` ADD COLUMN IF NOT EXISTS `remaining_feed_kg` DECIMAL(10,2) DEFAULT 155.00;

CREATE OR REPLACE VIEW `pond_reports` AS 
    SELECT 
        p.id,
        p.pond_name,
        p.assigned_caretaker_name,
        p.stocking_date,
        p.shrimp_weight_g,
        p.total_feed_kg,
        p.cycle_target_feed_kg,
        p.remaining_feed_kg,
        p.status,
        p.area_sqm,
        p.expected_harvest_date,
        p.harvest_readiness,
        p.created_at
    FROM `ponds` p;

SET FOREIGN_KEY_CHECKS = 1;

