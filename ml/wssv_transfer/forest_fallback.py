from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import gaussian_filter


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

    local_smooth = gaussian_filter(brightness, sigma=2.0)
    spot_contrast = brightness - local_smooth

    # Punctate white spot definition: local contrast (> 25.0), brightness (> 165), low saturation (< 0.20)
    punctate_spots = (spot_contrast > 25.0) & (brightness > 165) & (sat < 0.20)
    punctate_spot_ratio = float(punctate_spots.mean())

    uniform_bright = (brightness > 205) & (sat < 0.10)
    uniform_bright_ratio = float(uniform_bright.mean())

    shrimp_pigment_ratio = float(((sat >= 0.15) & (sat <= 0.70) & (brightness >= 40) & (brightness <= 220)).mean())

    values = [
        brightness.mean() / 255.0,
        brightness.std() / 255.0,
        sat.mean(),
        sat.std(),
        punctate_spot_ratio,
        uniform_bright_ratio,
        (brightness < 75).mean(),
        ((r > 125) & (r > g * 1.12) & (r > b * 1.12)).mean(),
        shrimp_pigment_ratio,
        float(spot_contrast.std() / 255.0),
    ]

    for channel in range(3):
        hist, _ = np.histogram(arr[:, :, channel], bins=12, range=(0, 255), density=True)
        values.extend(hist.tolist())

    cell = image_size // grid_size
    for gy in range(grid_size):
        for gx in range(grid_size):
            patch_brightness = brightness[gy * cell : (gy + 1) * cell, gx * cell : (gx + 1) * cell]
            patch_sat = sat[gy * cell : (gy + 1) * cell, gx * cell : (gx + 1) * cell]
            patch_contrast = spot_contrast[gy * cell : (gy + 1) * cell, gx * cell : (gx + 1) * cell]
            values.append(patch_brightness.mean() / 255.0)
            values.append(((patch_contrast > 25.0) & (patch_brightness > 165) & (patch_sat < 0.20)).mean())

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

    positive_threshold = 0.68
    review_threshold = 0.54

    features = _features(image_path, image_size, grid_size)

    punctate_spot_ratio = float(features[4])
    uniform_bright_ratio = float(features[5])
    shrimp_pigment_ratio = float(features[8])
    spot_contrast_std = float(features[9])

    base_prob = sum(_run_tree(tree, features) for tree in model["trees"]) / len(model["trees"])

    # 1. Plain light surface / document / wall -> Healthy (Low Risk)
    if uniform_bright_ratio > 0.30 and punctate_spot_ratio < 0.010:
        wssv_probability = min(base_prob, 0.10)

    # 2. Healthy shrimp photo (without dense WSSV white spot lesion clusters) -> Healthy (Low Risk)
    elif punctate_spot_ratio < 0.08:
        wssv_probability = min(base_prob, 0.20)

    # 3. True WSSV white spot lesions on carapace -> White Spot Syndrome Virus (WSSV)
    elif punctate_spot_ratio >= 0.08 and spot_contrast_std >= 0.09:
        wssv_probability = max(base_prob, 0.82)

    # 4. Standard baseline
    else:
        wssv_probability = base_prob

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
            "punctate_spot_ratio": round(punctate_spot_ratio, 4),
            "uniform_bright_ratio": round(uniform_bright_ratio, 4),
            "shrimp_pigment_ratio": round(shrimp_pigment_ratio, 4),
            "spot_contrast_std": round(spot_contrast_std, 4),
            "review_threshold": round(review_threshold, 4),
            "positive_threshold": round(positive_threshold, 4),
        },
    }
