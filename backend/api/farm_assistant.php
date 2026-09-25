<?php
if (file_exists(__DIR__ . '/../config/database.php')) {
    require_once __DIR__ . '/../config/database.php';
} else {
    require_once 'c:/Users/Cristel/Documents/ShrimPredict/backend/config/database.php';
}

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
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

function readInput(): array {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) return $json;
    return $_REQUEST;
}

function normalizeQuestion(string $question): string {
    return strtolower(trim(preg_replace('/\s+/', ' ', $question)));
}

function getCaretaker(PDO $conn, int $userId): array {
    if ($userId <= 0) return ['id' => 0, 'full_name' => 'Caretaker'];
    $stmt = $conn->prepare("SELECT id, full_name, email FROM users WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: ['id' => $userId, 'full_name' => 'Caretaker'];
}

function getAllPonds(PDO $conn): array {
    $stmt = $conn->query("SELECT * FROM ponds ORDER BY id ASC");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getAssignedPonds(PDO $conn, int $userId, array $allPonds): array {
    if ($userId <= 0) {
        return $allPonds;
    }

    $assigned = [];
    $stmt = $conn->prepare("
        SELECT DISTINCT p.*
        FROM ponds p
        WHERE p.id IN (SELECT pond_id FROM caretaker_ponds WHERE user_id = :uid)
           OR p.id = (SELECT pond_id FROM users WHERE id = :uid LIMIT 1)
        ORDER BY p.id ASC
    ");
    $stmt->execute([':uid' => $userId]);
    $assigned = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($assigned)) {
        $uStmt = $conn->prepare("SELECT full_name FROM users WHERE id = :uid LIMIT 1");
        $uStmt->execute([':uid' => $userId]);
        $name = $uStmt->fetchColumn();
        if ($name) {
            foreach ($allPonds as $p) {
                if (!empty($p['assigned_caretaker_name']) && stripos($p['assigned_caretaker_name'], trim($name)) !== false) {
                    $assigned[] = $p;
                }
            }
        }
    }

    return !empty($assigned) ? $assigned : $allPonds;
}

function computePondDoc(?string $stockingDate): ?int {
    if (!$stockingDate) return null;
    $s = strtotime($stockingDate);
    if (!$s) return null;
    $today = strtotime(date('Y-m-d'));
    $diff = floor(($today - $s) / 86400) + 1;
    return $diff >= 1 ? (int)$diff : 1;
}

function getPondStageInfo(?int $doc): array {
    if ($doc === null) {
        return [
            'stage' => 'Pre-Stocking',
            'feed' => 'Tateh - Starter',
            'desc' => 'Pond is prepared for stocking.'
        ];
    }
    if ($doc >= 1 && $doc <= 19) {
        return [
            'stage' => 'Nursery Stage',
            'feed' => 'Tateh - Starter',
            'desc' => "Day {$doc} Nursery stage. Prescribed formulation is Tateh - Starter (crumble pellets with Vitamin C)."
        ];
    }
    if ($doc === 20) {
        return [
            'stage' => 'Transfer Day',
            'feed' => 'Tateh - Grower',
            'desc' => "Day 20 Transfer Day milestone. Shrimp transition to Grow-out pond and switch to Tateh - Grower."
        ];
    }
    return [
        'stage' => 'Grow-out Stage',
        'feed' => 'Tateh - Grower',
        'desc' => "Day {$doc} Grow-out phase. Prescribed formulation is Tateh - Grower pellets."
    ];
}

function getNextFeedingSlot(): array {
    $nowHour = (int)date('H');
    $nowMin = (int)date('i');
    $currentTime = $nowHour * 60 + $nowMin;

    $slots = [
        ['time' => '6:00 AM',  'minutes' => 6 * 60,      'label' => '1st session (Morning)'],
        ['time' => '9:00 AM',  'minutes' => 9 * 60,      'label' => '2nd session (Mid-Morning)'],
        ['time' => '12:00 PM', 'minutes' => 12 * 60,     'label' => '3rd session (Noon)'],
        ['time' => '3:00 PM',  'minutes' => 15 * 60,     'label' => '4th session (Afternoon)'],
        ['time' => '6:00 PM',  'minutes' => 18 * 60,     'label' => '5th session (Evening)'],
    ];

    foreach ($slots as $s) {
        if ($currentTime <= $s['minutes']) {
            return [
                'next_slot' => $s['time'],
                'label' => $s['label'],
                'is_today' => true
            ];
        }
    }

    return [
        'next_slot' => '6:00 AM (Tomorrow)',
        'label' => '1st session (Morning)',
        'is_today' => false
    ];
}

function findMentionedPond(string $question, array $allPonds): ?array {
    // 1. Check exact full pond names (e.g. "pond a1", "pond b2", "pond 1")
    foreach ($allPonds as $p) {
        $nameLower = strtolower($p['pond_name']);
        if (preg_match('/\b' . preg_quote($nameLower, '/') . '\b/i', $question)) {
            return $p;
        }
    }

    // 2. Check short codes like "a1", "a2", "b1", "b2", "c1", "d1"
    foreach ($allPonds as $p) {
        $nameLower = strtolower($p['pond_name']);
        $short = trim(str_ireplace('pond', '', $nameLower));
        if ($short !== '' && preg_match('/\b(?:pond\s*)?' . preg_quote($short, '/') . '\b/i', $question)) {
            return $p;
        }
    }

    // 3. Check pond ID numbers like "pond 1", "pond #1", "basin 1"
    foreach ($allPonds as $p) {
        if (preg_match('/\b(?:pond|basin)\s*(?:#|no\.?)?\s*' . $p['id'] . '\b/i', $question)) {
            return $p;
        }
    }

    return null;
}

function baseResponse(string $intent, string $answer, array $extra = []): array {
    return array_merge([
        'success' => true,
        'intent' => $intent,
        'data_scope' => 'live_farm_telemetry_and_records',
        'answer' => $answer,
        'recommendation' => 'Continue standard farm monitoring protocols.',
        'chart' => null,
        'rows' => [],
        'actions' => [],
        'followups' => [
            'How is Pond A1 doing?',
            'When is the next feeding time?',
            'Any disease detected?',
            'Show water quality status'
        ],
    ], $extra);
}

// -------------------------------------------------------------
// MAIN REQUEST HANDLER
// -------------------------------------------------------------
$input = readInput();
$question = normalizeQuestion((string)($input['question'] ?? ''));
$userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;

$allPonds = getAllPonds($conn);
$caretaker = getCaretaker($conn, $userId);
$assignedPonds = getAssignedPonds($conn, $userId, $allPonds);

// 1. Welcome / Empty Query
if ($question === '') {
    echo json_encode(baseResponse('welcome', "Hello, {$caretaker['full_name']}! I am your ShrimPredict AI Farm Assistant. You can ask me anything about your assigned ponds, water quality readings, feeding schedule & formulation, disease biosecurity, or harvest estimates.", [
        'followups' => [
            'How are my assigned ponds?',
            'When is the next feeding time?',
            'What feed formulation should I use?',
            'Are there any disease alerts?'
        ]
    ]));
    exit;
}

// Check Entity: Is a specific pond mentioned?
$targetPond = findMentionedPond($question, $allPonds);

// Keyword Category Flags
$isTemp = preg_match('/\b(temp|temperature|init|mainit|malamig|degrees|celsius|°c)\b/i', $question);
$isPh = preg_match('/\b(ph|asim|kaasiman|acidity|alkalinity)\b/i', $question);
$isDO = preg_match('/\b(dissolved oxygen|oxygen|do|hangin|aerator|aeration|paddlewheel)\b/i', $question);
$isSalinity = preg_match('/\b(salinity|sal|alat|maalat|asin|ppt)\b/i', $question);
$isWaterGeneral = preg_match('/\b(water|tubig|quality|reading|parameter|lagay ng tubig)\b/i', $question);

$isHarvest = preg_match('/\b(harvest|ani|anihin|yield|readiness|handa na ba|production)\b/i', $question);
$isFeed = preg_match('/\b(feed|pakain|feeding|starter|grower|kilo|tateh|formulation|nursery|oras|schedule|susunod|next|missed|consumption|kinain)\b/i', $question) || (preg_match('/\b(kailan|anong oras)\b/i', $question) && !$isHarvest);
$isDisease = preg_match('/\b(disease|sakit|wssv|white spot|may sakit|namamatay|virus|bakterya|scan|biosecurity|pula|namumula|clear)\b/i', $question);
$isAlert = preg_match('/\b(alert|warning|critical|babala|gawin|action|problema|issue)\b/i', $question);

// 2. Pure Greeting (ONLY if NO specific pond and NO technical question)
$isPureGreeting = preg_match('/^(hi|hello|hey|kamusta|Hello|magandang\s*(araw|umaga|hapon|gabi)|good\s*(morning|afternoon|day))\b/i', $question)
    && !$targetPond && !$isTemp && !$isPh && !$isDO && !$isSalinity && !$isWaterGeneral && !$isFeed && !$isDisease && !$isHarvest && !$isAlert;

if ($isPureGreeting) {
    $pondListStr = implode(', ', array_map(fn($p) => $p['pond_name'], array_slice($assignedPonds, 0, 4)));
    $nextSlot = getNextFeedingSlot();
    $answer = "Hello, {$caretaker['full_name']}! I'm here to assist you with your ponds ({$pondListStr}). The next scheduled feeding session is at **{$nextSlot['next_slot']}** ({$nextSlot['label']}). How can I help you right now?";
    echo json_encode(baseResponse('greeting', $answer, [
        'recommendation' => 'Ask about water parameters, feeding requirements, or disease scans.',
        'followups' => ['Show water quality status', 'When is the next feeding?', 'Any disease detected?']
    ]));
    exit;
}

// =============================================================
// SCENARIO A: A SPECIFIC POND IS TARGETED
// =============================================================
if ($targetPond) {
    $pName = $targetPond['pond_name'];
    $temp = !empty($targetPond['temperature']) ? floatval($targetPond['temperature']) : null;
    $ph = !empty($targetPond['ph_level']) ? floatval($targetPond['ph_level']) : null;
    $do = !empty($targetPond['dissolved_oxygen']) ? floatval($targetPond['dissolved_oxygen']) : null;
    $sal = !empty($targetPond['salinity']) ? floatval($targetPond['salinity']) : null;
    $status = $targetPond['status'] ?: 'Healthy';
    $doc = computePondDoc($targetPond['stocking_date']);
    $stage = getPondStageInfo($doc);
    $feedToday = floatval($targetPond['feed_today_kg'] ?? 0);
    $targetFeed = floatval($targetPond['target_feed_kg'] ?? 45.0);

    // Case A1: Specific Pond + Temperature
    if ($isTemp) {
        $tempStr = $temp !== null ? "{$temp} °C" : "not recorded yet";
        $answer = "The current water temperature for **{$pName}** is **{$tempStr}**.";
        $rec = "Optimal temperature for Pacific White Shrimp (Vannamei) is 26.0°C to 32.0°C.";

        if ($temp !== null) {
            if ($temp > 32.0) {
                $answer .= " ⚠️ **Warning: High temperature detected.** Water temperatures above 32°C accelerate shrimp metabolism and drop dissolved oxygen capacity.";
                $rec = "Turn on paddlewheel aerators immediately and consider adding fresh water to stabilize temperature.";
            } elseif ($temp < 26.0) {
                $answer .= " Notice: Water temperature is cooler than ideal (below 26°C). Shrimp feeding activity may slow down.";
                $rec = "Check feed trays before feeding to prevent unconsumed feed accumulation.";
            } else {
                $answer .= " This is within the ideal, safe thermal range (26.0°C – 32.0°C).";
            }
        }

        echo json_encode(baseResponse('pond_temperature', $answer, [
            'recommendation' => $rec,
            'rows' => [$targetPond],
            'followups' => ["What is the pH level of {$pName}?", "How is {$pName} doing?", "What feed formulation for {$pName}?"]
        ]));
        exit;
    }

    // Case A2: Specific Pond + pH Level
    if ($isPh) {
        $phStr = $ph !== null ? number_format($ph, 2) : "not recorded yet";
        $answer = "The water pH level in **{$pName}** is **{$phStr}**.";
        $rec = "Optimal pH for shrimp culture is between 7.50 and 8.50 with daily fluctuation under 0.5.";

        if ($ph !== null) {
            if ($ph < 7.50) {
                $answer .= " ⚠️ **Warning: Water is slightly acidic.** Low pH can cause soft-shell syndrome and stress shrimp.";
                $rec = "Apply agricultural lime (CaCO3) or dolomite to raise alkalinity and buffer the water.";
            } elseif ($ph > 8.50) {
                $answer .= " ⚠️ **Warning: High pH detected.** High pH increases toxic un-ionized ammonia levels.";
                $rec = "Regulate bloom density and consider controlled water exchange.";
            } else {
                $answer .= " Water pH is well-balanced within the optimal healthy range.";
            }
        }

        echo json_encode(baseResponse('pond_ph', $answer, [
            'recommendation' => $rec,
            'rows' => [$targetPond],
            'followups' => ["What is the DO in {$pName}?", "What is the temperature of {$pName}?", "Show all parameters for {$pName}"]
        ]));
        exit;
    }

    // Case A3: Specific Pond + Dissolved Oxygen (DO)
    if ($isDO) {
        $doStr = $do !== null ? "{$do} mg/L" : "not recorded yet";
        $answer = "The dissolved oxygen (DO) level in **{$pName}** is **{$doStr}**.";
        $rec = "Dissolved oxygen should stay at or above 4.0 mg/L at all times.";

        if ($do !== null) {
            if ($do < 4.0) {
                $answer .= " 🚨 **Critical Alert: Low dissolved oxygen.** Shrimp may suffocate or crowd at the water surface.";
                $rec = "Immediately start all paddlewheels and backup aeration lines in {$pName}.";
            } else {
                $answer .= " Oxygen level is sufficient (≥ 4.0 mg/L) for healthy respiration and active feeding.";
            }
        }

        echo json_encode(baseResponse('pond_do', $answer, [
            'recommendation' => $rec,
            'rows' => [$targetPond],
            'followups' => ["How is {$pName} doing?", "When is the next feeding for {$pName}?", "Check salinity in {$pName}"]
        ]));
        exit;
    }

    // Case A4: Specific Pond + Salinity
    if ($isSalinity) {
        $salStr = $sal !== null ? "{$sal} ppt" : "not recorded yet";
        $answer = "The salinity level in **{$pName}** is **{$salStr}**.";
        $rec = "Recommended salinity range for Vannamei grow-out is 10 to 25 ppt.";

        if ($sal !== null) {
            if ($sal < 10) {
                $answer .= " Notice: Salinity is low. Ensure sufficient mineral supplementation (calcium and magnesium) for molting.";
            } elseif ($sal > 30) {
                $answer .= " Notice: Salinity is high. Monitor shrimp growth rates and osmotic stress.";
            } else {
                $answer .= " Salinity is within the recommended brackish range for Vannamei.";
            }
        }

        echo json_encode(baseResponse('pond_salinity', $answer, [
            'recommendation' => $rec,
            'rows' => [$targetPond],
            'followups' => ["What is the temperature of {$pName}?", "What is the pH level of {$pName}?"]
        ]));
        exit;
    }

    // Case A5: Specific Pond + Feeding & Formulation
    if ($isFeed) {
        $nextSlot = getNextFeedingSlot();
        $answer = "Feeding protocol for **{$pName}**:\n";
        $answer .= "• **Culture Stage:** " . ($doc ? "Day {$doc} ({$stage['stage']})" : "Pre-Stocking") . "\n";
        $answer .= "• **Prescribed Formulation:** **{$stage['feed']}**\n";
        $answer .= "• **Today's Feeding:** **{$feedToday} kg** logged of the **{$targetFeed} kg** daily target.\n";
        $answer .= "• **Next Scheduled Feeding:** **{$nextSlot['next_slot']}** ({$nextSlot['label']}).";

        echo json_encode(baseResponse('pond_feed_details', $answer, [
            'recommendation' => "Use {$stage['feed']}. Disperse feed evenly along feeding zones and check feed trays 1.5 hours after broadcast.",
            'rows' => [$targetPond],
            'followups' => ["When is the next feeding?", "Show water quality of {$pName}", "Any disease in {$pName}?"]
        ]));
        exit;
    }

    // Case A6: Specific Pond + Disease / Biosecurity
    if ($isDisease) {
        $diseaseDetection = $targetPond['disease_detection'] ?: 'None';
        $hasAlert = strtolower($diseaseDetection) !== 'none' && strtolower($diseaseDetection) !== 'healthy' && strtolower($diseaseDetection) !== 'clean';

        if ($hasAlert) {
            $answer = "⚠️ **Biosecurity Alert on {$pName}:** Detected **{$diseaseDetection}** (Confidence: " . round(floatval($targetPond['disease_confidence'] ?? 0), 1) . "%). Overall status is **{$status}**.";
            $rec = "Do not share harvesting nets or water between {$pName} and other basins. Notify the farm manager immediately.";
        } else {
            $answer = "✅ **Biosecurity Clean:** No disease detected for **{$pName}**. Shrimp health status is currently marked **{$status}** with 0 active pathogen alerts.";
            $rec = "Continue routine biosecurity scanning and disinfect all sampling equipment after each pond check.";
        }

        echo json_encode(baseResponse('pond_disease_status', $answer, [
            'recommendation' => $rec,
            'rows' => [$targetPond],
            'followups' => ["What is the water quality of {$pName}?", "How is {$pName} doing?", "Show disease reports this week"]
        ]));
        exit;
    }

    // Case A7: Specific Pond + Overall Status ("Hello ang Pond 1?")
    $nextSlot = getNextFeedingSlot();
    $answer = "Comprehensive Status Report for **{$pName}**:\n";
    $answer .= "• **Status:** **{$status}**\n";
    $answer .= "• **Culture Stage:** " . ($doc ? "Day {$doc} • {$stage['stage']}" : "Pre-Stocking") . "\n";
    $answer .= "• **Prescribed Feed:** **{$stage['feed']}** (" . ($doc && $doc <= 19 ? "Fine starter crumble" : "Grower pellets") . ")\n";
    $answer .= "• **Water Readings:** Temp: " . ($temp !== null ? "{$temp}°C" : "-") . " | pH: " . ($ph !== null ? $ph : "-") . " | DO: " . ($do !== null ? "{$do} mg/L" : "-") . " | Salinity: " . ($sal !== null ? "{$sal} ppt" : "-") . "\n";
    $answer .= "• **Today's Feeding:** {$feedToday} kg / {$targetFeed} kg | **Next Slot:** {$nextSlot['next_slot']}\n";
    $answer .= "• **Assigned Caretaker:** " . ($targetPond['assigned_caretaker_name'] ?: 'Unassigned');

    $rec = $status === 'Critical' ? "Urgent attention required on {$pName}. Check aerators and stabilize water readings." :
          ($status === 'Warning' ? "Monitor water parameters closely on {$pName} over the next 4 hours." : "Pond conditions are optimal. Maintain standard routine.");

    echo json_encode(baseResponse('specific_pond_overview', $answer, [
        'recommendation' => $rec,
        'rows' => [$targetPond],
        'followups' => ["What feed formulation for {$pName}?", "What is the temperature of {$pName}?", "When is the next feeding?"]
    ]));
    exit;
}

// =============================================================
// SCENARIO B: HARVEST & YIELD INQUIRIES
// =============================================================
if ($isHarvest) {
    $answer = "Harvest Estimates for your assigned ponds:\n";
    foreach (array_slice($assignedPonds, 0, 5) as $p) {
        $doc = computePondDoc($p['stocking_date']);
        $readiness = floatval($p['harvest_readiness'] ?? 0);
        $expDate = $p['expected_harvest_date'] ? date('M d, Y', strtotime($p['expected_harvest_date'])) : 'TBD';
        $answer .= "• **{$p['pond_name']}:** Readiness: **{$readiness}%** | Target Date: **{$expDate}** (" . ($doc ? "Day {$doc}" : "Pre-Stocking") . ")\n";
    }

    echo json_encode(baseResponse('harvest_overview', $answer, [
        'recommendation' => 'Harvest dates are estimated based on stocking date, growth rates, and feed conversion ratio (FCR). Consult the farm admin prior to final drain-out.',
        'rows' => $assignedPonds,
        'followups' => ['Show feed consumption', 'How is Pond A1 doing?', 'When is the next feeding?']
    ]));
    exit;
}

// =============================================================
// SCENARIO C: FEEDING & SCHEDULE INQUIRIES (ALL PONDS)
// =============================================================
if ($isFeed) {
    // Check if specifically asking about Nursery feed
    if (preg_match('/\bnursery\b/i', $question)) {
        $answer = "For **Nursery Stage Ponds (Days 1–19)**:\n";
        $answer .= "• **Prescribed Feed:** **Tateh - Starter** (high-protein 40% crumble pellets).\n";
        $answer .= "• **Supplementation:** Mix with **Vitamin C** or immunonutrients to boost post-larvae vitality and survival.\n";
        $answer .= "• **Schedule:** Feed 5 times daily (6:00 AM, 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM).";

        echo json_encode(baseResponse('nursery_feed_protocol', $answer, [
            'recommendation' => 'Broadcast feed gently around nursery feeding zones to ensure even post-larvae access.',
            'rows' => $assignedPonds,
            'followups' => ['When is the next feeding time?', 'Show feed consumption', 'How is Pond A1 doing?']
        ]));
        exit;
    }

    $nextSlot = getNextFeedingSlot();
    $today = date('Y-m-d');

    // Fetch today's feeding logs for assigned ponds
    $pondIdList = array_map(fn($p) => (int)$p['id'], $assignedPonds);
    $ph = implode(',', $pondIdList);

    $logsStmt = $conn->query("
        SELECT feeding_time, COUNT(DISTINCT pond_id) as ponds_fed, SUM(amount_kg) as total_kg
        FROM feeding_records
        WHERE pond_id IN ($ph) AND record_date = '{$today}'
        GROUP BY feeding_time
    ");
    $todayLogs = $logsStmt->fetchAll(PDO::FETCH_ASSOC);

    $standardSlots = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
    $loggedMap = [];
    foreach ($todayLogs as $l) {
        $loggedMap[strtoupper(trim($l['feeding_time']))] = $l;
    }

    $loggedList = [];
    $pendingList = [];
    foreach ($standardSlots as $slot) {
        if (isset($loggedMap[strtoupper($slot)])) {
            $loggedList[] = $slot;
        } else {
            $pendingList[] = $slot;
        }
    }

    $answer = "Feeding Schedule Status for your assigned ponds:\n";
    $answer .= "• **Next Scheduled Session:** **{$nextSlot['next_slot']}** ({$nextSlot['label']})\n";
    $answer .= "• **Completed Sessions Today:** " . (count($loggedList) > 0 ? implode(', ', $loggedList) : "None yet") . "\n";
    $answer .= "• **Pending Sessions:** " . (count($pendingList) > 0 ? implode(', ', $pendingList) : "All 5 sessions completed! ✅") . "\n\n";

    $answer .= "**Prescribed Feed Formulations by Basin:**\n";
    foreach (array_slice($assignedPonds, 0, 5) as $p) {
        $doc = computePondDoc($p['stocking_date']);
        $st = getPondStageInfo($doc);
        $answer .= "• **{$p['pond_name']}:** {$st['feed']} (" . ($doc ? "Day {$doc}" : "Pre-Stocking") . ")\n";
    }

    echo json_encode(baseResponse('feeding_schedule_overview', $answer, [
        'recommendation' => count($pendingList) > 0 ? "Prepare feed for the {$nextSlot['next_slot']} session. Broadcast evenly around pond perimeter." : "All 5 sessions are complete for today. Review tomorrow's feed inventory.",
        'rows' => $assignedPonds,
        'followups' => ['What feed formulation should I use?', 'Show feed consumption', 'How is Pond A1 doing?']
    ]));
    exit;
}

// =============================================================
// SCENARIO D: DISEASE & BIOSECURITY INQUIRIES
// =============================================================
if ($isDisease) {
    $flaggedPonds = [];
    foreach ($assignedPonds as $p) {
        $det = strtolower($p['disease_detection'] ?? '');
        if ($det && $det !== 'none' && $det !== 'healthy' && $det !== 'clean') {
            $flaggedPonds[] = $p;
        }
    }

    if (count($flaggedPonds) > 0) {
        $answer = "⚠️ **Active Biosecurity Alert:** Found " . count($flaggedPonds) . " pond(s) with flagged health issues:\n";
        foreach ($flaggedPonds as $fp) {
            $answer .= "• **{$fp['pond_name']}:** {$fp['disease_detection']} (Status: {$fp['status']})\n";
        }
        $rec = "Implement immediate biosecurity isolation: Disinfect footbaths, do not transfer equipment between ponds, and report immediately to the farm manager.";
    } else {
        $answer = "✅ **Biosecurity Status: Normal & Clean.** None of your assigned ponds currently have active White Spot Syndrome (WSSV) or disease alerts. All recent scans indicate healthy shrimp populations.";
        $rec = "Continue daily observation during feeding. Look out for lethargy, empty gut tracts, or reddish discoloration.";
    }

    echo json_encode(baseResponse('disease_biosecurity_status', $answer, [
        'recommendation' => $rec,
        'rows' => $flaggedPonds ?: $assignedPonds,
        'actions' => [['label' => 'Open Disease Scan', 'to' => '/caretaker/disease-scan']],
        'followups' => ['How are my assigned ponds?', 'What is the water quality status?', 'When is the next feeding?']
    ]));
    exit;
}

// =============================================================
// SCENARIO E: WATER QUALITY (ALL PONDS OR ADVISORY QUESTIONS)
// =============================================================
if ($isWaterGeneral || $isTemp || $isPh || $isDO || $isSalinity) {
    // Check if asking general advisory question e.g. "paano kung mababa ang ph", "paano kung mataas ang init"
    if (preg_match('/\b(mababa|acidic|low)\s*(ang)?\s*ph\b/i', $question)) {
        $answer = "📋 **SOP if Water pH is Low (Acidic, Below 7.50):**\n";
        $answer .= "1. Apply agricultural lime (CaCO3 - Calcium Carbonate) or Dolomite at 10–20 kg per 1,000 sqm to raise alkalinity.\n";
        $answer .= "2. Re-test water pH after 2 to 3 hours.\n";
        $answer .= "3. Check alkalinity to maintain a safe buffer (optimal ≥ 100 ppm).";
        echo json_encode(baseResponse('ph_low_advisory', $answer, [
            'recommendation' => 'Do not over-lime. Apply gradually during daylight hours.',
            'rows' => $assignedPonds,
            'followups' => ['Show water quality status', 'What is the pH level of Pond A1?']
        ]));
        exit;
    }

    if (preg_match('/\b(mababa|low)\s*(ang)?\s*(do|oxygen)\b/i', $question)) {
        $answer = "🚨 **Critical Protocol for Low Dissolved Oxygen (DO Below 4.0 mg/L):**\n";
        $answer .= "1. Immediately turn on all paddlewheel aerators and backup aeration blowers.\n";
        $answer .= "2. Suspend or reduce feeding immediately — digesting feed increases shrimp oxygen consumption.\n";
        $answer .= "3. Apply hydrogen peroxide or oxygen-releasing tablets in severe hypoxia emergencies.";
        echo json_encode(baseResponse('do_low_advisory', $answer, [
            'recommendation' => 'Keep aeration running until DO recovers safely above 4.5 mg/L.',
            'rows' => $assignedPonds,
            'followups' => ['Show water quality status', 'Ano ang dissolved oxygen sa pond 1?']
        ]));
        exit;
    }

    $criticalPonds = [];
    $warningPonds = [];
    $healthyPonds = [];

    foreach ($assignedPonds as $p) {
        $temp = floatval($p['temperature'] ?? 0);
        $ph = floatval($p['ph_level'] ?? 0);
        $do = floatval($p['dissolved_oxygen'] ?? 0);

        $isCrit = ($do > 0 && $do < 3.5) || ($temp > 33.0) || ($ph > 0 && ($ph < 7.0 || $ph > 9.0));
        $isWarn = ($do >= 3.5 && $do < 4.5) || ($temp > 31.5) || ($ph > 0 && ($ph < 7.4 || $ph > 8.6));

        if ($isCrit) $criticalPonds[] = $p;
        elseif ($isWarn) $warningPonds[] = $p;
        else $healthyPonds[] = $p;
    }

    $answer = "Water Quality Telemetry Summary (" . count($assignedPonds) . " assigned basins):\n";
    if (count($criticalPonds) > 0) {
        $answer .= "🚨 **Critical Basins (" . count($criticalPonds) . "):** " . implode(', ', array_map(fn($p) => $p['pond_name'], $criticalPonds)) . " - Immediate intervention needed!\n";
    }
    if (count($warningPonds) > 0) {
        $answer .= "⚠️ **Warning Basins (" . count($warningPonds) . "):** " . implode(', ', array_map(fn($p) => $p['pond_name'], $warningPonds)) . "\n";
    }
    if (count($healthyPonds) > 0) {
        $answer .= "✅ **Optimal Basins (" . count($healthyPonds) . "):** " . implode(', ', array_map(fn($p) => $p['pond_name'], $healthyPonds)) . "\n\n";
    }

    $answer .= "**Live Readings by Basin:**\n";
    foreach (array_slice($assignedPonds, 0, 5) as $p) {
        $answer .= "• **{$p['pond_name']}:** Temp {$p['temperature']}°C | pH {$p['ph_level']} | DO {$p['dissolved_oxygen']} mg/L | Salinity {$p['salinity']} ppt\n";
    }

    $rec = count($criticalPonds) > 0 ? "Turn on aerators immediately in critical ponds and report to farm manager." :
          (count($warningPonds) > 0 ? "Re-check aeration and monitor water color/transparency." : "All parameters are within healthy cultivation targets.");

    echo json_encode(baseResponse('water_quality_overview', $answer, [
        'recommendation' => $rec,
        'rows' => $assignedPonds,
        'followups' => ['How is Pond A1 doing?', 'When is the next feeding?', 'Are there any disease alerts?']
    ]));
    exit;
}

// =============================================================
// SCENARIO F: ALERTS & INCIDENT REPORTS
// =============================================================
if ($isAlert) {
    $answer = "Current Farm Alerts & Operational Notices:\n";
    $alertList = [];
    foreach ($assignedPonds as $p) {
        if ($p['status'] === 'Critical' || $p['status'] === 'Warning') {
            $alertList[] = "• **{$p['pond_name']}:** Flagged as **{$p['status']}** (DO: {$p['dissolved_oxygen']} mg/L, Temp: {$p['temperature']}°C)";
        }
    }

    if (count($alertList) > 0) {
        $answer .= implode("\n", $alertList) . "\n\nRecommended Action: Verify aerator operation and notify the farm admin via maintenance incident report.";
    } else {
        $answer .= "✅ No critical equipment or water quality warnings are currently active for your assigned ponds.";
    }

    echo json_encode(baseResponse('alerts_overview', $answer, [
        'recommendation' => 'Log any equipment breakdown or pump failure in the Reports tab.',
        'rows' => $assignedPonds,
        'followups' => ['Show water quality status', 'When is the next feeding?', 'How are my assigned ponds?']
    ]));
    exit;
}

// =============================================================
// SCENARIO G: GENERAL OVERVIEW ("Hello ANG MGA POND KO?")
// =============================================================
$nextSlot = getNextFeedingSlot();
$answer = "Here is the summary of your assigned ponds ({$caretaker['full_name']}):\n";
foreach (array_slice($assignedPonds, 0, 5) as $p) {
    $doc = computePondDoc($p['stocking_date']);
    $st = getPondStageInfo($doc);
    $answer .= "• **{$p['pond_name']}:** Status: **{$p['status']}** | " . ($doc ? "Day {$doc} • {$st['stage']}" : "Pre-Stocking") . " | Feed: **{$st['feed']}**\n";
    $answer .= "  Water: Temp {$p['temperature']}°C, pH {$p['ph_level']}, DO {$p['dissolved_oxygen']} mg/L\n";
}
$answer .= "\n**Next Feeding Time:** **{$nextSlot['next_slot']}** ({$nextSlot['label']}).";

echo json_encode(baseResponse('general_overview', $answer, [
    'recommendation' => 'Ask about a specific pond (e.g. "What is the temperature of Pond A1?") or water quality reading.',
    'rows' => $assignedPonds,
    'followups' => [
        'What is the temperature in Pond A1?',
        'When is the next feeding time?',
        'What feed formulation should I use?',
        'Are there any disease alerts?'
    ]
]));
