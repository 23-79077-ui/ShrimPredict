import os
import csv
from pathlib import Path
from collections import Counter

repo_dir = Path("data/shrimp_classifier_repo")

# Find all image files
image_files = list(repo_dir.rglob("*.jpg")) + list(repo_dir.rglob("*.png")) + list(repo_dir.rglob("*.jpeg"))
print(f"Total image files found in dataset repo: {len(image_files)}")

# Read all CSV files in outputs_training_final
csv_dir = repo_dir / "Shrimp_Classifier" / "outputs_training_final" / "data_splits"
manifest_map = {}
for csv_file in csv_dir.glob("*.csv"):
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            filename = Path(row["image_path"]).name
            manifest_map[filename] = row["label"]

print(f"Total CSV entries mapped: {len(manifest_map)}")
print("CSV Label distribution:", Counter(manifest_map.values()))

# Match images
matched_records = []
for img in image_files:
    filename = img.name
    # Exclude output charts and UI assets
    if "Chart" in filename or "Confusion" in filename or "Plot" in filename or "Fold" in filename or "asset" in str(img):
        continue
    
    label = manifest_map.get(filename)
    if not label:
        # Determine from path or name
        lower = str(img).lower()
        if "wssv" in lower:
            label = "WSSV"
        elif "healthy" in lower:
            label = "Healthy"
        elif "bg" in lower:
            label = "BG"
    
    if label:
        matched_records.append((img, label))

print(f"Matched {len(matched_records)} dataset image records:")
print("Matched Label Counts:", Counter([r[1] for r in matched_records]))
