from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps


def detect_cooked_orange_shrimp(image, threshold: float = 0.065) -> bool:
    """Return True when characteristic cooked shrimp orange/red coloration (astaxanthin pigment)
    is detected across the specimen area or image, distinguishing cooked shrimp from raw shrimp.
    Excludes caretaker hand/skin tones when raw shrimp specimens are held in hand.
    """
    if image is None:
        return False

    if isinstance(image, (str, Path)):
        img = cv2.imread(str(image), cv2.IMREAD_COLOR)
        if img is None:
            return False
    elif isinstance(image, np.ndarray):
        img = image
    else:
        try:
            img = np.asarray(image)
        except Exception:
            return False

    if img.size == 0 or img.ndim != 3:
        return False

    h, w = img.shape[:2]
    if max(h, w) > 400:
        scale = 320.0 / max(h, w)
        img_small = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        img_small = img

    hsv = cv2.cvtColor(img_small, cv2.COLOR_BGR2HSV)
    b = img_small[:, :, 0].astype(np.int32)
    g = img_small[:, :, 1].astype(np.int32)
    r = img_small[:, :, 2].astype(np.int32)

    h_channel = hsv[:, :, 0]
    s_channel = hsv[:, :, 1]
    v_channel = hsv[:, :, 2]

    # Astaxanthin cooked hue range in HSV:
    # Warm red-orange (0-28) or wrapped deep red (170-180)
    # S >= 70 (cooked flesh is vividly pigmented; raw shrimp is desaturated S < 50)
    # V >= 70 (sufficient brightness for cooked specimen)
    hue_match = ((h_channel <= 28) | (h_channel >= 170)) & (s_channel >= 70) & (v_channel >= 70)

    # RGB constraint: cooked shrimp is distinctly red/orange (R significantly greater than G and B)
    rgb_match = (r > (g + 20)) & (r > (b + 35)) & (r >= 105)

    cooked_mask = hue_match & rgb_match
    total_pixels = cooked_mask.size

    # Human skin detection (caretaker hands holding raw shrimp)
    skin_mask = (h_channel <= 25) & (s_channel >= 25) & (s_channel <= 180) & (v_channel >= 55) & (r > g) & (g > b)
    skin_ratio = float(np.count_nonzero(skin_mask) / max(1, total_pixels))

    # Deep astaxanthin pigmentation outside human skin
    deep_astaxanthin = ((h_channel <= 22) | (h_channel >= 172)) & (s_channel >= 120) & (v_channel >= 80) & (r > (g + 30)) & (r > (b + 50))
    deep_non_skin = deep_astaxanthin & (~skin_mask)
    deep_non_skin_ratio = float(np.count_nonzero(deep_non_skin) / max(1, total_pixels))
    deep_total_ratio = float(np.count_nonzero(deep_astaxanthin) / max(1, total_pixels))

    # Specimen foreground isolation (excluding uniform dark or pure white plate backgrounds)
    foreground_mask = (v_channel > 35) & (s_channel > 20)
    fg_count = max(1, int(np.count_nonzero(foreground_mask)))

    cooked_non_skin = cooked_mask & (~skin_mask)
    non_skin_ratio = float(np.count_nonzero(cooked_non_skin) / max(1, total_pixels))
    fg_non_skin = foreground_mask & (~skin_mask)
    fg_non_skin_count = max(1, int(np.count_nonzero(fg_non_skin)))
    ratio_fg_non_skin = float(np.count_nonzero(cooked_non_skin & fg_non_skin) / fg_non_skin_count)

    ratio_total = float(np.count_nonzero(cooked_mask) / max(1, total_pixels))
    ratio_foreground = float(np.count_nonzero(cooked_mask & foreground_mask) / fg_count)

    if skin_ratio >= 0.10:
        # Caretaker hand present: check non-skin cooked pigmentation
        return (deep_non_skin_ratio >= 0.10) or (non_skin_ratio >= 0.08 and ratio_fg_non_skin >= 0.35)
    else:
        return (deep_total_ratio >= 0.15) or (ratio_total >= 0.15 and ratio_foreground >= 0.38)


def validate_image_quality(image_path: Path) -> dict:
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    with Image.open(image_path) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        width, height = img.size
        rgb = np.asarray(img.resize((224, 224), Image.Resampling.BILINEAR), dtype=np.float32)
        gray = img.convert("L").resize((224, 224), Image.Resampling.BILINEAR)
        arr = np.asarray(gray, dtype=np.float32)

    max_c = rgb.max(axis=2) / 255.0
    min_c = rgb.min(axis=2) / 255.0
    sat = np.where(max_c > 0, (max_c - min_c) / (max_c + 1e-7), 0)

    # 1. Blur Detection using Gradient Variance (2D Laplacian approximation)
    dx = np.diff(arr, axis=1)
    dy = np.diff(arr, axis=0)
    blur_score = float(np.var(dx) + np.var(dy))

    # 2. Illumination & Contrast Metrics
    mean_bright = float(arr.mean())
    std_bright = float(arr.std())
    overexposed_ratio = float(((arr > 245) & (sat < 0.16)).mean())
    underexposed_ratio = float((arr < 28).mean())

    foreground = (sat > 0.10) & (arr > 30) & (arr < 235)
    foreground_ratio = float(foreground.mean())
    ys, xs = np.where(foreground)
    touches_edges = False
    bbox_fill_ratio = 0.0
    center_coverage = 0.0
    if len(xs) > 0 and len(ys) > 0:
        left, right = int(xs.min()), int(xs.max())
        top, bottom = int(ys.min()), int(ys.max())
        bbox_area = max(1, (right - left + 1) * (bottom - top + 1))
        bbox_fill_ratio = float(foreground.sum() / bbox_area)
        touches_edges = left <= 4 or top <= 4 or right >= 219 or bottom >= 219
        center_coverage = float(foreground[56:168, 56:168].mean())

    is_blurry = blur_score < 8.0 and std_bright < 18.0
    is_too_dark = mean_bright < 30.0 or underexposed_ratio > 0.70
    is_too_bright = mean_bright > 238.0 or (overexposed_ratio > 0.78 and std_bright < 28.0)
    is_low_contrast = std_bright < 7.0
    is_low_resolution = width < 180 or height < 180
    is_too_far = foreground_ratio < 0.055 or center_coverage < 0.035
    is_heavily_cropped = touches_edges and 0.42 < foreground_ratio < 0.82 and std_bright > 22.0 and center_coverage < 0.50
    is_overlapping = foreground_ratio > 0.88 and bbox_fill_ratio > 0.82 and std_bright > 38.0

    warnings = []
    if is_low_contrast:
        warnings.append("low contrast")
    if is_too_far:
        warnings.append("shrimp may be small in frame")
    if is_heavily_cropped:
        warnings.append("shrimp may be cropped")
    if is_overlapping:
        warnings.append("possible overlapping shrimp")

    is_quality_valid = not (
        is_blurry
        or is_too_dark
        or is_too_bright
        or is_low_resolution
    )

    if not is_quality_valid:
        reasons = []
        if is_blurry:
            reasons.append("blurry image")
        if is_too_dark:
            reasons.append("low lighting")
        if is_too_bright:
            reasons.append("overexposure")
        if is_low_resolution:
            reasons.append("low resolution")

        primary_message = "Please upload a clearer image of a shrimp."
        if is_blurry:
            primary_message = "Image is blurry."
        elif is_too_dark:
            primary_message = "Lighting is too dark."
        elif is_too_bright:
            primary_message = "Image is overexposed."
        elif is_low_resolution:
            primary_message = "Image resolution is too low."

        return {
            "is_quality_valid": False,
            "status": "Poor Image Quality",
            "prediction": None,
            "message": primary_message,
            "reasons": reasons,
            "warnings": warnings,
            "quality_metrics": {
                "width": width,
                "height": height,
                "blur_score": round(blur_score, 2),
                "brightness": round(mean_bright, 2),
                "contrast": round(std_bright, 2),
                "overexposed_ratio": round(overexposed_ratio, 4),
                "underexposed_ratio": round(underexposed_ratio, 4),
                "foreground_ratio": round(foreground_ratio, 4),
                "bbox_fill_ratio": round(bbox_fill_ratio, 4),
                "center_coverage": round(center_coverage, 4),
            },
        }

    return {
        "is_quality_valid": True,
        "status": "Good Quality",
        "message": "Image quality is suitable for diagnosis.",
        "warnings": warnings,
        "quality_metrics": {
            "width": width,
            "height": height,
            "blur_score": round(blur_score, 2),
            "brightness": round(mean_bright, 2),
            "contrast": round(std_bright, 2),
            "overexposed_ratio": round(overexposed_ratio, 4),
            "underexposed_ratio": round(underexposed_ratio, 4),
            "foreground_ratio": round(foreground_ratio, 4),
            "bbox_fill_ratio": round(bbox_fill_ratio, 4),
            "center_coverage": round(center_coverage, 4),
        },
    }


if __name__ == "__main__":
    if len(sys.argv) > 1:
        img_p = Path(sys.argv[1])
        print(json.dumps(validate_image_quality(img_p), indent=2))
    else:
        print("Usage: python quality_validator.py <image_path>")
