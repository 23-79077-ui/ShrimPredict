from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


SOURCE_DIR = Path(r"C:\Users\HP\Desktop\Shrimp\Shrimp\dataset-tools\shrimp-dataset")
OUTPUT_DIR = Path(r"C:\Users\HP\Desktop\Shrimp\Shrimp\dataset-tools\augmented_12k_dataset")
TARGET_PER_CLASS = 4000
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

CLASS_SOURCES = {
    "Healthy": ["Healthy"],
    "WSSV": ["White_Spot_Syndrome_Virus"],
    "Black Gill": ["Black_Gill", "Black_Gill_Augmented"],
}

OUTPUT_FOLDER_NAMES = {
    "Healthy": "Healthy",
    "WSSV": "WSSV",
    "Black Gill": "Black Gill",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the 12k three-class ShrimPredict disease scan dataset."
    )
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--target-per-class", type=int, default=TARGET_PER_CLASS)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def list_images(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(
        path
        for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def valid_image(path: Path) -> bool:
    try:
        with Image.open(path) as image:
            ImageOps.exif_transpose(image).convert("RGB").verify()
        return True
    except Exception:
        return False


def collect_sources(source_dir: Path) -> dict[str, list[Path]]:
    sources: dict[str, list[Path]] = {}
    for target_label, source_folders in CLASS_SOURCES.items():
        class_images: list[Path] = []
        for folder in source_folders:
            class_images.extend(list_images(source_dir / folder))
        sources[target_label] = [path for path in class_images if valid_image(path)]
    return sources


def existing_output_count(output_dir: Path, label: str) -> int:
    folder = output_dir / OUTPUT_FOLDER_NAMES[label]
    return len(list_images(folder))


def fit_square(image: Image.Image, size: int) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = max(0, (width - side) // 2)
    top = max(0, (height - side) // 2)
    image = image.crop((left, top, left + side, top + side))
    return image.resize((size, size), Image.Resampling.LANCZOS)


def augment_image(source_path: Path, output_size: int, rng: random.Random) -> Image.Image:
    with Image.open(source_path) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")

    width, height = image.size
    min_side = min(width, height)

    crop_scale = rng.uniform(0.82, 1.0)
    crop_side = max(1, int(min_side * crop_scale))
    max_left = max(0, width - crop_side)
    max_top = max(0, height - crop_side)
    left = rng.randint(0, max_left) if max_left else 0
    top = rng.randint(0, max_top) if max_top else 0
    image = image.crop((left, top, left + crop_side, top + crop_side))

    if rng.random() < 0.5:
        image = ImageOps.mirror(image)
    if rng.random() < 0.20:
        image = ImageOps.flip(image)

    angle = rng.uniform(-18, 18)
    image = image.rotate(angle, resample=Image.Resampling.BICUBIC, expand=False)
    image = image.resize((output_size, output_size), Image.Resampling.LANCZOS)

    image = ImageEnhance.Brightness(image).enhance(rng.uniform(0.82, 1.18))
    image = ImageEnhance.Contrast(image).enhance(rng.uniform(0.82, 1.22))
    image = ImageEnhance.Color(image).enhance(rng.uniform(0.88, 1.16))
    image = ImageEnhance.Sharpness(image).enhance(rng.uniform(0.86, 1.28))

    if rng.random() < 0.12:
        image = image.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.15, 0.55)))

    return image


def write_class_dataset(
    label: str,
    sources: list[Path],
    output_dir: Path,
    target_count: int,
    image_size: int,
    seed: int,
) -> dict:
    if not sources:
        raise FileNotFoundError(f"No valid source images found for class: {label}")

    output_folder = output_dir / OUTPUT_FOLDER_NAMES[label]
    output_folder.mkdir(parents=True, exist_ok=True)

    existing_count = existing_output_count(output_dir, label)
    if existing_count > target_count:
        raise RuntimeError(
            f"{output_folder} already has {existing_count} images, more than target {target_count}."
        )

    rng = random.Random(seed + sum(ord(char) for char in label))
    generated = 0

    for index in range(existing_count, target_count):
        source_path = sources[index % len(sources)] if index < len(sources) else rng.choice(sources)

        if index < len(sources):
            with Image.open(source_path) as image:
                image = fit_square(ImageOps.exif_transpose(image).convert("RGB"), image_size)
        else:
            image = augment_image(source_path, image_size, rng)

        output_path = output_folder / f"{label.replace(' ', '_').lower()}_{index + 1:04d}.jpg"
        image.save(output_path, format="JPEG", quality=92, optimize=True)
        generated += 1

        if generated % 500 == 0:
            print(f"{label}: generated {generated} new images ({index + 1}/{target_count})")

    return {
        "label": label,
        "output_folder": str(output_folder),
        "source_images": len(sources),
        "existing_before": existing_count,
        "generated": generated,
        "final_count": existing_output_count(output_dir, label),
    }


def main() -> None:
    args = parse_args()
    if not args.source_dir.exists():
        raise FileNotFoundError(f"Source dataset directory not found: {args.source_dir}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    sources = collect_sources(args.source_dir)
    source_counts = {label: len(paths) for label, paths in sources.items()}

    summaries = [
        write_class_dataset(
            label=label,
            sources=paths,
            output_dir=args.output_dir,
            target_count=args.target_per_class,
            image_size=args.image_size,
            seed=args.seed,
        )
        for label, paths in sources.items()
    ]

    final_counts = {
        label: existing_output_count(args.output_dir, label)
        for label in CLASS_SOURCES
    }
    total = sum(final_counts.values())
    if any(count != args.target_per_class for count in final_counts.values()):
        raise RuntimeError(f"Unexpected final class counts: {final_counts}")

    report = {
        "source_dir": str(args.source_dir),
        "output_dir": str(args.output_dir),
        "classes": ["Healthy", "WSSV", "Black Gill"],
        "source_counts": source_counts,
        "final_counts": final_counts,
        "total_images": total,
        "image_size": [args.image_size, args.image_size],
        "excluded_source_folders": ["White_Spot_Syndrome_Virus_and_Black_Gill"],
        "summaries": summaries,
    }
    (args.output_dir / "dataset_summary.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
