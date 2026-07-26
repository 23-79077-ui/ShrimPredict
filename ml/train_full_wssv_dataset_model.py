import os
import sys
import json
import random
import numpy as np
from pathlib import Path
from PIL import Image, ImageOps
from scipy.ndimage import gaussian_filter
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_score, recall_score, f1_score

sys.path.insert(0, ".")

IMAGE_SIZE = 96
GRID_SIZE = 6
FOREST_MODEL_PATH = Path("frontend/public/models/shrimp-disease/wssv-forest-model.json")
DATASET_DIR = Path("data/shrimp_infection_repo/dataset")

def saturation(rgb):
    max_rgb = rgb.max(axis=2) / 255.0
    min_rgb = rgb.min(axis=2) / 255.0
    with np.errstate(divide="ignore", invalid="ignore"):
        sat = np.where(max_rgb == 0, 0, (max_rgb - min_rgb) / max_rgb)
    return sat

def extract_image_features(image_path: Path):
    with Image.open(image_path) as img:
        img = ImageOps.exif_transpose(img).convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE))
    
    arr = np.asarray(img, dtype=np.float32)
    brightness = arr.mean(axis=2)
    sat = saturation(arr)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Gaussian local contrast filter for punctate white spot detection
    local_smooth = gaussian_filter(brightness, sigma=2.0)
    spot_contrast = brightness - local_smooth

    # Strict WSSV punctate lesion definition: local contrast > 25.0, brightness > 165, sat < 0.20
    punctate_spots = (spot_contrast > 25.0) & (brightness > 165) & (sat < 0.20)
    punctate_spot_ratio = float(punctate_spots.mean())

    uniform_bright = (brightness > 205) & (sat < 0.10)
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
            features.append(((patch_contrast > 25.0) & (patch_brightness > 165) & (patch_sat < 0.20)).mean())

    return np.asarray(features, dtype=np.float32)

def main():
    print("=== FULL WSSV DATASET TRAINING PIPELINE ===")
    
    # 1. Discover Healthy and WSSV images from full dataset
    healthy_paths = list(DATASET_DIR.rglob("*healthy*/**/*.jpg")) + list(DATASET_DIR.rglob("*healthy*/**/*.png"))
    wssv_paths = list(DATASET_DIR.rglob("*wssv*/**/*.jpg")) + list(DATASET_DIR.rglob("*wssv*/**/*.png"))

    print(f"Discovered {len(healthy_paths)} Healthy images and {len(wssv_paths)} WSSV images.")

    records = []
    for p in healthy_paths:
        records.append((p, 0, "Healthy"))
    for p in wssv_paths:
        records.append((p, 1, "WSSV"))

    random.seed(42)
    random.shuffle(records)

    # 2. Extract features from all images
    print("\nExtracting feature vectors from 1,800+ real shrimp images (this may take ~10-15s)...")
    X_list = []
    y_list = []
    failed_count = 0

    for path, label_int, label_name in records:
        try:
            feats = extract_image_features(path)
            X_list.append(feats)
            y_list.append(label_int)
        except Exception:
            failed_count += 1

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int32)

    print(f"\nFeature extraction complete: {X.shape[0]} valid samples extracted ({failed_count} skipped).")
    print(f"Class Distribution -> Healthy (0): {np.sum(y == 0)}, WSSV (1): {np.sum(y == 1)}")

    # 3. Stratified Train / Val / Test Split (80% Train, 10% Val, 10% Test)
    X_train_val, X_test, y_train_val, y_test = train_test_split(X, y, test_size=0.10, stratify=y, random_state=42)
    X_train, X_val, y_train, y_val = train_test_split(X_train_val, y_train_val, test_size=0.1111, stratify=y_train_val, random_state=42)

    print(f"Dataset Split -> Train: {len(y_train)}, Val: {len(y_val)}, Test: {len(y_test)}")

    # 4. Train Random Forest Ensemble with 500 trees
    print("\nTraining Random Forest Ensemble Classifier on 1,800+ real shrimp images...")
    classifier = RandomForestClassifier(
        n_estimators=500,
        max_depth=16,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    classifier.fit(X_train, y_train)

    # 5. Evaluate on Validation and Test Sets
    test_probs = classifier.predict_proba(X_test)[:, 1]
    test_preds = (test_probs >= 0.50).astype(int)

    acc = accuracy_score(y_test, test_preds)
    prec = precision_score(y_test, test_preds, zero_division=0)
    rec = recall_score(y_test, test_preds, zero_division=0)
    f1 = f1_score(y_test, test_preds, zero_division=0)

    print("\n================ TEST SET PERFORMANCE EVALUATION ================")
    print(f"Test Accuracy  : {acc * 100:.2f}%")
    print(f"Test Precision : {prec * 100:.2f}%")
    print(f"Test Recall    : {rec * 100:.2f}%")
    print(f"Test F1 Score  : {f1 * 100:.2f}%")
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, test_preds))
    print("\nFull Classification Report:")
    print(classification_report(y_test, test_preds, target_names=["Healthy", "WSSV"], zero_division=0))
    print("==================================================================")

    # 6. Export Decision Trees to JSON for production inference
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
        "imageSize": IMAGE_SIZE,
        "gridSize": GRID_SIZE,
        "labels": ["non_wssv", "wssv"],
        "positiveClasses": ["WSSV"],
        "negativeClasses": ["Healthy"],
        "threshold": 0.65,
        "reviewLowerThreshold": 0.54,
        "reviewUpperThreshold": 0.65,
        "metrics": {
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1": float(f1),
            "dataset_size": len(y)
        },
        "trees": [export_tree(estimator.tree_) for estimator in classifier.estimators_]
    }

    FOREST_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    FOREST_MODEL_PATH.write_text(json.dumps(model_artifact), encoding="utf-8")
    print(f"\n[SUCCESS] FULLY TRAINED WSSV MODEL EXPORTED SUCCESSFULLY TO: {FOREST_MODEL_PATH}")

if __name__ == "__main__":
    main()
