import json
import random
import csv
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_score, recall_score, f1_score

from train_wssv_lightweight import (
    NEGATIVE_CLASSES,
    POSITIVE_CLASSES,
    find_raw_images_dir,
    resolve_class_dirs,
)


IMAGE_SIZE = 96
GRID_SIZE = 6
HEALTHY_LABEL = "Healthy"
WSSV_LABEL = "White Spot Syndrome Virus (WSSV)"


def saturation(rgb):
    max_rgb = rgb.max(axis=2) / 255.0
    min_rgb = rgb.min(axis=2) / 255.0
    with np.errstate(divide="ignore", invalid="ignore"):
        sat = np.where(max_rgb == 0, 0, (max_rgb - min_rgb) / max_rgb)
    return sat


def image_features(image_path: Path):
    with Image.open(image_path) as image:
        image = image.convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE))
    arr = np.asarray(image, dtype=np.float32)
    brightness = arr.mean(axis=2)
    sat = saturation(arr)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    local_smooth = gaussian_filter(brightness, sigma=2.0)
    spot_contrast = brightness - local_smooth

    punctate_spots = (spot_contrast > 22.0) & (brightness > 160) & (sat < 0.28)
    punctate_spot_ratio = float(punctate_spots.mean())

    uniform_bright = (brightness > 205) & (sat < 0.12)
    uniform_bright_ratio = float(uniform_bright.mean())

    shrimp_pigment_ratio = float(((sat >= 0.15) & (sat <= 0.70) & (brightness >= 40) & (brightness <= 220)).mean())

    features = [
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
        features.extend(hist.tolist())

    cell = IMAGE_SIZE // GRID_SIZE
    for gy in range(GRID_SIZE):
        for gx in range(GRID_SIZE):
            patch_brightness = brightness[gy * cell : (gy + 1) * cell, gx * cell : (gx + 1) * cell]
            patch_sat = sat[gy * cell : (gy + 1) * cell, gx * cell : (gx + 1) * cell]
            patch_contrast = spot_contrast[gy * cell : (gy + 1) * cell, gx * cell : (gx + 1) * cell]
            features.append(patch_brightness.mean() / 255.0)
            features.append(((patch_contrast > 22.0) & (patch_brightness > 160) & (patch_sat < 0.28)).mean())

    return np.asarray(features, dtype=np.float32)


def metrics_at_threshold(probs, labels, threshold):
    preds = probs >= threshold
    tn, fp, fn, tp = confusion_matrix(labels, preds, labels=[0, 1]).ravel()
    return {
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(labels, preds)),
        "precision": float(precision_score(labels, preds, zero_division=0)),
        "recall": float(recall_score(labels, preds, zero_division=0)),
        "f1": float(f1_score(labels, preds, zero_division=0)),
        "false_positive_rate": float(fp / max(1, fp + tn)),
        "tp": int(tp),
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
    }


def choose_threshold(probs, labels):
    candidates = []
    for threshold in np.arange(0.35, 0.91, 0.01):
        metrics = metrics_at_threshold(probs, labels, threshold)
        candidates.append(metrics)

    strict = [item for item in candidates if item["recall"] >= 0.92 and item["precision"] >= 0.92 and item["false_positive_rate"] <= 0.08]
    if strict:
        return max(strict, key=lambda item: item["f1"] + item["accuracy"] - item["false_positive_rate"] * 1.4)

    safer = [item for item in candidates if item["recall"] >= 0.90 and item["precision"] >= 0.90 and item["false_positive_rate"] <= 0.12]
    if safer:
        return max(safer, key=lambda item: item["f1"] + item["accuracy"] - item["false_positive_rate"] * 1.3)

    return max(candidates, key=lambda item: item["f1"] * 1.4 + item["accuracy"] - item["false_positive_rate"] * 1.5)


def export_tree(tree):
    return {
        "childrenLeft": tree.children_left.tolist(),
        "childrenRight": tree.children_right.tolist(),
        "feature": tree.feature.tolist(),
        "threshold": tree.threshold.tolist(),
        "value": tree.value[:, 0, :].tolist(),
    }


def read_manifest(path: Path):
    rows = []
    if not path.exists():
        return rows

    with path.open("r", newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            label = 1 if row["label"] == WSSV_LABEL else 0
            rows.append((Path(row["path"]), label, row["label"]))
    return rows


def split_rows(rows, seed=31):
    random.Random(seed).shuffle(rows)
    train_end = int(len(rows) * 0.8)
    val_end = int(len(rows) * 0.9)
    return rows[:train_end], rows[train_end:val_end], rows[val_end:]


def load_bg_hard_negative_rows(root: Path):
    dataset_dir = root / "data" / "shrimp-disease"
    try:
        raw_dir = find_raw_images_dir(dataset_dir)
        class_dirs = resolve_class_dirs(raw_dir)
    except FileNotFoundError:
        return [], [], []

    rows = []
    for class_name in NEGATIVE_CLASSES - {"Healthy"}:
        class_dir = class_dirs.get(class_name)
        if not class_dir:
            continue
        for image_path in class_dir.rglob("*"):
            if image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
                rows.append((image_path, 0, class_name))
    return split_rows(rows, seed=37)


def load_rows_from_manifests(root: Path):
    manifest_dir = root / "ml" / "artifacts" / "wssv_dataset"
    train_rows = read_manifest(manifest_dir / "train.csv")
    val_rows = read_manifest(manifest_dir / "val.csv")
    test_rows = read_manifest(manifest_dir / "test.csv")
    if train_rows and val_rows and test_rows:
        bg_train, bg_val, bg_test = load_bg_hard_negative_rows(root)
        return train_rows + bg_train, val_rows + bg_val, test_rows + bg_test, "prepared_manifest_plus_bg_hard_negatives"
    return None


def load_rows_from_raw(root: Path):
    dataset_dir = root / "data" / "shrimp-disease"
    raw_dir = find_raw_images_dir(dataset_dir)
    class_dirs = resolve_class_dirs(raw_dir)

    rows = []
    for class_name, class_dir in class_dirs.items():
        if class_name in NEGATIVE_CLASSES:
            label = 0
        elif class_name in POSITIVE_CLASSES:
            label = 1
        else:
            continue
        for image_path in class_dir.rglob("*"):
            if image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
                rows.append((image_path, label, class_name))

    random.Random(23).shuffle(rows)
    train_end = int(len(rows) * 0.8)
    val_end = int(len(rows) * 0.9)
    return rows[:train_end], rows[train_end:val_end], rows[val_end:], "raw_healthy_vs_wssv"


def vectorize(rows):
    features = np.vstack([image_features(path) for path, _, _ in rows])
    labels = np.asarray([label for _, label, _ in rows], dtype=np.int32)
    return features, labels


def main():
    root = Path(__file__).resolve().parents[1]
    output_path = root / "frontend" / "public" / "models" / "shrimp-disease" / "wssv-forest-model.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    loaded = load_rows_from_manifests(root)
    if loaded is None:
        loaded = load_rows_from_raw(root)
    train_rows, val_rows, test_rows, training_source = loaded
    train_x, train_y = vectorize(train_rows)
    val_x, val_y = vectorize(val_rows)
    test_x, test_y = vectorize(test_rows)

    classifier = RandomForestClassifier(
        n_estimators=520,
        max_depth=16,
        min_samples_leaf=2,
        class_weight={0: 1.35, 1: 1.65},
        random_state=23,
        n_jobs=-1,
    )
    classifier.fit(train_x, train_y)

    probs = classifier.predict_proba(val_x)[:, 1]
    chosen_metrics = choose_threshold(probs, val_y)
    test_probs = classifier.predict_proba(test_x)[:, 1]
    test_metrics = metrics_at_threshold(test_probs, test_y, chosen_metrics["threshold"])
    test_preds = test_probs >= chosen_metrics["threshold"]

    model = {
        "type": "wssv_forest_classifier",
        "imageSize": IMAGE_SIZE,
        "gridSize": GRID_SIZE,
        "labels": ["non_wssv", "wssv"],
        "positiveClasses": sorted(POSITIVE_CLASSES),
        "negativeClasses": sorted(NEGATIVE_CLASSES),
        "threshold": chosen_metrics["threshold"],
        "reviewLowerThreshold": max(0.28, chosen_metrics["threshold"] - 0.22),
        "reviewUpperThreshold": chosen_metrics["threshold"],
        "metrics": test_metrics,
        "validationMetrics": chosen_metrics,
        "classificationReport": classification_report(test_y, test_preds, target_names=["Healthy", "WSSV"], output_dict=True, zero_division=0),
        "trainingSource": training_source,
        "imageCount": len(train_rows) + len(val_rows) + len(test_rows),
        "splitCounts": {
            "train": int(len(train_rows)),
            "validation": int(len(val_rows)),
            "test": int(len(test_rows)),
        },
        "trees": [export_tree(estimator.tree_) for estimator in classifier.estimators_],
    }

    output_path.write_text(json.dumps(model), encoding="utf-8")
    print(json.dumps({"savedTo": str(output_path), "validationMetrics": chosen_metrics, "testMetrics": test_metrics}, indent=2))


if __name__ == "__main__":
    main()
