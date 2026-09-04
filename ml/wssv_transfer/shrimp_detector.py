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


def count_shrimp_in_image(image_path: Path) -> dict:
    """Count shrimp for preview, using the same content detector as the main scan."""
    detector_result = validate_image_content(image_path)
    if not detector_result.get("shrimp_detected", False):
        return {
            "shrimp_detected": False,
            "shrimp_count": 0,
            "valid_shrimp_present": False,
            "status": "No shrimp detected",
            "message": detector_result.get("message", "No shrimp detected."),
            "confidence": 0.0,
        }

    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        return {
            "shrimp_detected": False,
            "shrimp_count": 0,
            "valid_shrimp_present": False,
            "status": "No shrimp detected",
            "message": "The selected image could not be decoded.",
            "confidence": 0.0,
        }

    height, width = image.shape[:2]
    if height == 0 or width == 0:
        return {
            "shrimp_detected": False,
            "shrimp_count": 0,
            "valid_shrimp_present": False,
            "status": "No shrimp detected",
            "message": "The selected image is invalid.",
            "confidence": 0.0,
        }

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    lower = np.array([0, 20, 20], dtype=np.uint8)
    upper = np.array([180, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)

    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    if cv2.countNonZero(mask) < max(150, int((height * width) * 0.002)):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        _, threshold = cv2.threshold(gray, 25, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        mask = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, kernel)

    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    shrimp_count = 0
    min_area = max(350, int((height * width) * 0.0008))

    for idx in range(1, num_labels):
        x, y, w, h, area = stats[idx]
        if area < min_area:
            continue
        if w < 10 or h < 10:
            continue
        aspect = w / max(h, 1)
        if 0.2 <= aspect <= 4.5:
            shrimp_count += 1

    # The main detector has already confirmed shrimp content. Contours can
    # under-count a shrimp overlapping a hand, so never report zero here.
    shrimp_count = max(1, shrimp_count)
    confidence = min(99.0, max(55.0, shrimp_count * 18.0))

    return {
        "shrimp_detected": True,
        "shrimp_count": int(shrimp_count),
        "valid_shrimp_present": True,
        "status": "success",
        "message": f"Detected {shrimp_count} shrimp in the preview image.",
        "confidence": round(float(confidence), 2),
    }


def detect_shrimp(image_path: Path) -> dict:
    """Backward-compatible shrimp detector wrapper used by Flask."""
    result = validate_image_content(image_path)
    result["shrimp_count"] = 1 if result.get("shrimp_detected", False) else 0
    result["valid_shrimp_present"] = bool(result.get("shrimp_detected", False))
    return result


if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(detect_shrimp(Path(sys.argv[1])), indent=2))
    else:
        print("Usage: python shrimp_detector.py <image_path>")
