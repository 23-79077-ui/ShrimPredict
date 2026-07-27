from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


SCRIPT_DIR = Path(__file__).resolve().parent
NODE_SCRIPT = SCRIPT_DIR / "shrimp_detector_node.js"

NON_SHRIMP_MESSAGES = {
    "Human": "Human detected. Please capture a shrimp image.",
    "Fish": "Fish detected. Please upload a shrimp image.",
    "Crab": "Crab detected. Please upload a shrimp image.",
    "Lobster": "Lobster detected. Please upload a shrimp image.",
    "Cooked Shrimp / Food": "Cooked shrimp detected. Please upload a live shrimp image.",
    "Screenshot": "Screenshot detected. Please upload a real shrimp photo.",
    "Document": "Document detected. Please upload a shrimp image.",
    "Background": "No shrimp detected.",
    "Unknown Object": "No shrimp detected.",
}


def _rgb_features(image_path: Path) -> dict:
    with Image.open(image_path) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        width, height = image.size
        arr = np.asarray(image.resize((224, 224), Image.Resampling.BILINEAR), dtype=np.float32)

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    brightness = arr.mean(axis=2)
    max_c = arr.max(axis=2) / 255.0
    min_c = arr.min(axis=2) / 255.0
    delta = max_c - min_c

    with np.errstate(divide="ignore", invalid="ignore"):
        sat = np.where(max_c == 0, 0.0, delta / (max_c + 1e-7))
        rg_ratio = np.where(g == 0, 0.0, r / (g + 1e-5))

    dx = np.abs(brightness[:, 1:] - brightness[:, :-1])
    dy = np.abs(brightness[1:, :] - brightness[:-1, :])
    edge_density = float((dx.mean() + dy.mean()) / 255.0)

    shrimp_pigment = (
        (sat >= 0.12) & (sat <= 0.82)
        & (brightness >= 35) & (brightness <= 225)
        & (rg_ratio >= 0.70) & (rg_ratio <= 1.95)
    )
    human_skin = (
        (r > 115) & (g > 70) & (b > 45) & (r > g) & (r > b)
        & (sat >= 0.12) & (sat <= 0.62) & (rg_ratio >= 1.12) & (rg_ratio <= 1.75)
    )
    document = (sat < 0.10) & (brightness > 188)
    dark_text = (brightness < 80) & (sat < 0.25)
    water_fish = (b > r * 1.12) & (b > g * 1.03) & (sat > 0.18)
    cooked_food = (r > 145) & (g > 75) & (b < 125) & (r > g * 1.18) & (sat > 0.25)
    dark_gill = (brightness < 95) & (sat < 0.40)

    border = np.concatenate([arr[:8, :, :].reshape(-1, 3), arr[-8:, :, :].reshape(-1, 3), arr[:, :8, :].reshape(-1, 3), arr[:, -8:, :].reshape(-1, 3)])
    center = arr[56:168, 56:168, :].reshape(-1, 3)
    border_center_delta = float(abs(border.mean() - center.mean()) / 255.0)

    return {
        "width": int(width),
        "height": int(height),
        "aspect_ratio": round(float(width / max(height, 1)), 3),
        "brightness": round(float(brightness.mean()), 2),
        "contrast": round(float(brightness.std()), 2),
        "saturation": round(float(sat.mean()), 4),
        "edge_density": round(edge_density, 4),
        "shrimp_pigment_ratio": round(float(shrimp_pigment.mean()), 4),
        "human_skin_ratio": round(float(human_skin.mean()), 4),
        "document_ratio": round(float(document.mean()), 4),
        "dark_text_ratio": round(float(dark_text.mean()), 4),
        "water_ratio": round(float(water_fish.mean()), 4),
        "cooked_food_ratio": round(float(cooked_food.mean()), 4),
        "dark_gill_ratio": round(float(dark_gill.mean()), 4),
        "border_center_delta": round(border_center_delta, 4),
    }


def _node_classification(image_path: Path) -> dict | None:
    if not NODE_SCRIPT.exists():
        return None
    try:
        proc = subprocess.run(
            ["node", str(NODE_SCRIPT), str(image_path)],
            capture_output=True,
            text=True,
            timeout=3.5,
            check=False,
        )
        if proc.returncode != 0:
            return None
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip().startswith("{")]
        return json.loads(lines[-1]) if lines else None
    except Exception:
        return None


def _category_from_node(node_result: dict | None) -> str | None:
    if not node_result:
        return None
    label = str(node_result.get("top_class") or "").lower()
    probability = float(node_result.get("probability") or 0)
    if probability < 0.25:
        return None
    if any(token in label for token in ["person", "man", "woman", "face", "shirt", "jersey"]):
        return "Human"
    if any(token in label for token in ["screen", "monitor", "laptop", "web site", "desktop computer"]):
        return "Screenshot"
    if any(token in label for token in ["paper", "book", "envelope", "menu", "binder"]):
        return "Document"
    if "fish" in label or "goldfish" in label:
        return "Fish"
    if "crab" in label:
        return "Crab"
    if "lobster" in label or "crayfish" in label:
        return "Lobster"
    if any(token in label for token in ["plate", "dish", "restaurant", "pizza", "food"]):
        return "Cooked Shrimp / Food"
    return None


def validate_image_content(image_path: Path) -> dict:
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    features = _rgb_features(image_path)
    node_result = _node_classification(image_path)
    node_category = _category_from_node(node_result)

    category = "Shrimp"
    shrimp_confidence = 0.82

    if node_category:
        category = node_category
        shrimp_confidence = 0.0
    elif (
        features["document_ratio"] > 0.65
        and features["dark_text_ratio"] > 0.04
        and features["cooked_food_ratio"] > 0.10
        and 0.80 <= features["aspect_ratio"] <= 1.25
    ):
        category = "Human"
        shrimp_confidence = 0.0
    elif features["document_ratio"] > 0.58 and features["shrimp_pigment_ratio"] < 0.16:
        category = "Document" if features["dark_text_ratio"] > 0.015 or features["edge_density"] > 0.018 else "Background"
        shrimp_confidence = 0.0
    elif features["human_skin_ratio"] > 0.48 and features["shrimp_pigment_ratio"] < 0.24:
        category = "Human"
        shrimp_confidence = 0.0
    elif features["cooked_food_ratio"] > 0.42 and features["dark_gill_ratio"] < 0.10:
        category = "Cooked Shrimp / Food"
        shrimp_confidence = 0.0
    elif features["water_ratio"] > 0.46 and features["shrimp_pigment_ratio"] < 0.18:
        category = "Fish"
        shrimp_confidence = 0.0
    elif features["contrast"] < 10 and features["edge_density"] < 0.018 and features["shrimp_pigment_ratio"] < 0.20:
        category = "Background"
        shrimp_confidence = 0.0
    elif features["shrimp_pigment_ratio"] < 0.020 and features["edge_density"] < 0.012:
        category = "Unknown Object"
        shrimp_confidence = 0.0
    else:
        shrimp_confidence = min(
            0.97,
            max(0.55, features["shrimp_pigment_ratio"] * 1.7 + features["edge_density"] * 5.0),
        )

    shrimp_detected = category == "Shrimp" and shrimp_confidence >= 0.50
    return {
        "shrimp_detected": shrimp_detected,
        "content_category": category,
        "prediction": "Shrimp Present" if shrimp_detected else None,
        "status": "Shrimp Detected" if shrimp_detected else "No Shrimp Detected",
        "confidence": round(shrimp_confidence * 100, 2),
        "message": "Shrimp successfully detected." if shrimp_detected else NON_SHRIMP_MESSAGES.get(category, "No shrimp detected."),
        "features": features,
        "node_classifier": node_result or {},
    }
