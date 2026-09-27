from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageOps

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATASET_ROOT = ROOT_DIR / "data" / "farm_captured"
DEFAULT_WSSV_DIR = DEFAULT_DATASET_ROOT / "WSSV"


def ensure_dataset_layout(dataset_root: Path) -> Path:
    dataset_root.mkdir(parents=True, exist_ok=True)
    (dataset_root / "Healthy").mkdir(exist_ok=True)
    (dataset_root / "WSSV").mkdir(exist_ok=True)
    return dataset_root


def add_training_example(source_path: Path, dataset_root: Path, label: str = "WSSV") -> Path:
    if not source_path.exists():
        raise FileNotFoundError(f"Source image not found: {source_path}")

    target_dir = dataset_root / label
    target_dir.mkdir(parents=True, exist_ok=True)

    image = Image.open(source_path).convert("RGB")
    filename = f"{label.lower()}_sample_{int(time.time())}{source_path.suffix.lower() or '.jpg'}"
    target_path = target_dir / filename
    image.save(target_path)

    # Add a few lightweight augmentation variants so the model learns the new positive pattern faster.
    for angle in (5, -5, 10):
        augmented = image.copy().rotate(angle, expand=True, fillcolor=(255, 255, 255))
        augmented = ImageOps.autocontrast(augmented)
        variant_path = target_dir / f"{label.lower()}_sample_{int(time.time())}_{angle}{source_path.suffix.lower() or '.jpg'}"
        augmented.save(variant_path)

    return target_path


def run_retrain(dataset_root: Path, epochs: int, fine_tune_epochs: int) -> None:
    script = ROOT_DIR / "ml" / "train_upgraded_model.py"
    cmd = [
        sys.executable,
        str(script),
        "--dataset-dir",
        str(dataset_root),
        "--epochs",
        str(epochs),
        "--fine-tune-epochs",
        str(fine_tune_epochs),
    ]
    print("Running retraining:")
    print(" ".join(cmd))
    subprocess.run(cmd, cwd=str(ROOT_DIR), check=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Add a new shrimp WSSV sample to the training set and do a short retraining pass."
    )
    parser.add_argument("source_image", type=Path, help="Path to the WSSV-positive image file to add.")
    parser.add_argument("--dataset-root", type=Path, default=DEFAULT_DATASET_ROOT, help="Root directory containing Healthy/WSSV folders.")
    parser.add_argument("--epochs", type=int, default=5, help="Number of short training epochs to run.")
    parser.add_argument("--fine-tune-epochs", type=int, default=2, help="Number of fine-tuning epochs to run.")
    args = parser.parse_args()

    dataset_root = ensure_dataset_layout(args.dataset_root)
    target_path = add_training_example(args.source_image, dataset_root, label="WSSV")
    print(f"Added WSSV training sample: {target_path}")
    run_retrain(dataset_root, args.epochs, args.fine_tune_epochs)


if __name__ == "__main__":
    main()
