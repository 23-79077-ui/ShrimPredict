import argparse
import json
from pathlib import Path

import tensorflow as tf


RAW_CLASS_MAP = {
    "Healthy": "non_wssv",
    "BG": "non_wssv",
    "WSSV": "wssv",
    "BG_WSSV": "wssv",
    "WSSV_BG": "wssv",
}

LABELS = ["non_wssv", "wssv"]


def find_raw_images_dir(dataset_dir: Path) -> Path:
    candidates = [
        dataset_dir,
        dataset_dir / "Raw Images",
        dataset_dir / "ShrimpDiseaseImageBD An Image Dataset for Computer Vision-Based Detection of Shrimp Diseases in Bangladesh" / "Raw Images",
    ]

    required_classes = {"Healthy", "BG", "WSSV"}

    for candidate in candidates:
        if candidate.exists() and required_classes.issubset(set(resolve_class_dirs(candidate))):
            return candidate

    matches = [
        path
        for path in dataset_dir.rglob("*")
        if path.is_dir() and path.name == "Raw Images" and required_classes.issubset(set(resolve_class_dirs(path)))
    ]
    if matches:
        return matches[0]

    expected = ", ".join(RAW_CLASS_MAP.keys())
    raise FileNotFoundError(f"Could not find Raw Images directory with class folders: {expected}")


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


def build_file_dataset(raw_dir: Path, image_size: tuple[int, int], batch_size: int, validation_split: float, seed: int):
    file_paths = []
    labels = []
    class_dirs = resolve_class_dirs(raw_dir)

    for source_class, target_class in RAW_CLASS_MAP.items():
        source_dir = class_dirs.get(source_class)
        if not source_dir:
            continue
        for image_path in source_dir.rglob("*"):
            if image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
                file_paths.append(str(image_path))
                labels.append(LABELS.index(target_class))

    if not file_paths:
        raise ValueError(f"No images found in {raw_dir}")

    path_ds = tf.data.Dataset.from_tensor_slices((file_paths, labels))
    path_ds = path_ds.shuffle(len(file_paths), seed=seed, reshuffle_each_iteration=False)

    val_count = max(1, int(len(file_paths) * validation_split))
    train_ds = path_ds.skip(val_count)
    val_ds = path_ds.take(val_count)

    def load_image(path, label):
        image = tf.io.read_file(path)
        image = tf.io.decode_image(image, channels=3, expand_animations=False)
        image = tf.image.resize(image, image_size)
        image = tf.cast(image, tf.float32)
        return image, label

    autotune = tf.data.AUTOTUNE
    train_ds = train_ds.map(load_image, num_parallel_calls=autotune).batch(batch_size).prefetch(autotune)
    val_ds = val_ds.map(load_image, num_parallel_calls=autotune).batch(batch_size).prefetch(autotune)
    return train_ds, val_ds, len(file_paths)


def build_model(image_size: tuple[int, int], learning_rate: float):
    data_augmentation = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08),
            tf.keras.layers.RandomZoom(0.12),
            tf.keras.layers.RandomContrast(0.12),
        ],
        name="wssv_augmentation",
    )

    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(*image_size, 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False

    inputs = tf.keras.Input(shape=(*image_size, 3))
    x = data_augmentation(inputs)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.25)(x)
    outputs = tf.keras.layers.Dense(1, activation="sigmoid", name="wssv_probability")(x)

    model = tf.keras.Model(inputs, outputs, name="shrimp_wssv_classifier")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss="binary_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
            tf.keras.metrics.AUC(name="auc"),
        ],
    )
    return model


def main():
    parser = argparse.ArgumentParser(description="Train a WSSV-focused shrimp disease image classifier.")
    parser.add_argument("--dataset-dir", required=True, help="Path to the extracted Kaggle dataset or its Raw Images folder.")
    parser.add_argument("--output-dir", default="ml/artifacts/wssv_classifier", help="Where to save the trained model and metadata.")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--validation-split", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--learning-rate", type=float, default=0.0008)
    args = parser.parse_args()

    tf.keras.utils.set_random_seed(args.seed)
    raw_dir = find_raw_images_dir(Path(args.dataset_dir))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    image_size = (args.image_size, args.image_size)
    train_ds, val_ds, image_count = build_file_dataset(
        raw_dir=raw_dir,
        image_size=image_size,
        batch_size=args.batch_size,
        validation_split=args.validation_split,
        seed=args.seed,
    )

    model = build_model(image_size, args.learning_rate)
    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_auc", mode="max", patience=4, restore_best_weights=True),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(output_dir / "best_wssv_classifier.keras"),
            monitor="val_auc",
            mode="max",
            save_best_only=True,
        ),
    ]

    history = model.fit(train_ds, validation_data=val_ds, epochs=args.epochs, callbacks=callbacks)
    metrics = model.evaluate(val_ds, return_dict=True)

    model.save(output_dir / "wssv_classifier.keras")
    metadata = {
        "task": "binary_wssv_detection",
        "positive_label": "wssv",
        "negative_label": "non_wssv",
        "source_classes": RAW_CLASS_MAP,
        "labels": LABELS,
        "image_size": list(image_size),
        "image_count": image_count,
        "validation_metrics": {key: float(value) for key, value in metrics.items()},
        "history": {key: [float(v) for v in values] for key, values in history.history.items()},
        "recommendation": "Treat WSSV probability >= 0.60 as High risk and notify admin immediately.",
    }

    (output_dir / "labels.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"saved_to": str(output_dir), "metrics": metadata["validation_metrics"]}, indent=2))


if __name__ == "__main__":
    main()
