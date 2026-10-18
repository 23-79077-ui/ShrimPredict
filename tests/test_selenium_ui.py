"""Selenium smoke tests for the shipped ShrimPredict React routes.

Credentials are supplied through environment variables. Tests never use the
sample credentials shown in the login page and do not save farm records unless
SHRIMPREDICT_UI_WRITE_TESTS=1 is explicitly enabled.
"""

from __future__ import annotations

import os
import unittest
from pathlib import Path

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as expected
    from selenium.webdriver.support.ui import WebDriverWait
except ImportError as exc:
    raise SystemExit(
        "Selenium is required: install it with "
        "`python -m pip install -r tests\\requirements.txt` in the selected environment."
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.getenv("SHRIMPREDICT_BASE_URL", "http://localhost:5173").rstrip("/")
WAIT_SECONDS = float(os.getenv("SHRIMPREDICT_UI_WAIT_SECONDS", "20"))
HEADLESS = os.getenv("SHRIMPREDICT_HEADLESS", "true").casefold() not in {"0", "false", "no"}
WRITE_TESTS = os.getenv("SHRIMPREDICT_UI_WRITE_TESTS", "").casefold() in {"1", "true", "yes"}


def _start_browser() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    if HEADLESS:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,1000")
    options.add_argument("--force-device-scale-factor=1")
    options.add_argument("--disable-dev-shm-usage")
    return webdriver.Chrome(options=options)


class BrowserTest(unittest.TestCase):
    def setUp(self) -> None:
        self.driver = _start_browser()
        self.wait = WebDriverWait(self.driver, WAIT_SECONDS)

    def tearDown(self) -> None:
        self.driver.quit()

    def open_page(self, path: str) -> None:
        self.driver.get(f"{BASE_URL}{path}")

    def login_as(self, role: str) -> None:
        email = os.getenv(f"SHRIMPREDICT_{role.upper()}_EMAIL", "")
        password = os.getenv(f"SHRIMPREDICT_{role.upper()}_PASSWORD", "")
        if not email or not password:
            self.skipTest(
                f"Set SHRIMPREDICT_{role.upper()}_EMAIL and "
                f"SHRIMPREDICT_{role.upper()}_PASSWORD for authenticated UI tests."
            )

        self.open_page("/login")
        role_label = "Admin" if role == "admin" else "Caretaker"
        self.wait.until(
            expected.element_to_be_clickable(
                (By.XPATH, f"//button[normalize-space()='{role_label}']")
            )
        ).click()
        email_field = self.wait.until(expected.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
        password_field = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        email_field.clear()
        email_field.send_keys(email)
        password_field.clear()
        password_field.send_keys(password)
        password_field.find_element(By.XPATH, "ancestor::form").submit()
        destination = "/admin/" if role == "admin" else "/caretaker/"
        self.wait.until(lambda driver: destination in driver.current_url)


class PublicAndAuthSmokeTests(BrowserTest):
    def test_landing_login_and_protected_route_redirect(self) -> None:
        self.driver.set_window_size(390, 844)
        self.open_page("/")
        self.assertLessEqual(
            self.driver.execute_script("return window.innerWidth"),
            576,
            "The login usability check must run at a narrow/mobile viewport.",
        )
        self.wait.until(expected.presence_of_element_located((By.ID, "root")))
        self.assertTrue(self.driver.find_element(By.TAG_NAME, "body").text.strip())

        self.open_page("/login")
        email = self.wait.until(expected.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
        password = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        submit = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        for control in (email, password, submit):
            self.driver.execute_script(
                "arguments[0].scrollIntoView({block: 'center'});", control
            )
            self.wait.until(expected.visibility_of(control))
        email.clear()
        password.clear()
        self.assertFalse(self.driver.execute_script("return arguments[0].checkValidity()", email))
        self.assertFalse(self.driver.execute_script("return arguments[0].checkValidity()", password))

        self.open_page("/caretaker/disease-scan")
        self.wait.until(lambda driver: driver.current_url.endswith("/login"))


@unittest.skipUnless(
    os.getenv("SHRIMPREDICT_CARETAKER_EMAIL") and os.getenv("SHRIMPREDICT_CARETAKER_PASSWORD"),
    "Caretaker UI credentials are not configured.",
)
class CaretakerWorkflowTests(BrowserTest):
    def test_disease_scan_image_upload_preview(self) -> None:
        self.login_as("caretaker")
        self.open_page("/caretaker/disease-scan")
        self.wait.until(
            expected.text_to_be_present_in_element(
                (By.CSS_SELECTOR, ".caretaker-diseasescan-hub"), "Shrimp Disease Scan"
            )
        )
        image_path = ROOT / "ml" / "test_wssv_shrimp.jpg"
        self.assertTrue(image_path.is_file(), f"Missing workspace fixture: {image_path}")
        image_input = self.wait.until(
            expected.presence_of_element_located((By.CSS_SELECTOR, "input[type='file'][accept='image/*']"))
        )
        self.driver.execute_script("arguments[0].classList.remove('d-none');", image_input)
        image_input.send_keys(str(image_path))
        self.wait.until(
            expected.presence_of_element_located((By.CSS_SELECTOR, "img[alt='shrimp scan target']"))
        )

        if WRITE_TESTS:
            scan_button = self.wait.until(
                expected.element_to_be_clickable(
                    (By.XPATH, "//button[contains(normalize-space(.), 'Scan Shrimp')]")
                )
            )
            scan_button.click()
            self.wait.until(
                lambda driver: "Uncertain Prediction" in driver.find_element(By.TAG_NAME, "body").text
                or "Disease Detected" in driver.find_element(By.TAG_NAME, "body").text
                or "Healthy Shrimp" in driver.find_element(By.TAG_NAME, "body").text
                or "Poor Image Quality" in driver.find_element(By.TAG_NAME, "body").text
                or "No Shrimp Detected" in driver.find_element(By.TAG_NAME, "body").text
            )
        else:
            self.assertIn("Scan Shrimp", self.driver.find_element(By.TAG_NAME, "body").text)
            print(
                "\nImage preview passed. Inference and report persistence were not submitted; "
                "set SHRIMPREDICT_UI_WRITE_TESTS=1 to opt in."
            )

    def test_feed_entry_conversion_and_history_route(self) -> None:
        self.login_as("caretaker")
        self.open_page("/caretaker/my-pond")
        self.wait.until(
            expected.text_to_be_present_in_element(
                (By.TAG_NAME, "body"), "Log Feeding Entry"
            )
        )
        amount = self.wait.until(
            expected.presence_of_element_located(
                (By.CSS_SELECTOR, "input[type='number'][placeholder='e.g. 4.0 (kg)']")
            )
        )
        if not amount.is_enabled():
            self.skipTest("Feed amount is disabled for the selected pond's current daily state.")
        amount.clear()
        amount.send_keys("4")
        self.wait.until(
            expected.text_to_be_present_in_element((By.TAG_NAME, "body"), "4,000 g")
        )

        if WRITE_TESTS:
            save_button = self.wait.until(
                expected.element_to_be_clickable(
                    (By.XPATH, "//button[contains(normalize-space(.), 'Log Feeding for')]")
                )
            )
            save_button.click()
            self.wait.until(
                lambda driver: "successfully" in driver.find_element(By.TAG_NAME, "body").text.casefold()
                or "logged" in driver.find_element(By.TAG_NAME, "body").text.casefold()
            )
        else:
            print(
                "\nFeed amount conversion passed; record was not saved. "
                "Set SHRIMPREDICT_UI_WRITE_TESTS=1 to opt in."
            )

        self.open_page("/caretaker/feeding-history")
        self.wait.until(
            expected.text_to_be_present_in_element((By.TAG_NAME, "body"), "Feeding")
        )


@unittest.skipUnless(
    os.getenv("SHRIMPREDICT_ADMIN_EMAIL") and os.getenv("SHRIMPREDICT_ADMIN_PASSWORD"),
    "Admin UI credentials are not configured.",
)
class AdminHarvestWorkflowTests(BrowserTest):
    def test_harvest_forecast_route_and_table(self) -> None:
        self.login_as("admin")
        self.open_page("/admin/harvest")
        self.wait.until(
            expected.text_to_be_present_in_element((By.TAG_NAME, "body"), "Harvest Forecast")
        )
        headings = [
            element.text.strip()
            for element in self.driver.find_elements(By.CSS_SELECTOR, "table thead th")
        ]
        self.assertTrue(
            any("Est. Harvest" in heading for heading in headings),
            f"Harvest table headings did not include 'Est. Harvest': {headings}",
        )
        body = self.driver.find_element(By.TAG_NAME, "body").text
        self.assertIn("Feed Used", body)
        self.assertIn("Readiness", body)


if __name__ == "__main__":
    unittest.main(verbosity=2)
