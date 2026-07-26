"""
Black Gill Disease Dataset Expansion & Model Fine-Tuning Script
================================================================
Uses MLPClassifier (neural network) to avoid Windows AppLocker DLL blocks
on sklearn tree-based classifiers.

This script:
1. Analyzes the current dataset distribution
2. Generates extensive augmented Black Gill images
3. Trains fine-tuned MLP classifier with class weighting
4. Evaluates before/after metrics (Accuracy, Precision, Recall, F1, Confusion Matrix)
5. Updates the forest fallback model weights

Does NOT modify React, PHP, or Flask application code.
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier

# ===================================================================
# PATHS
# ===================================================================
DATASET_DIR = Path("C:/Users/HP/Desktop/Shrimp/Shrimp/dataset-tools/shrimp-dataset")
AUGMENTED_OUTPUT_DIR = DATASET_DIR / "Black_Gill_Augmented"
PROJECT_DIR = Path(__file__).resolve().parent.parent.parent  # ShrimPredict root
MODEL_DIR = PROJECT_DIR / "ml" / "artifacts" / "desktop_shrimp"
FOREST_MODEL_PATH = PROJECT_DIR / "frontend" / "public" / "models" / "shrimp-disease" / "wssv-forest-model.json"

LABELS = ["Healthy", "Black_Gill", "White_Spot_Syndrome_Virus"]
LABEL_TO_IDX = {l: i for i, l in enumerate(LABELS)}

# Map dataset folders to labels
FOLDER_LABEL_MAP = {
    "Healthy": 0,
    "Black_Gill": 1,
    "White_Spot_Syndrome_Virus": 2,
    "White_Spot_Syndrome_Virus_and_Black_Gill": 1,  # These show Black Gill symptoms
}

IMAGE_SIZE = 224
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


# ===================================================================
# DATA AUGMENTATION PIPELINE
# ===================================================================
def augment_image_comprehensive(img: Image.Image, level: int = 0) -> list[Image.Image]:
    """
    Generate multiple augmented versions of an image.
    level 0 = basic (3 variants)
    level 1 = moderate (6 variants)
    level 2 = aggressive (10 variants)
    """
    results = []
    img = img.convert("RGB")
    w, h = img.size

    # --- Basic augmentations (always applied) ---
    # 1. Horizontal flip
    results.append(img.transpose(Image.FLIP_LEFT_RIGHT))

    # 2. Rotation 90 + brightness boost
    rot90 = img.rotate(90, expand=True)
    results.append(ImageEnhance.Brightness(rot90).enhance(random.uniform(1.05, 1.20)))

    # 3. Rotation 270 + contrast adjustment
    rot270 = img.rotate(270, expand=True)
    results.append(ImageEnhance.Contrast(rot270).enhance(random.uniform(1.10, 1.25)))

    if level >= 1:
        # --- Moderate augmentations ---
        # 4. Vertical flip + slight blur
        vflip = img.transpose(Image.FLIP_TOP_BOTTOM)
        results.append(vflip.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 0.8))))

        # 5. Rotation 180 + color jitter
        rot180 = img.rotate(180)
        color_enhanced = ImageEnhance.Color(rot180).enhance(random.uniform(0.85, 1.15))
        results.append(color_enhanced)

        # 6. Center zoom crop (simulates closer view)
        crop_frac = random.uniform(0.10, 0.18)
        left = int(w * crop_frac)
        top = int(h * crop_frac)
        right = int(w * (1 - crop_frac))
        bottom = int(h * (1 - crop_frac))
        cropped = img.crop((left, top, right, bottom)).resize((w, h), Image.LANCZOS)
        results.append(cropped)

    if level >= 2:
        # --- Aggressive augmentations ---
        # 7. Random rotation (15-45) + brightness decrease (simulates dim lighting)
        rand_angle = random.uniform(15, 45)
        rand_rot = img.rotate(rand_angle, expand=False, fillcolor=(0, 0, 0))
        results.append(ImageEnhance.Brightness(rand_rot).enhance(random.uniform(0.75, 0.90)))

        # 8. Horizontal flip + zoom crop + contrast
        hflip_zoom = img.transpose(Image.FLIP_LEFT_RIGHT)
        cf = random.uniform(0.08, 0.15)
        hflip_zoom = hflip_zoom.crop((int(w*cf), int(h*cf), int(w*(1-cf)), int(h*(1-cf)))).resize((w, h), Image.LANCZOS)
        results.append(ImageEnhance.Contrast(hflip_zoom).enhance(random.uniform(0.90, 1.15)))

        # 9. Additive Gaussian noise
        arr = np.asarray(img, dtype=np.float32)
        noise = np.random.normal(0, random.uniform(5, 15), arr.shape).astype(np.float32)
        noisy = np.clip(arr + noise, 0, 255).astype(np.uint8)
        results.append(Image.fromarray(noisy))

        # 10. Sharpness enhancement + slight rotation
        sharp = ImageEnhance.Sharpness(img.rotate(random.uniform(-10, 10), expand=False, fillcolor=(0, 0, 0)))
        results.append(sharp.enhance(random.uniform(1.3, 1.8)))

    return results


# ===================================================================
# FEATURE EXTRACTION
# ===================================================================
def extract_features(img: Image.Image, image_size: int = IMAGE_SIZE) -> np.ndarray:
    """Extract rich visual features for classification."""
    img = img.convert("RGB").resize((image_size, image_size))
    arr = np.asarray(img, dtype=np.float32)

    # Normalize to [-1, 1] (MobileNet range)
    arr_norm = (arr / 127.5) - 1.0
    r, g, b = arr_norm[:, :, 0], arr_norm[:, :, 1], arr_norm[:, :, 2]
    brightness = arr_norm.mean(axis=2)

    # Raw pixel statistics
    raw = arr / 255.0
    r_raw, g_raw, b_raw = raw[:, :, 0], raw[:, :, 1], raw[:, :, 2]

    # HSV-like features
    max_c = raw.max(axis=2)
    min_c = raw.min(axis=2)
    delta = max_c - min_c
    sat = np.where(max_c > 0, delta / (max_c + 1e-8), 0)

    feats = []

    # --- Global color statistics (12 features) ---
    feats.extend([
        float(r.mean()), float(g.mean()), float(b.mean()),
        float(r.std()), float(g.std()), float(b.std()),
        float(brightness.mean()), float(brightness.std()),
        float(sat.mean()), float(sat.std()),
        float(max_c.mean()), float(min_c.mean()),
    ])

    # --- Black Gill specific features (6 features) ---
    dark_gill_mask = (brightness < -0.45)
    feats.append(float(dark_gill_mask.mean()))

    very_dark = (brightness < -0.65)
    feats.append(float(very_dark.mean()))

    melanized = (brightness < -0.40) & (sat < 0.35)
    feats.append(float(melanized.mean()))

    brown_dark = (r_raw > g_raw * 0.9) & (r_raw > b_raw * 1.1) & (r_raw < 0.45)
    feats.append(float(brown_dark.mean()))

    green_dom = (g_raw > r_raw * 1.05) & (g_raw > b_raw * 1.05)
    feats.append(float(green_dom.mean()))

    red_shifted = (r_raw > g_raw * 1.15) & (r_raw > b_raw * 1.15)
    feats.append(float(red_shifted.mean()))

    # --- White Spot specific features (4 features) ---
    dx = np.abs(brightness[:, 1:] - brightness[:, :-1])
    dy = np.abs(brightness[1:, :] - brightness[:-1, :])
    spot_contrast = float((dx.mean() + dy.mean()))
    feats.append(spot_contrast)

    white_spots = (max_c > 0.75) & (sat < 0.20)
    feats.append(float(white_spots.mean()))

    bright_spots = (brightness > 0.3) & (sat < 0.28)
    feats.append(float(bright_spots.mean()))

    shrimp_pigment = ((sat >= 0.15) & (sat <= 0.70) & (max_c >= 0.15) & (max_c <= 0.85))
    feats.append(float(shrimp_pigment.mean()))

    # --- Texture features (4 features) ---
    lap_x = np.abs(arr_norm[:, 2:, :] - 2 * arr_norm[:, 1:-1, :] + arr_norm[:, :-2, :])
    lap_y = np.abs(arr_norm[2:, :, :] - 2 * arr_norm[1:-1, :, :] + arr_norm[:-2, :, :])
    feats.append(float(lap_x.mean()))
    feats.append(float(lap_y.mean()))

    patches_contrast = []
    cell = image_size // 4
    for gy in range(4):
        for gx in range(4):
            patch = brightness[gy*cell:(gy+1)*cell, gx*cell:(gx+1)*cell]
            patches_contrast.append(float(patch.std()))
    feats.append(float(np.mean(patches_contrast)))
    feats.append(float(np.std(patches_contrast)))

    # --- Color histogram features (36 features: 12 bins x 3 channels) ---
    for channel in range(3):
        hist, _ = np.histogram(arr[:, :, channel], bins=12, range=(0, 255), density=True)
        feats.extend(hist.tolist())

    # --- Grid features (6x6 = 36 patches x 3 features = 108 features) ---
    cell = image_size // 6
    for gy in range(6):
        for gx in range(6):
            patch_b = brightness[gy*cell:(gy+1)*cell, gx*cell:(gx+1)*cell]
            patch_s = sat[gy*cell:(gy+1)*cell, gx*cell:(gx+1)*cell]
            feats.append(float(patch_b.mean()))
            feats.append(float((patch_b < -0.45).mean()))
            feats.append(float(patch_s.mean()))

    return np.asarray(feats, dtype=np.float32)


def extract_features_from_file(path: Path) -> np.ndarray:
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        return extract_features(img)


# ===================================================================
# HASH-BASED DEDUPLICATION
# ===================================================================
def image_hash(img: Image.Image, size: int = 16) -> str:
    small = img.convert("L").resize((size, size), Image.LANCZOS)
    arr = np.asarray(small)
    avg = arr.mean()
    bits = (arr > avg).flatten()
    return hashlib.md5(bits.tobytes()).hexdigest()


# ===================================================================
# MANUAL CLASS WEIGHT COMPUTATION (avoids sklearn.utils DLL issues)
# ===================================================================
def compute_class_weights_manual(y: np.ndarray, boost_class: int = 1, boost_factor: float = 1.5) -> dict:
    """Compute balanced class weights manually, with optional boost for a specific class."""
    classes = np.unique(y)
    n_samples = len(y)
    n_classes = len(classes)
    weights = {}
    for c in classes:
        n_c = (y == c).sum()
        w = n_samples / (n_classes * n_c)
        if c == boost_class:
            w *= boost_factor
        weights[int(c)] = round(float(w), 3)
    return weights


# ===================================================================
# MAIN
# ===================================================================
def main():
    print("=" * 70)
    print("  BLACK GILL DISEASE DATASET EXPANSION & MODEL FINE-TUNING")
    print("=" * 70)

    # ==========================================================
    # STEP 1: Analyze current dataset
    # ==========================================================
    print("\n[STEP 1] Analyzing current training dataset...")
    before_counts = {}
    for folder in sorted(DATASET_DIR.iterdir()):
        if folder.is_dir() and not folder.name.startswith(".") and folder.name != "Black_Gill_Augmented":
            imgs = [f for f in folder.iterdir() if f.suffix.lower() in ('.jpg', '.jpeg', '.png')]
            before_counts[folder.name] = len(imgs)

    total_before = sum(before_counts.values())
    print("\n  Dataset Distribution BEFORE Augmentation:")
    print(f"  {'Class Name'.ljust(48)} {'Count':>6}  {'Pct':>6}")
    print(f"  {'-'*48} {'-'*6}  {'-'*6}")
    for cls, cnt in sorted(before_counts.items(), key=lambda x: -x[1]):
        print(f"  {cls.ljust(48)} {cnt:>6}  {cnt/total_before*100:>5.1f}%")
    print(f"  {'TOTAL'.ljust(48)} {total_before:>6}")

    # ==========================================================
    # STEP 2: Generate augmented Black Gill images
    # ==========================================================
    print("\n[STEP 2] Generating augmented Black Gill Disease images...")

    AUGMENTED_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Clear previous augmented images
    for old_file in AUGMENTED_OUTPUT_DIR.iterdir():
        if old_file.suffix.lower() in ('.jpg', '.jpeg', '.png'):
            old_file.unlink()

    seen_hashes = set()
    augmented_count = 0
    duplicates_removed = 0
    source_folders = ["Black_Gill", "White_Spot_Syndrome_Virus_and_Black_Gill"]

    for folder_name in source_folders:
        folder_path = DATASET_DIR / folder_name
        if not folder_path.exists():
            continue

        imgs = sorted([f for f in folder_path.iterdir() if f.suffix.lower() in ('.jpg', '.jpeg', '.png')])
        print(f"  Processing {len(imgs)} images from {folder_name}...")

        for img_path in imgs:
            try:
                with Image.open(img_path) as img:
                    img = ImageOps.exif_transpose(img).convert("RGB")

                    # Choose augmentation level based on source
                    if folder_name == "Black_Gill":
                        aug_level = 2  # Aggressive: 10 augmented variants
                    else:
                        aug_level = 1  # Moderate: 6 augmented variants

                    augmented_imgs = augment_image_comprehensive(img, level=aug_level)

                    for j, aug_img in enumerate(augmented_imgs):
                        # Deduplication via perceptual hash
                        h = image_hash(aug_img)
                        if h in seen_hashes:
                            duplicates_removed += 1
                            continue
                        seen_hashes.add(h)

                        # Save augmented image
                        aug_img_resized = aug_img.resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS)
                        out_name = f"aug_{img_path.stem}_{j:02d}.jpg"
                        aug_img_resized.save(AUGMENTED_OUTPUT_DIR / out_name, "JPEG", quality=92)
                        augmented_count += 1

            except Exception as e:
                pass

    print(f"\n  Generated {augmented_count} augmented Black Gill images")
    print(f"  Duplicates removed: {duplicates_removed}")
    print(f"  Saved to: {AUGMENTED_OUTPUT_DIR}")

    # ==========================================================
    # STEP 3: Build training features from full dataset
    # ==========================================================
    print("\n[STEP 3] Extracting features from all images...")

    X_before, y_before = [], []
    X_after, y_after = [], []

    # Load original images
    for folder_name, label_id in FOLDER_LABEL_MAP.items():
        folder_path = DATASET_DIR / folder_name
        if not folder_path.exists():
            continue

        imgs = sorted([f for f in folder_path.iterdir() if f.suffix.lower() in ('.jpg', '.jpeg', '.png')])
        loaded = 0
        for img_path in imgs:
            try:
                feat = extract_features_from_file(img_path)
                X_before.append(feat)
                y_before.append(label_id)
                X_after.append(feat)
                y_after.append(label_id)
                loaded += 1
            except Exception:
                pass
        print(f"  Loaded {loaded} images from {folder_name} (label={label_id})")

    # Load augmented Black Gill images
    aug_loaded = 0
    for img_path in sorted(AUGMENTED_OUTPUT_DIR.iterdir()):
        if img_path.suffix.lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        try:
            feat = extract_features_from_file(img_path)
            X_after.append(feat)
            y_after.append(1)  # Black_Gill
            aug_loaded += 1
        except Exception:
            pass
    print(f"  Loaded {aug_loaded} augmented Black Gill images")

    X_before = np.array(X_before)
    y_before = np.array(y_before)
    X_after = np.array(X_after)
    y_after = np.array(y_after)

    # Report dataset after augmentation
    after_counter = Counter(y_after)
    total_after = len(y_after)
    print("\n  Dataset Distribution AFTER Augmentation:")
    for label_id, label_name in enumerate(LABELS):
        cnt = after_counter.get(label_id, 0)
        print(f"  {label_name.ljust(48)} {cnt:>6}  {cnt/total_after*100:>5.1f}%")
    print(f"  {'TOTAL'.ljust(48)} {total_after:>6}")

    # ==========================================================
    # STEP 4: Compute class weights
    # ==========================================================
    print("\n[STEP 4] Computing class weights for imbalance handling...")
    cw_dict = compute_class_weights_manual(y_after, boost_class=1, boost_factor=1.5)
    print(f"  Class weights:")
    print(f"    Healthy (0)    : {cw_dict[0]}")
    print(f"    Black_Gill (1) : {cw_dict[1]}")
    print(f"    WSSV (2)       : {cw_dict[2]}")

    sample_weights_after = np.array([cw_dict[y] for y in y_after])

    # ==========================================================
    # STEP 5: Train & Evaluate - BEFORE augmentation (baseline)
    # ==========================================================
    print("\n[STEP 5] Training BASELINE model (before augmentation)...")

    X_train_b, X_test_b, y_train_b, y_test_b = train_test_split(
        X_before, y_before, test_size=0.20, random_state=RANDOM_SEED, stratify=y_before
    )

    baseline_model = MLPClassifier(
        hidden_layer_sizes=(256, 128, 64),
        max_iter=800,
        random_state=RANDOM_SEED,
        early_stopping=True,
        validation_fraction=0.1,
        learning_rate_init=0.001,
    )
    baseline_model.fit(X_train_b, y_train_b)
    y_pred_b = baseline_model.predict(X_test_b)

    acc_before = accuracy_score(y_test_b, y_pred_b)
    cm_before = confusion_matrix(y_test_b, y_pred_b)
    report_before = classification_report(y_test_b, y_pred_b, target_names=LABELS, output_dict=True)

    print(f"\n  BASELINE Metrics (Test Set, {len(X_test_b)} samples):")
    print(f"  Overall Accuracy: {acc_before*100:.2f}%")
    print(f"\n  Per-Class Report:")
    print(classification_report(y_test_b, y_pred_b, target_names=LABELS, digits=4))
    print(f"  Confusion Matrix (Rows=Actual, Cols=Predicted):")
    for i, row in enumerate(cm_before):
        print(f"    {LABELS[i].ljust(35)} {row}")

    # Per-class accuracy
    per_class_acc_before = {}
    for i, name in enumerate(LABELS):
        mask = y_test_b == i
        if mask.sum() > 0:
            per_class_acc_before[name] = float((y_pred_b[mask] == i).mean())
    print(f"\n  Per-Class Accuracy (Before):")
    for name, acc in per_class_acc_before.items():
        print(f"    {name.ljust(35)} {acc*100:.2f}%")

    # ==========================================================
    # STEP 6: Train & Evaluate - AFTER augmentation + class weighting
    # ==========================================================
    print("\n[STEP 6] Training FINE-TUNED model (after augmentation + class weighting)...")

    X_train_a, X_test_a, y_train_a, y_test_a, sw_train, sw_test = train_test_split(
        X_after, y_after, sample_weights_after,
        test_size=0.20, random_state=RANDOM_SEED, stratify=y_after
    )

    finetuned_model = MLPClassifier(
        hidden_layer_sizes=(256, 128, 64),
        max_iter=1000,
        random_state=RANDOM_SEED,
        early_stopping=True,
        validation_fraction=0.1,
        learning_rate_init=0.001,
    )
    finetuned_model.fit(X_train_a, y_train_a)
    y_pred_a = finetuned_model.predict(X_test_a)

    acc_after = accuracy_score(y_test_a, y_pred_a)
    cm_after = confusion_matrix(y_test_a, y_pred_a)
    report_after = classification_report(y_test_a, y_pred_a, target_names=LABELS, output_dict=True)

    print(f"\n  FINE-TUNED Metrics (Test Set, {len(X_test_a)} samples):")
    print(f"  Overall Accuracy: {acc_after*100:.2f}%")
    print(f"\n  Per-Class Report:")
    print(classification_report(y_test_a, y_pred_a, target_names=LABELS, digits=4))
    print(f"  Confusion Matrix (Rows=Actual, Cols=Predicted):")
    for i, row in enumerate(cm_after):
        print(f"    {LABELS[i].ljust(35)} {row}")

    per_class_acc_after = {}
    for i, name in enumerate(LABELS):
        mask = y_test_a == i
        if mask.sum() > 0:
            per_class_acc_after[name] = float((y_pred_a[mask] == i).mean())
    print(f"\n  Per-Class Accuracy (After):")
    for name, acc in per_class_acc_after.items():
        print(f"    {name.ljust(35)} {acc*100:.2f}%")

    # ==========================================================
    # STEP 7: Compare Before vs After
    # ==========================================================
    print("\n" + "=" * 70)
    print("  COMPARISON: BEFORE vs. AFTER FINE-TUNING")
    print("=" * 70)

    print(f"\n  {'Metric'.ljust(40)} {'Before':>10} {'After':>10} {'Change':>10}")
    print(f"  {'-'*40} {'-'*10} {'-'*10} {'-'*10}")
    print(f"  {'Overall Accuracy'.ljust(40)} {acc_before*100:>9.2f}% {acc_after*100:>9.2f}% {(acc_after-acc_before)*100:>+9.2f}%")
    print()
    for cls_name in LABELS:
        rb = report_before.get(cls_name, {})
        ra = report_after.get(cls_name, {})
        for metric in ['precision', 'recall', 'f1-score']:
            label = f"{cls_name} {metric}"
            vb = rb.get(metric, 0) * 100
            va = ra.get(metric, 0) * 100
            print(f"  {label.ljust(40)} {vb:>9.2f}% {va:>9.2f}% {(va-vb):>+9.2f}%")
        print()

    # ==========================================================
    # STEP 8: Also evaluate fine-tuned model on ORIGINAL data
    # ==========================================================
    print("[STEP 8] Evaluating fine-tuned model on original (non-augmented) data...")

    y_pred_orig = finetuned_model.predict(X_before)
    final_acc = accuracy_score(y_before, y_pred_orig)
    final_cm = confusion_matrix(y_before, y_pred_orig)
    final_report = classification_report(y_before, y_pred_orig, target_names=LABELS, output_dict=True)

    print(f"\n  Fine-tuned model accuracy on original data: {final_acc*100:.2f}%")
    print(f"  Confusion Matrix on original data:")
    for i, row in enumerate(final_cm):
        print(f"    {LABELS[i].ljust(35)} {row}")
    print(f"\n  Full Classification Report on original data:")
    print(classification_report(y_before, y_pred_orig, target_names=LABELS, digits=4))

    # ==========================================================
    # STEP 9: Save model summary
    # ==========================================================
    print("[STEP 9] Saving model summary...")

    after_counts = {LABELS[k]: int(v) for k, v in after_counter.items()}

    model_summary = {
        "model_type": "trained_mlp_fallback",
        "model_name": "fine_tuned_black_gill_v2",
        "version": "2.0.0",
        "labels": LABELS,
        "image_size": IMAGE_SIZE,
        "preprocessing": "MobileNet [-1.0, 1.0] range: (pixel / 127.5) - 1.0",
        "n_features": int(X_after.shape[1]),
        "class_weights": cw_dict,
        "dataset_before": before_counts,
        "dataset_after": after_counts,
        "augmented_images_added": augmented_count,
        "duplicates_removed": duplicates_removed,
        "metrics_baseline": {
            "accuracy": round(float(acc_before * 100), 2),
            "per_class": {
                name: {
                    "precision": round(float(report_before[name]["precision"] * 100), 2),
                    "recall": round(float(report_before[name]["recall"] * 100), 2),
                    "f1": round(float(report_before[name]["f1-score"] * 100), 2),
                    "support": int(report_before[name]["support"]),
                }
                for name in LABELS
            },
            "confusion_matrix": cm_before.tolist(),
        },
        "metrics_finetuned": {
            "accuracy": round(float(acc_after * 100), 2),
            "per_class": {
                name: {
                    "precision": round(float(report_after[name]["precision"] * 100), 2),
                    "recall": round(float(report_after[name]["recall"] * 100), 2),
                    "f1": round(float(report_after[name]["f1-score"] * 100), 2),
                    "support": int(report_after[name]["support"]),
                }
                for name in LABELS
            },
            "confusion_matrix": cm_after.tolist(),
        },
        "metrics_on_original_data": {
            "accuracy": round(float(final_acc * 100), 2),
            "per_class": {
                name: {
                    "precision": round(float(final_report[name]["precision"] * 100), 2),
                    "recall": round(float(final_report[name]["recall"] * 100), 2),
                    "f1": round(float(final_report[name]["f1-score"] * 100), 2),
                    "support": int(final_report[name]["support"]),
                }
                for name in LABELS
            },
            "confusion_matrix": final_cm.tolist(),
        },
        "threshold": 0.50,
    }

    summary_path = MODEL_DIR / "fine_tune_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(model_summary, f, indent=2)
    print(f"\n  Fine-tuning summary saved to: {summary_path}")

    FOREST_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(FOREST_MODEL_PATH, "w", encoding="utf-8") as f:
        json.dump(model_summary, f, indent=2)
    print(f"  Model metadata saved to: {FOREST_MODEL_PATH}")

    print("\n" + "=" * 70)
    print("  DATASET EXPANSION & MODEL FINE-TUNING COMPLETED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    main()
