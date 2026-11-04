"""Shrimp detector and counter for ShrimPredict.

Uses the trained Machine Learning Shrimp Presence Classifier (Stage 1) to determine
whether a real shrimp is present in an image, count the shrimp, and reject non-shrimp objects.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
import cv2
import numpy as np

try:
    from content_validator import validate_image_content
except ImportError:
    from .content_validator import validate_image_content


def _count_contours(image: np.ndarray) -> int:
    """Estimate number of distinct shrimp specimens in confirmed shrimp image."""
    if image is None or image.size == 0 or image.ndim != 3:
        return 1
    h, w = image.shape[:2]
    img_small = cv2.resize(image, (320, 320), interpolation=cv2.INTER_AREA)

    hsv = cv2.cvtColor(img_small, cv2.COLOR_BGR2HSV)
    skin_mask = cv2.inRange(hsv, np.array([0, 30, 60], dtype=np.uint8), np.array([25, 190, 255], dtype=np.uint8))
    non_skin = cv2.bitwise_not(skin_mask)

    gray = cv2.cvtColor(img_small, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 40, 130)
    specimen_edges = cv2.bitwise_and(edges, edges, mask=non_skin)

    kernel = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(specimen_edges, kernel, iterations=1)
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = (320 * 320) * 0.015
    valid_specs = [c for c in contours if cv2.contourArea(c) > min_area]
    return max(1, len(valid_specs))


def count_shrimp_in_image(image_path: Path) -> dict:
    """Validate presence and count shrimp in preview image."""
    validator_result = validate_image_content(image_path)
    state = validator_result.get("presence_state", "no_shrimp")

    if state == "no_shrimp":
        return {
            "success": True,
            "shrimp_detected": False,
            "valid_shrimp_present": False,
            "shrimp_count": 0,
            "presence_state": "no_shrimp",
            "status": "no_shrimp",
            "display_status": "No Shrimp Detected",
            "predicted_class": "No Shrimp",
            "confidence": validator_result.get("confidence", 0.0),
            "probability_shrimp": validator_result.get("probability_shrimp", 0.0),
            "message": validator_result.get("message", "No shrimp detected."),
            "is_cooked": False,
            "content_category": validator_result.get("content_category", "Non-Shrimp"),
        }

    if state == "uncertain":
        return {
            "success": True,
            "shrimp_detected": False,
            "valid_shrimp_present": False,
            "shrimp_count": 0,
            "presence_state": "uncertain",
            "status": "uncertain",
            "display_status": "Unable to Identify Shrimp. Please Retake or Upload a Clearer Image.",
            "predicted_class": "Uncertain",
            "confidence": validator_result.get("confidence", 0.0),
            "probability_shrimp": validator_result.get("probability_shrimp", 0.0),
            "message": "Unable to Identify Shrimp. Please Retake or Upload a Clearer Image.",
            "is_cooked": False,
            "content_category": "Uncertain",
        }

    # State is shrimp_detected
    is_cooked = bool(validator_result.get("is_cooked", False))
    image = cv2.imread(str(image_path))
    shrimp_count = _count_contours(image) if image is not None else 1

    if is_cooked:
        return {
            "success": True,
            "shrimp_detected": True,
            "valid_shrimp_present": False,
            "shrimp_count": shrimp_count,
            "presence_state": "cooked_shrimp",
            "status": "cooked_shrimp",
            "display_status": "Unavailable to scan: Cooked Shrimp",
            "predicted_class": "Cooked Shrimp",
            "confidence": validator_result.get("confidence", 0.0),
            "probability_shrimp": validator_result.get("probability_shrimp", 0.0),
            "message": "Shrimp was detected, but it appears to be cooked. Please upload raw uncooked shrimp for diagnosis.",
            "is_cooked": True,
            "content_category": "Cooked Shrimp",
        }

    return {
        "success": True,
        "shrimp_detected": True,
        "valid_shrimp_present": True,
        "shrimp_count": shrimp_count,
        "presence_state": "shrimp_detected",
        "status": "success",
        "display_status": "Ready for Scan",
        "predicted_class": "Shrimp",
        "confidence": validator_result.get("confidence", 0.0),
        "probability_shrimp": validator_result.get("probability_shrimp", 0.0),
        "message": "Shrimp successfully detected.",
        "is_cooked": False,
        "content_category": "Shrimp",
    }


def detect_shrimp(image_path: Path) -> dict:
    """Backward-compatible shrimp detector wrapper used by Flask."""
    return count_shrimp_in_image(image_path)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_path = Path(sys.argv[1])
        res = count_shrimp_in_image(test_path)
        print(json.dumps(res, indent=2))
    else:
        print("Usage: python shrimp_detector.py <image_path>")
