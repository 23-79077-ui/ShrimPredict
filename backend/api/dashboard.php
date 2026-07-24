<?php
require_once __DIR__ . '/../config/database.php';
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$database = new Database();
$conn = $database->getConnection();

// ensure pondIds exists in all code paths
$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : (isset($_GET['caretaker_id']) ? (int)$_GET['caretaker_id'] : 0);
$pondIds = [];

$userName = '';
if ($userId > 0) {
    $userStmt = $conn->prepare('SELECT full_name FROM users WHERE id = :id');
    $userStmt->execute([':id' => $userId]);
    $userRow = $userStmt->fetch(PDO::FETCH_ASSOC);
    $userName = $userRow ? $userRow['full_name'] : '';

    // Fetch active pond IDs assigned to this caretaker (via caretaker_ponds or legacy users.pond_id)
    $idsStmt = $conn->prepare(
        "SELECT DISTINCT p.id
         FROM ponds p
         WHERE p.status NOT IN ('Inactive', 'Deleted') AND (
             p.id IN (SELECT pond_id FROM caretaker_ponds WHERE user_id = :user_id)
             OR p.id = (SELECT pond_id FROM users WHERE id = :user_id LIMIT 1)
         )"
    );
    $idsStmt->execute([':user_id' => $userId]);
    $pondRows = $idsStmt->fetchAll(PDO::FETCH_ASSOC);
    $pondIds = array_map(function($r){ return (int)$r['id']; }, $pondRows);
    $totalPonds = count($pondIds);

    // Count healthy ponds among those IDs
    if (count($pondIds) > 0) {
        $placeholders = implode(',', array_fill(0, count($pondIds), '?'));
        $healthyStmt = $conn->prepare("SELECT COUNT(DISTINCT id) as healthy_ponds FROM ponds WHERE status = 'Healthy' AND id IN ($placeholders)");
        $healthyStmt->execute($pondIds);
        $healthyPonds = $healthyStmt->fetch(PDO::FETCH_ASSOC)['healthy_ponds'] ?: 0;
    } else {
        $healthyPonds = 0;
    }
} else {
        // Count active ponds that are assigned to caretakers (via users.pond_id or caretaker_ponds)
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

        // Fetch the actual assigned pond IDs so frontend can display which ponds are counted
        $rowsStmt = $conn->query($activePondsQuery);
        $rows = $rowsStmt->fetchAll(PDO::FETCH_ASSOC);
        $pondIds = array_map(function($r){ return (int)$r['pond_id']; }, $rows);
        $totalPonds = count($pondIds);

        if ($totalPonds > 0) {
            $placeholders = implode(',', array_fill(0, count($pondIds), '?'));
            $healthyStmt = $conn->prepare("SELECT COUNT(DISTINCT id) as healthy_ponds FROM ponds WHERE status = 'Healthy' AND id IN ($placeholders)");
            $healthyStmt->execute($pondIds);
            $healthyPonds = $healthyStmt->fetch(PDO::FETCH_ASSOC)['healthy_ponds'] ?: 0;
        } else {
            $healthyPonds = 0;
        }
}

$stmt = $conn->query("SELECT COUNT(*) as disease_alerts FROM disease_reports WHERE risk_level = 'High'");
$diseaseAlerts = $stmt->fetch(PDO::FETCH_ASSOC)['disease_alerts'] ?: 0;

if ($userId > 0) {
        if (!empty($pondIds)) {
                $ph = implode(',', array_fill(0, count($pondIds), '?'));
                $stmt = $conn->prepare("SELECT COUNT(DISTINCT fr.pond_id) as todays_feeding FROM feeding_records fr WHERE fr.pond_id IN ($ph) AND DATE(fr.record_date) = CURDATE()");
                $stmt->execute($pondIds);
        } else {
                $stmt = $conn->prepare("SELECT COUNT(DISTINCT fr.pond_id) as todays_feeding 
                    FROM feeding_records fr 
                    WHERE (fr.user_id = :user_id OR LOWER(fr.recorded_by_name) LIKE LOWER(CONCAT('%', :user_name, '%'))) AND DATE(fr.record_date) = CURDATE()");
                $stmt->execute([':user_id' => $userId, ':user_name' => $userName]);
        }
} else {
    $stmt = $conn->query("SELECT COUNT(DISTINCT fr.pond_id) as todays_feeding FROM feeding_records fr WHERE DATE(fr.record_date) = CURDATE()");
}
$todaysFeeding = $stmt->fetch(PDO::FETCH_ASSOC)['todays_feeding'] ?: 0;

$stmt = $conn->query('SELECT COUNT(*) as upcoming_harvest FROM harvest_predictions');
$upcomingHarvest = $stmt->fetch(PDO::FETCH_ASSOC)['upcoming_harvest'] ?: 0;

$labels = [];
$data = [];
for ($i = 6; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-$i days"));
        if ($userId > 0) {
                if (!empty($pondIds)) {
                        $placeholders = implode(',', array_fill(0, count($pondIds), '?'));
                        $params = $pondIds;
                        array_push($params, $date);
                        $stmt = $conn->prepare("SELECT COALESCE(SUM(fr.amount_kg), 0) as total_amount FROM feeding_records fr WHERE fr.pond_id IN ($placeholders) AND DATE(fr.record_date) = ?");
                        $stmt->execute($params);
                } else {
                        $stmt = $conn->prepare("SELECT COALESCE(SUM(fr.amount_kg), 0) as total_amount
                    FROM feeding_records fr
                    WHERE (fr.user_id = :user_id OR LOWER(fr.recorded_by_name) LIKE LOWER(CONCAT('%', :user_name, '%'))) AND DATE(fr.record_date) = :date");
                        $stmt->execute([':user_id' => $userId, ':user_name' => $userName, ':date' => $date]);
                }
        } else {
        $stmt = $conn->prepare("SELECT COALESCE(SUM(fr.amount_kg), 0) as total_amount
          FROM feeding_records fr
          JOIN ponds p ON p.id = fr.pond_id
          JOIN ($activePondsQuery) active_p ON active_p.pond_id = p.id
          WHERE DATE(fr.record_date) = :date");
        $stmt->execute([':date' => $date]);
    }
    $amount = (float)$stmt->fetch(PDO::FETCH_ASSOC)['total_amount'];
    $labels[] = date('M d', strtotime($date));
    $data[] = round($amount, 2);
}

// Count feeding records (entries) in the last 7 days for this user or all caretakers
$weekStart = date('Y-m-d', strtotime('-6 days'));
if ($userId > 0) {
    if (!empty($pondIds)) {
        $ph = implode(',', array_fill(0, count($pondIds), '?'));
        $params = $pondIds;
        array_push($params, $weekStart);
        $stmt = $conn->prepare("SELECT COUNT(*) as feed_entries_count FROM feeding_records fr WHERE fr.pond_id IN ($ph) AND DATE(fr.record_date) >= ?");
        $stmt->execute($params);
    } else {
        $stmt = $conn->prepare("SELECT COUNT(*) as feed_entries_count FROM feeding_records fr WHERE (fr.user_id = :user_id OR LOWER(fr.recorded_by_name) LIKE LOWER(CONCAT('%', :user_name, '%'))) AND DATE(fr.record_date) >= :week_start");
        $stmt->execute([':user_id' => $userId, ':user_name' => $userName, ':week_start' => $weekStart]);
    }
} else {
    $stmt = $conn->prepare("SELECT COUNT(*) as feed_entries_count FROM feeding_records fr WHERE DATE(fr.record_date) >= :week_start");
    $stmt->execute([':week_start' => $weekStart]);
}
$feedEntriesCount = (int)$stmt->fetch(PDO::FETCH_ASSOC)['feed_entries_count'] ?: 0;

if ($userId > 0) {
    if (!empty($pondIds)) {
        $ph = implode(',', array_fill(0, count($pondIds), '?'));
        $activityStmt = $conn->prepare(
            "SELECT fr.*, p.pond_name, COALESCE(fr.recorded_by_name, u.full_name, 'Caretaker') as recorded_by_name
            FROM feeding_records fr
            LEFT JOIN ponds p ON p.id = fr.pond_id
            LEFT JOIN users u ON u.id = fr.user_id
            WHERE fr.pond_id IN ($ph)
            ORDER BY fr.created_at DESC, fr.id DESC LIMIT 15"
        );
        $activityStmt->execute($pondIds);
    } else {
        $activityStmt = $conn->prepare(
            "SELECT fr.*, p.pond_name, COALESCE(fr.recorded_by_name, u.full_name, 'Caretaker') as recorded_by_name
            FROM feeding_records fr
            LEFT JOIN ponds p ON p.id = fr.pond_id
            LEFT JOIN users u ON u.id = fr.user_id
            WHERE (fr.user_id = :user_id OR LOWER(fr.recorded_by_name) LIKE LOWER(CONCAT('%', :user_name, '%')))
            ORDER BY fr.created_at DESC, fr.id DESC LIMIT 15"
        );
        $activityStmt->execute([':user_id' => $userId, ':user_name' => $userName]);
    }
} else {
    $activityStmt = $conn->query(
        "SELECT fr.*, p.pond_name, COALESCE(fr.recorded_by_name, u.full_name, 'Caretaker') as recorded_by_name
        FROM feeding_records fr
        LEFT JOIN ponds p ON p.id = fr.pond_id
        LEFT JOIN users u ON u.id = fr.user_id
        ORDER BY fr.created_at DESC, fr.id DESC LIMIT 15"
    );
}

$recentActivity = [];
while ($row = $activityStmt->fetch(PDO::FETCH_ASSOC)) {
    $recordedBy = trim((string)($row['recorded_by_name'] ?? '')) ?: 'Caretaker';
    $recentActivity[] = [
        'id' => (int)$row['id'],
        'title' => $recordedBy . ' logged feeding',
        'message' => ($row['pond_name'] ?? ('Pond ' . $row['pond_id'])) . ' • ' . (float)$row['amount_kg'] . ' kg • ' . ($row['feed_type'] ?? 'Tateh') . ($row['feeding_time'] ? ' (' . $row['feeding_time'] . ')' : ''),
        'time' => $row['created_at'] ?? $row['record_date'],
        'pond_name' => $row['pond_name'] ?? ('Pond ' . $row['pond_id']),
        'amount_kg' => (float)$row['amount_kg'],
        'feed_type' => $row['feed_type'] ?? 'Tateh',
        'feeding_time' => $row['feeding_time'] ?? '—',
        'vitamin_name' => $row['vitamin_name'] ?? ($row['has_vitamin'] ? 'Yes' : 'None'),
        'recorded_by' => $recordedBy,
        'record_date' => $row['record_date']
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
    'feed_entries_count' => $feedEntriesCount,
    'assigned_active_pond_ids' => $pondIds,
    'backend_file_mtime' => filemtime(__FILE__),
]);

