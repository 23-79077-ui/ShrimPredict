<?php
require_once __DIR__ . '/../config/database.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    header('Content-Type: application/json; charset=UTF-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : 'download');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'download') {
    try {
        $tables = [];
        $stmt = $conn->query("SHOW TABLES");
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $tables[] = $row[0];
        }

        $sqlDump = "-- ShrimpPredict Database Backup Dump\n";
        $sqlDump .= "-- Generated on " . date('Y-m-d H:i:s') . "\n";
        $sqlDump .= "-- Server version: MySQL / MariaDB\n\n";
        $sqlDump .= "CREATE DATABASE IF NOT EXISTS `shrim_predict_db`;\n";
        $sqlDump .= "USE `shrim_predict_db`;\n\n";

        foreach ($tables as $table) {
            $createTableStmt = $conn->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM);
            $sqlDump .= "DROP TABLE IF EXISTS `$table`;\n";
            $sqlDump .= $createTableStmt[1] . ";\n\n";

            $rows = $conn->query("SELECT * FROM `$table`")->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($rows)) {
                foreach ($rows as $row) {
                    $keys = array_keys($row);
                    $escapedKeys = array_map(function($k) { return "`$k`"; }, $keys);
                    $values = array_map(function($val) use ($conn) {
                        if ($val === null) return "NULL";
                        return $conn->quote($val);
                    }, array_values($row));

                    $sqlDump .= "INSERT INTO `$table` (" . implode(', ', $escapedKeys) . ") VALUES (" . implode(', ', $values) . ");\n";
                }
                $sqlDump .= "\n";
            }
        }

        // Update last_backup setting
        $nowStr = date('F d, Y h:i A');
        $up = $conn->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('last_backup', :val) ON DUPLICATE KEY UPDATE setting_value = :val2");
        $up->execute([':val' => $nowStr, ':val2' => $nowStr]);

        $fileName = 'shrim_predict_backup_' . date('Y-m-d_H-i-s') . '.sql';
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Content-Length: ' . strlen($sqlDump));
        echo $sqlDump;
        exit;

    } catch (Exception $e) {
        header('Content-Type: application/json; charset=UTF-8');
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Backup failed: ' . $e->getMessage()]);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === 'restore' || isset($_FILES['sql_file']))) {
    header('Content-Type: application/json; charset=UTF-8');
    try {
        $sqlContent = '';
        if (isset($_FILES['sql_file']) && $_FILES['sql_file']['error'] === UPLOAD_ERR_OK) {
            $sqlContent = file_get_contents($_FILES['sql_file']['tmp_name']);
        } else {
            $input = json_decode(file_get_contents('php://input'), true);
            if (isset($input['sql_content'])) {
                $sqlContent = $input['sql_content'];
            }
        }

        if (empty($sqlContent)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No SQL backup content provided for restore.']);
            exit;
        }

        $conn->exec($sqlContent);

        // Update last_backup setting
        $nowStr = date('F d, Y h:i A') . ' (Restored)';
        $up = $conn->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('last_backup', :val) ON DUPLICATE KEY UPDATE setting_value = :val2");
        $up->execute([':val' => $nowStr, ':val2' => $nowStr]);

        echo json_encode([
            'success' => true,
            'message' => 'Database backup restored successfully!',
            'last_backup' => $nowStr
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database restore error: ' . $e->getMessage()]);
        exit;
    }
}

header('Content-Type: application/json; charset=UTF-8');
http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Invalid backup action.']);
