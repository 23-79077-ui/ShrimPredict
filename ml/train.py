"""
train.py
========
ShrimPredict 4-Class Baseline & Improved Classifier Training Pipeline

Classes:
0: Healthy
1: WSSV
2: Black Gill
3: WSSV + Black Gill

Execution Order:
- Step 6: Train Baseline Model (Categorical Cross-Entropy, unweighted, no augmentation).
- Step 7: Compare Class Imbalance Strategies on Validation Data (Unweighted vs Class-Weighted).
- Step 8 & 9: Train Improved Model in 2 stages (Transfer learning + Fine tuning with biological augmentation).
- Step 13: Mine Hard Negatives on Validation Data -> hard_negatives.csv.
- Save baseline_model.keras, efficientnet_v2_disease.keras, labels JSON, and metrics report.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
import numpy as np
from sklearn.metrics import confusion_matrix, classification_report, balanced_accuracy_score, f1_score, precision_recall_fscore_support
from sklearn.utils.class_weight import compute_class_weight
import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetV2B0

ROOT_DIR = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT_DIR / "ml" / "artifacts"
TRAIN_CSV = ARTIFACTS_DIR / "train_clean.csv"
VAL_CSV = ARTIFACTS_DIR / "val_clean.csv"

BASELINE_MODEL_PATH = ARTIFACTS_DIR / "baseline_model.keras"
IMPROVED_MODEL_PATH = ARTIFACTS_DIR / "efficientnet_v2_disease.keras"
LABELS_PATH = ARTIFACTS_DIR / "efficientnet_v2_disease_labels.json"
HARD_NEGATIVES_CSV = ARTIFACTS_DIR / "hard_negatives.csv"
TRAINING_METRICS_JSON = ARTIFACTS_DIR / "training_metrics.json"

CANONICAL_CLASSES = ["Healthy", "WSSV", "Black Gill", "WSSV + Black Gill"]


def load_manifest(csv_path: Path) -> tuple[list[str], list[int], list[str]]:
    if not csv_path.exists():
        raise FileNotFoundError(f"Manifest not found: {csv_path}")

    paths, labels_idx, labels_str = [], [], []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lbl = row["label"]
            if lbl in CANONICAL_CLASSES:
                paths.append(row["image_path"])
                labels_str.append(lbl)
                labels_idx.append(CANONICAL_CLASSES.index(lbl))
    return paths, labels_idx, labels_str


def build_tf_dataset(
    paths: list[str],
    labels: list[int],
    batch_size: int = 32,
    is_training: bool = True,
    pad_val: float = 128.0,
    seed: int = 42,
) -> tf.data.Dataset:
    target_size = (224, 224)
    target_h, target_w = target_size

    def _load_and_letterbox(path_t, label_t):
        raw = tf.io.read_file(path_t)
        img = tf.io.decode_image(raw, channels=3, expand_animations=False)
        img = tf.cast(img, tf.float32)

        shape = tf.shape(img)
        orig_h, orig_w = shape[0], shape[1]

        scale = tf.minimum(
            tf.cast(target_w, tf.float32) / tf.cast(orig_w, tf.float32),
            tf.cast(target_h, tf.float32) / tf.cast(orig_h, tf.float32),
        )
        new_w = tf.cast(tf.round(tf.cast(orig_w, tf.float32) * scale), tf.int32)
        new_h = tf.cast(tf.round(tf.cast(orig_h, tf.float32) * scale), tf.int32)

        resized = tf.image.resize(img, [new_h, new_w], method="bicubic")

        pad_h = target_h - new_h
        pad_w = target_w - new_w
        pad_top = pad_h // 2
        pad_bottom = pad_h - pad_top
        pad_left = pad_w // 2
        pad_right = pad_w - pad_left

        shifted = resized - pad_val
        paddings = tf.stack([[pad_top, pad_bottom], [pad_left, pad_right], [0, 0]])
        padded = tf.pad(shifted, paddings, mode="CONSTANT", constant_values=0.0)
        output = padded + pad_val
        output = tf.clip_by_value(output, 0.0, 255.0)
        output.set_shape([target_h, target_w, 3])

        return output, tf.one_hot(label_t, len(CANONICAL_CLASSES))

    ds = tf.data.Dataset.from_tensor_slices((paths, labels))
    if is_training:
        ds = ds.shuffle(buffer_size=len(paths), seed=seed, reshuffle_each_iteration=True)

    ds = ds.map(_load_and_letterbox, num_parallel_calls=tf.data.AUTOTUNE)
    ds = ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return ds


def build_model(use_augmentation: bool = True) -> tuple[tf.keras.Model, tf.keras.Model]:
    inputs = tf.keras.Input(shape=(224, 224, 3), name="image_input")

    if use_augmentation:
        aug_layers = tf.keras.Sequential([
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.04),      # +/- 14.4 degrees
            layers.RandomBrightness(0.12),    # +/- 12%
            layers.RandomContrast(0.10),      # +/- 10%
            layers.GaussianNoise(0.02 * 255), # Biologically safe sensor noise
        ], name="biological_augmentation")
        x = aug_layers(inputs)
    else:
        x = inputs

    base = EfficientNetV2B0(
        include_top=False,
        weights="imagenet",
        input_shape=(224, 224, 3),
        include_preprocessing=True,  # Handles [0, 255] internal scaling
    )
    base.trainable = False

    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D(name="avg_pool")(x)
    x = layers.BatchNormalization(name="head_bn")(x)
    x = layers.Dropout(0.30, name="head_dropout")(x)
    outputs = layers.Dense(len(CANONICAL_CLASSES), activation="softmax", name="disease_output")(x)

    model = tf.keras.Model(inputs=inputs, outputs=outputs, name="shrimpredict_4class_model")
    return model, base


def evaluate_on_val(model: tf.keras.Model, val_ds: tf.data.Dataset, y_val: list[int]) -> dict:
    raw_preds = model.predict(val_ds, verbose=0)
    y_pred = np.argmax(raw_preds, axis=1)

    macro_f1 = float(f1_score(y_val, y_pred, average="macro"))
    weighted_f1 = float(f1_score(y_val, y_pred, average="weighted"))
    bal_acc = float(balanced_accuracy_score(y_val, y_pred))
    acc = float(np.mean(np.array(y_val) == y_pred))

    p, r, f, s = precision_recall_fscore_support(y_val, y_pred, labels=[0, 1, 2, 3], zero_division=0)
    cm = confusion_matrix(y_val, y_pred, labels=[0, 1, 2, 3])

    per_class = {}
    for i, c in enumerate(CANONICAL_CLASSES):
        tn = np.sum((np.array(y_val) != i) & (y_pred != i))
        fp = np.sum((np.array(y_val) != i) & (y_pred == i))
        spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
        per_class[c] = {
            "precision": round(float(p[i]), 4),
            "recall": round(float(r[i]), 4),
            "f1_score": round(float(f[i]), 4),
            "specificity": round(spec, 4),
            "support": int(s[i]),
        }

    return {
        "accuracy": round(acc, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "balanced_accuracy": round(bal_acc, 4),
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "raw_predictions": raw_preds,
    }


def mine_hard_negatives(val_paths: list[str], y_val: list[int], raw_preds: np.ndarray, output_csv: Path):
    hard_negs = []
    y_pred = np.argmax(raw_preds, axis=1)
    confs = np.max(raw_preds, axis=1)

    for i, (true_idx, pred_idx, conf) in enumerate(zip(y_val, y_pred, confs)):
        if true_idx != pred_idx and conf >= 0.50:
            true_lbl = CANONICAL_CLASSES[true_idx]
            pred_lbl = CANONICAL_CLASSES[pred_idx]
            error_type = f"{true_lbl} -> {pred_lbl}"
            hard_negs.append({
                "image_path": val_paths[i],
                "true_class": true_lbl,
                "predicted_class": pred_lbl,
                "confidence": round(float(conf * 100), 2),
                "top_probability": round(float(conf), 4),
                "model": "Improved_EfficientNetV2B0_4Class",
                "error_type": error_type,
            })

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["image_path", "true_class", "predicted_class", "confidence", "top_probability", "model", "error_type"])
        for row in hard_negs:
            writer.writerow([row["image_path"], row["true_class"], row["predicted_class"], row["confidence"], row["top_probability"], row["model"], row["error_type"]])

    print(f"\nMined {len(hard_negs)} hard negative validation samples -> {output_csv}")
    return hard_negs


def run_training_pipeline():
    print("=" * 65)
    print("SHRIMPREDICT 4-CLASS TRAINING PIPELINE")
    print("=" * 65)

    train_paths, y_train, train_strs = load_manifest(TRAIN_CSV)
    val_paths, y_val, val_strs = load_manifest(VAL_CSV)

    print(f"Loaded Train: {len(train_paths)} samples, Val: {len(val_paths)} samples")
    train_counts = {c: train_strs.count(c) for c in CANONICAL_CLASSES}
    val_counts = {c: val_strs.count(c) for c in CANONICAL_CLASSES}
    print(f"Train Counts: {train_counts}")
    print(f"Val Counts:   {val_counts}")

    # Compute balanced class weights
    class_weights_arr = compute_class_weight(
        class_weight="balanced",
        classes=np.arange(len(CANONICAL_CLASSES)),
        y=y_train,
    )
    class_weights_dict = {i: float(class_weights_arr[i]) for i in range(len(CANONICAL_CLASSES))}
    print(f"Balanced Class Weights: {class_weights_dict}")

    train_ds = build_tf_dataset(train_paths, y_train, batch_size=32, is_training=True)
    val_ds = build_tf_dataset(val_paths, y_val, batch_size=32, is_training=False)

    # -----------------------------------------------------------------
    # STEP 6: TRAIN BASELINE FIRST
    # -----------------------------------------------------------------
    print("\n" + "=" * 65)
    print("STEP 6: TRAINING BASELINE MODEL (No Augmentation, No Class Weights)")
    print("=" * 65)

    base_model, _ = build_model(use_augmentation=False)
    base_model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.CategoricalCrossentropy(),
        metrics=["accuracy"],
    )

    base_callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=4, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-6),
    ]

    base_model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=6,
        callbacks=base_callbacks,
        verbose=1,
    )

    baseline_metrics = evaluate_on_val(base_model, val_ds, y_val)
    print("\n--- BASELINE VALIDATION METRICS ---")
    print(f"Accuracy:          {baseline_metrics['accuracy'] * 100:.2f}%")
    print(f"Macro F1:          {baseline_metrics['macro_f1']:.4f}")
    print(f"Balanced Accuracy: {baseline_metrics['balanced_accuracy'] * 100:.2f}%")
    for c in CANONICAL_CLASSES:
        m = baseline_metrics["per_class"][c]
        print(f"  {c:<20} P: {m['precision']:.4f} | R: {m['recall']:.4f} | F1: {m['f1_score']:.4f}")

    base_model.save(BASELINE_MODEL_PATH)
    print(f"Saved Baseline Model -> {BASELINE_MODEL_PATH}")

    # -----------------------------------------------------------------
    # STEP 7, 8, 9: TRAIN IMPROVED MODEL (2 Stages + Augmentation + Balanced Weights)
    # -----------------------------------------------------------------
    print("\n" + "=" * 65)
    print("STEP 8 & 9: TRAINING IMPROVED MODEL (Biological Augmentation + Balanced Weights)")
    print("=" * 65)

    imp_model, imp_backbone = build_model(use_augmentation=True)
    imp_model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.02),
        metrics=["accuracy"],
    )

    imp_callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(IMPROVED_MODEL_PATH),
            monitor="val_accuracy",
            mode="max",
            save_best_only=True,
            verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", mode="max", patience=5, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.4, patience=2, min_lr=1e-6, verbose=1),
    ]

    print("Stage 1: Training Head (Frozen Backbone)...")
    imp_model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=8,
        class_weight=class_weights_dict,
        callbacks=imp_callbacks,
        verbose=1,
    )

    print("\nStage 2: Fine-Tuning Top 25 Layers (learning_rate=1e-5)...")
    imp_backbone.trainable = True
    for layer in imp_backbone.layers[:-25]:
        layer.trainable = False

    imp_model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.01),
        metrics=["accuracy"],
    )

    imp_model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=5,
        class_weight=class_weights_dict,
        callbacks=imp_callbacks,
        verbose=1,
    )

    # Save finalized improved model and labels manifest
    imp_model.save(IMPROVED_MODEL_PATH)
    with open(LABELS_PATH, "w", encoding="utf-8") as f:
        json.dump({"classes": CANONICAL_CLASSES}, f, indent=2)

    improved_metrics = evaluate_on_val(imp_model, val_ds, y_val)
    print("\n--- IMPROVED MODEL VALIDATION METRICS ---")
    print(f"Accuracy:          {improved_metrics['accuracy'] * 100:.2f}%")
    print(f"Macro F1:          {improved_metrics['macro_f1']:.4f}")
    print(f"Balanced Accuracy: {improved_metrics['balanced_accuracy'] * 100:.2f}%")
    for c in CANONICAL_CLASSES:
        m = improved_metrics["per_class"][c]
        print(f"  {c:<20} P: {m['precision']:.4f} | R: {m['recall']:.4f} | F1: {m['f1_score']:.4f}")

    # STEP 13: Hard-Negative Mining
    hard_negs = mine_hard_negatives(val_paths, y_val, improved_metrics["raw_predictions"], HARD_NEGATIVES_CSV)

    # Save summary metrics report
    training_summary = {
        "classes": CANONICAL_CLASSES,
        "class_weights": class_weights_dict,
        "baseline_metrics": baseline_metrics,
        "improved_metrics": improved_metrics,
        "hard_negatives_count": len(hard_negs),
    }
    with open(TRAINING_METRICS_JSON, "w", encoding="utf-8") as f:
        json.dump(training_summary, f, indent=2)
    print(f"Saved complete training metrics summary -> {TRAINING_METRICS_JSON}")


if __name__ == "__main__":
    run_training_pipeline()
