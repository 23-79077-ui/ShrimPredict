from __future__ import annotations

import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps


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
                "width": int(width),
                "height": int(height),
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
            "width": int(width),
            "height": int(height),
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
