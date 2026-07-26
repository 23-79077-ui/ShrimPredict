<?php
require_once __DIR__ . '/../config/database.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

function readInput(): array {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) return $json;
    return $_REQUEST;
}

function normalizeQuestion(string $question): string {
    return strtolower(trim(preg_replace('/\s+/', ' ', $question)));
}

function placeholders(array $values): string {
    return implode(',', array_fill(0, count($values), '?'));
}

function getCaretaker(PDO $conn, int $userId): array {
    if ($userId <= 0) return ['id' => 0, 'full_name' => 'Caretaker'];
    $stmt = $conn->prepare("SELECT id, full_name FROM users WHERE id = :id AND role = 'caretaker' LIMIT 1");
    $stmt->execute([':id' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: ['id' => $userId, 'full_name' => 'Caretaker'];
}

function getAssignedPonds(PDO $conn, int $userId): array {
    if ($userId <= 0) return [];
    $stmt = $conn->prepare("
        SELECT DISTINCT p.id, p.pond_name, p.status, p.temperature, p.ph_level, p.salinity, p.dissolved_oxygen, p.water_level
        FROM ponds p
        WHERE p.id IN (SELECT pond_id FROM caretaker_ponds WHERE user_id = :user_id)
           OR p.id = (SELECT pond_id FROM users WHERE id = :user_id LIMIT 1)
        ORDER BY p.pond_name ASC
    ");
    $stmt->execute([':user_id' => $userId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function queryRows(PDO $conn, string $sql, array $params = []): array {
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function scalar(PDO $conn, string $sql, array $params = [], $default = 0) {
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $value = $stmt->fetchColumn();
    return $value === false || $value === null ? $default : $value;
}

function normalizeFeedingTimeValue(string $value): string {
    $value = strtoupper(trim($value));
    return preg_replace('/^0(\d:)/', '$1', $value);
}

function baseResponse(string $intent, string $answer, array $extra = []): array {
    return array_merge([
        'success' => true,
        'intent' => $intent,
        'data_scope' => 'caretaker_assigned_ponds_and_caretaker_submitted_records_only',
        'answer' => $answer,
        'recommendation' => 'Continue routine monitoring and submit clear records after each farm activity.',
        'chart' => null,
        'rows' => [],
        'actions' => [],
        'followups' => [
            'Show my ponds',
            'Show disease reports this week',
            'Show feed consumption',
            'Show harvest prediction',
        ],
    ], $extra);
}

$input = readInput();
$question = normalizeQuestion((string)($input['question'] ?? ''));
$userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;

if ($question === '') {
    echo json_encode(baseResponse('welcome', 'Ask me about your assigned ponds, disease scans, feeding records, alerts, or harvest prediction.', [
        'followups' => ['Show my ponds', 'Weekly summary', 'Show feed consumption', 'Show latest disease scans'],
    ]));
    exit;
}

$caretaker = getCaretaker($conn, $userId);
$ponds = getAssignedPonds($conn, $userId);
$pondIds = array_map(fn($pond) => (int)$pond['id'], $ponds);
$pondNames = array_map(fn($pond) => (string)$pond['pond_name'], $ponds);
$hasPonds = count($pondIds) > 0;
$pondPh = $hasPonds ? placeholders($pondIds) : 'NULL';
$namePh = count($pondNames) > 0 ? placeholders($pondNames) : 'NULL';
$feedingSchedule = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];

$isSummary = str_contains($question, 'summary') || str_contains($question, 'brief') || str_contains($question, 'overview');
$isDisease = str_contains($question, 'disease') || str_contains($question, 'wssv') || str_contains($question, 'white spot') || str_contains($question, 'scan');
$isSchedule = str_contains($question, 'schedule') || str_contains($question, 'oras') || str_contains($question, 'time') || str_contains($question, 'slot') || str_contains($question, 'nakapag pakain') || str_contains($question, 'nakapagpakain') || str_contains($question, 'hindi nakakapag pakain') || str_contains($question, 'hindi nakakapagpakain') || str_contains($question, 'magpapakain');
$isFeed = str_contains($question, 'feed') || str_contains($question, 'feeding') || str_contains($question, 'consumed') || str_contains($question, 'missed');
$isHarvest = str_contains($question, 'harvest') || str_contains($question, 'yield');
$isWater = str_contains($question, 'water') || str_contains($question, 'ph') || str_contains($question, 'temperature') || str_contains($question, 'salinity') || str_contains($question, 'oxygen');
$isAlert = str_contains($question, 'alert') || str_contains($question, 'notification');
$isPond = str_contains($question, 'pond') || str_contains($question, 'healthy') || str_contains($question, 'risk') || str_contains($question, 'inspection');

if (!$hasPonds) {
    echo json_encode(baseResponse('no_assigned_ponds', "I cannot find assigned ponds for {$caretaker['full_name']} yet. Please ask the admin to assign ponds before using caretaker analytics.", [
        'recommendation' => 'Assign at least one pond to this caretaker account.',
        'actions' => [['label' => 'Open My Pond', 'to' => '/caretaker/my-pond']],
    ]));
    exit;
}

if ($isSummary) {
    $healthy = (int)scalar($conn, "SELECT COUNT(*) FROM ponds WHERE status = 'Healthy' AND id IN ($pondPh)", $pondIds);
    $feedParams = [$userId];
    $feedParams = array_merge($feedParams, $pondIds);
    $feedParams[] = date('Y-m-d', strtotime('-6 days'));
    $weeklyFeed = (float)scalar($conn, "
        SELECT COALESCE(SUM(fr.amount_kg), 0)
        FROM feeding_records fr
        JOIN users u ON u.id = fr.user_id AND u.role = 'caretaker'
        WHERE fr.user_id = ? AND fr.pond_id IN ($pondPh) AND fr.record_date >= ?
    ", $feedParams);
    $diseaseParams = array_merge([$userId], $pondNames, [date('Y-m-d', strtotime('-6 days'))]);
    $diseaseCount = (int)scalar($conn, "SELECT COUNT(*) FROM disease_reports WHERE (user_id = ? OR pond_name IN ($namePh)) AND DATE(created_at) >= ?", $diseaseParams);
    $highRisk = (int)scalar($conn, "SELECT COUNT(*) FROM disease_reports WHERE (user_id = ? OR pond_name IN ($namePh)) AND risk_level = 'High' AND DATE(created_at) >= ?", $diseaseParams);

    $answer = "Weekly summary for {$caretaker['full_name']}: you have " . count($ponds) . " assigned pond(s). {$healthy} pond(s) are currently marked Healthy based on the ponds table. Your own caretaker feeding logs show " . round($weeklyFeed, 2) . " kg of feed in the last 7 days. There were {$diseaseCount} disease scan(s) tied to your account or assigned ponds, including {$highRisk} high-risk WSSV result(s).";
    echo json_encode(baseResponse('weekly_summary', $answer, [
        'recommendation' => $highRisk > 0 ? 'Review the high-risk disease scan images and alert the farm administrator immediately.' : 'No critical WSSV trend is visible from your recent records.',
        'actions' => [['label' => 'Open Reports', 'to' => '/caretaker/reports'], ['label' => 'Scan Disease', 'to' => '/caretaker/disease-scan']],
        'followups' => ['Show affected ponds', 'Show feed consumption', 'Show latest disease scans', 'Show water report'],
    ]));
    exit;
}

if ($isDisease) {
    $periodSql = str_contains($question, 'today') ? 'DATE(created_at) = CURDATE()' : (str_contains($question, 'week') ? 'DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)' : '1=1');
    $params = array_merge([$userId], $pondNames);
    $rows = queryRows($conn, "
        SELECT id, pond_name, disease_name, confidence_score, risk_level, status, created_at
        FROM disease_reports
        WHERE (user_id = ? OR pond_name IN ($namePh)) AND {$periodSql}
        ORDER BY created_at DESC, id DESC
        LIMIT 8
    ", $params);
    $wssv = 0;
    foreach ($rows as $row) {
        if (stripos($row['disease_name'], 'white spot') !== false || stripos($row['disease_name'], 'wssv') !== false) $wssv++;
    }
    $answer = count($rows) . " disease scan(s) found for your assigned ponds. {$wssv} scan(s) mention possible White Spot/WSSV.";
    echo json_encode(baseResponse('disease_reports', $answer, [
        'rows' => $rows,
        'recommendation' => $wssv > 0 ? 'Inspect the affected pond and retake a close-up shrimp photo before confirming farm action.' : 'Continue routine scan monitoring.',
        'actions' => [['label' => 'Open Disease Scan', 'to' => '/caretaker/disease-scan'], ['label' => 'Open Reports', 'to' => '/caretaker/reports']],
        'followups' => ['Show affected ponds', 'Show latest disease scans', 'Show feed consumption', 'Weekly summary'],
    ]));
    exit;
}

if ($isSchedule) {
    $params = [$userId];
    $params = array_merge($params, $pondIds);
    $rows = queryRows($conn, "
        SELECT p.pond_name,
               fr.pond_id,
               fr.feeding_time,
               COALESCE(SUM(fr.amount_kg), 0) AS total_feed_kg,
               MAX(fr.created_at) AS logged_at
        FROM feeding_records fr
        JOIN users u ON u.id = fr.user_id AND u.role = 'caretaker'
        JOIN ponds p ON p.id = fr.pond_id
        WHERE fr.user_id = ?
          AND fr.pond_id IN ($pondPh)
          AND fr.record_date = CURDATE()
        GROUP BY p.id, p.pond_name, fr.feeding_time
        ORDER BY p.pond_name ASC, fr.feeding_time ASC
    ", $params);

    $loggedSlots = [];
    foreach ($rows as $row) {
        $slot = normalizeFeedingTimeValue((string)($row['feeding_time'] ?? ''));
        if ($slot !== '') $loggedSlots[$slot] = true;
    }

    $scheduleRows = [];
    $loggedLabels = [];
    $pendingLabels = [];
    foreach ($feedingSchedule as $slot) {
        $normalized = normalizeFeedingTimeValue($slot);
        $isLogged = isset($loggedSlots[$normalized]);
        $scheduleRows[] = [
            'feeding_time' => $slot,
            'status' => $isLogged ? 'Logged' : 'Pending',
        ];
        if ($isLogged) {
            $loggedLabels[] = $slot;
        } else {
            $pendingLabels[] = $slot;
        }
    }

    $answer = "Today's feeding schedule for your assigned ponds: ";
    $answer .= count($loggedLabels) > 0 ? "already logged: " . implode(', ', $loggedLabels) . ". " : "no feeding time has been logged yet. ";
    $answer .= count($pendingLabels) > 0 ? "Still pending: " . implode(', ', $pendingLabels) . "." : "All 5 feeding times are already logged today.";

    echo json_encode(baseResponse('today_feeding_schedule', $answer, [
        'rows' => $scheduleRows,
        'chart' => [
            'type' => 'bar',
            'title' => "Today's Feeding Schedule",
            'labels' => $feedingSchedule,
            'data' => array_map(fn($row) => $row['status'] === 'Logged' ? 1 : 0, $scheduleRows),
        ],
        'recommendation' => count($pendingLabels) > 0 ? 'Complete the pending feeding slots and log each feeding right after it is done.' : 'All scheduled feeding slots are complete for today.',
        'actions' => [['label' => 'Open My Pond', 'to' => '/caretaker/my-pond'], ['label' => 'Open Feeding History', 'to' => '/caretaker/feeding-history']],
        'followups' => ['What time still needs feeding?', 'Show feed consumption', 'Open feeding log', 'Weekly summary'],
    ]));
    exit;
}

if ($isFeed) {
    $params = [$userId];
    $params = array_merge($params, $pondIds);
    $rows = queryRows($conn, "
        SELECT p.pond_name, COALESCE(SUM(fr.amount_kg), 0) AS total_feed_kg
        FROM ponds p
        LEFT JOIN feeding_records fr ON fr.pond_id = p.id
            AND fr.user_id = ?
            AND fr.record_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        LEFT JOIN users u ON u.id = fr.user_id AND u.role = 'caretaker'
        WHERE p.id IN ($pondPh)
        GROUP BY p.id, p.pond_name
        ORDER BY total_feed_kg DESC
    ", $params);
    $total = array_reduce($rows, fn($sum, $row) => $sum + (float)$row['total_feed_kg'], 0);
    $top = $rows[0] ?? null;
    $missed = array_values(array_filter($rows, fn($row) => (float)$row['total_feed_kg'] <= 0));
    $answer = "Your caretaker feeding logs show " . round($total, 2) . " kg of feed for your assigned ponds in the last 7 days.";
    if ($top) $answer .= " Highest consumption is {$top['pond_name']} with " . round((float)$top['total_feed_kg'], 2) . " kg.";
    if (count($missed) > 0) $answer .= " " . count($missed) . " pond(s) have no feeding record in this period.";
    echo json_encode(baseResponse('feed_consumption', $answer, [
        'rows' => $rows,
        'chart' => [
            'type' => 'bar',
            'title' => '7-Day Feed Consumption',
            'labels' => array_column($rows, 'pond_name'),
            'data' => array_map(fn($row) => round((float)$row['total_feed_kg'], 2), $rows),
        ],
        'recommendation' => count($missed) > 0 ? 'Check ponds with no feeding records and update the feeding log if feeding was completed.' : 'Feeding logs are present for your assigned ponds.',
        'actions' => [['label' => 'Open Feeding History', 'to' => '/caretaker/feeding-history'], ['label' => 'Open My Pond', 'to' => '/caretaker/my-pond']],
        'followups' => ['Which pond consumed most feed?', 'Who missed feeding?', 'Weekly summary', 'Show harvest prediction'],
    ]));
    exit;
}

if ($isHarvest) {
    $params = [$userId];
    $params = array_merge($params, $pondIds);
    $rows = queryRows($conn, "
        SELECT p.pond_name,
               COALESCE(SUM(fr.amount_kg), 0) AS total_feed_kg,
               ROUND(COALESCE(SUM(fr.amount_kg), 0) * (11000 / 15000), 2) AS estimated_harvest_kg
        FROM ponds p
        LEFT JOIN feeding_records fr ON fr.pond_id = p.id AND fr.user_id = ?
        LEFT JOIN users u ON u.id = fr.user_id AND u.role = 'caretaker'
        WHERE p.id IN ($pondPh)
        GROUP BY p.id, p.pond_name
        ORDER BY estimated_harvest_kg DESC
    ", $params);
    $best = $rows[0] ?? null;
    $answer = "Harvest prediction uses the caretaker historical baseline: 15,000 kg feed usually yields around 11 tons per pond.";
    if ($best) $answer .= " Based on your caretaker feeding logs, {$best['pond_name']} has the highest estimate at " . round((float)$best['estimated_harvest_kg'], 2) . " kg.";
    echo json_encode(baseResponse('harvest_prediction', $answer, [
        'rows' => $rows,
        'chart' => [
            'type' => 'bar',
            'title' => 'Estimated Harvest By Assigned Pond',
            'labels' => array_column($rows, 'pond_name'),
            'data' => array_map(fn($row) => round((float)$row['estimated_harvest_kg'], 2), $rows),
        ],
        'recommendation' => 'Use this as an operational estimate only. Confirm final harvest readiness with the farm administrator.',
        'actions' => [['label' => 'Open My Pond', 'to' => '/caretaker/my-pond'], ['label' => 'Open Reports', 'to' => '/caretaker/reports']],
        'followups' => ['Show feed consumption', 'Which pond is ready?', 'Weekly summary', 'Show water report'],
    ]));
    exit;
}

if ($isWater || $isPond) {
    $rows = $ponds;
    $lowPh = array_values(array_filter($rows, fn($row) => (float)$row['ph_level'] < 7.0));
    $abnormalTemp = array_values(array_filter($rows, fn($row) => (float)$row['temperature'] > 32 || (float)$row['temperature'] < 26));
    $healthy = count(array_filter($rows, fn($row) => strtolower((string)$row['status']) === 'healthy'));
    $answer = "You have " . count($rows) . " assigned pond(s). {$healthy} pond(s) are currently marked Healthy.";
    if (count($lowPh) > 0) $answer .= " " . count($lowPh) . " pond(s) have low pH.";
    if (count($abnormalTemp) > 0) $answer .= " " . count($abnormalTemp) . " pond(s) have abnormal temperature.";
    echo json_encode(baseResponse('pond_water_status', $answer, [
        'rows' => $rows,
        'recommendation' => (count($lowPh) || count($abnormalTemp)) ? 'Inspect the flagged pond parameters and update the admin if readings remain abnormal.' : 'Water indicators look stable from the latest pond records.',
        'actions' => [['label' => 'Open My Pond', 'to' => '/caretaker/my-pond']],
        'followups' => ['Show low pH ponds', 'Show abnormal temperature', 'Show disease reports', 'Show feed consumption'],
    ]));
    exit;
}

if ($isAlert) {
    $params = array_merge([$userId, $caretaker['full_name']], $pondNames);
    $rows = queryRows($conn, "
        SELECT title, message, action_type, pond_name, created_at
        FROM notifications
        WHERE status = 'active'
          AND (user_id = ? OR caretaker_name = ? OR pond_name IN ($namePh))
        ORDER BY created_at DESC
        LIMIT 8
    ", $params);
    echo json_encode(baseResponse('alerts', count($rows) . " active alert/notification item(s) are visible for your caretaker workspace.", [
        'rows' => $rows,
        'recommendation' => count($rows) > 0 ? 'Review the newest alert first and update records after action is taken.' : 'No active alerts found for your assigned pond workspace.',
        'actions' => [['label' => 'Open Reports', 'to' => '/caretaker/reports']],
        'followups' => ['Weekly summary', 'Show disease reports', 'Show my ponds', 'Show feed consumption'],
    ]));
    exit;
}

echo json_encode(baseResponse('general_help', 'I can answer using your ShrimPredict records only. Try asking about your ponds, WSSV scans, feed consumption, water quality, alerts, or harvest prediction.', [
    'followups' => ['Show my ponds', 'Show latest disease scans', 'Show feed consumption', 'Weekly summary'],
]));
