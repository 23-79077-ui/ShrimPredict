import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image


POSITIVE_CLASSES = {"WSSV", "WSSV_BG", "BG_WSSV"}
NEGATIVE_CLASSES = {"Healthy", "BG"}
FEATURE_NAMES = [
    "white_spot_ratio",
    "very_white_ratio",
    "dark_ratio",
    "red_ratio",
    "mean_brightness",
    "mean_saturation",
    "brightness_std",
]


def normalize_class_name(folder_name: str) -> str:
    cleaned = folder_name.strip()
    if ". " in cleaned:
        cleaned = cleaned.split(". ", 1)[1]
    return cleaned.replace(" ", "_").upper()


def resolve_class_dirs(raw_dir: Path) -> dict[str, Path]:
    class_dirs = {}
    aliases = {
        "HEALTHY": "Healthy",
        "BG": "BG",
        "WSSV": "WSSV",
        "BG_WSSV": "BG_WSSV",
        "WSSV_BG": "WSSV_BG",
    }

    for child in raw_dir.iterdir():
        if not child.is_dir():
            continue
        canonical = aliases.get(normalize_class_name(child.name))
        if canonical:
            class_dirs[canonical] = child

    return class_dirs


def find_raw_images_dir(dataset_dir: Path) -> Path:
    required_classes = {"Healthy", "BG", "WSSV"}
    for path in [dataset_dir, dataset_dir / "Raw Images", *dataset_dir.rglob("Raw Images")]:
        if path.exists() and path.is_dir() and required_classes.issubset(set(resolve_class_dirs(path))):
            return path
    raise FileNotFoundError("Could not find Raw Images folder with Healthy, BG, and WSSV class folders.")


def saturation(rgb):
    max_rgb = rgb.max(axis=2) / 255.0
    min_rgb = rgb.min(axis=2) / 255.0
    return np.where(max_rgb == 0, 0, (max_rgb - min_rgb) / max_rgb)


def extract_features(image_path: Path):
    with Image.open(image_path) as image:
        image = image.convert("RGB").resize((192, 192))
    arr = np.asarray(image, dtype=np.float32)

    # Ignore the outer edge because many dataset photos have bright table/background borders.
    arr = arr[16:-16, 16:-16, :]
    brightness = arr.mean(axis=2)
    sat = saturation(arr)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    white_spot = (brightness > 205) & (brightness < 245) & (sat < 0.18)
    very_white = (brightness >= 245) & (sat < 0.12)
    dark = brightness < 70
    red = (r > 125) & (r > g * 1.12) & (r > b * 1.12)

    return np.array(
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


def sigmoid(value):
    return 1.0 / (1.0 + np.exp(-value))


def train_logistic_regression(features, labels, epochs=3000, learning_rate=0.08, seed=42):
    rng = np.random.default_rng(seed)
    weights = rng.normal(0, 0.03, size=features.shape[1])
    bias = 0.0

    for _ in range(epochs):
        logits = features @ weights + bias
        probs = sigmoid(logits)
        error = probs - labels
        weights -= learning_rate * (features.T @ error / len(labels))
        bias -= learning_rate * error.mean()

    return weights, bias


def evaluate(features, labels, weights, bias, threshold):
    probs = sigmoid(features @ weights + bias)
    preds = probs >= threshold
    positives = labels == 1
    negatives = labels == 0

    tp = int((preds & positives).sum())
    tn = int((~preds & negatives).sum())
    fp = int((preds & negatives).sum())
    fn = int((~preds & positives).sum())

    accuracy = (tp + tn) / max(1, len(labels))
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    false_positive_rate = fp / max(1, int(negatives.sum()))
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "false_positive_rate": false_positive_rate,
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
    }


def choose_threshold(features, labels, weights, bias):
    best_threshold = 0.7
    best_score = -math.inf
    for threshold in np.arange(0.35, 0.86, 0.01):
        metrics = evaluate(features, labels, weights, bias, float(threshold))
        # Healthy false positives hurt the app most, so penalize them harder.
        score = metrics["recall"] + metrics["accuracy"] - metrics["false_positive_rate"] * 1.8
        if score > best_score:
            best_score = score
            best_threshold = float(threshold)
    return best_threshold


def main():
    root = Path(__file__).resolve().parents[1]
    dataset_dir = root / "data" / "shrimp-disease"
    output_path = root / "frontend" / "public" / "models" / "shrimp-disease" / "wssv-lightweight-model.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    raw_dir = find_raw_images_dir(dataset_dir)
    class_dirs = resolve_class_dirs(raw_dir)

    rows = []
    for class_name, class_dir in class_dirs.items():
        if class_name not in POSITIVE_CLASSES and class_name not in NEGATIVE_CLASSES:
            continue
        label = 1 if class_name in POSITIVE_CLASSES else 0
        for image_path in class_dir.rglob("*"):
            if image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
                rows.append((image_path, label, class_name))

    random.Random(42).shuffle(rows)
    features = np.vstack([extract_features(path) for path, _, _ in rows])
    labels = np.array([label for _, label, _ in rows], dtype=np.float32)

    mean = features.mean(axis=0)
    std = np.where(features.std(axis=0) == 0, 1, features.std(axis=0))
    scaled = (features - mean) / std

    split = int(len(rows) * 0.8)
    train_x, val_x = scaled[:split], scaled[split:]
    train_y, val_y = labels[:split], labels[split:]

    weights, bias = train_logistic_regression(train_x, train_y)
    threshold = choose_threshold(val_x, val_y, weights, bias)
    metrics = evaluate(val_x, val_y, weights, bias, threshold)

    model = {
        "type": "wssv_lightweight_logistic_regression",
        "trainedOn": "ShrimpDiseaseImageBD Raw Images",
        "labels": ["non_wssv", "wssv"],
        "positiveClasses": sorted(POSITIVE_CLASSES),
        "negativeClasses": sorted(NEGATIVE_CLASSES),
        "featureNames": FEATURE_NAMES,
        "mean": mean.tolist(),
        "std": std.tolist(),
        "weights": weights.tolist(),
        "bias": float(bias),
        "threshold": threshold,
        "metrics": {key: float(value) if isinstance(value, float) else value for key, value in metrics.items()},
        "imageCount": len(rows),
    }
    output_path.write_text(json.dumps(model, indent=2), encoding="utf-8")
    print(json.dumps({"savedTo": str(output_path), "metrics": model["metrics"]}, indent=2))


if __name__ == "__main__":
    main()
