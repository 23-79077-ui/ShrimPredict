from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from black_gill_specialist import predict_black_gill
from content_validator import validate_image_content
from desktop_shrimp import is_desktop_model_ready, predict_desktop_shrimp
from forest_fallback import FOREST_MODEL_PATH, predict_with_forest
from quality_validator import validate_image_quality


DEFAULT_DATASET_DIR = Path("C:/Users/HP/Desktop/Shrimp/Shrimp/dataset-tools/shrimp-dataset")
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
LABEL_MAP = {
    "Healthy": "Healthy",
    "Black_Gill": "Black Gill Disease",
    "Black_Gill_Augmented": "Black Gill Disease",
    "White_Spot_Syndrome_Virus": "White Spot Syndrome Virus (WSSV)",
    "White_Spot_Syndrome_Virus_and_Black_Gill": "Black Gill Disease",
}


def perceptual_hash(path: Path, size: int = 16) -> str:
    with Image.open(path) as image:
        gray = ImageOps.exif_transpose(image).convert("L").resize((size, size), Image.Resampling.LANCZOS)
    arr = np.asarray(gray)
    return hashlib.sha1((arr > arr.mean()).astype(np.uint8).tobytes()).hexdigest()


def iter_images(dataset_dir: Path) -> list[tuple[Path, str]]:
    rows = []
    for folder in sorted(dataset_dir.iterdir()):
        if not folder.is_dir() or folder.name.startswith("."):
            continue
        label = LABEL_MAP.get(folder.name)
        if not label:
            continue
        for path in sorted(folder.rglob("*")):
            if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
                rows.append((path, label))
    return rows


def audit_dataset(dataset_dir: Path) -> dict:
    rows = iter_images(dataset_dir)
    counts = Counter(label for _, label in rows)
    folder_counts = Counter(path.parent.name for path, _ in rows)
    corrupted = []
    duplicate_groups = defaultdict(list)

    for path, _ in rows:
        try:
            with Image.open(path) as image:
                ImageOps.exif_transpose(image).verify()
            duplicate_groups[perceptual_hash(path)].append(str(path))
        except Exception as exc:
            corrupted.append({"path": str(path), "error": str(exc)})

    duplicates = [paths for paths in duplicate_groups.values() if len(paths) > 1]
    total = sum(counts.values())
    imbalance = {
        label: {
            "images": int(count),
            "percent": round(float(count / total * 100), 2) if total else 0.0,
        }
        for label, count in sorted(counts.items())
    }
    return {
        "dataset_dir": str(dataset_dir),
        "total_images": int(total),
        "images_per_class": imbalance,
        "images_per_folder": dict(sorted(folder_counts.items())),
        "duplicate_groups": len(duplicates),
        "duplicate_images": int(sum(len(group) - 1 for group in duplicates)),
        "duplicate_examples": duplicates[:10],
        "corrupted_images": corrupted,
        "class_imbalance_ratio": round(float(max(counts.values()) / max(min(counts.values()), 1)), 3) if counts else 0,
    }


def _predict_current(image_path: Path) -> dict:
    stage1 = validate_image_content(image_path)
    if not stage1["shrimp_detected"]:
        return {"prediction": "No Shrimp", "confidence_score": 0, "stage": "content", "details": stage1}
    stage2 = validate_image_quality(image_path)
    if not stage2["is_quality_valid"]:
        return {"prediction": "Poor Image Quality", "confidence_score": 0, "stage": "quality", "details": stage2}

    results = []
    if is_desktop_model_ready():
        try:
            results.append(predict_desktop_shrimp(image_path))
        except Exception:
            pass
    if FOREST_MODEL_PATH.exists():
        try:
            results.append(predict_with_forest(image_path, FOREST_MODEL_PATH))
        except Exception:
            pass
    try:
        bg = predict_black_gill(image_path)
        if bg["disease_name"] == "Black Gill Disease" and bg["confidence_score"] >= 60:
            results.append(bg)
    except Exception:
        pass

    if not results:
        return {"prediction": "Unable", "confidence_score": 0, "stage": "disease"}
    results.sort(key=lambda item: float(item.get("confidence_score", item.get("confidence", 0))), reverse=True)
    return results[0]


def evaluate(dataset_dir: Path, max_per_class: int | None) -> dict:
    rows = iter_images(dataset_dir)
    if max_per_class:
        kept = []
        seen = Counter()
        for path, label in rows:
            if seen[label] < max_per_class:
                kept.append((path, label))
                seen[label] += 1
        rows = kept

    labels = sorted(set(LABEL_MAP.values()))
    matrix = {actual: {pred: 0 for pred in labels + ["No Shrimp", "Poor Image Quality", "Unable"]} for actual in labels}
    confidence_by_pred = defaultdict(list)

    for path, actual in rows:
        pred_res = _predict_current(path)
        pred = pred_res.get("prediction") or pred_res.get("disease_name") or "Unable"
        if "White Spot" in pred or "WSSV" in pred:
            pred = "White Spot Syndrome Virus (WSSV)"
        elif "Black Gill" in pred:
            pred = "Black Gill Disease"
        elif "Healthy" in pred:
            pred = "Healthy"
        elif pred not in matrix[actual]:
            pred = "Unable"
        matrix[actual][pred] += 1
        confidence_by_pred[pred].append(float(pred_res.get("confidence_score", pred_res.get("confidence", 0)) or 0))

    per_class = {}
    for label in labels:
        tp = matrix[label].get(label, 0)
        support = sum(matrix[label].values())
        pred_total = sum(matrix[actual].get(label, 0) for actual in labels)
        precision = tp / pred_total if pred_total else 0
        recall = tp / support if support else 0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
        per_class[label] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "accuracy": round(recall, 4),
            "support": int(support),
        }

    total = sum(sum(row.values()) for row in matrix.values())
    correct = sum(matrix[label].get(label, 0) for label in labels)
    return {
        "evaluated_images": int(total),
        "accuracy": round(correct / total, 4) if total else 0,
        "macro_precision": round(float(np.mean([m["precision"] for m in per_class.values()])), 4) if per_class else 0,
        "macro_recall": round(float(np.mean([m["recall"] for m in per_class.values()])), 4) if per_class else 0,
        "macro_f1": round(float(np.mean([m["f1"] for m in per_class.values()])), 4) if per_class else 0,
        "per_class": per_class,
        "confusion_matrix": matrix,
        "average_confidence_per_prediction": {
            label: round(float(np.mean(values)), 2) for label, values in sorted(confidence_by_pred.items()) if values
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit dataset and evaluate the current ShrimPredict AI pipeline.")
    parser.add_argument("--dataset-dir", type=Path, default=DEFAULT_DATASET_DIR)
    parser.add_argument("--max-per-class", type=int, default=80, help="Limit evaluation cost. Use 0 for all images.")
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "ml" / "artifacts" / "ai_pipeline_evaluation.json")
    args = parser.parse_args()

    max_per_class = None if args.max_per_class == 0 else args.max_per_class
    report = {
        "audit": audit_dataset(args.dataset_dir),
        "evaluation": evaluate(args.dataset_dir, max_per_class),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
