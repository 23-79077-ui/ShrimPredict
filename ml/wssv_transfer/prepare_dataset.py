from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps
from sklearn.model_selection import train_test_split


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
LABELS = ["Healthy", "White Spot Syndrome Virus (WSSV)"]


@dataclass(frozen=True)
class ImageRecord:
    path: Path
    label: str
    sha256: str


def normalize_label(path: Path) -> str | None:
    parts = [part.lower().replace("_", " ").replace("-", " ") for part in path.parts]
    joined = " ".join(parts)
    if "wssv" in joined or "white spot" in joined:
        return "White Spot Syndrome Virus (WSSV)"
    if "healthy" in joined:
        return "Healthy"
    return None


def image_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_image(path: Path, image_size: int) -> bool:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.resize((image_size, image_size), Image.Resampling.BILINEAR)
        return True
    except Exception:
        return False


def discover_images(data_dir: Path, image_size: int) -> tuple[list[ImageRecord], dict]:
    seen_hashes: set[str] = set()
    records: list[ImageRecord] = []
    rejected = Counter()

    for path in sorted(data_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        label = normalize_label(path)
        if label is None:
            rejected["unsupported_label"] += 1
            continue

        if not validate_image(path, image_size):
            rejected["corrupted"] += 1
            continue

        sha = image_sha256(path)
        if sha in seen_hashes:
            rejected["duplicate"] += 1
            continue

        seen_hashes.add(sha)
        records.append(ImageRecord(path.resolve(), label, sha))

    stats = {
        "accepted": len(records),
        "rejected": dict(rejected),
        "class_distribution": dict(Counter(record.label for record in records)),
    }
    return records, stats


def cap_imbalance(records: list[ImageRecord], max_ratio: float, seed: int) -> list[ImageRecord]:
    grouped: dict[str, list[ImageRecord]] = defaultdict(list)
    for record in records:
        grouped[record.label].append(record)

    if set(grouped) != set(LABELS):
        missing = sorted(set(LABELS) - set(grouped))
        raise ValueError(f"Missing required classes: {missing}")

    rng = random.Random(seed)
    minority_count = min(len(grouped[label]) for label in LABELS)
    max_count = max(minority_count, int(minority_count * max_ratio))

    balanced: list[ImageRecord] = []
    for label in LABELS:
        class_records = list(grouped[label])
        rng.shuffle(class_records)
        balanced.extend(class_records[:max_count])
    rng.shuffle(balanced)
    return balanced


def write_manifest(path: Path, records: list[ImageRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["path", "label", "sha256"])
        writer.writeheader()
        for record in records:
            writer.writerow({"path": str(record.path), "label": record.label, "sha256": record.sha256})


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare public shrimp datasets for binary WSSV training.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--output-dir", default="ml/artifacts/wssv_dataset", type=Path)
    parser.add_argument("--image-size", default=224, type=int)
    parser.add_argument("--seed", default=42, type=int)
    parser.add_argument("--max-class-ratio", default=1.15, type=float)
    args = parser.parse_args()

    records, raw_stats = discover_images(args.data_dir, args.image_size)
    balanced_records = cap_imbalance(records, args.max_class_ratio, args.seed)

    train_val, test = train_test_split(
        balanced_records,
        test_size=0.10,
        stratify=[record.label for record in balanced_records],
        random_state=args.seed,
    )
    train, val = train_test_split(
        train_val,
        test_size=1 / 9,
        stratify=[record.label for record in train_val],
        random_state=args.seed,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_manifest(args.output_dir / "train.csv", train)
    write_manifest(args.output_dir / "val.csv", val)
    write_manifest(args.output_dir / "test.csv", test)

    split_stats = {
        "labels": LABELS,
        "raw": raw_stats,
        "balanced_distribution": dict(Counter(record.label for record in balanced_records)),
        "splits": {
            "train": dict(Counter(record.label for record in train)),
            "val": dict(Counter(record.label for record in val)),
            "test": dict(Counter(record.label for record in test)),
        },
    }
    (args.output_dir / "dataset_stats.json").write_text(json.dumps(split_stats, indent=2), encoding="utf-8")
    print(json.dumps(split_stats, indent=2))


if __name__ == "__main__":
    main()
