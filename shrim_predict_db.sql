-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 21, 2026 at 03:01 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `shrim_predict_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `action` varchar(150) NOT NULL,
  `details` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `details`, `created_at`) VALUES
(1, 1, 'Logged in', 'Admin logged into the system', '2026-07-22 14:36:45'),
(2, 2, 'Recorded feeding', 'Feeding record added for Pond A', '2026-07-22 14:36:45'),
(3, 1, 'Water Quality Verified', 'Recorded water quality for Pond A1 via device_screen (DO: 6.8 mg/L, Temp: 28.5°C, pH: 7.8, Sal: 20 ppt).', '2026-09-10 14:57:20'),
(4, 6, 'Water Quality Verified', 'Water Quality Verified for Pond A1 on 2026-09-19 (DO: 6.5 mg/L, Temp: 28.5°C, pH: 7.8, Sal: 20 ppt).', '2026-09-19 13:05:50'),
(5, 6, 'Water Quality Verified', 'Water Quality Verified for Pond A1 on 2026-09-20 (DO: 6.5 mg/L, Temp: 28.5°C, pH: 7.8, Sal: 20 ppt).', '2026-09-20 02:45:40'),
(6, 6, 'Water Quality Verified', 'Water Quality Verified for Pond A1 on 2026-09-21 (DO: 5 mg/L, Temp: 28°C, pH: 7.5, Sal: 15 ppt).', '2026-09-21 08:57:29');

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `full_name`, `email`, `password_hash`, `phone`, `status`, `created_at`) VALUES
(1, 'System Admin', 'admin@shrimpredict.com', '$2y$10$eHnwobsFGe1hdLaqndWzFe.ZRY59SOmiF/oaLP/ENn/X2UNG1XOsa', '09123456789', 'Active', '2026-07-22 14:36:44');

-- --------------------------------------------------------

--
-- Table structure for table `alerts`
--

CREATE TABLE `alerts` (
  `id` int(11) NOT NULL,
  `title` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `severity` varchar(20) DEFAULT 'Medium',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `category` varchar(50) DEFAULT 'Pond Status',
  `affected_pond_name` varchar(50) DEFAULT 'Pond 1',
  `assigned_caretaker_name` varchar(100) DEFAULT 'Unassigned',
  `confidence_pct` int(11) DEFAULT 0,
  `recommended_action` text DEFAULT NULL,
  `status` varchar(30) DEFAULT 'Pending',
  `follow_up_notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `alerts`
--

INSERT INTO `alerts` (`id`, `title`, `message`, `severity`, `created_at`, `category`, `affected_pond_name`, `assigned_caretaker_name`, `confidence_pct`, `recommended_action`, `status`, `follow_up_notes`) VALUES
(1, 'Disease Detected', 'White Spot Disease Detected in Pond 3 tissue scan.', 'Critical', '2026-07-25 01:09:13', 'Disease', 'Pond 3', 'Cristel Javier', 96, 'Immediate water treatment, aeration boost & pond quarantine required.', 'Pending', 'Waiting for caretaker water treatment report.'),
(2, 'Harvest Ready', 'Harvest readiness reached 100%. Optimal shrimp size achieved.', 'High', '2026-07-24 23:09:13', 'Harvest', 'Pond 1', 'Maria Santos', 100, 'Recommended harvest date: July 28. Prepare harvesting equipment and cold storage.', 'Pending', 'Harvest team notified.'),
(3, 'Feeding Log Missing', 'No feeding log submitted today for Pond 4 afternoon schedule.', 'Medium', '2026-07-24 21:09:13', 'Feeding', 'Pond 4', 'Cristel Javier', 0, 'Notify caretaker Cristel Javier to submit feeding log immediately.', 'Pending', 'Alert notification sent to caretaker mobile app.'),
(4, 'Shrimp Image Upload Delayed', 'Weekly shrimp growth photo upload past due for Pond 5.', 'Low', '2026-07-24 18:09:13', 'Image Upload', 'Pond 5', 'Nicca Kate Arroyo', 0, 'Remind caretaker Nicca Kate Arroyo to capture clear shrimp tissue photo.', 'In Progress', 'Caretaker scheduled image upload for 2:00 PM.'),
(5, 'Low Dissolved Oxygen Alert', 'Dissolved oxygen dropped below safe threshold (4.2 mg/L).', 'Critical', '2026-07-24 14:09:13', 'Pond Status', 'Pond 3', 'Cristel Javier', 94, 'Activate secondary aerators and inspect paddlewheels immediately.', 'Pending', 'Secondary aerators toggled on.'),
(6, 'Suspected Black Gill Disease', 'Early gill discoloration detected in Pond 4 image sample.', 'High', '2026-07-24 02:09:13', 'Disease', 'Pond 4', 'Cristel Javier', 82, 'Perform water parameter test and inspect shrimp gills physically.', 'In Progress', 'Caretaker taking water samples.'),
(7, 'Salinity Normalization Complete', 'Pond 2 salinity stabilized at safe target of 18 ppt.', 'Low', '2026-07-23 02:09:13', 'Pond Status', 'Pond 2', 'Maria Santos', 100, 'Maintain regular monitoring schedule.', 'Resolved', 'Resolved by Maria Santos during morning check.'),
(8, 'Late Attendance Logged', 'Caretaker checked in 45 minutes after scheduled shift.', 'Medium', '2026-07-23 02:09:13', 'Caretaker Activity', 'Pond 7', 'Lara Camille', 0, 'Verify caretaker on-site attendance and shift logs.', 'Resolved', 'Caretaker verified on-site.');

-- --------------------------------------------------------

--
-- Table structure for table `caretaker_ponds`
--

CREATE TABLE `caretaker_ponds` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `pond_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `caretaker_ponds`
--

INSERT INTO `caretaker_ponds` (`id`, `user_id`, `pond_id`, `created_at`) VALUES
(19, 7, 4, '2026-07-26 02:49:54'),
(20, 7, 5, '2026-07-26 02:49:54'),
(21, 7, 6, '2026-07-26 02:49:54'),
(23, 6, 1, '2026-07-26 02:52:15'),
(31, 17, 7, '2026-09-16 06:32:51'),
(33, 18, 11, '2026-09-16 06:59:29');

-- --------------------------------------------------------

--
-- Table structure for table `contact_messages`
--

CREATE TABLE `contact_messages` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `status` enum('unread','read','replied') DEFAULT 'unread',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `contact_messages`
--

INSERT INTO `contact_messages` (`id`, `name`, `email`, `subject`, `message`, `status`, `created_at`) VALUES
(1, 'Juan Dela Cruz', 'juan@farm.com', 'Pond Setup / Inquiry', 'How can we help your farm?', 'unread', '2026-07-26 01:06:16'),
(2, 'Maria Santos', 'maria@shrimp-farm.ph', 'AI WSSV Scan Integration', 'We want to connect 5 shrimp ponds in Pampanga to the AI disease alert system.', 'unread', '2026-07-26 01:06:42'),
(3, 'Nicca', 'nicca@gmail.com', 'Concern', 'hello paorder eme', 'unread', '2026-07-26 01:07:23');

-- --------------------------------------------------------

--
-- Table structure for table `disease_reports`
--

CREATE TABLE `disease_reports` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `caretaker_name` varchar(150) DEFAULT NULL,
  `pond_name` varchar(150) DEFAULT NULL,
  `disease_name` varchar(100) NOT NULL,
  `confidence_score` decimal(5,2) DEFAULT 0.00,
  `risk_level` varchar(20) DEFAULT 'Low',
  `recommendation` text DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Pending',
  `image_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `disease_reports`
--

INSERT INTO `disease_reports` (`id`, `user_id`, `caretaker_name`, `pond_name`, `disease_name`, `confidence_score`, `risk_level`, `recommendation`, `status`, `image_path`, `created_at`) VALUES
(1, NULL, 'Juan Dela Cruz', 'Pond A1', 'White Spot Syndrome', 93.00, 'High', 'Increase water quality checks and isolate affected pond.', 'Pending', 'uploads/sample.jpg', '2026-07-22 14:36:45'),
(2, NULL, 'Maria Santos', 'Pond A2', 'Black Gill Disease', 74.00, 'Medium', 'Adjust salinity and monitor shrimp behavior.', 'Reviewed', 'uploads/sample2.jpg', '2026-07-22 14:36:45'),
(3, NULL, 'Caretaker', 'General Pond', 'White Spot Syndrome', 93.00, 'High', 'Improve water quality and isolate affected pond.', 'Pending', 'uploads/1784956363_profile.jpg', '2026-07-25 05:12:43'),
(4, NULL, 'Caretaker', 'General Pond', 'White Spot Syndrome', 93.00, 'High', 'Improve water quality and isolate affected pond.', 'Pending', 'uploads/1784956380_BrokenFilter.jpg', '2026-07-25 05:13:00'),
(5, 5, 'Lara camille', 'Pond B2', 'White Spot Syndrome', 82.00, 'High', 'Isolate the pond immediately, increase water quality checks, and consult a veterinarian for treatment.', 'Pending', 'uploads/sample.jpg', '2026-07-25 05:14:36'),
(6, 5, 'Lara camille', 'Pond B3', 'Healthy', 76.11, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785023172_f6df6e0f_shrimpwsd.jpg', '2026-07-25 23:46:12'),
(7, 5, 'Lara camille', 'Pond C1', 'Healthy', 76.11, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785023191_8c79256e_shrimpwsd.jpg', '2026-07-25 23:46:31'),
(8, 5, 'Lara camille', 'Pond A1', 'Needs Review - Possible WSSV', 55.00, 'Medium', 'Retake a clearer close-up photo under good lighting.\nInspect shrimp shells for distinct white spots.\nKeep monitoring the pond before confirming WSSV.\nEscalate to admin if symptoms or mortality increase.', 'Pending', 'uploads/disease_scans/1785023488_3cbe8e9f_shri.jpg', '2026-07-25 23:51:28'),
(9, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025352_c53945e7_shrimp_scan.jpg', '2026-07-26 00:22:32'),
(10, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025352_923310f8_shrimp_scan.jpg', '2026-07-26 00:22:32'),
(11, 5, 'Lara camille', 'Pond B1', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 00:27:50'),
(12, 5, 'Lara camille', 'Pond B2', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025682_38a3f594_healty.jpg', '2026-07-26 00:28:02'),
(13, 5, 'Lara camille', 'Pond B3', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025694_280dd844_shrimpwsd.jpg', '2026-07-26 00:28:14'),
(14, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025844_1662d8bc_shrimp_scan.jpg', '2026-07-26 00:30:44'),
(15, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025844_3a0d124d_shrimp_scan.jpg', '2026-07-26 00:30:44'),
(16, 5, 'Lara camille', 'Pond A2', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025890_8891a636_shrimpwsd.jpg', '2026-07-26 00:31:30'),
(17, 5, 'Lara camille', 'Pond A3', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025899_203b8db5_caretaker-wssv-scan-1785025898744.png', '2026-07-26 00:31:39'),
(18, 5, 'Lara camille', 'Pond B1', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025943_30063ca1_shri.jpg', '2026-07-26 00:32:23'),
(19, 5, 'Lara camille', 'Pond B2', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785025968_1fd2c0f9_images.jpg', '2026-07-26 00:32:48'),
(20, 5, 'Lara camille', 'Pond B3', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026010_6e0e997b_hehe.jpg', '2026-07-26 00:33:30'),
(21, 5, 'Lara camille', 'Pond C1', 'White Spot Syndrome Virus (WSSV)', 78.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026061_be2d7235_images__1_.jpg', '2026-07-26 00:34:21'),
(22, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 82.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026267_62ea3309_1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 00:37:47'),
(23, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 75.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026267_e945304d_1785025682_38a3f594_healty.jpg', '2026-07-26 00:37:47'),
(24, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 61.29, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026268_d25287f6_1785025968_1fd2c0f9_images.jpg', '2026-07-26 00:37:48'),
(25, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 75.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026268_361f0872_1785026010_6e0e997b_hehe.jpg', '2026-07-26 00:37:48'),
(26, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 75.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026319_a7c9c3e9_1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 00:38:39'),
(27, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 75.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026319_e2414a35_1785025682_38a3f594_healty.jpg', '2026-07-26 00:38:39'),
(28, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 75.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026320_3c1317ef_1785025968_1fd2c0f9_images.jpg', '2026-07-26 00:38:40'),
(29, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 75.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026320_c999baec_1785026010_6e0e997b_hehe.jpg', '2026-07-26 00:38:40'),
(30, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 82.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026465_86d24f94_1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 00:41:06'),
(31, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 66.23, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026466_e7adc88d_1785025682_38a3f594_healty.jpg', '2026-07-26 00:41:06'),
(32, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 82.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026466_1f1140fc_1785025968_1fd2c0f9_images.jpg', '2026-07-26 00:41:06'),
(33, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 82.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026467_24efc58f_1785026010_6e0e997b_hehe.jpg', '2026-07-26 00:41:07'),
(34, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026574_d0f8fdf9_1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 00:42:54'),
(35, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026574_c50d7bc5_1785025682_38a3f594_healty.jpg', '2026-07-26 00:42:54'),
(36, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026575_99ebb550_1785025968_1fd2c0f9_images.jpg', '2026-07-26 00:42:55'),
(37, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026575_bc02f1c4_1785026010_6e0e997b_hehe.jpg', '2026-07-26 00:42:55'),
(38, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 82.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026666_4f10ac49_1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 00:44:26'),
(39, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 82.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026666_7e77cdad_1785025682_38a3f594_healty.jpg', '2026-07-26 00:44:26'),
(40, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 82.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026666_b844f3c8_1785025968_1fd2c0f9_images.jpg', '2026-07-26 00:44:26'),
(41, NULL, 'Test Caretaker', 'Pond A1', 'White Spot Syndrome Virus (WSSV)', 82.00, 'High', 'Isolate infected shrimp.\nImprove water quality.\nReduce stress.\nConsult aquatic veterinarian.\nMonitor remaining ponds.', 'Pending', 'uploads/disease_scans/1785026667_5733dbe6_1785026010_6e0e997b_hehe.jpg', '2026-07-26 00:44:27'),
(42, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026729_dd7af0e2_1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 00:45:29'),
(43, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026730_32f2f6c1_1785025682_38a3f594_healty.jpg', '2026-07-26 00:45:30'),
(44, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026730_5676969b_1785025968_1fd2c0f9_images.jpg', '2026-07-26 00:45:30'),
(45, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026730_f02cead9_1785026010_6e0e997b_hehe.jpg', '2026-07-26 00:45:30'),
(46, 5, 'Lara camille', 'Pond B1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026796_7f9718ab_images__1_.jpg', '2026-07-26 00:46:36'),
(47, 5, 'Lara camille', 'Pond B2', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785026816_45ded5b6_shrimpwsd.jpg', '2026-07-26 00:46:56'),
(48, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027296_f09cbded_1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 00:54:56'),
(49, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027297_12dcba75_1785025682_38a3f594_healty.jpg', '2026-07-26 00:54:57'),
(50, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027297_8f33cef4_1785025968_1fd2c0f9_images.jpg', '2026-07-26 00:54:57'),
(51, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027297_6b84451e_1785026010_6e0e997b_hehe.jpg', '2026-07-26 00:54:57'),
(52, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027416_c188e5ab_1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 00:56:56'),
(53, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027416_d5026ce0_1785025682_38a3f594_healty.jpg', '2026-07-26 00:56:56'),
(54, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027416_c6a7dab0_1785025968_1fd2c0f9_images.jpg', '2026-07-26 00:56:56'),
(55, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027416_0914581e_1785026010_6e0e997b_hehe.jpg', '2026-07-26 00:56:56'),
(56, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027666_dd4d3675_1785025670_c5464ea2_healthyyy.jpg', '2026-07-26 01:01:06'),
(57, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027666_ca239b34_1785025682_38a3f594_healty.jpg', '2026-07-26 01:01:06'),
(58, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027667_17bae043_1785025968_1fd2c0f9_images.jpg', '2026-07-26 01:01:07'),
(59, NULL, 'Test Caretaker', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785027667_f9bd677a_1785026010_6e0e997b_hehe.jpg', '2026-07-26 01:01:07'),
(60, 5, 'Lara camille', 'Pond B1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785029108_ade1e2f6_hehe.jpg', '2026-07-26 01:25:08'),
(61, 5, 'Lara camille', 'Pond B2', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785029141_7c21f69f_shri.jpg', '2026-07-26 01:25:41'),
(62, 5, 'Lara camille', 'Pond B3', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785029160_91b68eb0_images__1_.jpg', '2026-07-26 01:26:00'),
(63, 5, 'Lara camille', 'Pond C1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785030880_aaf59e14_hehe.jpg', '2026-07-26 01:54:40'),
(64, 5, 'Lara camille', 'Pond A1', 'Healthy', 80.00, 'Low', 'No disease detected.', 'Pending', 'uploads/disease_scans/1785030916_4a7aa1e6_images.jpg', '2026-07-26 01:55:16');

-- --------------------------------------------------------

--
-- Table structure for table `feeding_records`
--

CREATE TABLE `feeding_records` (
  `id` int(11) NOT NULL,
  `pond_id` int(11) NOT NULL,
  `amount_kg` decimal(10,2) NOT NULL,
  `feed_type` varchar(100) NOT NULL,
  `feeding_time` varchar(20) DEFAULT NULL,
  `product_code` varchar(20) DEFAULT NULL,
  `has_vitamin` tinyint(1) DEFAULT 0,
  `vitamin_name` varchar(100) DEFAULT NULL,
  `record_date` date NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `recorded_by_name` varchar(100) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `shrimp_weight_grams` decimal(8,2) DEFAULT NULL,
  `tray_count` int(11) DEFAULT 4,
  `tray_feed_grams` decimal(10,2) DEFAULT NULL,
  `total_tray_feed_grams` decimal(10,2) DEFAULT NULL,
  `broadcast_feed_kg` decimal(10,3) DEFAULT NULL,
  `tray_monitoring_status` varchar(50) DEFAULT NULL,
  `amount_grams` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `feeding_records`
--

INSERT INTO `feeding_records` (`id`, `pond_id`, `amount_kg`, `feed_type`, `feeding_time`, `product_code`, `has_vitamin`, `vitamin_name`, `record_date`, `notes`, `created_at`, `recorded_by_name`, `user_id`, `shrimp_weight_grams`, `tray_count`, `tray_feed_grams`, `total_tray_feed_grams`, `broadcast_feed_kg`, `tray_monitoring_status`, `amount_grams`) VALUES
(31, 4, 9.00, 'Tateh - Starter', '6:00 AM', 'Starter', 0, 'None', '2026-07-27', '1st feeding session (Morning)', '2026-07-26 22:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(32, 4, 9.00, 'Tateh - Starter', '9:00 AM', 'Starter', 1, 'Vitamin C', '2026-07-27', '2nd feeding session (Mid-Morning)', '2026-07-27 01:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(33, 4, 9.00, 'Tateh - Starter', '12:00 PM', 'Starter', 0, 'None', '2026-07-27', '3rd feeding session (Noon)', '2026-07-27 04:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(34, 4, 9.00, 'Tateh - Starter', '3:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-07-27', '4th feeding session (Afternoon)', '2026-07-27 07:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(35, 4, 9.00, 'Tateh - Starter', '6:00 PM', 'Starter', 0, 'None', '2026-07-27', '5th feeding session (Evening)', '2026-07-27 10:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(36, 4, 9.00, 'Tateh - Starter', '6:00 AM', 'Starter', 0, 'None', '2026-07-26', '1st feeding session (Morning)', '2026-07-25 22:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(37, 4, 9.00, 'Tateh - Starter', '9:00 AM', 'Starter', 1, 'Vitamin C', '2026-07-26', '2nd feeding session (Mid-Morning)', '2026-07-26 01:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(38, 4, 9.00, 'Tateh - Starter', '12:00 PM', 'Starter', 0, 'None', '2026-07-26', '3rd feeding session (Noon)', '2026-07-26 04:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(39, 4, 9.00, 'Tateh - Starter', '3:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-07-26', '4th feeding session (Afternoon)', '2026-07-26 07:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(40, 4, 9.00, 'Tateh - Starter', '6:00 PM', 'Starter', 0, 'None', '2026-07-26', '5th feeding session (Evening)', '2026-07-26 10:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(41, 5, 9.00, 'Tateh - Grower', '6:00 AM', 'Grower', 0, 'None', '2026-07-27', '1st feeding session (Morning)', '2026-07-26 22:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(42, 5, 9.00, 'Tateh - Grower', '9:00 AM', 'Grower', 1, 'Vitamin C', '2026-07-27', '2nd feeding session (Mid-Morning)', '2026-07-27 01:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(43, 5, 9.00, 'Tateh - Grower', '12:00 PM', 'Grower', 0, 'None', '2026-07-27', '3rd feeding session (Noon)', '2026-07-27 04:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(44, 5, 9.00, 'Tateh - Grower', '3:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-07-27', '4th feeding session (Afternoon)', '2026-07-27 07:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(45, 5, 9.00, 'Tateh - Grower', '6:00 PM', 'Grower', 0, 'None', '2026-07-27', '5th feeding session (Evening)', '2026-07-27 10:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(46, 5, 9.00, 'Tateh - Grower', '6:00 AM', 'Grower', 0, 'None', '2026-07-26', '1st feeding session (Morning)', '2026-07-25 22:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(47, 5, 9.00, 'Tateh - Grower', '9:00 AM', 'Grower', 1, 'Vitamin C', '2026-07-26', '2nd feeding session (Mid-Morning)', '2026-07-26 01:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(48, 5, 9.00, 'Tateh - Grower', '12:00 PM', 'Grower', 0, 'None', '2026-07-26', '3rd feeding session (Noon)', '2026-07-26 04:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(49, 5, 9.00, 'Tateh - Grower', '3:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-07-26', '4th feeding session (Afternoon)', '2026-07-26 07:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(50, 5, 9.00, 'Tateh - Grower', '6:00 PM', 'Grower', 0, 'None', '2026-07-26', '5th feeding session (Evening)', '2026-07-26 10:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(51, 6, 9.00, 'Tateh - Starter', '6:00 AM', 'Starter', 0, 'None', '2026-07-27', '1st feeding session (Morning)', '2026-07-26 22:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(52, 6, 9.00, 'Tateh - Starter', '9:00 AM', 'Starter', 1, 'Vitamin C', '2026-07-27', '2nd feeding session (Mid-Morning)', '2026-07-27 01:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(53, 6, 9.00, 'Tateh - Starter', '12:00 PM', 'Starter', 0, 'None', '2026-07-27', '3rd feeding session (Noon)', '2026-07-27 04:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(54, 6, 9.00, 'Tateh - Starter', '3:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-07-27', '4th feeding session (Afternoon)', '2026-07-27 07:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(55, 6, 9.00, 'Tateh - Starter', '6:00 PM', 'Starter', 0, 'None', '2026-07-27', '5th feeding session (Evening)', '2026-07-27 10:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(56, 6, 9.00, 'Tateh - Starter', '6:00 AM', 'Starter', 0, 'None', '2026-07-26', '1st feeding session (Morning)', '2026-07-25 22:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(57, 6, 9.00, 'Tateh - Starter', '9:00 AM', 'Starter', 1, 'Vitamin C', '2026-07-26', '2nd feeding session (Mid-Morning)', '2026-07-26 01:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(58, 6, 9.00, 'Tateh - Starter', '12:00 PM', 'Starter', 0, 'None', '2026-07-26', '3rd feeding session (Noon)', '2026-07-26 04:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(59, 6, 9.00, 'Tateh - Starter', '3:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-07-26', '4th feeding session (Afternoon)', '2026-07-26 07:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(60, 6, 9.00, 'Tateh - Starter', '6:00 PM', 'Starter', 0, 'None', '2026-07-26', '5th feeding session (Evening)', '2026-07-26 10:00:00', 'Rc Javier', 7, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(61, 7, 9.00, 'Tateh - Grower', '6:00 AM', 'Grower', 0, 'None', '2026-07-27', '1st feeding session (Morning)', '2026-07-26 22:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(62, 7, 9.00, 'Tateh - Grower', '9:00 AM', 'Grower', 1, 'Vitamin C', '2026-07-27', '2nd feeding session (Mid-Morning)', '2026-07-27 01:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(63, 7, 9.00, 'Tateh - Grower', '12:00 PM', 'Grower', 0, 'None', '2026-07-27', '3rd feeding session (Noon)', '2026-07-27 04:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(64, 7, 9.00, 'Tateh - Grower', '3:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-07-27', '4th feeding session (Afternoon)', '2026-07-27 07:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(65, 7, 9.00, 'Tateh - Grower', '6:00 PM', 'Grower', 0, 'None', '2026-07-27', '5th feeding session (Evening)', '2026-07-27 10:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(66, 7, 9.00, 'Tateh - Grower', '6:00 AM', 'Grower', 0, 'None', '2026-07-26', '1st feeding session (Morning)', '2026-07-25 22:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(67, 7, 9.00, 'Tateh - Grower', '9:00 AM', 'Grower', 1, 'Vitamin C', '2026-07-26', '2nd feeding session (Mid-Morning)', '2026-07-26 01:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(68, 7, 9.00, 'Tateh - Grower', '12:00 PM', 'Grower', 0, 'None', '2026-07-26', '3rd feeding session (Noon)', '2026-07-26 04:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(69, 7, 9.00, 'Tateh - Grower', '3:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-07-26', '4th feeding session (Afternoon)', '2026-07-26 07:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(70, 7, 9.00, 'Tateh - Grower', '6:00 PM', 'Grower', 0, 'None', '2026-07-26', '5th feeding session (Evening)', '2026-07-26 10:00:00', 'Re Villela', 8, NULL, 4, NULL, NULL, NULL, NULL, NULL),
(71, 1, 0.00, 'Tateh - Starter', '6:00 AM', 'Starter', 0, 'None', '2026-08-10', 'Wala pang pakain (0g)', '2026-08-09 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 0.00),
(72, 1, 0.00, 'Tateh - Starter', '9:00 AM', 'Starter', 0, 'None', '2026-08-10', 'Wala pang pakain (0g)', '2026-08-10 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 0.00),
(73, 1, 0.50, 'Tateh - Starter', '12:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-10', '500g Starter feed with Sanolife PRO-2', '2026-08-10 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 500.00),
(74, 1, 0.50, 'Tateh - Starter', '3:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-10', '500g Starter feed with Sanolife PRO-2', '2026-08-10 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 500.00),
(75, 1, 0.50, 'Tateh - Starter', '6:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-10', '500g Starter feed with Sanolife PRO-2', '2026-08-10 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 500.00),
(76, 1, 0.65, 'Tateh - Starter', '6:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-11', 'DOC #2: 650g Starter with Sanolife PRO-2', '2026-08-10 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 650.00),
(77, 1, 0.65, 'Tateh - Starter', '9:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-11', 'DOC #2: 650g Starter with Sanolife PRO-2', '2026-08-11 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 650.00),
(78, 1, 0.65, 'Tateh - Starter', '12:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-11', 'DOC #2: 650g Starter with Sanolife PRO-2', '2026-08-11 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 650.00),
(79, 1, 0.65, 'Tateh - Starter', '3:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-11', 'DOC #2: 650g Starter with Sanolife PRO-2', '2026-08-11 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 650.00),
(80, 1, 0.65, 'Tateh - Starter', '6:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-11', 'DOC #2: 650g Starter with Sanolife PRO-2', '2026-08-11 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 650.00),
(81, 1, 0.70, 'Tateh - Starter', '6:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-12', 'DOC #3: 700g Starter with Sanolife PRO-2', '2026-08-11 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 700.00),
(82, 1, 0.70, 'Tateh - Starter', '9:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-12', 'DOC #3: 700g Starter with Sanolife PRO-2', '2026-08-12 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 700.00),
(83, 1, 0.70, 'Tateh - Starter', '12:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-12', 'DOC #3: 700g Starter with Sanolife PRO-2', '2026-08-12 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 700.00),
(84, 1, 0.70, 'Tateh - Starter', '3:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-12', 'DOC #3: 700g Starter with Sanolife PRO-2', '2026-08-12 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 700.00),
(85, 1, 0.70, 'Tateh - Starter', '6:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-12', 'DOC #3: 700g Starter with Sanolife PRO-2', '2026-08-12 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 700.00),
(86, 1, 0.75, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-13', 'DOC #4: 750g Starter #1 with Sanolife PRO-2', '2026-08-12 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 750.00),
(87, 1, 0.75, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-13', 'DOC #4: 750g Starter #1 with Sanolife PRO-2', '2026-08-13 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 750.00),
(88, 1, 0.75, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-13', 'DOC #4: 750g Starter #1 with Sanolife PRO-2', '2026-08-13 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 750.00),
(89, 1, 0.75, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-13', 'DOC #4: 750g Starter #1 with Sanolife PRO-2', '2026-08-13 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 750.00),
(90, 1, 0.75, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-13', 'DOC #4: 750g Starter #1 with Sanolife PRO-2', '2026-08-13 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 750.00),
(91, 1, 0.80, 'Tateh - Starter', '6:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-14', 'DOC #5: 800g Starter with Sanolife PRO-2', '2026-08-13 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 800.00),
(92, 1, 0.80, 'Tateh - Starter', '9:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-14', 'DOC #5: 800g Starter with Sanolife PRO-2', '2026-08-14 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 800.00),
(93, 1, 0.80, 'Tateh - Starter', '12:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-14', 'DOC #5: 800g Starter with Sanolife PRO-2', '2026-08-14 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 800.00),
(94, 1, 0.80, 'Tateh - Starter', '3:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-14', 'DOC #5: 800g Starter with Sanolife PRO-2', '2026-08-14 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 800.00),
(95, 1, 0.80, 'Tateh - Starter', '6:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-14', 'DOC #5: 800g Starter with Sanolife PRO-2', '2026-08-14 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 800.00),
(96, 1, 0.85, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-15', 'DOC #6: 850g Starter #1 with Sanolife PRO-2', '2026-08-14 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 850.00),
(97, 1, 0.85, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-15', 'DOC #6: 850g Starter #1 with Sanolife PRO-2', '2026-08-15 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 850.00),
(98, 1, 0.85, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-15', 'DOC #6: 850g Starter #1 with Sanolife PRO-2', '2026-08-15 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 850.00),
(99, 1, 0.85, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-15', 'DOC #6: 850g Starter #1 with Sanolife PRO-2', '2026-08-15 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 850.00),
(100, 1, 0.85, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-15', 'DOC #6: 850g Starter #1 with Sanolife PRO-2', '2026-08-15 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 850.00),
(101, 1, 0.90, 'Tateh - Starter', '6:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-16', 'DOC #7: 900g Starter with Sanolife PRO-2', '2026-08-15 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 900.00),
(102, 1, 0.90, 'Tateh - Starter', '9:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-16', 'DOC #7: 900g Starter with Sanolife PRO-2', '2026-08-16 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 900.00),
(103, 1, 0.90, 'Tateh - Starter', '12:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-16', 'DOC #7: 900g Starter with Sanolife PRO-2', '2026-08-16 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 900.00),
(104, 1, 0.90, 'Tateh - Starter', '3:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-16', 'DOC #7: 900g Starter with Sanolife PRO-2', '2026-08-16 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 900.00),
(105, 1, 0.90, 'Tateh - Starter', '6:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-16', 'DOC #7: 900g Starter with Sanolife PRO-2', '2026-08-16 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 900.00),
(106, 1, 0.95, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-17', 'DOC #8: 950g Starter #1 with Sanolife PRO-2', '2026-08-16 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(107, 1, 0.95, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sano Top-S', '2026-08-17', 'DOC #8: 950g Starter #1 with Sano Top-S', '2026-08-17 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(108, 1, 0.95, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-17', 'DOC #8: 950g Starter #1 with Sanolife PRO-2', '2026-08-17 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(109, 1, 0.95, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sano Top-S', '2026-08-17', 'DOC #8: 950g Starter #1 with Sano Top-S', '2026-08-17 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(110, 1, 0.95, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-17', 'DOC #8: 950g Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-17 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(111, 1, 0.95, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-18', 'DOC #9: 950g Starter #1 with Sanolife PRO-2', '2026-08-17 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(112, 1, 0.95, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sano Top-S', '2026-08-18', 'DOC #9: 950g Starter #1 with Sano Top-S', '2026-08-18 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(113, 1, 0.95, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-18', 'DOC #9: 950g Starter #1 with Sanolife PRO-2', '2026-08-18 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(114, 1, 0.95, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sano Top-S', '2026-08-18', 'DOC #9: 950g Starter #1 with Sano Top-S', '2026-08-18 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(115, 1, 0.95, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-18', 'DOC #9: 950g Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-18 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 950.00),
(116, 1, 1.00, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-19', 'DOC #10: 1000g Starter #1 with Sanolife PRO-2', '2026-08-18 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(117, 1, 1.00, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sano Top-S', '2026-08-19', 'DOC #10: 1000g Starter #1 with Sano Top-S', '2026-08-19 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(118, 1, 1.00, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-19', 'DOC #10: 1000g Starter #1 with Sanolife PRO-2', '2026-08-19 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(119, 1, 1.00, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sano Top-S', '2026-08-19', 'DOC #10: 1000g Starter #1 with Sano Top-S', '2026-08-19 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(120, 1, 1.00, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-19', 'DOC #10: 1000g Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-19 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(121, 1, 1.00, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-20', 'DOC #11: 1000g Starter #1 with Sanolife PRO-2', '2026-08-19 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(122, 1, 1.00, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sano Top-S', '2026-08-20', 'DOC #11: 1000g Starter #1 with Sano Top-S', '2026-08-20 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(123, 1, 1.00, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-20', 'DOC #11: 1000g Starter #1 with Sanolife PRO-2', '2026-08-20 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(124, 1, 1.00, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sano Top-S', '2026-08-20', 'DOC #11: 1000g Starter #1 with Sano Top-S', '2026-08-20 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(125, 1, 1.00, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-20', 'DOC #11: 1000g Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-20 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1000.00),
(126, 1, 1.10, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-21', 'DOC #12: 1100g Starter #1 with Sanolife PRO-2', '2026-08-20 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(127, 1, 1.10, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sano Top-S', '2026-08-21', 'DOC #12: 1100g Starter #1 with Sano Top-S', '2026-08-21 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(128, 1, 1.10, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-21', 'DOC #12: 1100g Starter #1 with Sanolife PRO-2', '2026-08-21 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(129, 1, 1.10, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sano Top-S', '2026-08-21', 'DOC #12: 1100g Starter #1 with Sano Top-S', '2026-08-21 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(130, 1, 1.10, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-21', 'DOC #12: 1100g Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-21 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(131, 1, 1.10, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-22', 'DOC #13: 1100g Starter #1 with Sanolife PRO-2', '2026-08-21 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(132, 1, 1.10, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sano Top-S', '2026-08-22', 'DOC #13: 1100g Starter #1 with Sano Top-S', '2026-08-22 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(133, 1, 1.10, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-22', 'DOC #13: 1100g Starter #1 with Sanolife PRO-2', '2026-08-22 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(134, 1, 1.10, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sano Top-S', '2026-08-22', 'DOC #13: 1100g Starter #1 with Sano Top-S', '2026-08-22 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(135, 1, 1.10, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-22', 'DOC #13: 1100g Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-22 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(136, 1, 1.10, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-23', 'DOC #14: 1100g Starter #1 with Sanolife PRO-2', '2026-08-22 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(137, 1, 1.10, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sano Top-S', '2026-08-23', 'DOC #14: 1100g Starter #1 with Sano Top-S', '2026-08-23 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(138, 1, 1.10, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-23', 'DOC #14: 1100g Starter #1 with Sanolife PRO-2', '2026-08-23 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(139, 1, 1.10, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sano Top-S', '2026-08-23', 'DOC #14: 1100g Starter #1 with Sano Top-S', '2026-08-23 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(140, 1, 1.10, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-23', 'DOC #14: 1100g Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-23 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1100.00),
(141, 1, 1.20, 'Tateh - Starter #1', '6:00 AM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-24', 'DOC #15: 1200g Starter #1 with Sanolife PRO-2', '2026-08-23 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(142, 1, 1.20, 'Tateh - Starter #1', '9:00 AM', 'Starter #1', 1, 'Sano Top-S', '2026-08-24', 'DOC #15: 1200g Starter #1 with Sano Top-S', '2026-08-24 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(143, 1, 1.20, 'Tateh - Starter #1', '12:00 PM', 'Starter #1', 1, 'Sanolife PRO-2', '2026-08-24', 'DOC #15: 1200g Starter #1 with Sanolife PRO-2', '2026-08-24 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(144, 1, 1.20, 'Tateh - Starter #1', '3:00 PM', 'Starter #1', 1, 'Sano Top-S', '2026-08-24', 'DOC #15: 1200g Starter #1 with Sano Top-S', '2026-08-24 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(145, 1, 1.20, 'Tateh - Starter #1', '6:00 PM', 'Starter #1', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-24', 'DOC #15: 1200g Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-24 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(146, 1, 1.20, 'Tateh - Starter #1', '6:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-25', 'DOC #16 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sanolife PRO-2', '2026-08-24 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(147, 1, 1.20, 'Tateh - Starter #1', '9:00 AM', 'Starter', 1, 'Sano Top-S', '2026-08-25', 'DOC #16 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sano Top-S', '2026-08-25 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(148, 1, 1.20, 'Tateh - Starter #1', '12:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-25', 'DOC #16 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sanolife PRO-2', '2026-08-25 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(149, 1, 1.20, 'Tateh - Starter #1', '3:00 PM', 'Starter', 1, 'Sano Top-S', '2026-08-25', 'DOC #16 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sano Top-S', '2026-08-25 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(150, 1, 1.20, 'Tateh - Starter #1', '6:00 PM', 'Starter', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-25', 'DOC #16 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-25 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(151, 1, 1.20, 'Tateh - Starter #1', '6:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-26', 'DOC #17 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sanolife PRO-2', '2026-08-25 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(152, 1, 1.20, 'Tateh - Starter #1', '9:00 AM', 'Starter', 1, 'Sano Top-S', '2026-08-26', 'DOC #17 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sano Top-S', '2026-08-26 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(153, 1, 1.20, 'Tateh - Starter #1', '12:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-26', 'DOC #17 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sanolife PRO-2', '2026-08-26 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(154, 1, 1.20, 'Tateh - Starter #1', '3:00 PM', 'Starter', 1, 'Sano Top-S', '2026-08-26', 'DOC #17 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sano Top-S', '2026-08-26 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(155, 1, 1.20, 'Tateh - Starter #1', '6:00 PM', 'Starter', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-26', 'DOC #17 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-26 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(156, 1, 1.20, 'Tateh - Starter #1', '6:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-27', 'DOC #18 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sanolife PRO-2', '2026-08-26 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(157, 1, 1.20, 'Tateh - Starter #1', '9:00 AM', 'Starter', 1, 'Sano Top-S', '2026-08-27', 'DOC #18 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sano Top-S', '2026-08-27 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(158, 1, 1.20, 'Tateh - Starter #1', '12:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-27', 'DOC #18 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sanolife PRO-2', '2026-08-27 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(159, 1, 1.20, 'Tateh - Starter #1', '3:00 PM', 'Starter', 1, 'Sano Top-S', '2026-08-27', 'DOC #18 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sano Top-S', '2026-08-27 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(160, 1, 1.20, 'Tateh - Starter #1', '6:00 PM', 'Starter', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-27', 'DOC #18 [Nursery Stage (Starter)]: 1200g Tateh - Starter #1 with Sanolife PRO-2, Sano Top-S', '2026-08-27 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 1200.00),
(161, 1, 3.00, 'Tateh - Starter #2', '6:00 AM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-28', 'DOC #19 [Nursery Stage (Starter)]: 3000g Tateh - Starter #2 with Sanolife PRO-2', '2026-08-27 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(162, 1, 3.00, 'Tateh - Starter #2', '9:00 AM', 'Starter', 1, 'Sano Top-S', '2026-08-28', 'DOC #19 [Nursery Stage (Starter)]: 3000g Tateh - Starter #2 with Sano Top-S', '2026-08-28 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(163, 1, 3.00, 'Tateh - Starter #2', '12:00 PM', 'Starter', 1, 'Sanolife PRO-2', '2026-08-28', 'DOC #19 [Nursery Stage (Starter)]: 3000g Tateh - Starter #2 with Sanolife PRO-2', '2026-08-28 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(164, 1, 3.00, 'Tateh - Starter #2', '3:00 PM', 'Starter', 1, 'Sano Top-S', '2026-08-28', 'DOC #19 [Nursery Stage (Starter)]: 3000g Tateh - Starter #2 with Sano Top-S', '2026-08-28 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(165, 1, 3.00, 'Tateh - Starter #2', '6:00 PM', 'Starter', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-28', 'DOC #19 [Nursery Stage (Starter)]: 3000g Tateh - Starter #2 with Sanolife PRO-2, Sano Top-S', '2026-08-28 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(166, 1, 3.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-08-29', 'DOC #20 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2', '2026-08-28 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(167, 1, 3.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-08-29', 'DOC #20 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sano Top-S', '2026-08-29 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(168, 1, 3.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-08-29', 'DOC #20 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2', '2026-08-29 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(169, 1, 3.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-08-29', 'DOC #20 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sano Top-S', '2026-08-29 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(170, 1, 3.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-29', 'DOC #20 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-08-29 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(171, 1, 3.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-08-30', 'DOC #21 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2', '2026-08-29 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(172, 1, 3.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-08-30', 'DOC #21 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sano Top-S', '2026-08-30 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(173, 1, 3.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-08-30', 'DOC #21 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2', '2026-08-30 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(174, 1, 3.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-08-30', 'DOC #21 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sano Top-S', '2026-08-30 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(175, 1, 3.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-30', 'DOC #21 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-08-30 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(176, 1, 3.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-08-31', 'DOC #22 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2', '2026-08-30 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(177, 1, 3.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-08-31', 'DOC #22 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sano Top-S', '2026-08-31 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(178, 1, 3.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-08-31', 'DOC #22 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2', '2026-08-31 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(179, 1, 3.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-08-31', 'DOC #22 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sano Top-S', '2026-08-31 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(180, 1, 3.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-08-31', 'DOC #22 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-08-31 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(181, 1, 3.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-01', 'DOC #23 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2', '2026-08-31 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(182, 1, 3.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-01', 'DOC #23 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sano Top-S', '2026-09-01 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(183, 1, 3.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-01', 'DOC #23 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-01 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(184, 1, 3.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-01', 'DOC #23 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sano Top-S', '2026-09-01 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(185, 1, 3.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-01', 'DOC #23 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-01 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(186, 1, 3.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-02', 'DOC #24 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-01 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(187, 1, 3.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-02', 'DOC #24 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sano Top-S', '2026-09-02 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(188, 1, 4.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-02', 'DOC #24 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-02 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(189, 1, 4.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-02', 'DOC #24 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-02 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(190, 1, 3.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-02', 'DOC #24 [Grow-out Stage (Grower)]: 3000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-02 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 3000.00),
(191, 1, 4.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-03', 'DOC #25 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-02 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(192, 1, 4.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-03', 'DOC #25 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-03 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(193, 1, 4.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-03', 'DOC #25 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-03 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(194, 1, 4.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-03', 'DOC #25 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-03 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(195, 1, 4.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-03', 'DOC #25 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-03 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(196, 1, 4.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-04', 'DOC #26 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-03 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(197, 1, 4.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-04', 'DOC #26 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-04 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(198, 1, 4.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-04', 'DOC #26 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-04 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(199, 1, 4.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-04', 'DOC #26 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-04 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(200, 1, 4.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-04', 'DOC #26 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-04 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(201, 1, 4.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-05', 'DOC #27 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-04 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(202, 1, 4.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-05', 'DOC #27 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-05 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(203, 1, 4.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-05', 'DOC #27 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-05 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(204, 1, 4.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-05', 'DOC #27 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-05 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(205, 1, 4.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-05', 'DOC #27 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-05 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(206, 1, 4.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-06', 'DOC #28 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-05 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(207, 1, 4.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-06', 'DOC #28 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-06 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(208, 1, 4.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-06', 'DOC #28 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-06 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(209, 1, 4.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-06', 'DOC #28 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-06 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(210, 1, 4.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-06', 'DOC #28 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-06 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(211, 1, 4.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-07', 'DOC #29 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-06 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(212, 1, 4.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-07', 'DOC #29 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-07 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(213, 1, 4.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-07', 'DOC #29 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-07 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(214, 1, 4.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-07', 'DOC #29 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-07 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(215, 1, 4.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-07', 'DOC #29 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-07 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(216, 1, 4.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-08', 'DOC #30 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-07 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(217, 1, 4.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-08', 'DOC #30 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-08 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(218, 1, 4.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-08', 'DOC #30 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-08 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(219, 1, 4.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-08', 'DOC #30 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-08 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(220, 1, 4.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-08', 'DOC #30 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-08 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(221, 1, 4.00, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-09', 'DOC #31 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-08 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(222, 1, 4.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-09', 'DOC #31 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-09 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(223, 1, 4.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-09', 'DOC #31 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-09 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(224, 1, 4.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-09', 'DOC #31 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sano Top-S', '2026-09-09 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(225, 1, 4.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-09', 'DOC #31 [Grow-out Stage (Grower)]: 4000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-09 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4000.00),
(226, 1, 4.95, 'Tateh - Grower #2', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-10', 'DOC #32 [Grow-out Stage (Grower)]: 4950g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-09 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 4950.00),
(227, 1, 5.00, 'Tateh - Grower #2', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-10', 'DOC #32 [Grow-out Stage (Grower)]: 5000g Tateh - Grower #2 with Sano Top-S', '2026-09-10 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 5000.00),
(228, 1, 5.00, 'Tateh - Grower #2', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-10', 'DOC #32 [Grow-out Stage (Grower)]: 5000g Tateh - Grower #2 with Sanolife PRO-2', '2026-09-10 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 5000.00),
(229, 1, 5.00, 'Tateh - Grower #2', '3:00 PM', 'Grower', 1, 'Sano Top-S', '2026-09-10', 'DOC #32 [Grow-out Stage (Grower)]: 5000g Tateh - Grower #2 with Sano Top-S', '2026-09-10 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 5000.00),
(230, 1, 5.00, 'Tateh - Grower #2', '6:00 PM', 'Grower', 1, 'Sanolife PRO-2, Sano Top-S', '2026-09-10', 'DOC #32 [Grow-out Stage (Grower)]: 5000g Tateh - Grower #2 with Sanolife PRO-2, Sano Top-S', '2026-09-10 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 5000.00),
(231, 1, 5.00, 'Tateh - Grower #1', '6:00 AM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-11', 'DOC #33 [Grow-out Stage (Grower)]: 5000g Tateh - Grower #1 with Sanolife PRO-2', '2026-09-10 22:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 5000.00),
(232, 1, 5.00, 'Tateh - Grower #1', '9:00 AM', 'Grower', 1, 'Sano Top-S', '2026-09-11', 'DOC #33 [Grow-out Stage (Grower)]: 5000g Tateh - Grower #1 with Sano Top-S', '2026-09-11 01:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 5000.00),
(233, 1, 5.00, 'Tateh - Grower #1', '12:00 PM', 'Grower', 1, 'Sanolife PRO-2', '2026-09-11', 'DOC #33 [Grow-out Stage (Grower)]: 5000g Tateh - Grower #1 with Sanolife PRO-2', '2026-09-11 04:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 5000.00),
(234, 1, 0.00, 'Tateh - Grower #1', '3:00 PM', 'Grower', 0, 'None', '2026-09-11', 'DOC #33 [Grow-out Stage (Grower)]: 0g (Wala pang pakain)', '2026-09-11 07:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 0.00),
(235, 1, 0.00, 'Tateh - Grower #1', '6:00 PM', 'Grower', 0, 'None', '2026-09-11', 'DOC #33 [Grow-out Stage (Grower)]: 0g (Wala pang pakain)', '2026-09-11 10:00:00', 'Cj Arroyo', 6, NULL, 4, NULL, NULL, NULL, NULL, 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `harvest_adjustments`
--

CREATE TABLE `harvest_adjustments` (
  `adjustment_id` int(11) NOT NULL,
  `pond_id` int(11) NOT NULL,
  `adjustment_type` varchar(80) NOT NULL,
  `percentage` decimal(8,2) NOT NULL DEFAULT 0.00,
  `reason` text NOT NULL,
  `supporting_record_id` int(11) DEFAULT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `harvest_history`
--

CREATE TABLE `harvest_history` (
  `harvest_id` int(11) NOT NULL,
  `pond_id` int(11) NOT NULL,
  `total_feed_consumed_kg` decimal(12,2) NOT NULL DEFAULT 0.00,
  `predicted_harvest_kg` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `actual_harvest_kg` decimal(12,2) NOT NULL DEFAULT 0.00,
  `absolute_error_kg` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `percentage_error` decimal(8,2) NOT NULL DEFAULT 0.00,
  `actual_harvest_date` date NOT NULL,
  `recorded_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `harvest_predictions`
--

CREATE TABLE `harvest_predictions` (
  `id` int(11) NOT NULL,
  `pond_id` int(11) NOT NULL,
  `total_feed_consumed_kg` decimal(12,2) NOT NULL DEFAULT 0.00,
  `baseline_ratio` decimal(8,4) NOT NULL DEFAULT 0.7333,
  `baseline_harvest_kg` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `adjusted_harvest_kg` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `predicted_harvest_tons` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `feed_progress_percentage` decimal(8,2) NOT NULL DEFAULT 0.00,
  `readiness_status` varchar(50) NOT NULL DEFAULT 'Not Ready',
  `adjustment_percentage` decimal(8,2) NOT NULL DEFAULT 0.00,
  `adjustment_reason` text DEFAULT NULL,
  `prediction_method` varchar(150) NOT NULL DEFAULT 'Caretaker Historical Feed-to-Harvest Baseline',
  `calculated_at` datetime DEFAULT current_timestamp(),
  `created_by` varchar(100) DEFAULT 'System',
  `estimated_harvest` decimal(10,2) NOT NULL,
  `average_weight` decimal(10,2) NOT NULL,
  `biomass` decimal(10,2) NOT NULL,
  `survival_rate` decimal(5,2) NOT NULL,
  `recommendation` text DEFAULT NULL,
  `prediction_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `harvest_predictions`
--

INSERT INTO `harvest_predictions` (`id`, `pond_id`, `total_feed_consumed_kg`, `baseline_ratio`, `baseline_harvest_kg`, `adjusted_harvest_kg`, `predicted_harvest_tons`, `feed_progress_percentage`, `readiness_status`, `adjustment_percentage`, `adjustment_reason`, `prediction_method`, `calculated_at`, `created_by`, `estimated_harvest`, `average_weight`, `biomass`, `survival_rate`, `recommendation`, `prediction_date`, `created_at`) VALUES
(3, 1, 1.00, 0.7333, 0.7333, 0.7333, 0.0007, 0.01, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-07-26 20:00:55', 'System', 0.73, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-07-26', '2026-07-26 11:59:25'),
(4, 2, 12.00, 0.7333, 8.8000, 8.8000, 0.0088, 0.08, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-07-26 20:00:55', 'System', 8.80, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-07-26', '2026-07-26 12:00:54'),
(5, 1, 6.00, 0.7333, 4.4000, 4.4000, 0.0044, 0.04, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-07-27 12:17:51', 'System', 4.40, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-07-27', '2026-07-27 04:02:10'),
(6, 2, 12.00, 0.7333, 8.8000, 8.8000, 0.0088, 0.08, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-07-27 12:17:51', 'System', 8.80, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-07-27', '2026-07-27 04:02:10'),
(7, 1, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-11 21:29:05', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-11', '2026-09-11 07:36:19'),
(8, 2, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-11 21:29:05', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-11', '2026-09-11 07:36:19'),
(9, 3, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-11 21:29:05', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-11', '2026-09-11 07:36:19'),
(10, 4, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-11 21:29:05', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-11', '2026-09-11 07:36:19'),
(11, 5, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-11 21:29:05', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-11', '2026-09-11 07:36:19'),
(12, 6, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-11 21:29:05', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-11', '2026-09-11 07:36:19'),
(13, 7, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-11 21:29:05', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-11', '2026-09-11 07:36:19'),
(14, 1, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-16 14:57:29', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-16', '2026-09-16 06:43:53'),
(15, 2, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-16 14:57:29', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-16', '2026-09-16 06:43:53'),
(16, 3, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-16 14:57:29', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-16', '2026-09-16 06:43:53'),
(17, 4, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-16 14:57:29', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-16', '2026-09-16 06:43:53'),
(18, 5, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-16 14:57:29', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-16', '2026-09-16 06:43:53'),
(19, 6, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-16 14:57:29', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-16', '2026-09-16 06:43:53'),
(20, 7, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-16 14:57:29', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-16', '2026-09-16 06:43:53'),
(21, 1, 356.70, 0.7333, 261.5800, 261.5800, 0.2616, 2.38, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-21 20:55:30', 'System', 261.58, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-21', '2026-09-21 12:10:52'),
(22, 4, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-21 20:55:30', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-21', '2026-09-21 12:10:52'),
(23, 5, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-21 20:55:30', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-21', '2026-09-21 12:10:52'),
(24, 6, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-21 20:55:30', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-21', '2026-09-21 12:10:52'),
(25, 7, 90.00, 0.7333, 66.0000, 66.0000, 0.0660, 0.60, 'Not Ready', 0.00, 'None', 'Caretaker Historical Feed-to-Harvest Baseline', '2026-09-21 20:55:30', 'System', 66.00, 0.00, 0.00, 0.00, 'Estimate is based on caretaker historical data: about 15,000 kg feed produces around 11 tons of shrimp per pond. Final harvest readiness must be confirmed by the farm administrator.', '2026-09-21', '2026-09-21 12:10:52');

-- --------------------------------------------------------

--
-- Table structure for table `maintenance_reports`
--

CREATE TABLE `maintenance_reports` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `caretaker_name` varchar(150) NOT NULL,
  `pond_id` int(11) DEFAULT NULL,
  `pond_name` varchar(100) NOT NULL,
  `problem_type` varchar(100) NOT NULL,
  `specific_issue` varchar(255) NOT NULL,
  `severity_level` varchar(50) NOT NULL DEFAULT 'Medium',
  `description` text NOT NULL,
  `suggested_action` text DEFAULT NULL,
  `photo_url` text DEFAULT NULL,
  `video_url` varchar(255) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'Pending',
  `admin_notes` text DEFAULT NULL,
  `resolved_by` varchar(150) DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `maintenance_reports`
--

INSERT INTO `maintenance_reports` (`id`, `user_id`, `caretaker_name`, `pond_id`, `pond_name`, `problem_type`, `specific_issue`, `severity_level`, `description`, `suggested_action`, `photo_url`, `video_url`, `status`, `admin_notes`, `resolved_by`, `resolved_at`, `created_at`) VALUES
(1, 1, 'Maria Santos', 1, 'Pond A1', 'Equipment', 'Aerator Pump Not Working', 'High', 'Calculated low aeration. Aerator motor pump in Pond A1 stopped rotating since 8:00 AM.', 'Inspect electrical breaker or replace motor pump', '', '', 'In Progress', '', 'Admin', NULL, '2026-07-24 02:20:24'),
(2, 5, 'Lara camille', 4, 'Pond B1', 'Equipment', 'Pump Not Working', 'High', 'Inayos ko na po ayaw pa din', '', '', '', 'Done', 'Issue resolved and verified by admin.', 'Admin', '2026-07-26 09:35:12', '2026-07-24 02:24:00'),
(3, 5, 'Lara camille', 9, 'Pond C3', 'Maintenance', 'Needs Filter Replacement', 'Medium', 'Sira na po!!!!!!!!!!!!!!', 'Need Na Palitan!!!!!!!!1', '/shrim_predict_api/backend/uploads/reports/report_1784860209_6123c53a.jpg', '/shrim_predict_api/backend/uploads/reports/report_1784860235_619c324b.mp4', 'Done', 'Issue resolved and verified by admin.', 'Admin', '2026-07-24 10:39:42', '2026-07-24 02:30:42'),
(4, 5, 'Lara camille', 7, 'Pond 7', 'Equipment', 'Equipment', 'Medium', 'emeee', '', 'http://localhost/shrim_predict_api/backend/uploads/reports/report_1785023327_09c51483.jpg', 'http://localhost/shrim_predict_api/backend/uploads/reports/report_1785023334_e0cf3afc.mp4', 'Pending', NULL, NULL, NULL, '2026-07-25 23:49:10'),
(5, 6, 'Cj Arroyo', 1, 'Pond A1', 'Equipment', 'Pump Not Working', 'High', 'Now working', 'Need to change', 'http://localhost/shrim_predict_api/backend/uploads/reports/report_1785121255_0dfbab44.jpg', '', 'Done', 'Issue resolved and verified by admin.', 'Admin', '2026-07-27 11:03:44', '2026-07-27 03:01:04'),
(6, 8, 'Re Villela', 7, 'Pond C1', 'Equipment', 'Pump Not Working', 'Medium', 'Broken!', '', 'http://localhost/shrim_predict_api/backend/uploads/reports/report_1785133643_c474bca2.jpg', '', 'Pending', NULL, NULL, NULL, '2026-07-27 06:27:30'),
(7, 8, 'Re Villela', 7, 'Pond C1', 'Disease / Sick Shrimp', 'Dead Shrimp Observed', 'Medium', 'The shrimp is not moving', '', 'http://localhost/shrim_predict_api/backend/uploads/reports/report_1785133711_7b4383a8.jpg', '', 'Pending', NULL, NULL, NULL, '2026-07-27 06:28:51'),
(8, 8, 'Re Villela', 7, 'Pond C1', 'Disease / Sick Shrimp', 'Dead Shrimp Observed', 'Medium', 'Thee shrimp is dead', '', 'http://localhost/shrim_predict_api/backend/uploads/reports/report_1785150089_31b250a4.jpg', '', 'Done', 'Issue resolved and verified by admin.', 'Admin', '2026-07-27 19:04:59', '2026-07-27 11:01:43');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL DEFAULT 'Notification',
  `message` text NOT NULL,
  `caretaker_name` varchar(150) DEFAULT NULL,
  `action_type` varchar(50) DEFAULT 'general',
  `pond_name` varchar(100) DEFAULT NULL,
  `target_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `status` varchar(20) DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `caretaker_name`, `action_type`, `pond_name`, `target_id`, `is_read`, `status`, `created_at`) VALUES
(1, 1, 'Notification', 'New disease report uploaded.', NULL, 'general', NULL, NULL, 1, 'active', '2026-07-22 14:36:45'),
(2, 2, 'Notification', 'Feeding schedule updated.', NULL, 'general', NULL, NULL, 1, 'active', '2026-07-22 14:36:45'),
(3, 1, 'Feeding Record Logged', 'Maria Santos logged 15.5kg of Starter feed for Pond A1 at 9:00 AM.', 'Maria Santos', 'feeding', 'Pond A1', NULL, 1, 'active', '2026-07-24 01:23:52'),
(5, 1, 'Feeding Record Logged', 'Maria Santos logged 18.25kg of Grower feed for Pond A1 at 3:00 PM.', 'Maria Santos', 'feeding', 'Pond A1', NULL, 1, 'active', '2026-07-24 01:35:24'),
(6, 5, 'Feeding Record Logged', 'Lara camille logged 12kg of Grower feed for Pond B1 at 9:00 AM.', 'Lara camille', 'feeding', 'Pond B1', NULL, 1, 'active', '2026-07-24 01:37:54'),
(8, 1, 'Feeding Record Logged', 'Maria Santos logged 20kg of Grower feed for Pond A1 at 6:00 PM.', 'Maria Santos', 'feeding', 'Pond A1', NULL, 1, 'active', '2026-07-24 01:40:44'),
(9, 5, 'Feeding Record Logged', 'Lara camille logged 11kg of Starter feed for Pond B1 at 6:00 PM.', 'Lara camille', 'feeding', 'Pond B1', NULL, 1, 'active', '2026-07-24 01:43:42'),
(10, 1, 'New Maintenance Report: High Severity', 'Maria Santos reported an issue for Pond A1: Aerator Pump Not Working (Equipment).', 'Maria Santos', 'maintenance', 'Pond A1', NULL, 1, 'active', '2026-07-24 02:20:24'),
(11, 5, 'New Maintenance Report: High Severity', 'Lara camille reported an issue for Pond B1: Pump Not Working (Equipment).', 'Lara camille', 'maintenance', 'Pond B1', NULL, 1, 'active', '2026-07-24 02:24:00'),
(12, 5, 'New Maintenance Report: Medium Severity', 'Lara camille reported an issue for Pond C3: Needs Filter Replacement (Maintenance).', 'Lara camille', 'maintenance', 'Pond C3', NULL, 1, 'active', '2026-07-24 02:30:43'),
(13, NULL, 'Disease Scan Submitted', 'Caretaker scanned for disease: White Spot Syndrome with 93% confidence (High Risk).', 'Caretaker', 'disease_scan', 'General Pond', NULL, 1, 'active', '2026-07-25 05:12:43'),
(14, NULL, 'Disease Scan Submitted', 'Caretaker scanned for disease: White Spot Syndrome with 93% confidence (High Risk).', 'Caretaker', 'disease_scan', 'General Pond', NULL, 1, 'active', '2026-07-25 05:13:00'),
(15, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome with 82%% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-25 05:14:36'),
(16, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: Healthy with 76.11% confidence (Low Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-25 23:46:12'),
(17, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: Healthy with 76.11% confidence (Low Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-25 23:46:31'),
(18, 5, 'New Maintenance Report: Medium Severity', 'Lara camille reported an issue for Pond 7: Equipment (Equipment).', 'Lara camille', 'maintenance', 'Pond 7', NULL, 1, 'active', '2026-07-25 23:49:10'),
(19, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: Needs Review - Possible WSSV with 55% confidence (Medium Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-25 23:51:28'),
(20, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:22:32'),
(21, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:22:32'),
(22, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:27:50'),
(23, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:28:02'),
(24, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:28:14'),
(25, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:30:44'),
(26, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:30:44'),
(27, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:31:30'),
(28, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:31:39'),
(29, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:32:23'),
(30, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:32:48'),
(31, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:33:30'),
(32, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: White Spot Syndrome Virus (WSSV) with 78% confidence (High Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:34:21'),
(33, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 82% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:37:47'),
(34, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 75% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:37:47'),
(35, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 61.29% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:37:48'),
(36, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 75% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:37:48'),
(37, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 75% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:38:39'),
(38, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 75% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:38:39'),
(39, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 75% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:38:40'),
(40, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 75% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:38:40'),
(41, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 82% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:41:06'),
(42, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 66.23% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:41:06'),
(43, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 82% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:41:06'),
(44, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 82% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:41:07'),
(45, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:42:54'),
(46, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:42:54'),
(47, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:42:55'),
(48, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:42:55'),
(49, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 82% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:44:26'),
(50, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 82% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:44:26'),
(51, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 82% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:44:26'),
(52, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: White Spot Syndrome Virus (WSSV) with 82% confidence (High Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:44:27'),
(53, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:45:30'),
(54, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:45:30'),
(55, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:45:30'),
(56, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:45:30'),
(57, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: Healthy with 80% confidence (Low Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:46:36'),
(58, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: Healthy with 80% confidence (Low Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 00:46:56'),
(59, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:54:56'),
(60, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:54:57'),
(61, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:54:57'),
(62, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:54:57'),
(63, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:56:56'),
(64, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:56:56'),
(65, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:56:56'),
(66, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 00:56:56'),
(67, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 01:01:06'),
(68, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 01:01:06'),
(69, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 01:01:07'),
(70, NULL, 'Disease Scan Submitted', 'Test Caretaker scanned for disease: Healthy with 80% confidence (Low Risk).', 'Test Caretaker', 'disease_scan', 'Pond A1', NULL, 1, 'active', '2026-07-26 01:01:07'),
(71, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: Healthy with 80% confidence (Low Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 01:25:08'),
(72, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: Healthy with 80% confidence (Low Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 01:25:41'),
(73, NULL, 'Disease Scan Submitted', 'Lara camille scanned for disease: Healthy with 80% confidence (Low Risk).', 'Lara camille', 'disease_scan', 'Pond 7', NULL, 1, 'active', '2026-07-26 01:26:00'),
(74, 5, 'Disease Scan Submitted', 'Lara camille scanned for disease: Healthy with 80% confidence (Low Risk).', 'Lara camille', 'disease_scan', 'Pond 7', 63, 1, 'active', '2026-07-26 01:54:40'),
(75, 5, 'Disease Scan Submitted', 'Lara camille scanned for disease: Healthy with 80% confidence (Low Risk).', 'Lara camille', 'disease_scan', 'Pond 7', 64, 1, 'active', '2026-07-26 01:55:16'),
(76, 6, 'Feeding Record Logged', 'Cj Arroyo logged 1kg of Starter feed for Pond A1 at 6:00 AM.', 'Cj Arroyo', 'feeding', 'Pond A1', NULL, 1, 'active', '2026-07-26 11:18:52'),
(77, 6, 'Feeding Record Logged', 'Cj Arroyo logged 12kg of Starter feed for Pond A2 at 6:00 AM.', 'Cj Arroyo', 'feeding', 'Pond A2', NULL, 1, 'active', '2026-07-26 12:00:38'),
(78, 6, 'New Maintenance Report: High Severity', 'Cj Arroyo reported an issue for Pond A1: Pump Not Working (Equipment).', 'Cj Arroyo', 'maintenance', 'Pond A1', 5, 1, 'active', '2026-07-27 03:01:04'),
(79, 6, 'Report Update: Pond A1 (In Progress)', 'Admin Admin marked your maintenance report \'Pump Not Working\' as In Progress.', 'System Admin', 'report_update', 'Pond A1', 5, 1, 'active', '2026-07-27 03:02:50'),
(80, 6, 'Report Update: Pond A1 (Done)', 'Admin Admin marked your maintenance report \'Pump Not Working\' as Done. Note: Issue resolved and verified by admin.', 'System Admin', 'report_update', 'Pond A1', 5, 1, 'active', '2026-07-27 03:03:44'),
(81, 6, 'Feeding Record Logged', 'Cj Arroyo logged 5kg of Starter feed for Pond A1 at 6:00 AM.', 'Cj Arroyo', 'feeding', 'Pond A1', NULL, 1, 'active', '2026-07-27 03:18:53'),
(82, 6, 'Feeding Record Logged', 'Cj Arroyo logged 9kg of Grower feed for Pond A1 at 9:00 AM.', 'Cj Arroyo', 'feeding', 'Pond A1', NULL, 1, 'active', '2026-07-27 06:22:16'),
(83, 6, 'Feeding Record Logged', 'Cj Arroyo logged 0.2kg of Grower feed for Pond A1 at 12:00 PM.', 'Cj Arroyo', 'feeding', 'Pond A1', NULL, 0, 'active', '2026-07-27 06:22:52'),
(84, 8, 'Feeding Record Logged', 'Re Villela logged 10kg of Starter feed for Pond C1 at 6:00 AM.', 'Re Villela', 'feeding', 'Pond C1', NULL, 0, 'active', '2026-07-27 06:25:13'),
(85, 8, 'Feeding Record Logged', 'Re Villela logged 5kg of Starter feed for Pond C1 at 9:00 AM.', 'Re Villela', 'feeding', 'Pond C1', NULL, 0, 'active', '2026-07-27 06:25:24'),
(86, 8, 'Feeding Record Logged', 'Re Villela logged 8kg of Grower feed for Pond C1 at 12:00 PM.', 'Re Villela', 'feeding', 'Pond C1', NULL, 0, 'active', '2026-07-27 06:25:37'),
(87, 8, 'Feeding Record Logged', 'Re Villela logged 10kg of Grower feed for Pond C1 at 3:00 PM.', 'Re Villela', 'feeding', 'Pond C1', NULL, 0, 'active', '2026-07-27 06:25:48'),
(88, 8, 'Feeding Record Logged', 'Re Villela logged 10kg of Grower feed for Pond C1 at 6:00 PM.', 'Re Villela', 'feeding', 'Pond C1', NULL, 0, 'active', '2026-07-27 06:26:00'),
(89, NULL, 'New Maintenance Report: Medium Severity', 'Re Villela reported an issue for Pond C1: Pump Not Working (Equipment).', 'Re Villela', 'maintenance', 'Pond C1', 6, 0, 'active', '2026-07-27 06:27:30'),
(90, NULL, 'New Maintenance Report: Medium Severity', 'Re Villela reported an issue for Pond C1: Dead Shrimp Observed (Disease / Sick Shrimp).', 'Re Villela', 'maintenance', 'Pond C1', 7, 0, 'active', '2026-07-27 06:28:51'),
(91, 6, 'Feeding Record Logged', 'Cj Arroyo logged 10kg of Starter feed for Pond A1 at 3:00 PM.', 'Cj Arroyo', 'feeding', 'Pond A1', NULL, 0, 'active', '2026-07-27 06:30:52'),
(92, 6, 'Feeding Record Logged', 'Cj Arroyo logged 12kg of Starter feed for Pond A1 at 6:00 PM.', 'Cj Arroyo', 'feeding', 'Pond A1', NULL, 0, 'active', '2026-07-27 06:30:57'),
(93, 6, 'Feeding Record Logged', 'Cj Arroyo logged 10kg of Starter feed for Pond A2 at 6:00 AM.', 'Cj Arroyo', 'feeding', 'Pond A2', NULL, 0, 'active', '2026-07-27 06:31:06'),
(94, 6, 'Feeding Record Logged', 'Cj Arroyo logged 5kg of Starter feed for Pond A2 at 9:00 AM.', 'Cj Arroyo', 'feeding', 'Pond A2', NULL, 0, 'active', '2026-07-27 06:31:14'),
(95, 6, 'Feeding Record Logged', 'Cj Arroyo logged 10kg of Starter feed for Pond A2 at 3:00 PM.', 'Cj Arroyo', 'feeding', 'Pond A2', NULL, 0, 'active', '2026-07-27 06:31:20'),
(96, 6, 'Feeding Record Logged', 'Cj Arroyo logged 12kg of Starter feed for Pond A2 at 6:00 PM.', 'Cj Arroyo', 'feeding', 'Pond A2', NULL, 0, 'active', '2026-07-27 06:31:26'),
(97, 6, 'Feeding Record Logged', 'Cj Arroyo logged 10kg of Grower feed for Pond A3 at 6:00 AM.', 'Cj Arroyo', 'feeding', 'Pond A3', NULL, 0, 'active', '2026-07-27 06:31:38'),
(98, 6, 'Feeding Record Logged', 'Cj Arroyo logged 12kg of Starter feed for Pond A3 at 9:00 AM.', 'Cj Arroyo', 'feeding', 'Pond A3', NULL, 0, 'active', '2026-07-27 06:31:44'),
(99, 6, 'Feeding Record Logged', 'Cj Arroyo logged 12kg of Starter feed for Pond A3 at 12:00 PM.', 'Cj Arroyo', 'feeding', 'Pond A3', NULL, 0, 'active', '2026-07-27 06:31:50'),
(100, 6, 'Feeding Record Logged', 'Cj Arroyo logged 10kg of Grower feed for Pond A3 at 3:00 PM.', 'Cj Arroyo', 'feeding', 'Pond A3', NULL, 0, 'active', '2026-07-27 06:31:57'),
(101, 6, 'Feeding Record Logged', 'Cj Arroyo logged 10kg of Starter feed for Pond A3 at 6:00 PM.', 'Cj Arroyo', 'feeding', 'Pond A3', NULL, 0, 'active', '2026-07-27 06:32:04'),
(102, 7, 'Feeding Record Logged', 'Rc Javier logged 10kg of Starter feed for Pond B1 at 6:00 AM.', 'Rc Javier', 'feeding', 'Pond B1', NULL, 0, 'active', '2026-07-27 09:15:33'),
(103, 7, 'Feeding Record Logged', 'Rc Javier logged 10kg of Starter feed for Pond B1 at 9:00 AM.', 'Rc Javier', 'feeding', 'Pond B1', NULL, 0, 'active', '2026-07-27 09:16:18'),
(104, 7, 'Feeding Record Logged', 'Rc Javier logged 10kg of Starter feed for Pond B1 at 12:00 PM.', 'Rc Javier', 'feeding', 'Pond B1', NULL, 0, 'active', '2026-07-27 09:16:37'),
(105, 7, 'Feeding Record Logged', 'Rc Javier logged 12kg of Starter feed for Pond B1 at 3:00 PM.', 'Rc Javier', 'feeding', 'Pond B1', NULL, 0, 'active', '2026-07-27 09:18:37'),
(106, 7, 'Feeding Record Logged', 'Rc Javier logged 14kg of Starter feed for Pond B1 at 6:00 PM.', 'Rc Javier', 'feeding', 'Pond B1', NULL, 1, 'active', '2026-07-27 09:18:59'),
(107, NULL, 'New Maintenance Report: Medium Severity', 'Re Villela reported an issue for Pond C1: Dead Shrimp Observed (Disease / Sick Shrimp).', 'Re Villela', 'maintenance', 'Pond C1', 8, 1, 'active', '2026-07-27 11:01:43'),
(108, 8, 'Report Resolved: Done (Pond C1)', 'Admin Admin marked your maintenance report \'Dead Shrimp Observed\' as Done (Resolved). Note: Issue resolved and verified by admin.', 'System Admin', 'report_update', 'Pond C1', 8, 0, 'active', '2026-07-27 11:04:59'),
(109, NULL, 'Pond Status Logged', 'Cristel Javier created D1 (Status: Unmonitored, Growth: %).', 'Cristel Javier', 'water_quality', 'D1', NULL, 0, 'active', '2026-09-16 06:43:16');

-- --------------------------------------------------------

--
-- Table structure for table `ponds`
--

CREATE TABLE `ponds` (
  `id` int(11) NOT NULL,
  `pond_name` varchar(100) NOT NULL,
  `temperature` decimal(5,2) DEFAULT 0.00,
  `ph_level` decimal(5,2) DEFAULT 0.00,
  `salinity` decimal(5,2) DEFAULT 0.00,
  `dissolved_oxygen` decimal(5,2) DEFAULT 0.00,
  `water_level` decimal(5,2) DEFAULT 0.00,
  `status` varchar(20) DEFAULT 'Unmonitored',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `area_sqm` int(11) DEFAULT 500,
  `stocking_date` date DEFAULT '2026-04-02',
  `growth_percentage` decimal(5,2) DEFAULT 85.00,
  `disease_detection` varchar(150) DEFAULT NULL,
  `disease_confidence` decimal(5,2) DEFAULT 0.00,
  `harvest_readiness` decimal(5,2) DEFAULT 85.00,
  `expected_harvest_date` date DEFAULT '2026-08-10',
  `feed_today_kg` decimal(10,2) DEFAULT 12.00,
  `total_feed_kg` decimal(10,2) DEFAULT 450.00,
  `latest_image` varchar(255) DEFAULT 'uploads/sample.jpg',
  `assigned_caretaker_name` varchar(100) DEFAULT 'Juan Dela Cruz',
  `target_feed_kg` decimal(10,2) DEFAULT 45.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ponds`
--

INSERT INTO `ponds` (`id`, `pond_name`, `temperature`, `ph_level`, `salinity`, `dissolved_oxygen`, `water_level`, `status`, `created_at`, `area_sqm`, `stocking_date`, `growth_percentage`, `disease_detection`, `disease_confidence`, `harvest_readiness`, `expected_harvest_date`, `feed_today_kg`, `total_feed_kg`, `latest_image`, `assigned_caretaker_name`, `target_feed_kg`) VALUES
(1, 'Pond A1', 28.00, 7.50, 15.00, 5.00, 1.20, 'Healthy', '2026-07-25 01:20:24', 500, '2026-08-10', 88.00, 'Healthy', 0.00, 85.00, '2026-08-12', 15.00, 356.70, 'uploads/sample1.jpg', 'Cj Arroyo', 45.00),
(2, 'Pond A2', 28.80, 7.60, 17.50, 6.50, 1.10, 'Healthy', '2026-07-25 01:20:24', 500, '2026-04-15', 90.00, 'Healthy', 0.00, 88.00, '2026-08-15', 10.50, 390.00, 'uploads/sample2.jpg', 'Maria Santos', 45.00),
(3, 'Pond A3', 33.20, 7.10, 24.00, 4.80, 0.80, 'Critical', '2026-07-25 01:20:24', 500, '2026-04-02', 92.00, 'Possible White Spot Disease', 95.00, 92.00, '2026-08-03', 11.00, 420.00, 'uploads/sample3.jpg', 'cristel Javier', 45.00),
(4, 'Pond B1', 31.00, 7.40, 22.50, 5.40, 1.00, 'Warning', '2026-07-25 01:20:24', 500, '2026-03-28', 95.00, 'Suspected Black Gill', 74.00, 95.00, '2026-07-28', 14.00, 510.00, 'uploads/sample4.jpg', 'cristel Javier', 45.00),
(5, 'Pond B2', 30.00, 7.90, 18.50, 6.90, 1.30, 'Healthy', '2026-07-25 01:20:24', 500, '2026-03-20', 100.00, 'Healthy', 0.00, 100.00, '2026-07-25', 15.00, 600.00, 'uploads/sample5.jpg', 'Nicca Kate Arroyo', 45.00),
(6, 'Pond B3', 29.00, 7.70, 18.20, 6.60, 1.20, 'Healthy', '2026-07-25 01:20:24', 500, '2026-04-20', 78.00, 'Healthy', 0.00, 72.00, '2026-08-25', 9.00, 320.00, 'uploads/sample6.jpg', 'Nicca Kate Arroyo', 45.00),
(7, 'Pond C1', 29.20, 7.80, 18.00, 6.70, 1.20, 'Healthy', '2026-07-25 01:20:24', 500, '2026-04-12', 82.00, 'Healthy', 0.00, 79.00, '2026-08-18', 11.00, 380.00, 'uploads/sample7.jpg', 'Lara camille', 45.00),
(11, 'D1', NULL, NULL, NULL, NULL, NULL, 'Unmonitored', '2026-09-16 06:43:16', 500, '2026-09-16', NULL, NULL, 0.00, 0.00, '2026-12-15', 0.00, 0.00, 'uploads/sample.jpg', 'Cristel Javier', 45.00);

-- --------------------------------------------------------

--
-- Table structure for table `pond_caretakers`
--

CREATE TABLE `pond_caretakers` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `assigned_pond_id` int(11) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `role_name`, `description`) VALUES
(1, 'admin', 'Administrator role'),
(2, 'caretaker', 'Pond caretaker role');

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `updated_at`) VALUES
(1, 'max_ponds', '30', '2026-07-25 01:06:02'),
(2, 'default_pond_status', 'Healthy', '2026-07-25 01:06:02'),
(3, 'auto_assign_pond_number', 'ON', '2026-07-25 01:06:02'),
(4, 'target_harvest_age', '120', '2026-07-25 01:06:02'),
(5, 'harvest_ready_percentage', '95', '2026-07-25 01:06:02'),
(6, 'prediction_refresh', 'Daily', '2026-07-25 01:06:02'),
(7, 'receive_disease_alerts', 'ON', '2026-07-25 01:06:02'),
(8, 'receive_harvest_alerts', 'ON', '2026-07-25 01:06:02'),
(9, 'receive_feeding_alerts', 'ON', '2026-07-25 01:06:02'),
(10, 'receive_caretaker_activity_alerts', 'ON', '2026-07-25 01:06:02'),
(11, 'receive_email_notifications', 'OFF', '2026-07-25 01:06:02'),
(12, 'theme', 'Light', '2026-07-25 01:12:41'),
(13, 'language', 'English', '2026-07-25 01:06:02'),
(14, 'date_format', 'MM/DD/YYYY', '2026-07-25 01:06:02'),
(15, 'time_format', '12 Hours', '2026-07-25 01:06:02'),
(16, 'last_backup', 'July 25, 2026 03:13 AM', '2026-07-25 01:13:00'),
(17, 'automatic_backup', 'ON', '2026-07-25 01:06:02'),
(18, 'backup_frequency', 'Weekly', '2026-07-25 01:06:02'),
(31, 'caretaker_theme', 'Dark', '2026-07-27 02:49:04'),
(32, 'caretaker_language', 'English', '2026-07-27 02:49:04'),
(35, 'caretaker_target_feed', '45.0', '2026-07-27 03:59:07'),
(36, 'caretaker_default_slot', '6:00 AM', '2026-07-27 03:59:07'),
(37, 'caretaker_auto_refresh', 'ON', '2026-07-27 03:59:07');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `employee_id` varchar(50) DEFAULT NULL,
  `date_hired` date DEFAULT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'caretaker',
  `status` varchar(20) DEFAULT 'Active',
  `date_archived` datetime DEFAULT NULL,
  `archive_reason` varchar(255) DEFAULT NULL,
  `pond_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `phone` varchar(30) DEFAULT '09123456789',
  `address` text DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `total_logins` int(11) NOT NULL DEFAULT 1,
  `position` varchar(100) DEFAULT 'System Administrator',
  `avatar_path` longtext DEFAULT NULL,
  `two_factor_enabled` tinyint(1) DEFAULT 0,
  `last_login` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `employee_id`, `date_hired`, `full_name`, `email`, `password_hash`, `role`, `status`, `date_archived`, `archive_reason`, `pond_id`, `created_at`, `phone`, `address`, `last_login_at`, `total_logins`, `position`, `avatar_path`, `two_factor_enabled`, `last_login`) VALUES
(6, NULL, NULL, 'Cj Arroyo', 'cj@gmail.com', '$2y$10$BwN6IrHofoLggA88iZ.HluOpDj03AGUppUFwwSS9N2.4B2c7FaKF.', 'caretaker', 'Active', NULL, NULL, 1, '2026-07-26 02:48:58', '09123456789', NULL, NULL, 1, 'Pond Caretaker', '', 0, '2026-07-27 02:42:31'),
(7, NULL, NULL, 'Rc Javier', 'rc@gmail.com', '$2y$10$Rvy36ciaTYutW4QDzTecG.9Gle8uqwaqdtCK.DmPcWP.w9PRr2r4W', 'caretaker', 'Active', NULL, NULL, 4, '2026-07-26 02:49:53', '09123456788', NULL, NULL, 1, 'Pond Caretaker', NULL, 0, '2026-07-26 02:49:53'),
(8, NULL, NULL, 'Re Villela', 're@gmail.com', '$2y$10$.xHuh9ZOWvLlJm2Dobz9ue/ps8R2ejXphV7lpN9.krEkGT/zT09aW', 'caretaker', 'Archived', '2026-07-27 20:58:35', 'Resigned', 7, '2026-07-26 02:51:44', '09123456786', NULL, NULL, 1, 'Pond Caretaker', NULL, 0, '2026-07-27 12:58:35'),
(9, NULL, NULL, 'Administrator', 'admin@shrimpredict.com', '$2y$10$lV7cqnOMv0tV2IzWUyUrjOVbkSFX8Og/B5RcZH2G6Vbtr9Gay4afi', 'admin', 'Active', NULL, NULL, NULL, '2026-07-26 02:54:58', '09123456789', NULL, NULL, 1, 'System Administrator', NULL, 0, '2026-07-26 02:54:58'),
(17, NULL, NULL, 'Cristel Javier', 'cristel@gmail.com', '$2y$10$A06yKzMeeCf0i.DBaIBpwe3vrBLQ8J0S/s1jnNYl9qp3.kV4UOc4e', 'caretaker', 'Active', NULL, NULL, NULL, '2026-09-16 06:32:27', '09999999999', NULL, NULL, 1, 'Pond Caretaker', NULL, 0, '2026-09-16 06:59:29'),
(18, NULL, NULL, 'Cristel Javier', 'cristel3@gmail.com', '$2y$10$/ecftfvVOKTMGp6OO1Okgey4pnf9Bef97NfykehwRxxhbaLVkVXoC', 'caretaker', 'Active', NULL, NULL, 11, '2026-09-16 06:42:19', '09619912981', NULL, NULL, 1, 'Pond Caretaker', NULL, 0, '2026-09-16 06:59:29');

-- --------------------------------------------------------

--
-- Table structure for table `water_quality_records`
--

CREATE TABLE `water_quality_records` (
  `id` int(11) NOT NULL,
  `pond_id` int(11) NOT NULL,
  `caretaker_id` int(11) DEFAULT NULL,
  `recorded_by_name` varchar(100) DEFAULT NULL,
  `dissolved_oxygen` decimal(5,2) NOT NULL DEFAULT 0.00,
  `temperature` decimal(5,2) NOT NULL DEFAULT 0.00,
  `ph_level` decimal(5,2) NOT NULL DEFAULT 0.00,
  `salinity` decimal(5,2) NOT NULL DEFAULT 0.00,
  `capture_mode` enum('device_screen','data_sheet','manual') DEFAULT 'device_screen',
  `ocr_confidence` decimal(5,2) DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `raw_ocr_text` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `record_date` date NOT NULL,
  `recorded_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `water_quality_records`
--

INSERT INTO `water_quality_records` (`id`, `pond_id`, `caretaker_id`, `recorded_by_name`, `dissolved_oxygen`, `temperature`, `ph_level`, `salinity`, `capture_mode`, `ocr_confidence`, `image_path`, `raw_ocr_text`, `notes`, `record_date`, `recorded_at`, `created_at`) VALUES
(2, 1, 6, 'Cj Arroyo', 6.50, 28.50, 7.80, 20.00, 'data_sheet', 98.50, 'uploads/water_quality/wq_1_1789823150_6087.jpg', '{\r\n  \"dissolved_oxygen\": 6.5,\r\n  \"water_temp\": 28.5,\r\n  \"ph_balance\": 7.8,\r\n  \"salinity\": 20,\r\n  \"confidence\": 98.5\r\n}', NULL, '2026-09-19', '2026-09-19 15:05:50', '2026-09-19 13:05:50'),
(3, 1, 6, 'Cj Arroyo', 6.50, 28.50, 7.80, 20.00, 'data_sheet', 98.50, 'uploads/water_quality/wq_1_1789872340_1976.jpg', '{\r\n  \"dissolved_oxygen\": 6.5,\r\n  \"water_temp\": 28.5,\r\n  \"ph_balance\": 7.8,\r\n  \"salinity\": 20,\r\n  \"confidence\": 98.5\r\n}', NULL, '2026-09-20', '2026-09-20 04:45:40', '2026-09-20 02:45:40'),
(4, 1, 6, 'Cj Arroyo', 5.00, 28.00, 7.50, 15.00, 'data_sheet', 98.50, 'uploads/water_quality/wq_1_1789981049_7074.jpg', '{\r\n  \"dissolved_oxygen\": 5,\r\n  \"water_temp\": 28,\r\n  \"ph_balance\": 7.5,\r\n  \"salinity\": 15,\r\n  \"confidence\": 98.5\r\n}', NULL, '2026-09-21', '2026-09-21 10:57:29', '2026-09-21 08:57:29');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_activity_user` (`user_id`);

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_admin_email` (`email`);

--
-- Indexes for table `alerts`
--
ALTER TABLE `alerts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_alert_severity` (`severity`);

--
-- Indexes for table `caretaker_ponds`
--
ALTER TABLE `caretaker_ponds`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_pond` (`user_id`,`pond_id`),
  ADD KEY `pond_id` (`pond_id`),
  ADD KEY `idx_caretaker_ponds_user` (`user_id`);

--
-- Indexes for table `contact_messages`
--
ALTER TABLE `contact_messages`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `disease_reports`
--
ALTER TABLE `disease_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_disease_risk` (`risk_level`);

--
-- Indexes for table `feeding_records`
--
ALTER TABLE `feeding_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `pond_id` (`pond_id`),
  ADD KEY `idx_feeding_date` (`record_date`);

--
-- Indexes for table `harvest_adjustments`
--
ALTER TABLE `harvest_adjustments`
  ADD PRIMARY KEY (`adjustment_id`),
  ADD KEY `pond_id` (`pond_id`);

--
-- Indexes for table `harvest_history`
--
ALTER TABLE `harvest_history`
  ADD PRIMARY KEY (`harvest_id`),
  ADD KEY `pond_id` (`pond_id`);

--
-- Indexes for table `harvest_predictions`
--
ALTER TABLE `harvest_predictions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `pond_id` (`pond_id`),
  ADD KEY `idx_harvest_date` (`prediction_date`);

--
-- Indexes for table `maintenance_reports`
--
ALTER TABLE `maintenance_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_mr_user` (`user_id`),
  ADD KEY `idx_mr_status` (`status`),
  ADD KEY `idx_mr_severity` (`severity_level`),
  ADD KEY `idx_mr_created` (`created_at`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notification_user` (`user_id`);

--
-- Indexes for table `ponds`
--
ALTER TABLE `ponds`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pond_status` (`status`);

--
-- Indexes for table `pond_caretakers`
--
ALTER TABLE `pond_caretakers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_caretaker_email` (`email`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_name` (`role_name`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `pond_id` (`pond_id`),
  ADD KEY `idx_user_role` (`role`);

--
-- Indexes for table `water_quality_records`
--
ALTER TABLE `water_quality_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pond_date` (`pond_id`,`record_date`),
  ADD KEY `idx_caretaker_date` (`caretaker_id`,`record_date`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `alerts`
--
ALTER TABLE `alerts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `caretaker_ponds`
--
ALTER TABLE `caretaker_ponds`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `contact_messages`
--
ALTER TABLE `contact_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `disease_reports`
--
ALTER TABLE `disease_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `feeding_records`
--
ALTER TABLE `feeding_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=236;

--
-- AUTO_INCREMENT for table `harvest_adjustments`
--
ALTER TABLE `harvest_adjustments`
  MODIFY `adjustment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `harvest_history`
--
ALTER TABLE `harvest_history`
  MODIFY `harvest_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `harvest_predictions`
--
ALTER TABLE `harvest_predictions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `maintenance_reports`
--
ALTER TABLE `maintenance_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=110;

--
-- AUTO_INCREMENT for table `ponds`
--
ALTER TABLE `ponds`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `pond_caretakers`
--
ALTER TABLE `pond_caretakers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `water_quality_records`
--
ALTER TABLE `water_quality_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `caretaker_ponds`
--
ALTER TABLE `caretaker_ponds`
  ADD CONSTRAINT `caretaker_ponds_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `caretaker_ponds_ibfk_2` FOREIGN KEY (`pond_id`) REFERENCES `ponds` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `feeding_records`
--
ALTER TABLE `feeding_records`
  ADD CONSTRAINT `feeding_records_ibfk_1` FOREIGN KEY (`pond_id`) REFERENCES `ponds` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `harvest_adjustments`
--
ALTER TABLE `harvest_adjustments`
  ADD CONSTRAINT `harvest_adjustments_ibfk_1` FOREIGN KEY (`pond_id`) REFERENCES `ponds` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `harvest_history`
--
ALTER TABLE `harvest_history`
  ADD CONSTRAINT `harvest_history_ibfk_1` FOREIGN KEY (`pond_id`) REFERENCES `ponds` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `harvest_predictions`
--
ALTER TABLE `harvest_predictions`
  ADD CONSTRAINT `harvest_predictions_ibfk_1` FOREIGN KEY (`pond_id`) REFERENCES `ponds` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`pond_id`) REFERENCES `ponds` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
