from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import gaussian_filter


FOREST_MODEL_PATH = Path("frontend/public/models/shrimp-disease/wssv-forest-model.json")
LIGHTWEIGHT_MODEL_PATH = Path("frontend/public/models/shrimp-disease/wssv-lightweight-model.json")


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

    # Keep these thresholds aligned with ml/train_wssv_forest_model.py.
    punctate_spots = (spot_contrast > 22.0) & (brightness > 160) & (sat < 0.28)
    punctate_spot_ratio = float(punctate_spots.mean())

    broad_shell_spots = (spot_contrast > 10.0) & (brightness > 135) & (sat < 0.45)
    broad_shell_spot_ratio = float(broad_shell_spots.mean())

    uniform_bright = (brightness > 205) & (sat < 0.10)
    uniform_bright_ratio = float(uniform_bright.mean())

    shrimp_pigment_ratio = float(((sat >= 0.15) & (sat <= 0.70) & (brightness >= 40) & (brightness <= 220)).mean())
    diagnostic_domain_ratio = float(((sat >= 0.18) & (sat <= 0.78) & (brightness >= 35) & (brightness <= 210)).mean())

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
        broad_shell_spot_ratio,
        diagnostic_domain_ratio,
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
            values.append(((patch_contrast > 22.0) & (patch_brightness > 160) & (patch_sat < 0.28)).mean())
            values.append(((patch_contrast > 10.0) & (patch_brightness > 135) & (patch_sat < 0.45)).mean())

    return np.asarray(values, dtype=np.float32)


def _lightweight_features(image_path: Path) -> np.ndarray:
    with Image.open(image_path) as image:
        image = ImageOps.exif_transpose(image).convert("RGB").resize((192, 192))

    arr = np.asarray(image, dtype=np.float32)
    arr = arr[16:-16, 16:-16, :]
    brightness = arr.mean(axis=2)
    sat = _saturation(arr)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    white_spot = (brightness > 205) & (brightness < 245) & (sat < 0.18)
    very_white = (brightness >= 245) & (sat < 0.12)
    dark = brightness < 70
    red = (r > 125) & (r > g * 1.12) & (r > b * 1.12)

    return np.asarray(
        [
            white_spot.mean(),
            very_white.mean(),
            dark.mean(),
            red.mean(),
            brightness.mean() / 255.0,
            sat.mean(),
            brightness.std() / 255.0,
        ],
        dtype=np.float32,
    )


def _sigmoid(value: float) -> float:
    return float(1.0 / (1.0 + np.exp(-value)))


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


def _result_from_probability(wssv_probability: float, threshold: float, metrics: dict | None, model_type: str, visual_evidence: dict | None = None) -> dict:
    review_threshold = max(0.38, threshold - 0.22)

    if wssv_probability >= threshold:
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
        "model_type": model_type,
        "model_metrics": metrics or {},
        "visual_evidence": visual_evidence or {
            "review_threshold": round(review_threshold, 4),
            "positive_threshold": round(threshold, 4),
        },
    }


def predict_with_lightweight(image_path: Path, model_path: Path = LIGHTWEIGHT_MODEL_PATH) -> dict:
    if not model_path.exists():
        raise FileNotFoundError(f"Lightweight fallback model not found: {model_path}")

    model = json.loads(model_path.read_text(encoding="utf-8"))
    features = _lightweight_features(image_path)
    mean = np.asarray(model.get("mean", []), dtype=np.float32)
    std = np.asarray(model.get("std", []), dtype=np.float32)
    weights = np.asarray(model.get("weights", []), dtype=np.float32)

    if len(features) != len(mean) or len(features) != len(std) or len(features) != len(weights):
        raise ValueError("Lightweight model feature dimensions do not match the extractor.")

    scaled = (features - mean) / np.where(std == 0, 1, std)
    wssv_probability = _sigmoid(float(scaled @ weights + float(model.get("bias", 0))))
    threshold = float(model.get("threshold", 0.6))

    evidence = {
        name: round(float(value), 4)
        for name, value in zip(model.get("featureNames", []), features)
    }
    evidence["review_threshold"] = round(max(0.38, threshold - 0.22), 4)
    evidence["positive_threshold"] = round(threshold, 4)

    return _result_from_probability(
        wssv_probability,
        threshold,
        model.get("metrics", {}),
        "trained_lightweight_logistic_fallback",
        evidence,
    )


def predict_with_forest(image_path: Path, model_path: Path = FOREST_MODEL_PATH) -> dict:
    if not model_path.exists():
        raise FileNotFoundError(f"Fallback model not found: {model_path}")

    model = json.loads(model_path.read_text(encoding="utf-8"))
    if not model.get("trees"):
        return predict_with_lightweight(image_path, model_path.with_name("wssv-lightweight-model.json"))

    image_size = int(model.get("imageSize", 96))
    grid_size = int(model.get("gridSize", 6))

    positive_threshold = float(model.get("threshold", 0.62))
    review_threshold = float(model.get("reviewLowerThreshold", max(0.38, positive_threshold - 0.22)))

    features = _features(image_path, image_size, grid_size)

    punctate_spot_ratio = float(features[4])
    uniform_bright_ratio = float(features[5])
    shrimp_pigment_ratio = float(features[8])
    spot_contrast_std = float(features[9])
    broad_shell_spot_ratio = float(features[10])
    diagnostic_domain_ratio = float(features[11])

    base_prob = sum(_run_tree(tree, features) for tree in model["trees"]) / len(model["trees"])

    # 1. Plain light surface / document / wall -> Healthy (Low Risk)
    if uniform_bright_ratio > 0.30 and punctate_spot_ratio < 0.010:
        wssv_probability = min(base_prob, 0.10)

    # 1b. Product/plated/background-heavy photos are not reliable diagnostic close-ups.
    elif diagnostic_domain_ratio < 0.30 and shrimp_pigment_ratio < 0.30:
        wssv_probability = max(min(base_prob, review_threshold + 0.08), review_threshold)

    # 2. Weak visual evidence -> Healthy unless the trained model strongly disagrees.
    elif punctate_spot_ratio < 0.018 and broad_shell_spot_ratio < 0.050 and spot_contrast_std < 0.055:
        wssv_probability = min(base_prob, 0.20)

    # 3. True WSSV white spot lesions on carapace -> White Spot Syndrome Virus (WSSV)
    elif punctate_spot_ratio >= 0.06 and spot_contrast_std >= 0.08 and diagnostic_domain_ratio >= 0.30:
        wssv_probability = max(base_prob, 0.82)

    # 3b. Broad pale WSSV lesions on darker/blue shell.
    elif broad_shell_spot_ratio >= 0.055 and spot_contrast_std >= 0.052 and diagnostic_domain_ratio >= 0.30:
        wssv_probability = max(base_prob, 0.78)

    # 4. Suspicious but not dense enough for automatic high-risk confirmation.
    elif (punctate_spot_ratio >= 0.045 or broad_shell_spot_ratio >= 0.075) and spot_contrast_std >= 0.060:
        wssv_probability = max(base_prob, review_threshold)

    # 5. Standard baseline
    else:
        wssv_probability = base_prob

    return _result_from_probability(
        wssv_probability,
        positive_threshold,
        model.get("metrics", {}),
        "trained_random_forest_fallback",
        {
            "punctate_spot_ratio": round(punctate_spot_ratio, 4),
            "broad_shell_spot_ratio": round(broad_shell_spot_ratio, 4),
            "uniform_bright_ratio": round(uniform_bright_ratio, 4),
            "shrimp_pigment_ratio": round(shrimp_pigment_ratio, 4),
            "diagnostic_domain_ratio": round(diagnostic_domain_ratio, 4),
            "spot_contrast_std": round(spot_contrast_std, 4),
            "review_threshold": round(review_threshold, 4),
            "positive_threshold": round(positive_threshold, 4),
        },
    )
