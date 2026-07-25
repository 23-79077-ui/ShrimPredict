import json
import random
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, precision_score, recall_score
from sklearn.preprocessing import StandardScaler

from train_wssv_lightweight import (
    NEGATIVE_CLASSES,
    POSITIVE_CLASSES,
    find_raw_images_dir,
    resolve_class_dirs,
)


IMAGE_SIZE = 48


def image_vector(image_path: Path):
    with Image.open(image_path) as image:
        image = image.convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE))
    arr = np.asarray(image, dtype=np.float32) / 255.0
    return arr.reshape(-1)


def metrics_at_threshold(probs, labels, threshold):
    preds = probs >= threshold
    tn, fp, fn, tp = confusion_matrix(labels, preds, labels=[0, 1]).ravel()
    return {
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(labels, preds)),
        "precision": float(precision_score(labels, preds, zero_division=0)),
        "recall": float(recall_score(labels, preds, zero_division=0)),
        "false_positive_rate": float(fp / max(1, fp + tn)),
        "tp": int(tp),
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
    }


def choose_threshold(probs, labels):
    best = None
    best_score = -999
    for threshold in np.arange(0.45, 0.96, 0.01):
        metrics = metrics_at_threshold(probs, labels, threshold)
        fp_penalty = 5.0 if metrics["false_positive_rate"] > 0.13 else 2.2
        score = metrics["accuracy"] + metrics["recall"] - metrics["false_positive_rate"] * fp_penalty
        if score > best_score:
            best = metrics
            best_score = score
    return best


def main():
    root = Path(__file__).resolve().parents[1]
    dataset_dir = root / "data" / "shrimp-disease"
    output_path = root / "frontend" / "public" / "models" / "shrimp-disease" / "wssv-pixel-model.json"
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

    random.Random(7).shuffle(rows)
    vectors = np.vstack([image_vector(path) for path, _, _ in rows])
    labels = np.array([label for _, label, _ in rows], dtype=np.int32)

    split = int(len(rows) * 0.8)
    train_x, val_x = vectors[:split], vectors[split:]
    train_y, val_y = labels[:split], labels[split:]

    scaler = StandardScaler()
    train_x = scaler.fit_transform(train_x)
    val_x = scaler.transform(val_x)

    classifier = LogisticRegression(
        C=0.12,
        class_weight={0: 1.7, 1: 1.0},
        max_iter=2000,
        solver="liblinear",
        random_state=7,
    )
    classifier.fit(train_x, train_y)

    probs = classifier.predict_proba(val_x)[:, 1]
    chosen_metrics = choose_threshold(probs, val_y)

    model = {
        "type": "wssv_pixel_logistic_regression",
        "imageSize": IMAGE_SIZE,
        "labels": ["non_wssv", "wssv"],
        "positiveClasses": sorted(POSITIVE_CLASSES),
        "negativeClasses": sorted(NEGATIVE_CLASSES),
        "mean": scaler.mean_.astype(float).tolist(),
        "scale": scaler.scale_.astype(float).tolist(),
        "weights": classifier.coef_[0].astype(float).tolist(),
        "bias": float(classifier.intercept_[0]),
        "threshold": chosen_metrics["threshold"],
        "metrics": chosen_metrics,
        "imageCount": len(rows),
    }
    output_path.write_text(json.dumps(model), encoding="utf-8")
    print(json.dumps({"savedTo": str(output_path), "metrics": chosen_metrics}, indent=2))


if __name__ == "__main__":
    main()
