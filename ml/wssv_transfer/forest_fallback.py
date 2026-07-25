from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


FOREST_MODEL_PATH = Path("frontend/public/models/shrimp-disease/wssv-forest-model.json")


def _saturation(rgb: np.ndarray) -> np.ndarray:
    max_rgb = rgb.max(axis=2) / 255.0
    min_rgb = rgb.min(axis=2) / 255.0
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(max_rgb == 0, 0, (max_rgb - min_rgb) / max_rgb)


def _features(image_path: Path, image_size: int, grid_size: int) -> np.ndarray:
    with Image.open(image_path) as image:
        image = ImageOps.exif_transpose(image).convert("RGB").resize((image_size, image_size))

    arr = np.asarray(image, dtype=np.float32)
    brightness = arr.mean(axis=2)
    sat = _saturation(arr)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    values = [
        brightness.mean() / 255,
        brightness.std() / 255,
        sat.mean(),
        sat.std(),
        ((brightness > 205) & (brightness < 245) & (sat < 0.2)).mean(),
        ((brightness >= 245) & (sat < 0.12)).mean(),
        (brightness < 75).mean(),
        ((r > 125) & (r > g * 1.12) & (r > b * 1.12)).mean(),
    ]

    for channel in range(3):
        hist, _ = np.histogram(arr[:, :, channel], bins=12, range=(0, 255), density=True)
        values.extend(hist.tolist())

    cell = image_size // grid_size
    for gy in range(grid_size):
        for gx in range(grid_size):
            patch_brightness = brightness[gy * cell : (gy + 1) * cell, gx * cell : (gx + 1) * cell]
            patch_sat = sat[gy * cell : (gy + 1) * cell, gx * cell : (gx + 1) * cell]
            values.append(patch_brightness.mean() / 255)
            values.append(((patch_brightness > 205) & (patch_brightness < 245) & (patch_sat < 0.2)).mean())

    return np.asarray(values, dtype=np.float32)


def _run_tree(tree: dict, features: np.ndarray) -> float:
    node = 0
    while tree["childrenLeft"][node] != -1:
        feature_index = tree["feature"][node]
        threshold = tree["threshold"][node]
        node = tree["childrenLeft"][node] if features[feature_index] <= threshold else tree["childrenRight"][node]
    return float(tree["value"][node][1])


def _risk_level(disease_name: str, confidence: float) -> str:
    if "Needs Review" in disease_name:
        return "Medium"
    if "White Spot" in disease_name and confidence >= 60:
        return "High"
    if "White Spot" in disease_name:
        return "Medium"
    return "Low"


def _recommendation(disease_name: str) -> str:
    if "White Spot" in disease_name:
        return "\n".join(
            [
                "Isolate infected shrimp.",
                "Improve water quality.",
                "Reduce stress.",
                "Consult aquatic veterinarian.",
                "Monitor remaining ponds.",
            ]
        )
    if "Needs Review" in disease_name:
        return "\n".join(
            [
                "Retake a clearer close-up photo under good lighting.",
                "Inspect shrimp shells for distinct white spots.",
                "Keep monitoring the pond before confirming WSSV.",
                "Escalate to admin if symptoms or mortality increase.",
            ]
        )
    return "No disease detected."


def predict_with_forest(image_path: Path, model_path: Path = FOREST_MODEL_PATH) -> dict:
    if not model_path.exists():
        raise FileNotFoundError(f"Fallback model not found: {model_path}")

    model = json.loads(model_path.read_text(encoding="utf-8"))
    image_size = int(model.get("imageSize", 96))
    grid_size = int(model.get("gridSize", 6))
    positive_threshold = float(model.get("reviewUpperThreshold", model.get("threshold", 0.68)))
    review_threshold = float(model.get("reviewLowerThreshold", max(0.35, positive_threshold - 0.22)))
    features = _features(image_path, image_size, grid_size)
    wssv_probability = sum(_run_tree(tree, features) for tree in model["trees"]) / len(model["trees"])
    white_spot_ratio = float(features[4])
    very_white_ratio = float(features[5])
    localized_white_spots = 0.012 <= white_spot_ratio <= 0.16 and very_white_ratio < 0.24
    visual_evidence_override = localized_white_spots and wssv_probability >= 0.38

    if visual_evidence_override and wssv_probability < positive_threshold:
        wssv_probability = min(positive_threshold - 0.01, max(wssv_probability, 0.50 + white_spot_ratio * 1.7))

    if wssv_probability >= positive_threshold:
        disease_name = "White Spot Syndrome Virus (WSSV)"
        confidence = wssv_probability * 100
    elif wssv_probability >= review_threshold:
        disease_name = "Needs Review - Possible WSSV"
        confidence = max(wssv_probability, 1 - wssv_probability) * 100
    else:
        disease_name = "Healthy"
        confidence = (1 - wssv_probability) * 100

    return {
        "disease_name": disease_name,
        "confidence_score": round(float(confidence), 2),
        "risk_level": _risk_level(disease_name, confidence),
        "recommendation": _recommendation(disease_name),
        "probabilities": {
            "Healthy": round(float((1 - wssv_probability) * 100), 2),
            "White Spot Syndrome Virus (WSSV)": round(float(wssv_probability * 100), 2),
        },
        "model_type": "trained_random_forest_fallback",
        "model_metrics": model.get("metrics", {}),
        "visual_evidence": {
            "localized_white_spots": localized_white_spots,
            "white_spot_ratio": round(white_spot_ratio, 4),
            "very_white_ratio": round(very_white_ratio, 4),
            "override_applied": visual_evidence_override,
            "review_threshold": round(review_threshold, 4),
            "positive_threshold": round(positive_threshold, 4),
        },
    }
