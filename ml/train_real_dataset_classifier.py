import os
import sys
import json
import csv
import random

import numpy as np
from pathlib import Path
from PIL import Image, ImageOps
from scipy.ndimage import gaussian_filter
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
from sklearn.metrics import classification_report, confusion_matrix

sys.path.insert(0, ".")
from ml.wssv_transfer.forest_fallback import _features, FOREST_MODEL_PATH

DATA_REPO = Path("data/shrimp_classifier_repo/Shrimp_Classifier")
UPLOADS_DIR = DATA_REPO / "uploads"
CSV_DIR = DATA_REPO / "outputs_training_final" / "data_splits"

def build_training_dataset():
    # 1. Map filenames from CSV splits
    manifest_map = {}
    for csv_path in CSV_DIR.glob("*.csv"):
        with open(csv_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                orig_filename = Path(row["image_path"]).name.lower()
                label = row["label"]
                manifest_map[orig_filename] = label

    print(f"Loaded {len(manifest_map)} CSV entries.")

    # 2. Collect files from uploads
    records = []
    upload_files = list(UPLOADS_DIR.glob("*"))
    print(f"Collecting features from {len(upload_files)} real dataset images...")

    for img_path in upload_files:
        if not img_path.is_file() or img_path.suffix.lower() not in {".jpg", ".png", ".jpeg"}:
            continue

        lower = str(img_path.name).lower()
        label = manifest_map.get(lower)

        # Fallback labeling heuristics if filename contains disease keyword
        if not label:
            if "wssv" in lower or "white" in lower:
                label = "WSSV"
            elif "healthy" in lower:
                label = "Healthy"
            elif "bg" in lower:
                label = "BG"

        if label:
            # Map WSSV -> 1, Healthy/BG -> 0
            binary_label = 1 if label == "WSSV" else 0
            records.append((img_path, binary_label, label))

    print(f"Collected {len(records)} labeled dataset records.")
    return records

def train_and_save_model():
    records = build_training_dataset()
    if len(records) < 10:
        print("Not enough dataset records found to train. Exiting.")
        return

    random.seed(42)
    random.shuffle(records)

    print("Extracting multi-feature vectors for all dataset images...")
    X_list = []
    y_list = []
    for path, binary_label, label in records:
        try:
            feats = _features(path, 96, 6)
            X_list.append(feats)
            y_list.append(binary_label)
        except Exception as e:
            print(f"Error processing {path.name}: {e}")

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int32)

    print(f"Dataset shape: X={X.shape}, y={y.shape}. Class distribution: Healthy/BG={np.sum(y==0)}, WSSV={np.sum(y==1)}")

    # Train ExtraTrees / RandomForest Ensemble
    clf = RandomForestClassifier(
        n_estimators=300,
        max_depth=12,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X, y)

    train_preds = clf.predict(X)
    print("\n--- TRAINING ACCURACY REPORT ---")
    print(classification_report(y, train_preds, target_names=["Healthy/Non-WSSV", "WSSV"]))

    # Export decision trees to JSON for forest_fallback
    def export_tree(tree):
        return {
            "childrenLeft": tree.children_left.tolist(),
            "childrenRight": tree.children_right.tolist(),
            "feature": tree.feature.tolist(),
            "threshold": tree.threshold.tolist(),
            "value": tree.value[:, 0, :].tolist(),
        }

    model_artifact = {
        "type": "wssv_forest_classifier",
        "imageSize": 96,
        "gridSize": 6,
        "labels": ["non_wssv", "wssv"],
        "positiveClasses": ["WSSV"],
        "negativeClasses": ["Healthy", "BG"],
        "threshold": 0.65,
        "reviewLowerThreshold": 0.54,
        "reviewUpperThreshold": 0.65,
        "metrics": {
            "accuracy": float(np.mean(train_preds == y)),
            "dataset_size": len(y)
        },
        "trees": [export_tree(estimator.tree_) for estimator in clf.estimators_]
    }

    FOREST_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    FOREST_MODEL_PATH.write_text(json.dumps(model_artifact), encoding="utf-8")
    print(f"\nTrained model successfully exported to {FOREST_MODEL_PATH}!")

if __name__ == "__main__":
    train_and_save_model()
