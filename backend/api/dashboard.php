<?php
require_once __DIR__ . '/../config/database.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');

$database = new Database();
$conn = $database->getConnection();

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

$stmt = $conn->query("SELECT COUNT(*) as total_ponds FROM ($activePondsQuery) active_p");
$totalPonds = $stmt->fetch(PDO::FETCH_ASSOC)['total_ponds'] ?: 0;

$stmt = $conn->query("SELECT COUNT(*) as healthy_ponds FROM ($activePondsQuery) active_p JOIN ponds p ON p.id = active_p.pond_id WHERE p.status = 'Healthy'");
$healthyPonds = $stmt->fetch(PDO::FETCH_ASSOC)['healthy_ponds'] ?: 0;

$stmt = $conn->query("SELECT COUNT(*) as disease_alerts FROM disease_reports WHERE risk_level = 'High'");
$diseaseAlerts = $stmt->fetch(PDO::FETCH_ASSOC)['disease_alerts'] ?: 0;

$stmt = $conn->query("SELECT COUNT(*) as todays_feeding FROM (
  SELECT fr.pond_id
  FROM feeding_records fr
  JOIN ponds p ON p.id = fr.pond_id
  JOIN ($activePondsQuery) active_p ON active_p.pond_id = p.id
  WHERE DATE(fr.record_date) = CURDATE()
  GROUP BY fr.pond_id
  HAVING COUNT(*) >= 3
) complete_feeds");
$todaysFeeding = $stmt->fetch(PDO::FETCH_ASSOC)['todays_feeding'] ?: 0;

$stmt = $conn->query('SELECT COUNT(*) as upcoming_harvest FROM harvest_predictions');
$upcomingHarvest = $stmt->fetch(PDO::FETCH_ASSOC)['upcoming_harvest'] ?: 0;

$labels = [];
$data = [];
for ($i = 6; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-$i days"));
    $stmt = $conn->prepare("SELECT COALESCE(SUM(fr.amount_kg), 0) as total_amount
      FROM feeding_records fr
      JOIN ponds p ON p.id = fr.pond_id
      JOIN ($activePondsQuery) active_p ON active_p.pond_id = p.id
      WHERE DATE(fr.record_date) = :date");
    $stmt->execute([':date' => $date]);
    $amount = (float)$stmt->fetch(PDO::FETCH_ASSOC)['total_amount'];
    $labels[] = date('M d', strtotime($date));
    $data[] = round($amount, 2);
}

$activityStmt = $conn->query(
    "SELECT fr.*, p.pond_name, COALESCE(fr.recorded_by_name, u.full_name, 'Caretaker') as recorded_by_name
    FROM feeding_records fr
    JOIN ponds p ON p.id = fr.pond_id
    LEFT JOIN caretaker_ponds cp ON cp.pond_id = p.id
    LEFT JOIN users u ON u.id = cp.user_id AND u.role = 'caretaker' AND u.status = 'Active'
    JOIN ($activePondsQuery) active_p ON active_p.pond_id = p.id
    ORDER BY fr.created_at DESC LIMIT 5"
);
$recentActivity = [];
while ($row = $activityStmt->fetch(PDO::FETCH_ASSOC)) {
    $recordedBy = trim((string)($row['recorded_by_name'] ?? '')) ?: (preg_match('/Recorded by:\s*(.+)$/', (string)($row['notes'] ?? ''), $matches) ? $matches[1] : 'Caretaker');
    $recentActivity[] = [
        'id' => (int)$row['id'],
        'title' => ($recordedBy ?: 'Caretaker') . ' logged feeding',
        'message' => ($row['pond_name'] ?? 'Pond ' . $row['pond_id']) . ' • ' . (float)$row['amount_kg'] . ' kg • ' . ($row['feeding_time'] ?: 'scheduled feed'),
        'time' => $row['created_at'] ?? $row['record_date'],
    ];
}

echo json_encode([
  'total_ponds' => (int)$totalPonds,
  'healthy_ponds' => (int)$healthyPonds,
  'disease_alerts' => (int)$diseaseAlerts,
  'todays_feeding' => (int)$todaysFeeding,
  'upcoming_harvest' => (int)$upcomingHarvest,
  'feed_chart' => [
      'labels' => $labels,
      'data' => $data,
  ],
  'recent_activity' => $recentActivity,
]);
