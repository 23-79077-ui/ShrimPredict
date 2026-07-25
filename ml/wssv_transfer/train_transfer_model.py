from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import tensorflow as tf
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.utils.class_weight import compute_class_weight


LABELS = ["Healthy", "White Spot Syndrome Virus (WSSV)"]
AUTOTUNE = tf.data.AUTOTUNE


def read_manifest(path: Path) -> tuple[list[str], list[int]]:
    image_paths: list[str] = []
    labels: list[int] = []
    label_to_index = {label: index for index, label in enumerate(LABELS)}
    with path.open("r", newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            image_paths.append(row["path"])
            labels.append(label_to_index[row["label"]])
    return image_paths, labels


def decode_image(path: tf.Tensor, label: tf.Tensor, image_size: int) -> tuple[tf.Tensor, tf.Tensor]:
    image = tf.io.read_file(path)
    image = tf.io.decode_image(image, channels=3, expand_animations=False)
    image = tf.image.resize(image, [image_size, image_size])
    image = tf.cast(image, tf.float32)
    label = tf.one_hot(label, len(LABELS))
    return image, label


def make_dataset(manifest: Path, image_size: int, batch_size: int, shuffle: bool) -> tuple[tf.data.Dataset, np.ndarray]:
    image_paths, labels = read_manifest(manifest)
    ds = tf.data.Dataset.from_tensor_slices((image_paths, labels))
    if shuffle:
        ds = ds.shuffle(buffer_size=len(image_paths), seed=42, reshuffle_each_iteration=True)
    ds = ds.map(lambda path, label: decode_image(path, label, image_size), num_parallel_calls=AUTOTUNE)
    ds = ds.batch(batch_size).prefetch(AUTOTUNE)
    return ds, np.array(labels)


def build_augmentation(image_size: int) -> tf.keras.Sequential:
    crop_size = int(image_size * 0.92)
    return tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal_and_vertical"),
            tf.keras.layers.RandomRotation(0.12),
            tf.keras.layers.RandomZoom(0.18),
            tf.keras.layers.RandomCrop(crop_size, crop_size),
            tf.keras.layers.Resizing(image_size, image_size),
            tf.keras.layers.RandomBrightness(0.18),
            tf.keras.layers.RandomContrast(0.18),
        ],
        name="augmentation",
    )


def base_model_factory(model_name: str, image_size: int) -> tuple[tf.keras.Model, callable]:
    input_shape = (image_size, image_size, 3)
    name = model_name.lower()
    if name == "efficientnetb0":
        base = tf.keras.applications.EfficientNetB0(include_top=False, weights="imagenet", input_shape=input_shape)
        return base, tf.keras.applications.efficientnet.preprocess_input
    if name == "mobilenetv2":
        base = tf.keras.applications.MobileNetV2(include_top=False, weights="imagenet", input_shape=input_shape)
        return base, tf.keras.applications.mobilenet_v2.preprocess_input
    if name == "resnet50":
        base = tf.keras.applications.ResNet50(include_top=False, weights="imagenet", input_shape=input_shape)
        return base, tf.keras.applications.resnet50.preprocess_input
    raise ValueError(f"Unsupported model: {model_name}")


def build_model(model_name: str, image_size: int, learning_rate: float) -> tuple[tf.keras.Model, tf.keras.Model]:
    inputs = tf.keras.Input(shape=(image_size, image_size, 3), name="image")
    augmentation = build_augmentation(image_size)
    base, preprocess = base_model_factory(model_name, image_size)
    base.trainable = False

    x = augmentation(inputs)
    x = tf.keras.layers.Lambda(preprocess, name="preprocess")(x)
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.35)(x)
    outputs = tf.keras.layers.Dense(len(LABELS), activation="softmax", name="disease")(x)
    model = tf.keras.Model(inputs, outputs, name=f"shrimp_wssv_{model_name.lower()}")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.03),
        metrics=["accuracy", tf.keras.metrics.Precision(name="precision"), tf.keras.metrics.Recall(name="recall")],
    )
    return model, base


def fine_tune_model(model: tf.keras.Model, base: tf.keras.Model, unfreeze_last: int, learning_rate: float) -> None:
    base.trainable = True
    for layer in base.layers[:-unfreeze_last]:
        layer.trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.02),
        metrics=["accuracy", tf.keras.metrics.Precision(name="precision"), tf.keras.metrics.Recall(name="recall")],
    )


def evaluate(model: tf.keras.Model, test_ds: tf.data.Dataset, y_true: np.ndarray, output_dir: Path) -> dict:
    probabilities = model.predict(test_ds, verbose=1)
    y_pred = probabilities.argmax(axis=1)
    wssv_scores = probabilities[:, 1]

    report_dict = classification_report(y_true, y_pred, target_names=LABELS, output_dict=True, zero_division=0)
    report_text = classification_report(y_true, y_pred, target_names=LABELS, zero_division=0)
    matrix = confusion_matrix(y_true, y_pred)

    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "wssv_precision": float(report_dict["White Spot Syndrome Virus (WSSV)"]["precision"]),
        "wssv_recall": float(report_dict["White Spot Syndrome Virus (WSSV)"]["recall"]),
        "wssv_f1": float(report_dict["White Spot Syndrome Virus (WSSV)"]["f1-score"]),
        "roc_auc": float(roc_auc_score(y_true, wssv_scores)),
        "classification_report": report_dict,
        "confusion_matrix": matrix.tolist(),
    }

    (output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (output_dir / "classification_report.txt").write_text(report_text, encoding="utf-8")

    plt.figure(figsize=(6, 5))
    sns.heatmap(matrix, annot=True, fmt="d", cmap="Blues", xticklabels=LABELS, yticklabels=LABELS)
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.tight_layout()
    plt.savefig(output_dir / "confusion_matrix.png", dpi=160)
    plt.close()

    fpr, tpr, _ = roc_curve(y_true, wssv_scores)
    plt.figure(figsize=(6, 5))
    plt.plot(fpr, tpr, label=f"AUC {metrics['roc_auc']:.3f}")
    plt.plot([0, 1], [0, 1], linestyle="--", color="gray")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(output_dir / "roc_curve.png", dpi=160)
    plt.close()

    return metrics


def train_once(args: argparse.Namespace, model_name: str, learning_rate: float, output_dir: Path) -> dict:
    train_ds, y_train = make_dataset(args.manifest_dir / "train.csv", args.image_size, args.batch_size, shuffle=True)
    val_ds, _ = make_dataset(args.manifest_dir / "val.csv", args.image_size, args.batch_size, shuffle=False)
    test_ds, y_test = make_dataset(args.manifest_dir / "test.csv", args.image_size, args.batch_size, shuffle=False)

    class_weights_values = compute_class_weight(class_weight="balanced", classes=np.arange(len(LABELS)), y=y_train)
    class_weights = {index: float(value) for index, value in enumerate(class_weights_values)}

    model, base = build_model(model_name, args.image_size, learning_rate)
    checkpoint_path = output_dir / "best_model.keras"
    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=args.patience, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.35, patience=3, min_lr=1e-7),
        tf.keras.callbacks.ModelCheckpoint(checkpoint_path, monitor="val_loss", save_best_only=True),
    ]

    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        class_weight=class_weights,
        callbacks=callbacks,
    )

    fine_tune_model(model, base, args.unfreeze_last, args.fine_tune_lr)
    fine_history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.fine_tune_epochs,
        class_weight=class_weights,
        callbacks=callbacks,
    )

    model = tf.keras.models.load_model(checkpoint_path)
    metrics = evaluate(model, test_ds, y_test, output_dir)
    (output_dir / "labels.json").write_text(json.dumps(LABELS, indent=2), encoding="utf-8")
    (output_dir / "training_history.json").write_text(
        json.dumps({"frozen": history.history, "fine_tune": fine_history.history}, indent=2),
        encoding="utf-8",
    )
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Train transfer-learning WSSV classifier.")
    parser.add_argument("--manifest-dir", default=Path("ml/artifacts/wssv_dataset"), type=Path)
    parser.add_argument("--output-dir", default=Path("ml/artifacts/wssv_transfer"), type=Path)
    parser.add_argument("--image-size", default=224, type=int)
    parser.add_argument("--batch-size", default=16, type=int)
    parser.add_argument("--epochs", default=30, type=int)
    parser.add_argument("--fine-tune-epochs", default=20, type=int)
    parser.add_argument("--patience", default=7, type=int)
    parser.add_argument("--learning-rate", default=1e-3, type=float)
    parser.add_argument("--fine-tune-lr", default=1e-5, type=float)
    parser.add_argument("--unfreeze-last", default=35, type=int)
    parser.add_argument("--target-wssv-recall", default=0.95, type=float)
    parser.add_argument("--model-candidates", default="efficientnetb0,resnet50,mobilenetv2")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    best_metrics = None
    best_model_dir = None

    for candidate in [item.strip() for item in args.model_candidates.split(",") if item.strip()]:
        candidate_dir = args.output_dir / candidate
        candidate_dir.mkdir(parents=True, exist_ok=True)
        metrics = train_once(args, candidate, args.learning_rate, candidate_dir)
        if best_metrics is None or metrics["wssv_recall"] > best_metrics["wssv_recall"]:
            best_metrics = metrics
            best_model_dir = candidate_dir
        if metrics["wssv_recall"] >= args.target_wssv_recall and metrics["accuracy"] >= 0.95:
            break

    summary = {
        "best_model_dir": str(best_model_dir),
        "best_metrics": best_metrics,
        "target_met": bool(best_metrics and best_metrics["wssv_recall"] >= args.target_wssv_recall and best_metrics["accuracy"] >= 0.95),
    }
    (args.output_dir / "training_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
