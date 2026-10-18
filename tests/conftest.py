"""
ShrimPredict: Pytest Configuration and Test Report Customization
Configures test metadata, hardware environment details, and embedded visual proof.

Conducted By (Researchers): Rodney Evan Villela, Rhona Cristel Javier, Nicca Kate Arroyo, and Frederick Nicoll Quiroz
System: ShrimPredict: Shrimp Disease Detection, Feed Monitoring, and Harvest Prediction System
"""

import os
import sys
import platform
import datetime
from pathlib import Path
import psutil
import pytest

ROOT_DIR = Path(__file__).resolve().parents[1]
SCREENSHOTS_DIR = ROOT_DIR / "test_results" / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def pytest_html_report_title(report):
    """Sets publication-ready title for the HTML test execution report."""
    report.title = "ShrimPredict: Software Quality & Functional UI Evaluation Report"


def pytest_configure(config):
    """Enriches report metadata with researcher attribution and test workstation hardware specs."""
    ram_gb = psutil.virtual_memory().total / (1024 ** 3)
    cpu_cores = f"{psutil.cpu_count(logical=False)} Physical / {psutil.cpu_count(logical=True)} Logical"
    
    # Store standard environment metadata
    metadata = {
        "System Title": "ShrimPredict: Shrimp Disease Detection, Feed Monitoring, and Harvest Prediction System",
        "Lead Researchers / Evaluators": "[ILAGAY ANG MGA PANGALAN NINYO DITO]",
        "Operating System": platform.platform(),
        "Processor": platform.processor(),
        "CPU Cores": cpu_cores,
        "Total Installed RAM": f"{ram_gb:.2f} GB",
        "Python Runtime": platform.python_version(),
        "Execution Timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Target Application": "http://localhost:5173",
        "Inference Microservice": "http://127.0.0.1:5001"
    }
    
    # Set pytest-metadata dictionary if supported
    if hasattr(config, "_metadata"):
        config._metadata.clear()
        config._metadata.update(metadata)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Captures test execution status and attaches visual screenshot artifacts to the HTML report."""
    outcome = yield
    report = outcome.get_result()
    extras = getattr(report, "extras", [])
    
    if report.when == "call":
        # Look for matching screenshots from test case ID
        test_name = item.name.lower()
        matched_screenshots = []
        
        if "5_1_2" in test_name or "feature" in test_name:
            for s in [
                "TC_5_1_2_upload_and_wsd_result.png",
                "TC_5_1_2_feed_log.png",
                "TC_5_1_2_invalid_file_alert.png"
            ]:
                p = SCREENSHOTS_DIR / s
                if p.is_file():
                    matched_screenshots.append(p)
                    
        elif "5_2_1" in test_name or "usability" in test_name or "viewport" in test_name:
            for s in [
                "TC_5_2_1_desktop_ui.png",
                "TC_5_2_1_mobile_ui.png"
            ]:
                p = SCREENSHOTS_DIR / s
                if p.is_file():
                    matched_screenshots.append(p)

        # Attach any discovered screenshot artifacts to the report
        try:
            from pytest_html import extras as html_extras
            for sc_path in matched_screenshots:
                rel_path = f"../screenshots/{sc_path.name}"
                extras.append(html_extras.image(rel_path, name=sc_path.name))
        except Exception:
            pass

    report.extras = extras

