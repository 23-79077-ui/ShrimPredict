<?php
require_once __DIR__ . '/../config/database.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$database = new Database();
$conn = $database->getConnection();

$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

// compute assigned active ponds (union of users.pond_id and caretaker_ponds)
$activePondsQuery = "
  SELECT p.id AS pond_id
  FROM ponds p
  JOIN users u ON u.pond_id = p.id
  WHERE u.role = 'caretaker' AND u.status = 'Active' AND p.status NOT IN ('Inactive', 'Deleted')
  UNION
  SELECT cp.pond_id
  FROM caretaker_ponds cp
  JOIN users u ON u.id = cp.user_id
  JOIN ponds p ON p.id = cp.pond_id
  WHERE u.role = 'caretaker' AND u.status = 'Active' AND p.status NOT IN ('Inactive', 'Deleted')
";

$rowsStmt = $conn->query($activePondsQuery);
$rows = $rowsStmt->fetchAll(PDO::FETCH_ASSOC);
$pondIds = array_map(function($r){ return (int)$r['pond_id']; }, $rows);

// if userId provided, filter to user's ponds
$userPondIds = [];
if ($userId > 0) {
    $idsStmt = $conn->prepare(
        "SELECT DISTINCT p.id
         FROM ponds p
         WHERE p.status NOT IN ('Inactive', 'Deleted') AND (
             p.id IN (SELECT pond_id FROM caretaker_ponds WHERE user_id = :user_id)
             OR p.id = (SELECT pond_id FROM users WHERE id = :user_id LIMIT 1)
         )"
    );
    $idsStmt->execute([':user_id' => $userId]);
    $rows2 = $idsStmt->fetchAll(PDO::FETCH_ASSOC);
    $userPondIds = array_map(function($r){ return (int)$r['id']; }, $rows2);
}

$response = [
    'assigned_active_pond_ids' => $pondIds,
    'total_assigned_ponds' => count($pondIds),
    'user_assigned_pond_ids' => $userPondIds,
    'user_assigned_count' => count($userPondIds),
    'backend_file' => __FILE__,
    'backend_mtime' => filemtime(__FILE__),
];

echo json_encode($response);
