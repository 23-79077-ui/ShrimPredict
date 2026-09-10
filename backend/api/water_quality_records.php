<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/notifications_helper.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

// Ensure the water_quality_records table and uploads directory exist
function ensureWaterQualityTable($conn) {
    $tableSql = "
        CREATE TABLE IF NOT EXISTS water_quality_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pond_id INT NOT NULL,
            caretaker_id INT NULL,
            recorded_by_name VARCHAR(100) NULL,
            dissolved_oxygen DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            temperature DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            ph_level DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            salinity DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            capture_mode ENUM('device_screen', 'data_sheet', 'manual') DEFAULT 'device_screen',
            ocr_confidence DECIMAL(5,2) DEFAULT NULL,
            image_path VARCHAR(255) DEFAULT NULL,
            raw_ocr_text TEXT DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            record_date DATE NOT NULL,
            recorded_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pond_date (pond_id, record_date),
            INDEX idx_caretaker_date (caretaker_id, record_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";
    $conn->exec($tableSql);

    $uploadsDir = __DIR__ . '/../uploads/water_quality';
    if (!is_dir($uploadsDir)) {
        @mkdir($uploadsDir, 0777, true);
    }
}

ensureWaterQualityTable($conn);

// Helper function to create an alert if parameters are out of optimal range
function evaluateWaterQualityAlerts($conn, $pondId, $pondName, $caretakerName, $do, $temp, $ph, $salinity) {
    $issues = [];
    $severity = 'Low';

    if ($do < 4.0) {
        $issues[] = "Critical DO level: {$do} mg/L (Below 4.0 mg/L dangerous threshold)";
        $severity = 'Critical';
    } elseif ($do < 5.0) {
        $issues[] = "Low DO level: {$do} mg/L (Below 5.0 mg/L optimal minimum)";
        if ($severity !== 'Critical') $severity = 'High';
    }

    if ($temp >= 34.0) {
        $issues[] = "Critical water temp: {$temp}°C (Above 34.0°C thermal stress threshold)";
        $severity = 'Critical';
    } elseif ($temp >= 32.5) {
        $issues[] = "Elevated water temp: {$temp}°C (Above 32.5°C warning limit)";
        if ($severity !== 'Critical') $severity = 'Medium';
    } elseif ($temp < 24.0) {
        $issues[] = "Low water temp: {$temp}°C (Below 24.0°C metabolic minimum)";
        if ($severity !== 'Critical') $severity = 'Medium';
    }

    if ($ph < 7.0 || $ph > 8.8) {
        $issues[] = "Critical pH level: {$ph} (Outside safe 7.0 - 8.8 range)";
        $severity = 'Critical';
    } elseif ($ph < 7.5 || $ph > 8.5) {
        $issues[] = "Abnormal pH level: {$ph} (Sub-optimal, target is 7.5 - 8.3)";
        if ($severity !== 'Critical' && $severity !== 'High') $severity = 'Medium';
    }

    if ($salinity < 10.0 || $salinity > 35.0) {
        $issues[] = "Extreme salinity: {$salinity} ppt (Outside 10.0 - 35.0 ppt range)";
        if ($severity !== 'Critical') $severity = 'High';
    } elseif ($salinity < 15.0 || $salinity > 28.0) {
        $issues[] = "Sub-optimal salinity: {$salinity} ppt (Target is 15.0 - 28.0 ppt)";
        if ($severity === 'Low') $severity = 'Medium';
    }

    if (!empty($issues)) {
        $issueText = implode('; ', $issues);
        $title = "Water Quality Anomaly: {$pondName}";
        $message = "{$issueText}. Recorded by {$caretakerName}. Immediate corrective aeration or water exchange recommended.";

        try {
            $alertStmt = $conn->prepare('
                INSERT INTO alerts (pond_id, alert_type, title, message, severity, status, created_at)
                VALUES (:pond_id, :alert_type, :title, :message, :severity, "Open", NOW())
            ');
            $alertStmt->execute([
                ':pond_id' => $pondId,
                ':alert_type' => 'Water Quality',
                ':title' => $title,
                ':message' => $message,
                ':severity' => $severity,
            ]);
        } catch (Throwable $e) {
            // Non-blocking alert failure
        }
    }
}

// -------------------------------------------------------------------------
// GET REQUEST: Check status or fetch records
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $pondId = isset($_GET['pond_id']) ? (int)$_GET['pond_id'] : 0;
    $caretakerId = isset($_GET['caretaker_id']) ? (int)$_GET['caretaker_id'] : 0;
    $date = isset($_GET['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date']) ? $_GET['date'] : date('Y-m-d');
    $fetchAll = isset($_GET['all']) && $_GET['all'] == '1';

    try {
        // Mode A: Fetch single pond's status for the specified date
        if ($pondId > 0 && !$fetchAll) {
            $stmt = $conn->prepare('
                SELECT wqr.*, p.pond_name, p.location
                FROM water_quality_records wqr
                LEFT JOIN ponds p ON wqr.pond_id = p.id
                WHERE wqr.pond_id = :pond_id AND wqr.record_date = :record_date
                ORDER BY wqr.id DESC
                LIMIT 1
            ');
            $stmt->execute([':pond_id' => $pondId, ':record_date' => $date]);
            $record = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'pond_id' => $pondId,
                'date' => $date,
                'is_verified' => !empty($record),
                'record' => $record ?: null,
            ]);
            exit;
        }

        // Mode B: Fetch checklist status for all ponds assigned to a caretaker
        if ($caretakerId > 0 && !$fetchAll) {
            // Find all ponds assigned to this caretaker
            $pondStmt = $conn->prepare('
                SELECT DISTINCT p.id, p.pond_name, p.status, p.location,
                       p.dissolved_oxygen, p.temperature, p.ph_level, p.salinity
                FROM ponds p
                INNER JOIN caretaker_ponds cp ON p.id = cp.pond_id
                WHERE cp.user_id = :caretaker_id
                ORDER BY p.pond_name ASC
            ');
            $pondStmt->execute([':caretaker_id' => $caretakerId]);
            $assignedPonds = $pondStmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($assignedPonds)) {
                // Fallback to legacy single-pond assignment on users table
                $legacyStmt = $conn->prepare('SELECT pond_id FROM users WHERE id = :user_id LIMIT 1');
                $legacyStmt->execute([':user_id' => $caretakerId]);
                $legacyPondId = (int)$legacyStmt->fetchColumn();
                if ($legacyPondId > 0) {
                    $pStmt = $conn->prepare('SELECT id, pond_name, status, location, dissolved_oxygen, temperature, ph_level, salinity FROM ponds WHERE id = :pid');
                    $pStmt->execute([':pid' => $legacyPondId]);
                    $assignedPonds = $pStmt->fetchAll(PDO::FETCH_ASSOC);
                }
            }

            // For each assigned pond, check if a water quality record exists for today
            $checklist = [];
            $verifiedCount = 0;

            foreach ($assignedPonds as $pond) {
                $pid = (int)$pond['id'];
                $checkStmt = $conn->prepare('
                    SELECT * FROM water_quality_records
                    WHERE pond_id = :pid AND record_date = :rdate
                    ORDER BY id DESC LIMIT 1
                ');
                $checkStmt->execute([':pid' => $pid, ':rdate' => $date]);
                $todayRecord = $checkStmt->fetch(PDO::FETCH_ASSOC);

                $isVerified = !empty($todayRecord);
                if ($isVerified) $verifiedCount++;

                $checklist[] = [
                    'pond_id' => $pid,
                    'pond_name' => $pond['pond_name'],
                    'location' => $pond['location'],
                    'current_status' => $pond['status'],
                    'is_verified_today' => $isVerified,
                    'today_record' => $todayRecord ?: null,
                    'latest_readings' => [
                        'dissolved_oxygen' => $todayRecord ? (float)$todayRecord['dissolved_oxygen'] : (float)$pond['dissolved_oxygen'],
                        'temperature' => $todayRecord ? (float)$todayRecord['temperature'] : (float)$pond['temperature'],
                        'ph_level' => $todayRecord ? (float)$todayRecord['ph_level'] : (float)$pond['ph_level'],
                        'salinity' => $todayRecord ? (float)$todayRecord['salinity'] : (float)$pond['salinity'],
                    ],
                ];
            }

            echo json_encode([
                'success' => true,
                'caretaker_id' => $caretakerId,
                'date' => $date,
                'total_assigned' => count($assignedPonds),
                'verified_count' => $verifiedCount,
                'is_all_completed' => count($assignedPonds) > 0 && $verifiedCount === count($assignedPonds),
                'checklist' => $checklist,
            ]);
            exit;
        }

        // Mode C: Admin list / History
        $query = '
            SELECT wqr.*, p.pond_name, p.location
            FROM water_quality_records wqr
            LEFT JOIN ponds p ON wqr.pond_id = p.id
            WHERE 1=1
        ';
        $params = [];

        if ($pondId > 0) {
            $query .= ' AND wqr.pond_id = :pond_id';
            $params[':pond_id'] = $pondId;
        }
        if (isset($_GET['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date'])) {
            $query .= ' AND wqr.record_date = :rdate';
            $params[':rdate'] = $_GET['date'];
        }

        $query .= ' ORDER BY wqr.record_date DESC, wqr.id DESC LIMIT 100';

        $stmt = $conn->prepare($query);
        $stmt->execute($params);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'count' => count($records),
            'records' => $records,
        ]);
        exit;

    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error querying water quality records: ' . $e->getMessage()]);
        exit;
    }
}

// -------------------------------------------------------------------------
// POST REQUEST: Submit verified water quality record
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $pondId = isset($_POST['pond_id']) ? (int)$_POST['pond_id'] : 0;
        $caretakerId = isset($_POST['caretaker_id']) ? (int)$_POST['caretaker_id'] : 0;
        $recordedByName = isset($_POST['recorded_by_name']) ? trim((string)$_POST['recorded_by_name']) : 'Caretaker';

        $dissolvedOxygen = isset($_POST['dissolved_oxygen']) ? (float)$_POST['dissolved_oxygen'] : 0.0;
        $temperature = isset($_POST['temperature']) ? (float)$_POST['temperature'] : 0.0;
        $phLevel = isset($_POST['ph_level']) ? (float)$_POST['ph_level'] : 0.0;
        $salinity = isset($_POST['salinity']) ? (float)$_POST['salinity'] : 0.0;

        $captureMode = isset($_POST['capture_mode']) && in_array($_POST['capture_mode'], ['device_screen', 'data_sheet', 'manual'], true)
            ? $_POST['capture_mode']
            : 'device_screen';

        $ocrConfidence = isset($_POST['ocr_confidence']) && is_numeric($_POST['ocr_confidence'])
            ? (float)$_POST['ocr_confidence']
            : null;

        $rawOcrText = isset($_POST['raw_ocr_text']) ? trim((string)$_POST['raw_ocr_text']) : null;
        $notes = isset($_POST['notes']) ? trim((string)$_POST['notes']) : null;

        $recordDate = isset($_POST['record_date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_POST['record_date'])
            ? $_POST['record_date']
            : date('Y-m-d');

        $recordedAt = isset($_POST['recorded_at']) && strtotime($_POST['recorded_at'])
            ? date('Y-m-d H:i:s', strtotime($_POST['recorded_at']))
            : date('Y-m-d H:i:s');

        if ($pondId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid pond_id is required.']);
            exit;
        }

        // Verify pond exists
        $pondStmt = $conn->prepare('SELECT id, pond_name FROM ponds WHERE id = :id LIMIT 1');
        $pondStmt->execute([':id' => $pondId]);
        $pond = $pondStmt->fetch(PDO::FETCH_ASSOC);

        if (!$pond) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Assigned pond not found.']);
            exit;
        }

        $pondName = $pond['pond_name'];

        // Handle Image Upload if provided
        $imagePath = null;
        if (isset($_FILES['image']) && is_uploaded_file($_FILES['image']['tmp_name'])) {
            $uploadsDir = __DIR__ . '/../uploads/water_quality';
            if (!is_dir($uploadsDir)) {
                @mkdir($uploadsDir, 0777, true);
            }

            $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'jfif'], true)) {
                $ext = 'jpg';
            }

            $filename = 'wq_' . $pondId . '_' . time() . '_' . mt_rand(1000, 9999) . '.' . $ext;
            $destination = $uploadsDir . '/' . $filename;

            if (move_uploaded_file($_FILES['image']['tmp_name'], $destination)) {
                $imagePath = 'uploads/water_quality/' . $filename;
            }
        }

        // Insert into water_quality_records table
        $insertStmt = $conn->prepare('
            INSERT INTO water_quality_records
            (pond_id, caretaker_id, recorded_by_name, dissolved_oxygen, temperature, ph_level, salinity, capture_mode, ocr_confidence, image_path, raw_ocr_text, notes, record_date, recorded_at)
            VALUES
            (:pond_id, :caretaker_id, :recorded_by_name, :dissolved_oxygen, :temperature, :ph_level, :salinity, :capture_mode, :ocr_confidence, :image_path, :raw_ocr_text, :notes, :record_date, :recorded_at)
        ');

        $insertStmt->execute([
            ':pond_id' => $pondId,
            ':caretaker_id' => $caretakerId > 0 ? $caretakerId : null,
            ':recorded_by_name' => $recordedByName,
            ':dissolved_oxygen' => $dissolvedOxygen,
            ':temperature' => $temperature,
            ':ph_level' => $phLevel,
            ':salinity' => $salinity,
            ':capture_mode' => $captureMode,
            ':ocr_confidence' => $ocrConfidence,
            ':image_path' => $imagePath,
            ':raw_ocr_text' => $rawOcrText,
            ':notes' => $notes,
            ':record_date' => $recordDate,
            ':recorded_at' => $recordedAt,
        ]);

        $recordId = (int)$conn->lastInsertId();

        // Calculate new pond status based on latest readings
        $newStatus = 'Healthy';
        if ($dissolvedOxygen < 4.0 || $temperature >= 34.0 || $phLevel < 7.0 || $phLevel > 8.8) {
            $newStatus = 'Critical';
        } elseif ($dissolvedOxygen < 5.0 || $temperature >= 32.5 || $phLevel < 7.5 || $phLevel > 8.5) {
            $newStatus = 'Warning';
        }

        // Update latest values on the ponds table
        $updatePondStmt = $conn->prepare('
            UPDATE ponds
            SET dissolved_oxygen = :do,
                temperature = :temp,
                ph_level = :ph,
                salinity = :sal,
                status = :status
            WHERE id = :id
        ');
        $updatePondStmt->execute([
            ':do' => $dissolvedOxygen,
            ':temp' => $temperature,
            ':ph' => $phLevel,
            ':sal' => $salinity,
            ':status' => $newStatus,
            ':id' => $pondId,
        ]);

        // Evaluate and log potential alerts
        evaluateWaterQualityAlerts($conn, $pondId, $pondName, $recordedByName, $dissolvedOxygen, $temperature, $phLevel, $salinity);

        // Record activity log
        try {
            $actStmt = $conn->prepare('
                INSERT INTO activity_logs (user_id, action, details, created_at)
                VALUES (:uid, "Water Quality Verified", :details, NOW())
            ');
            $actStmt->execute([
                ':uid' => $caretakerId > 0 ? $caretakerId : 1,
                ':details' => "Recorded water quality for {$pondName} via {$captureMode} (DO: {$dissolvedOxygen} mg/L, Temp: {$temperature}°C, pH: {$phLevel}, Sal: {$salinity} ppt).",
            ]);
        } catch (Throwable $e) {}

        echo json_encode([
            'success' => true,
            'message' => "Water quality record for {$pondName} successfully logged and verified!",
            'data' => [
                'id' => $recordId,
                'pond_id' => $pondId,
                'pond_name' => $pondName,
                'dissolved_oxygen' => $dissolvedOxygen,
                'temperature' => $temperature,
                'ph_level' => $phLevel,
                'salinity' => $salinity,
                'capture_mode' => $captureMode,
                'image_path' => $imagePath,
                'new_pond_status' => $newStatus,
                'record_date' => $recordDate,
            ],
        ]);
        exit;

    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error saving water quality record: ' . $e->getMessage()]);
        exit;
    }
}
