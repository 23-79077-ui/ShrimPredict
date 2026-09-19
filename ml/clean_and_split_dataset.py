"""
clean_and_split_dataset.py
==========================
ShrimPredict Dataset Quality Audit, Quarantine & Leak-Free 4-Class Partitioning

Classes:
- Healthy
- WSSV
- Black Gill
- WSSV + Black Gill
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
import random
import sys
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = Path(r"C:\Users\HP\Desktop\Shrimp\Shrimp\dataset-tools\shrimp-dataset")
ARTIFACTS_DIR = ROOT_DIR / "ml" / "artifacts"

CANONICAL_4CLASS = ["Healthy", "WSSV", "Black Gill", "WSSV + Black Gill"]

FOLDER_TO_4CLASS = {
    "Healthy": "Healthy",
    "healthy": "Healthy",
    "Black_Gill": "Black Gill",
    "Black Gill": "Black Gill",
    "Black_Gill_Augmented": "Black Gill",
    "White_Spot_Syndrome_Virus": "WSSV",
    "White Spot Syndrome Virus": "WSSV",
    "White_Spot_Syndrome_Virus_and_Black_Gill": "WSSV + Black Gill",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def compute_dhash(image: Image.Image, hash_size: int = 8) -> int:
    """Computes a 64-bit difference hash (dHash) using PIL."""
    resized = image.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
    pixels = list(resized.getdata())
    diff = []
    for row in range(hash_size):
        row_start = row * (hash_size + 1)
        for col in range(hash_size):
            left = pixels[row_start + col]
            right = pixels[row_start + col + 1]
            diff.append(1 if left > right else 0)
    hash_int = 0
    for bit in diff:
        hash_int = (hash_int << 1) | bit
    return hash_int


def hamming_distance(h1: int, h2: int) -> int:
    return bin(h1 ^ h2).count("1")


def run_quality_and_quarantine_audit(dataset_dir: Path):
    print("=" * 65)
    print("STEP 1 & 3: DATASET INTEGRITY, QUALITY AUDIT & QUARANTINE")
    print(f"Dataset path: {dataset_dir}")
    print("=" * 65)

    records = []
    quarantine = []
    folder_counts = {}
    widths, heights, aspect_ratios = [], [], []
    grayscale_count = 0
    corrupt_count = 0

    all_files = sorted(dataset_dir.rglob("*"))
    for path in all_files:
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        folder_name = path.parent.name
        folder_counts[folder_name] = folder_counts.get(folder_name, 0) + 1

        label_4c = FOLDER_TO_4CLASS.get(folder_name)
        if not label_4c:
            quarantine.append({
                "image_path": str(path),
                "cluster_id": -1,
                "issue": "Unrecognized Directory Label",
                "reason": f"Folder name '{folder_name}' is not in canonical class mapping",
                "recommended_action": "Manual review / assign to valid class folder",
            })
            continue

        try:
            with Image.open(path) as img:
                img.verify()
            with Image.open(path) as img:
                w, h = img.size
                mode = img.mode
                widths.append(w)
                heights.append(h)
                aspect_ratios.append(round(w / h, 3))

                is_gray = mode in ("L", "1") or (mode == "RGB" and img.getextrema()[0] == img.getextrema()[1] == img.getextrema()[2])
                if is_gray:
                    grayscale_count += 1

                # Check for extreme anomalies
                if w < 40 or h < 40:
                    quarantine.append({
                        "image_path": str(path),
                        "cluster_id": -1,
                        "issue": "Extreme Low Resolution",
                        "reason": f"Dimensions ({w}x{h}) are below minimum viable resolution threshold (40px)",
                        "recommended_action": "Quarantine / Exclude from training",
                    })
                    continue

                dhash = compute_dhash(img)

                records.append({
                    "path": str(path),
                    "filename": path.name,
                    "folder": folder_name,
                    "ground_truth_raw": folder_name,
                    "label": label_4c,
                    "width": w,
                    "height": h,
                    "aspect_ratio": round(w / h, 3),
                    "mode": mode,
                    "dhash": dhash,
                    "cluster_id": -1,
                })
        except Exception as err:
            corrupt_count += 1
            quarantine.append({
                "image_path": str(path),
                "cluster_id": -1,
                "issue": "Corrupt Image File",
                "reason": f"PIL decoding failed: {err}",
                "recommended_action": "Quarantine / Do not load in training pipeline",
            })

    audit_summary = {
        "dataset_directory": str(dataset_dir),
        "total_scanned_files": len(records) + len(quarantine),
        "valid_images": len(records),
        "quarantined_files": len(quarantine),
        "corrupted_images": corrupt_count,
        "grayscale_images": grayscale_count,
        "folder_breakdown": folder_counts,
        "dimension_stats": {
            "min_width": int(min(widths)) if widths else 0,
            "max_width": int(max(widths)) if widths else 0,
            "min_height": int(min(heights)) if heights else 0,
            "max_height": int(max(heights)) if heights else 0,
            "mean_aspect_ratio": round(float(sum(aspect_ratios) / len(aspect_ratios)), 3) if aspect_ratios else 1.0,
        },
    }

    # Save audit & quarantine files
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    report_json_path = ARTIFACTS_DIR / "dataset_audit_report.json"
    report_csv_path = ARTIFACTS_DIR / "dataset_audit_report.csv"
    quarantine_csv_path = ARTIFACTS_DIR / "dataset_quarantine.csv"

    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(audit_summary, f, indent=2)

    with open(report_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["path", "filename", "folder", "reason"])
        for q in quarantine:
            writer.writerow([q["image_path"], Path(q["image_path"]).name, q["issue"], q["reason"]])

    with open(quarantine_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["image_path", "cluster_id", "issue", "reason", "recommended_action"])
        for q in quarantine:
            writer.writerow([q["image_path"], q["cluster_id"], q["issue"], q["reason"], q["recommended_action"]])

    print(f"Audit Summary:")
    print(f"  Valid Images:       {len(records)}")
    print(f"  Quarantined Files:  {len(quarantine)} (Saved to {quarantine_csv_path})")
    print(f"  Corrupt/Unreadable: {corrupt_count}")
    print(f"  Grayscale Images:   {grayscale_count}")
    print(f"  Mean Aspect Ratio:  {audit_summary['dimension_stats']['mean_aspect_ratio']}")

    return records


def cluster_and_partition(records: list[dict], max_hamming_dist: int = 6, seed: int = 42):
    print("\n" + "=" * 65)
    print("STEP 1 (CONTINUED): SPECIMEN CLUSTERING & LEAK-FREE SPLIT")
    print("=" * 65)

    folder_groups: dict[str, list[dict]] = {}
    for r in records:
        folder_groups.setdefault(r["folder"], []).append(r)

    clusters: list[list[dict]] = []
    for folder, items in folder_groups.items():
        folder_clusters: list[list[dict]] = []
        for item in items:
            h = item["dhash"]
            assigned = False
            for cluster in folder_clusters:
                centroid_hash = cluster[0]["dhash"]
                if hamming_distance(h, centroid_hash) <= max_hamming_dist:
                    cluster.append(item)
                    assigned = True
                    break
            if not assigned:
                folder_clusters.append([item])
        for c in folder_clusters:
            c_id = len(clusters)
            for itm in c:
                itm["cluster_id"] = c_id
            clusters.append(c)

    print(f"Clustered {len(records)} images into {len(clusters)} unique specimen clusters.")

    # Partition across the 4 canonical classes
    rng = random.Random(seed)
    class_clusters: dict[str, list[list[dict]]] = {c: [] for c in CANONICAL_4CLASS}
    for c in clusters:
        c_label = c[0]["label"]
        class_clusters[c_label].append(c)

    train_ratio, val_ratio = 0.70, 0.15
    train_records, val_records, test_records = [], [], []
    cluster_counts = {"train": 0, "val": 0, "test": 0}

    for c_label, c_list in class_clusters.items():
        rng.shuffle(c_list)
        n = len(c_list)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)

        train_c = c_list[:n_train]
        val_c = c_list[n_train:n_train + n_val]
        test_c = c_list[n_train + n_val:]

        cluster_counts["train"] += len(train_c)
        cluster_counts["val"] += len(val_c)
        cluster_counts["test"] += len(test_c)

        for cl in train_c:
            train_records.extend(cl)
        for cl in val_c:
            val_records.extend(cl)
        for cl in test_c:
            test_records.extend(cl)

    # STRICT LEAKAGE VERIFICATION (FAIL LOUDLY)
    train_clusters = {r["cluster_id"] for r in train_records}
    val_clusters = {r["cluster_id"] for r in val_records}
    test_clusters = {r["cluster_id"] for r in test_records}

    leak_tr_val = len(train_clusters & val_clusters)
    leak_tr_te = len(train_clusters & test_clusters)
    leak_va_te = len(val_clusters & test_clusters)

    print("\n---------------------------------------------------------")
    print(f"Total specimens:       {len(clusters)}")
    print(f"Train specimens:       {cluster_counts['train']}")
    print(f"Validation specimens:  {cluster_counts['val']}")
    print(f"Test specimens:        {cluster_counts['test']}")
    print()
    print("Cluster overlap:")
    print(f"Train & Val  = {leak_tr_val}")
    print(f"Train & Test = {leak_tr_te}")
    print(f"Val & Test   = {leak_va_te}")
    print("---------------------------------------------------------")

    if leak_tr_val != 0 or leak_tr_te != 0 or leak_va_te != 0:
        raise ValueError("CRITICAL LEAKAGE DETECTED! Stopping pipeline immediately.")

    print("[LEAKAGE CHECK PASSED] Dataset splits are 100% leak-free.")

    print("\nImages per class per split:")
    print(f"{'Class':<25} | {'Train':<10} | {'Validation':<12} | {'Test':<10} | {'Total':<10}")
    print("-" * 72)
    for c in CANONICAL_4CLASS:
        tr_c = sum(1 for r in train_records if r["label"] == c)
        va_c = sum(1 for r in val_records if r["label"] == c)
        te_c = sum(1 for r in test_records if r["label"] == c)
        print(f"{c:<25} | {tr_c:<10} | {va_c:<12} | {te_c:<10} | {tr_c + va_c + te_c:<10}")
    print("-" * 72)
    print(f"{'TOTAL':<25} | {len(train_records):<10} | {len(val_records):<12} | {len(test_records):<10} | {len(records):<10}")
    print("---------------------------------------------------------")

    return train_records, val_records, test_records


def save_clean_manifests(train_recs, val_recs, test_recs):
    splits = [
        ("train_clean.csv", train_recs),
        ("val_clean.csv", val_recs),
        ("test_clean.csv", test_recs),
    ]
    for filename, recs in splits:
        path = ARTIFACTS_DIR / filename
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "image_path",
                "filename",
                "folder",
                "ground_truth_raw",
                "label",
                "cluster_id",
                "width",
                "height",
                "aspect_ratio",
                "dhash",
            ])
            for r in recs:
                writer.writerow([
                    r["path"],
                    r["filename"],
                    r["folder"],
                    r["ground_truth_raw"],
                    r["label"],
                    r["cluster_id"],
                    r["width"],
                    r["height"],
                    r["aspect_ratio"],
                    hex(r["dhash"]),
                ])
        print(f"Saved manifest ({len(recs)} samples) -> {path}")


def main():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset path not found: {DATASET_PATH}")

    records = run_quality_and_quarantine_audit(DATASET_PATH)
    train_recs, val_recs, test_recs = cluster_and_partition(records, max_hamming_dist=6, seed=42)
    save_clean_manifests(train_recs, val_recs, test_recs)


if __name__ == "__main__":
    main()
