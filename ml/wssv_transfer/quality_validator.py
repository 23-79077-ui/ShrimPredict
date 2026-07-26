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
        img = ImageOps.exif_transpose(img).convert("L").resize((224, 224))
        arr = np.asarray(img, dtype=np.float32)

    # 1. Blur Detection using Gradient Variance (2D Laplacian approximation)
    dx = np.diff(arr, axis=1)
    dy = np.diff(arr, axis=0)
    blur_score = float(np.var(dx) + np.var(dy))

    # 2. Illumination & Contrast Metrics
    mean_bright = float(arr.mean())
    std_bright = float(arr.std())

    is_blurry = blur_score < 35.0
    is_too_dark = mean_bright < 25.0
    is_too_bright = mean_bright > 240.0
    is_low_contrast = std_bright < 12.0

    is_quality_valid = not (is_blurry or is_too_dark or is_too_bright or is_low_contrast)

    if not is_quality_valid:
        reasons = []
        if is_blurry:
            reasons.append("blurry image")
        if is_too_dark:
            reasons.append("low lighting")
        if is_too_bright:
            reasons.append("overexposure")
        if is_low_contrast:
            reasons.append("poor contrast")

        detail_msg = ", ".join(reasons)
        return {
            "is_quality_valid": False,
            "status": "Poor Image Quality",
            "prediction": None,
            "message": f"Please upload a clearer image of a shrimp ({detail_msg}).",
            "quality_metrics": {
                "blur_score": round(blur_score, 2),
                "brightness": round(mean_bright, 2),
                "contrast": round(std_bright, 2),
            },
        }

    return {
        "is_quality_valid": True,
        "status": "Good Quality",
        "message": "Image quality is suitable for diagnosis.",
        "quality_metrics": {
            "blur_score": round(blur_score, 2),
            "brightness": round(mean_bright, 2),
            "contrast": round(std_bright, 2),
        },
    }


if __name__ == "__main__":
    if len(sys.argv) > 1:
        img_p = Path(sys.argv[1])
        print(json.dumps(validate_image_quality(img_p), indent=2))
    else:
        print("Usage: python quality_validator.py <image_path>")
