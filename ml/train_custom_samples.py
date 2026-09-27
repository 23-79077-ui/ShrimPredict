"""
train_custom_samples.py
=======================
Retrains / fine-tunes the ShrimPredict disease classification model using
user-provided farm photos (e.g. real WSSV or Healthy photos).

Workflow:
1. Loads photos from data/user_train_samples/ (WSSV, Healthy, Black_Gill).
2. Generates rich augmentations (rotations, zooms on white spots, flips, lighting variations).
3. Balances with baseline reference samples.
4. Fine-tunes the top layers of efficientnet_v2_disease.keras.
5. Verifies predictions on the user's input image.
6. Notifies running Flask API to hot-reload the updated weights.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import urllib.request
from pathlib import Path
from typing import Sequence

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

# Ensure TensorFlow doesn't spam logs
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

ROOT_DIR = Path(__file__).resolve().parents[1]
USER_SAMPLES_DIR = ROOT_DIR / "data" / "user_train_samples"
ARTIFACTS_DIR = ROOT_DIR / "ml" / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "efficientnet_v2_disease.keras"
LABELS_PATH = ARTIFACTS_DIR / "efficientnet_v2_disease_labels.json"
METRICS_PATH = ARTIFACTS_DIR / "efficientnet_v2_disease_metrics.json"

DESKTOP_DATASET_DIR = Path(r"C:\Users\HP\Desktop\Shrimp\Shrimp\dataset-tools\augmented_12k_dataset")
FARM_CAPTURED_DIR = ROOT_DIR / "data" / "farm_captured"

CANONICAL_CLASSES = ["Healthy", "WSSV", "Black Gill"]


def ensure_user_folders() -> dict[str, Path]:
    """Ensure dedicated user training folders exist."""
    folders = {
        "WSSV": USER_SAMPLES_DIR / "WSSV",
        "Healthy": USER_SAMPLES_DIR / "Healthy",
        "Black Gill": USER_SAMPLES_DIR / "Black_Gill",
    }
    for p in folders.values():
        p.mkdir(parents=True, exist_ok=True)
    return folders


def generate_augmentations(img: Image.Image, num_variants: int = 35) -> list[Image.Image]:
    """
    Produce diverse augmentations emphasizing spots, angles, zoom, and lighting.
    """
    variants: list[Image.Image] = []
    base_rgb = img.convert("RGB")
    w, h = base_rgb.size

    variants.append(base_rgb)
    variants.append(base_rgb.transpose(Image.Transpose.FLIP_LEFT_RIGHT))
    variants.append(base_rgb.transpose(Image.Transpose.FLIP_TOP_BOTTOM))

    for _ in range(num_variants):
        variant = base_rgb.copy()

        # Random horizontal / vertical flip
        if random.random() > 0.5:
            variant = variant.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if random.random() > 0.5:
            variant = variant.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

        # Random rotation (-30 to +30 deg or orthogonal)
        angle = random.choice([
            random.uniform(-30, 30),
            random.choice([90, 180, 270]) + random.uniform(-10, 10),
        ])
        variant = variant.rotate(angle, expand=False, resample=Image.Resampling.BICUBIC)

        # Random crop / zoom (focus on white spot textures)
        if random.random() > 0.3:
            scale = random.uniform(0.65, 0.95)
            cw, ch = int(w * scale), int(h * scale)
            x0 = random.randint(0, max(0, w - cw))
            y0 = random.randint(0, max(0, h - ch))
            variant = variant.crop((x0, y0, x0 + cw, y0 + ch)).resize((w, h), Image.Resampling.LANCZOS)

        # Brightness & contrast jitter (simulates farm lighting / camera sensor)
        bright_factor = random.uniform(0.75, 1.30)
        variant = ImageEnhance.Brightness(variant).enhance(bright_factor)

        contrast_factor = random.uniform(0.85, 1.40)
        variant = ImageEnhance.Contrast(variant).enhance(contrast_factor)

        # Color saturation jitter
        color_factor = random.uniform(0.80, 1.25)
        variant = ImageEnhance.Color(variant).enhance(color_factor)

        # Occasional slight sharpen or blur
        if random.random() > 0.7:
            variant = variant.filter(ImageFilter.UnsharpMask(radius=2, percent=130))
        elif random.random() > 0.7:
            variant = variant.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.5, 1.2)))

        variants.append(variant)

    return variants


def collect_training_samples(img_size: int = 224) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """
    Collects user samples + augmented copies + representative baseline samples.
    """
    folders = ensure_user_folders()
    images: list[np.ndarray] = []
    labels: list[int] = []

    # 1. Collect user samples and heavily augment them
    for class_idx, class_name in enumerate(CANONICAL_CLASSES):
        folder = folders[class_name]
        user_files = [f for f in folder.glob("*") if f.is_file() and f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
        print(f"Found {len(user_files)} user file(s) in {folder.name}/")

        for ufile in user_files:
            try:
                with Image.open(ufile) as img:
                    augmented_list = generate_augmentations(img, num_variants=40)
                    for aug in augmented_list:
                        resized = aug.resize((img_size, img_size), Image.Resampling.LANCZOS)
                        arr = np.asarray(resized, dtype=np.float32)
                        images.append(arr)
                        labels.append(class_idx)
            except Exception as e:
                print(f"Warning: could not process {ufile}: {e}")

    # 2. Add baseline samples for Healthy and Black Gill so the model stays balanced
    baseline_sources = [
        ("Healthy", FARM_CAPTURED_DIR / "Healthy"),
        ("Healthy", DESKTOP_DATASET_DIR / "Healthy"),
        ("Black Gill", DESKTOP_DATASET_DIR / "Black Gill"),
        ("WSSV", DESKTOP_DATASET_DIR / "WSSV"),
    ]

    for class_name, src_dir in baseline_sources:
        if not src_dir.exists():
            continue
        class_idx = CANONICAL_CLASSES.index(class_name)
        existing_class_files = [f for f in src_dir.glob("*") if f.is_file() and f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
        # Take a balanced subset
        num_to_take = 50 if class_name != "WSSV" else 20
        selected = random.sample(existing_class_files, min(num_to_take, len(existing_class_files)))
        print(f"Sampling {len(selected)} reference images for '{class_name}' from {src_dir.name}")
        for sfile in selected:
            try:
                with Image.open(sfile) as img:
                    resized = img.convert("RGB").resize((img_size, img_size), Image.Resampling.LANCZOS)
                    images.append(np.asarray(resized, dtype=np.float32))
                    labels.append(class_idx)
            except Exception:
                pass

    x_arr = np.array(images, dtype=np.float32)
    y_arr = np.array(labels, dtype=np.int32)
    return x_arr, y_arr, CANONICAL_CLASSES


def train(epochs: int = 10, batch_size: int = 16, learning_rate: float = 1e-4) -> None:
    import tensorflow as tf
    from sklearn.utils.class_weight import compute_class_weight

    print("\n" + "=" * 65)
    print("SHRIMPREDICT CUSTOM SAMPLE RETRAINING PIPELINE")
    print("=" * 65)

    if not MODEL_PATH.exists():
        print(f"Error: Model not found at {MODEL_PATH}")
        sys.exit(1)

    print("Loading data...")
    X, y, class_names = collect_training_samples(img_size=224)
    print(f"Total training dataset size: {len(X)} images")

    # One-hot encode targets
    num_classes = len(class_names)
    Y_onehot = tf.keras.utils.to_categorical(y, num_classes=num_classes)

    # Compute class weights to give high focus to WSSV
    classes_present = np.unique(y)
    weights = compute_class_weight(class_weight="balanced", classes=classes_present, y=y)
    class_weight_dict = {cls: float(w) for cls, w in zip(classes_present, weights)}
    # Give WSSV an additional 2.5x focus weight to prevent false negatives
    wssv_idx = class_names.index("WSSV")
    if wssv_idx in class_weight_dict:
        class_weight_dict[wssv_idx] *= 2.5
    print(f"Class weighting: {class_weight_dict}")

    print(f"\nLoading existing model from {MODEL_PATH}...")
    model = tf.keras.models.load_model(str(MODEL_PATH))

    if model.output_shape[-1] != num_classes:
        print(f"Adapting model output head from {model.output_shape[-1]} to {num_classes} classes...")
        x = model.layers[-2].output
        outputs = tf.keras.layers.Dense(num_classes, activation="softmax", name="disease_output")(x)
        model = tf.keras.Model(model.inputs, outputs)

    # Unfreeze top layers of the backbone for fine-tuning
    model.trainable = True
    # Freeze earlier low-level feature layers (first 70% of layers)
    cutoff = int(len(model.layers) * 0.70)
    for layer in model.layers[:cutoff]:
        layer.trainable = False
    for layer in model.layers[cutoff:]:
        layer.trainable = True

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.02),
        metrics=["accuracy"],
    )

    print(f"\nFine-tuning model on custom farm samples ({epochs} epochs)...")
    model.fit(
        X,
        Y_onehot,
        epochs=epochs,
        batch_size=batch_size,
        shuffle=True,
        class_weight=class_weight_dict,
        verbose=1,
    )

    # Save updated model
    print(f"\nSaving fine-tuned model to {MODEL_PATH}...")
    model.save(str(MODEL_PATH))

    # Update labels manifest
    labels_payload = {
        "classes": class_names,
        "image_size": [224, 224],
        "preprocessing": "EfficientNetV2B0 transfer learning with custom user WSSV fine-tuning",
        "model": "EfficientNetV2B0 fine-tuned",
        "last_trained": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    with open(LABELS_PATH, "w", encoding="utf-8") as f:
        json.dump(labels_payload, f, indent=2)

    print("Model saved successfully!")

    # Hot-reload API if it's currently running
    reload_running_api()


def reload_running_api() -> None:
    """Attempts to notify the running Flask server to reload models."""
    api_url = "http://127.0.0.1:5001/reload_models"
    try:
        req = urllib.request.Request(api_url, method="POST")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"\n[API HOT-RELOAD] Flask API notified: {data.get('message', 'Reloaded')}")
    except Exception:
        print("\n[NOTE] Flask API server on port 5001 will reload model on next request or restart.")


def evaluate_test_image(image_path: Path) -> None:
    """Tests the newly trained model on a specific test image."""
    import tensorflow as tf

    if not image_path.exists():
        print(f"Test image not found: {image_path}")
        return

    print(f"\nEvaluating image: {image_path.name}")
    with Image.open(image_path) as img:
        img_resized = img.convert("RGB").resize((224, 224), Image.Resampling.LANCZOS)
    arr = np.expand_dims(np.asarray(img_resized, dtype=np.float32), 0)

    model = tf.keras.models.load_model(str(MODEL_PATH))
    preds = model.predict(arr, verbose=0)[0]

    with open(LABELS_PATH, "r", encoding="utf-8") as f:
        labels_data = json.load(f)
    classes = labels_data["classes"] if isinstance(labels_data, dict) and "classes" in labels_data else labels_data

    print("\n--- INFERENCE RESULTS ---")
    for cls, prob in zip(classes, preds):
        print(f"  {cls:<15}: {prob * 100:.2f}%")
    top_idx = int(np.argmax(preds))
    print(f"\nPredicted: {classes[top_idx]} ({preds[top_idx] * 100:.2f}% confidence)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fine-tune ShrimPredict model on custom user farm samples.")
    parser.add_argument("--epochs", type=int, default=8, help="Number of fine-tuning epochs.")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate.")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size.")
    parser.add_argument("--eval-image", type=Path, default=None, help="Optional image to evaluate after training.")
    args = parser.parse_args()

    ensure_user_folders()
    train(epochs=args.epochs, batch_size=args.batch_size, learning_rate=args.lr)

    test_img = args.eval_image or (USER_SAMPLES_DIR / "WSSV" / "wssv_shrimp_sample_1.jpg")
    if test_img and test_img.exists():
        evaluate_test_image(test_img)


if __name__ == "__main__":
    main()
