from __future__ import annotations

import argparse
import json
from pathlib import Path

import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetV2B0


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATASET_DIR = Path(r"C:\Users\HP\Desktop\Shrimp\Shrimp\dataset-tools\augmented_12k_dataset")
DEFAULT_MODEL_PATH = ROOT_DIR / "ml" / "artifacts" / "efficientnet_v2_disease.keras"
DEFAULT_LABELS_PATH = ROOT_DIR / "ml" / "artifacts" / "efficientnet_v2_disease_labels.json"
DEFAULT_METRICS_PATH = ROOT_DIR / "ml" / "artifacts" / "efficientnet_v2_disease_metrics.json"

CLASS_NAMES = ["Healthy", "WSSV", "Black Gill"]
FOLDER_TO_LABEL = {
    "Healthy": "Healthy",
    "WSSV": "WSSV",
    "Black Gill": "Black Gill",
    "Black_Gill": "Black Gill",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the upgraded three-class disease scan classifier.")
    parser.add_argument("--dataset-dir", type=Path, default=DEFAULT_DATASET_DIR)
    parser.add_argument("--model-path", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--labels-path", type=Path, default=DEFAULT_LABELS_PATH)
    parser.add_argument("--metrics-path", type=Path, default=DEFAULT_METRICS_PATH)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--fine-tune-epochs", type=int, default=8)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--validation-split", type=float, default=0.15)
    return parser.parse_args()


def collect_files(dataset_dir: Path) -> tuple[list[str], list[int], dict[str, int]]:
    image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    files: list[str] = []
    labels: list[int] = []

    for folder, label in FOLDER_TO_LABEL.items():
        class_dir = dataset_dir / folder
        if not class_dir.exists():
            continue
        label_index = CLASS_NAMES.index(label)
        for image_path in sorted(class_dir.rglob("*")):
            if image_path.is_file() and image_path.suffix.lower() in image_extensions:
                files.append(str(image_path))
                labels.append(label_index)

    counts = {name: labels.count(index) for index, name in enumerate(CLASS_NAMES)}
    missing = [name for name, count in counts.items() if count == 0]
    if missing:
        raise FileNotFoundError(f"Missing images for target classes: {missing}")
    return files, labels, counts


def build_datasets(args: argparse.Namespace):
    files, labels, counts = collect_files(args.dataset_dir)
    image_size = (args.image_size, args.image_size)
    dataset = tf.data.Dataset.from_tensor_slices((files, labels))
    dataset = dataset.shuffle(len(files), seed=args.seed, reshuffle_each_iteration=False)

    val_size = int(len(files) * args.validation_split)
    val_ds = dataset.take(val_size)
    train_ds = dataset.skip(val_size)

    def load_image(path, label):
        image = tf.io.read_file(path)
        image = tf.io.decode_image(image, channels=3, expand_animations=False)
        image = tf.image.resize(image, image_size)
        image = tf.cast(image, tf.float32)
        return image, tf.one_hot(label, len(CLASS_NAMES))

    autotune = tf.data.AUTOTUNE
    train_ds = (
        train_ds
        .map(load_image, num_parallel_calls=autotune)
        .batch(args.batch_size)
        .prefetch(autotune)
    )
    val_ds = (
        val_ds
        .map(load_image, num_parallel_calls=autotune)
        .batch(args.batch_size)
        .prefetch(autotune)
    )
    return train_ds, val_ds, counts, len(files), val_size


def build_model(image_size: int) -> tuple[tf.keras.Model, tf.keras.Model]:
    inputs = tf.keras.Input(shape=(image_size, image_size, 3), name="image")
    augmentation = tf.keras.Sequential(
        [
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.08),
            layers.RandomZoom(0.12),
            layers.RandomContrast(0.12),
        ],
        name="disease_augmentation",
    )

    base = EfficientNetV2B0(
        include_top=False,
        weights="imagenet",
        input_shape=(image_size, image_size, 3),
        include_preprocessing=True,
    )
    base.trainable = False

    x = augmentation(inputs)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D(name="global_pool")(x)
    x = layers.Dropout(0.35, name="dropout")(x)
    outputs = layers.Dense(len(CLASS_NAMES), activation="softmax", name="disease")(x)

    model = tf.keras.Model(inputs, outputs, name="shrimp_efficientnetv2b0_disease")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.02),
        metrics=[
            "accuracy",
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )
    return model, base


def main() -> None:
    args = parse_args()
    if not args.dataset_dir.exists():
        raise FileNotFoundError(f"Augmented dataset not found: {args.dataset_dir}")

    tf.keras.utils.set_random_seed(args.seed)
    args.model_path.parent.mkdir(parents=True, exist_ok=True)

    train_ds, val_ds, counts, total_images, val_size = build_datasets(args)
    model, base = build_model(args.image_size)

    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(args.model_path),
            monitor="val_accuracy",
            mode="max",
            save_best_only=True,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            mode="max",
            patience=5,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.35,
            patience=3,
            min_lr=1e-7,
        ),
    ]

    frozen_history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        callbacks=callbacks,
    )

    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.01),
        metrics=[
            "accuracy",
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )

    fine_tune_history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.fine_tune_epochs,
        callbacks=callbacks,
    )

    metrics = model.evaluate(val_ds, return_dict=True)
    model.save(args.model_path)

    labels_payload = {
        "classes": CLASS_NAMES,
        "image_size": [args.image_size, args.image_size],
        "preprocessing": "EfficientNetV2B0 include_preprocessing=True; upload resized to 224x224 RGB.",
        "model": "EfficientNetV2B0 transfer learning",
    }
    args.labels_path.write_text(json.dumps(labels_payload, indent=2), encoding="utf-8")

    report = {
        "model_path": str(args.model_path),
        "labels_path": str(args.labels_path),
        "classes": CLASS_NAMES,
        "dataset_dir": str(args.dataset_dir),
        "class_counts": counts,
        "total_images": total_images,
        "training_images": total_images - val_size,
        "validation_images": val_size,
        "validation_metrics": {key: float(value) for key, value in metrics.items()},
        "history": {
            "frozen": {key: [float(item) for item in value] for key, value in frozen_history.history.items()},
            "fine_tune": {key: [float(item) for item in value] for key, value in fine_tune_history.history.items()},
        },
    }
    args.metrics_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
