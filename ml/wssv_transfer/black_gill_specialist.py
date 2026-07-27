from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


def _extract_black_gill_features(image_path: Path) -> dict:
    with Image.open(image_path) as image:
        image = ImageOps.exif_transpose(image).convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)
    arr = np.asarray(image, dtype=np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    brightness = arr.mean(axis=2)
    max_c = arr.max(axis=2) / 255.0
    min_c = arr.min(axis=2) / 255.0
    sat = np.where(max_c > 0, (max_c - min_c) / (max_c + 1e-7), 0)

    center = brightness[45:179, 45:179]
    center_sat = sat[45:179, 45:179]
    dark = brightness < 85
    very_dark = brightness < 58
    melanized = (brightness < 105) & (sat < 0.42)
    brown_dark = (r > g * 0.88) & (r > b * 1.04) & (brightness < 122)
    green_black = (g > r * 0.98) & (g > b * 0.98) & (brightness < 115)

    return {
        "dark_ratio": float(dark.mean()),
        "very_dark_ratio": float(very_dark.mean()),
        "melanized_ratio": float(melanized.mean()),
        "brown_dark_ratio": float(brown_dark.mean()),
        "green_black_ratio": float(green_black.mean()),
        "center_dark_ratio": float((center < 92).mean()),
        "center_low_sat_ratio": float((center_sat < 0.42).mean()),
        "brightness": float(brightness.mean()),
        "contrast": float(brightness.std()),
    }


def predict_black_gill(image_path: Path) -> dict:
    features = _extract_black_gill_features(image_path)

    score = (
        features["melanized_ratio"] * 0.42
        + features["dark_ratio"] * 0.24
        + features["very_dark_ratio"] * 0.18
        + features["brown_dark_ratio"] * 0.10
        + features["green_black_ratio"] * 0.08
        + features["center_dark_ratio"] * 0.12
    )
    if features["contrast"] < 18:
        score *= 0.72
    if features["brightness"] < 42:
        score *= 0.70

    probability = min(0.98, max(0.02, score / 0.34))
    disease_name = "Black Gill Disease" if probability >= 0.58 else "No Black Gill Evidence"
    confidence = probability * 100 if disease_name == "Black Gill Disease" else (1 - probability) * 100

    return {
        "disease_name": disease_name,
        "prediction": disease_name,
        "confidence_score": round(float(confidence), 2),
        "confidence": round(float(confidence), 2),
        "status": "Diseased" if disease_name == "Black Gill Disease" else "Healthy",
        "risk_level": "High" if disease_name == "Black Gill Disease" and confidence >= 70 else ("Medium" if disease_name == "Black Gill Disease" else "Low"),
        "model_used": "Black Gill Specialist Model",
        "description": "Black Gill Disease detected by the specialist classifier." if disease_name == "Black Gill Disease" else "No strong Black Gill visual evidence detected.",
        "recommendation": "Inspect gills directly, improve aeration, check ammonia/nitrite, and isolate affected shrimp." if disease_name == "Black Gill Disease" else "Continue routine monitoring.",
        "probabilities": {
            "No Black Gill Evidence": round(float((1 - probability) * 100), 2),
            "Black Gill Disease": round(float(probability * 100), 2),
        },
        "visual_evidence": {key: round(float(value), 4) for key, value in features.items()},
    }
