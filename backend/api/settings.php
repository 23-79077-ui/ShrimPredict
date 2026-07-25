<?php
require_once __DIR__ . '/../config/database.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'OPTIONS') {
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

// GET: Return all settings as key-value pairs
if ($method === 'GET') {
    try {
        $stmt = $conn->query("SELECT setting_key, setting_value FROM system_settings");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }

        echo json_encode([
            'success' => true,
            'settings' => $settings
        ]);
        exit;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error fetching settings: ' . $e->getMessage()]);
        exit;
    }
}

// POST: Save/Update settings
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !is_array($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON input.']);
        exit;
    }

    $settings = isset($data['settings']) && is_array($data['settings']) ? $data['settings'] : $data;

    try {
        $stmt = $conn->prepare("
            INSERT INTO system_settings (setting_key, setting_value) 
            VALUES (:key, :val) 
            ON DUPLICATE KEY UPDATE setting_value = :val2
        ");

        $updatedCount = 0;
        foreach ($settings as $key => $value) {
            if ($key === 'settings') continue;
            $valStr = (string)$value;
            $stmt->execute([
                ':key' => $key,
                ':val' => $valStr,
                ':val2' => $valStr
            ]);
            $updatedCount++;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Settings saved successfully!',
            'updated' => $updatedCount
        ]);
        exit;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error saving settings: ' . $e->getMessage()]);
        exit;
    }
}
