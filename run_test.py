"""
ShrimPredict: Terminal Master Test Case Runner
==============================================
Designed for quick, per-test-case execution directly in the terminal,
formatted for taking clear screenshots and thesis documentation proof.

Usage:
    python run_test.py --list
    python run_test.py --tc TC-4.1.1
    python run_test.py --tc TC-4.1.2
    python run_test.py --tc TC-4.1.3
    python run_test.py --tc TC-4.1.4
    python run_test.py --tc TC-4.2.1
    python run_test.py --tc TC-4.3.1
    python run_test.py --tc TC-5.1.1
    python run_test.py --tc TC-5.1.2
    python run_test.py --tc TC-5.2.1
    python run_test.py --tc TC-5.2.2
    python run_test.py --tc TC-5.3.1
    python run_test.py --tc TC-5.3.2
    python run_test.py --tc TC-WQ
    python run_test.py --tc TC-GUARD
"""

import os
import sys
import time
import argparse
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Choose python executable from .venv311 if available
PYTHON_EXE = ROOT_DIR / ".venv311" / "Scripts" / "python.exe"
if not PYTHON_EXE.is_file():
    PYTHON_EXE = ROOT_DIR / ".venv" / "Scripts" / "python.exe"
if not PYTHON_EXE.is_file():
    PYTHON_EXE = Path(sys.executable)

TEST_CATALOG = [
    {
        "id": "TC-4.1.1",
        "alias": ["4.1.1", "FEED", "FEED_MONITORING"],
        "name": "Feed Consumption Estimation Accuracy",
        "objective": "Objective 4.1: Computer Vision & Feed Monitoring",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_4.py",
        "cmd_args": ["--tc", "TC-4.1.1"],
        "expected": "MAE <= 250 g, Deviation <= 5.0% (Accuracy >= 95.0%)",
        "target": "Algorithm reliability on feeding tray biomass ground-truth",
    },
    {
        "id": "TC-4.1.2",
        "alias": ["4.1.2", "LATENCY", "TIME"],
        "name": "Single-Image Processing Latency & Preprocessing Speed",
        "objective": "Objective 4.1: Image Preprocessing Efficiency",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_4.py",
        "cmd_args": ["--tc", "TC-4.1.2"],
        "expected": "Execution latency <= 100.0 ms per image frame",
        "target": "Aspect-preserving letterbox tensor generation speed",
    },
    {
        "id": "TC-4.1.3",
        "alias": ["4.1.3", "FPS", "THROUGHPUT"],
        "name": "Real-Time Frame Rate (FPS) & Algorithmic Scaling",
        "objective": "Objective 4.1: Real-Time Stream Feasibility",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_4.py",
        "cmd_args": ["--tc", "TC-4.1.3"],
        "expected": "Frame rate >= 30.0 FPS at standard HD / Full HD streams",
        "target": "Throughput across QVGA, VGA, HD, Full HD, and CNN resolutions",
    },
    {
        "id": "TC-4.1.4",
        "alias": ["4.1.4", "MEMORY", "RAM"],
        "name": "Image Processing Memory Profiling & Leak Check",
        "objective": "Objective 4.1: Memory Stability Profiling",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_4.py",
        "cmd_args": ["--tc", "TC-4.1.4"],
        "expected": "Heap & RSS memory stable, Post-run drift <= 15.0 MB",
        "target": "psutil & tracemalloc process resident memory tracking",
    },
    {
        "id": "TC-4.1.5",
        "alias": ["4.1.5", "ROBUSTNESS", "ENV", "NOISE"],
        "name": "Image Analysis Robustness Under Environmental Perturbations",
        "objective": "Objective 4.1: Computer Vision Environmental Reliability",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_4.py",
        "cmd_args": ["--tc", "TC-4.1.5"],
        "expected": "Tensor integrity = 100.0%, Execution latency <= 50.0 ms across 5 aquatic noise states",
        "target": "Robustness against low-light (06:00/18:00 feeding checks), pond glare, silt, motion blur",
    },
    {
        "id": "TC-4.2.1",
        "alias": ["4.2.1", "4.2", "WSD", "DISEASE"],
        "name": "WSD Disease Detection (Confusion Matrix & Classification Metrics)",
        "objective": "Objective 4.2: Disease Detection Performance",
        "type": "Requires Flask AI API (http://127.0.0.1:5001)",
        "script": "tests/eval_objective_4.py",
        "cmd_args": ["--tc", "TC-4.2"],
        "expected": "Accuracy >= 90.0%, Precision >= 90.0%, Recall >= 90.0%, F1 >= 90.0%",
        "target": "Binary confusion matrix on held-out shrimp split",
    },
    {
        "id": "TC-4.3.1",
        "alias": ["4.3.1", "4.3", "HARVEST", "YIELD"],
        "name": "Harvest Prediction Goodness-of-Fit & Error (MAE, RMSE, R^2)",
        "objective": "Objective 4.3: Harvest Yield Prediction",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_4.py",
        "cmd_args": ["--tc", "TC-4.3.1"],
        "expected": "MAE <= 50.0 kg, RMSE <= 60.0 kg, R^2 >= 0.90",
        "target": "Correlation between feed consumption and final pond yield",
    },
    {
        "id": "TC-4.3.2",
        "alias": ["4.3.2", "TIMING", "DOC", "HARVEST_DATE"],
        "name": "Harvest Readiness Timing & Target Date Prediction Error",
        "objective": "Objective 4.3: Harvest Timing Accuracy",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_4.py",
        "cmd_args": ["--tc", "TC-4.3.2"],
        "expected": "Timing MAE <= 5.0 Days, RMSE <= 7.0 Days, R^2 >= 0.90",
        "target": "Discrepancy in culture days between growth trajectory forecast vs actual harvest date",
    },
    {
        "id": "TC-5.1.1",
        "alias": ["5.1.1", "INTEGRATION", "PIPELINE"],
        "name": "End-to-End Pipeline Multi-Tier Integration",
        "objective": "Objective 5.1: Cross-Module System Integration",
        "type": "Requires MySQL + Apache + Flask AI API",
        "script": "tests/test_objective_5_selenium.py",
        "cmd_args": ["--tc", "TC-5.1.1"],
        "expected": "100% synchronization across Health, Feeding, Telemetry, Harvest, Disease",
        "target": "5-Tier cross-module database sync and API handshake",
    },
    {
        "id": "TC-5.1.2",
        "alias": ["5.1.2", "UI_CORE", "SELENIUM"],
        "name": "Web Interface Core Functional Features (Selenium Automated Test)",
        "objective": "Objective 5.1: Functional UI Automation",
        "type": "Requires Vite (5173) + Apache + MySQL + Chrome",
        "script": "tests/test_objective_5_selenium.py",
        "cmd_args": ["--tc", "TC-5.1.2"],
        "expected": "All core actions execute without UI blocks (Auth, Scan, Feed log, Validation)",
        "target": "Automated visible browser navigation with screenshot capture",
    },
    {
        "id": "TC-5.1.3",
        "alias": ["5.1.3", "BOUNDARY", "VALIDATION", "INTEGRITY"],
        "name": "Boundary Condition Handling & Invalid Telemetry Rejection",
        "objective": "Objective 5.1: System Functionality & Data Integrity",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_5_extensions.py",
        "cmd_args": ["--tc", "TC-5.1.3"],
        "expected": "Rejection Rate = 100.0%, Database corruption = 0.00% across 12 boundary edge-cases",
        "target": "Boundary Value Analysis & input sanitization (negative feed, impossible pH/DO, invalid files)",
    },
    {
        "id": "TC-5.2.1",
        "alias": ["5.2.1", "VIEWPORT", "RESPONSIVE", "USABILITY"],
        "name": "Web UI Multi-Viewport Usability (Desktop 1920x1080 vs Mobile 375x812)",
        "objective": "Objective 5.2: Multi-Viewport Layout Responsiveness",
        "type": "Requires Vite (5173) + Chrome",
        "script": "tests/test_objective_5_selenium.py",
        "cmd_args": ["--tc", "TC-5.2.1"],
        "expected": "Zero layout clipping/overflow; rendering feedback latency <= 1000 ms",
        "target": "Viewport comparison and UI rendering latency",
    },
    {
        "id": "TC-5.2.2",
        "alias": ["5.2.2", "NAVIGATION", "CLICK_DEPTH"],
        "name": "Navigation & User Journey Efficiency (Click-Depth <= 3)",
        "objective": "Objective 5.2: Navigation Efficiency",
        "type": "Requires Vite (5173) + Chrome",
        "script": "tests/test_objective_5_selenium.py",
        "cmd_args": ["--tc", "TC-5.2.2"],
        "expected": "Journey from Dashboard to Disease Scan <= 3 clicks; all routes HTTP 200 OK",
        "target": "Click-count audit and broken link verification across all core routes",
    },
    {
        "id": "TC-5.2.3",
        "alias": ["5.2.3", "ACTIONABLE", "ALERT", "CLARITY"],
        "name": "Diagnostic Feedback Usability & Actionable Alert Clarity",
        "objective": "Objective 5.2: Assistance to Shrimp Farmers (Usability)",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_5_extensions.py",
        "cmd_args": ["--tc", "TC-5.2.3"],
        "expected": "Actionable Remediation Coverage = 100.0%, Usability Clarity Score >= 4.5 / 5.0",
        "target": "Readability and actionability of emergency alerts (WSD isolation, hypoxia aeration, pH buffering)",
    },
    {
        "id": "TC-5.3.1",
        "alias": ["5.3.1", "CONCURRENT", "LOAD"],
        "name": "Multi-User Concurrent Load Simulation (10, 50, 100 Users)",
        "objective": "Objective 5.3: Concurrent Load Scalability",
        "type": "Requires Apache/PHP Backend + Flask AI API",
        "script": "tests/run_objective_5_load_stress.py",
        "cmd_args": ["--tc", "TC-5.3.1"],
        "expected": "Mean latency <= 2000 ms, Error rate 0.00% under concurrent threads",
        "target": "Thread pool simulation of simultaneous farmer telemetry requests",
    },
    {
        "id": "TC-5.3.2",
        "alias": ["5.3.2", "STRESS", "RECOVERY"],
        "name": "Stress Breaking Point & Cooldown Recovery Response",
        "objective": "Objective 5.3: Stress Recovery & Availability",
        "type": "Requires Apache/PHP Backend + Flask AI API",
        "script": "tests/run_objective_5_load_stress.py",
        "cmd_args": ["--tc", "TC-5.3.2"],
        "expected": "Zero unhandled crashes; Cooldown recovery latency <= 5.0 seconds",
        "target": "Step-stress ramp-up (10 -> 40 -> 90 users) and latency stabilization",
    },
    {
        "id": "TC-5.3.3",
        "alias": ["5.3.3", "NETWORK", "JITTER", "RESILIENCE"],
        "name": "Network Jitter & Remote Farm Connectivity Resilience",
        "objective": "Objective 5.3: System Effectiveness on Farm Cellular Data",
        "type": "Standalone (No server needed)",
        "script": "tests/eval_objective_5_extensions.py",
        "cmd_args": ["--tc", "TC-5.3.3"],
        "expected": "Packet Loss = 0.00%, Availability = 100.0% under coastal 3G/4G cellular jitter (150-750 ms)",
        "target": "Network jitter resilience and socket timeout recovery in remote aquaculture facilities",
    },
    {
        "id": "TC-WQ",
        "alias": ["WQ", "WATER_QUALITY", "OCR"],
        "name": "Water Quality Meter Scan & 7-Segment OCR Unit Tests (23 Tests)",
        "objective": "Water Quality Module: LCD & Optical Extraction",
        "type": "Standalone (Node.js)",
        "script": "tests/test_water_quality_scan.mjs",
        "cmd_args": [],
        "expected": "All 23 automated tests pass with 0 errors",
        "target": "PH-80, DO meter, Salinity meter, Temp OCR & logsheet scanning",
    },
    {
        "id": "TC-GUARD",
        "alias": ["GUARD", "ORANGE", "COOKED"],
        "name": "Cooked Orange Shrimp Quality Rejection Guard Test",
        "objective": "Pre-Inference Quality Validator Guard",
        "type": "Standalone (Pytest)",
        "script": "tests/test_cooked_orange_guard.py",
        "cmd_args": [],
        "expected": "Bright orange shrimp detected & rejected; raw shrimp accepted",
        "target": "HSV color space cooked shrimp anomaly detector unit test",
    },
]


def check_server(url: str, timeout: float = 1.5) -> bool:
    import urllib.request
    try:
        urllib.request.urlopen(url, timeout=timeout)
        return True
    except Exception:
        return False


def print_banner(tc_info: dict):
    print("=" * 82)
    print("  SHRIMPREDICT SYSTEM EVALUATION - INDIVIDUAL TEST CASE RUNNER")
    print("=" * 82)
    print(f"  Test Case ID     : {tc_info['id']}")
    print(f"  Test Scenario    : {tc_info['name']}")
    print(f"  Aligned Objective: {tc_info['objective']}")
    print(f"  Execution Mode   : {tc_info['type']}")
    print(f"  Expected Standard: {tc_info['expected']}")
    print("=" * 82)
    print()


def list_test_cases():
    print("=" * 82)
    print("  SHRIMPREDICT MASTER TEST CATALOG (OBJECTIVES 4 & 5)")
    print("=" * 82)
    print(f"  {'Test Case ID':<12} | {'Environment / Precondition':<30} | {'Scenario Name'}")
    print("-" * 82)
    for t in TEST_CATALOG:
        print(f"  {t['id']:<12} | {t['type']:<30} | {t['name']}")
    print("=" * 82)
    print("\n  USAGE EXAMPLES (Pumili ng isa at i-run sa terminal):")
    print("    python run_test.py --tc TC-4.1.1       (Feed Consumption Accuracy)")
    print("    python run_test.py --tc TC-4.1.2       (Image Processing Latency)")
    print("    python run_test.py --tc TC-4.1.3       (Frame Rate FPS Benchmark)")
    print("    python run_test.py --tc TC-4.1.4       (RAM Memory Profiling)")
    print("    python run_test.py --tc TC-4.2.1       (WSD Disease Detection Metrics)")
    print("    python run_test.py --tc TC-4.3.1       (Harvest Prediction Error & R^2)")
    print("    python run_test.py --tc TC-WQ          (Water Quality 23 OCR Tests)")
    print("    python run_test.py --tc TC-GUARD       (Cooked Shrimp Guard Unit Test)")
    print("=" * 82)


def main():
    parser = argparse.ArgumentParser(description="ShrimPredict Terminal Test Runner")
    parser.add_argument("--tc", type=str, default="", help="Test Case ID to execute (e.g. TC-4.1.1, TC-4.1.2, TC-4.3.1, TC-WQ)")
    parser.add_argument("--list", action="store_true", help="List all available test cases and their execution commands")
    args = parser.parse_args()

    if args.list or not args.tc:
        list_test_cases()
        if not args.tc:
            return

    query = args.tc.strip().upper()
    matched = None
    for item in TEST_CATALOG:
        if item["id"] == query or query in item["alias"]:
            matched = item
            break

    if not matched:
        print(f"\n[!] Error: Test Case '{args.tc}' not recognized.")
        print("    Run 'python run_test.py --list' to see valid Test Case IDs.")
        return

    print_banner(matched)

    # Check server preconditions if required
    if "127.0.0.1:5001" in matched["type"]:
        flask_up = check_server("http://127.0.0.1:5001/health")
        if not flask_up:
            print("[!] PAUNAWA: Hindi pa bukas ang Flask AI API sa http://127.0.0.1:5001!")
            print("    Para sa live inference:")
            print("    1. Buksan ang isa pang terminal window.")
            print("    2. I-run ang: .\\start_ai_api.bat")
            print("    3. Pag online na, ulitin ang command na ito.\n")
            print("    Tinatangka pa ring i-run ang test...")
            time.sleep(1.0)

    # Dispatch execution
    script_path = ROOT_DIR / matched["script"]
    if not script_path.is_file():
        print(f"[!] Error: Test script not found at {script_path}")
        return

    if script_path.suffix == ".mjs":
        cmd = ["node", str(script_path)]
    elif matched["id"] == "TC-GUARD":
        cmd = [str(PYTHON_EXE), "-m", "pytest", str(script_path), "-v"]
    else:
        cmd = [str(PYTHON_EXE), str(script_path)] + matched["cmd_args"]

    print(f"Executing: {' '.join(cmd)}\n")
    sys.stdout.flush()
    res = subprocess.run(cmd, cwd=str(ROOT_DIR))

    print("\n" + "=" * 82)
    if res.returncode == 0:
        print("  FINAL EVALUATION VERDICT: [ PASSED ]")
        print("=" * 82)
        print(f"  Test Case ID      : {matched['id']}")
        print(f"  Scenario Name     : {matched['name']}")
        print(f"  Expected Standard : {matched['expected']}")
        print(f"  Evaluation Status : [ PASSED ] (All Acceptance Criteria Satisfied)")
        print(f"  Research Status   : Scientific Hypothesis Verified & Replicable")
    else:
        print("  FINAL EVALUATION VERDICT: [ FAILED / INCOMPLETE ]")
        print("=" * 82)
        print(f"  Test Case ID      : {matched['id']}")
        print(f"  Evaluation Status : [ FAILED ] (Process exited with code {res.returncode})")
        print(f"  Troubleshooting   : Check prerequisites or start required local server")
    print("=" * 82 + "\n")

    sys.exit(res.returncode)


if __name__ == "__main__":
    main()
