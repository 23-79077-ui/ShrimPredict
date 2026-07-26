import csv
from pathlib import Path
from collections import Counter

csv_path = Path("data/shrimp_classifier_repo/Shrimp_Classifier/outputs_training_final/data_splits/hold_out_test_set_asli_20250608_143812.csv")
uploads_dir = Path("data/shrimp_classifier_repo/Shrimp_Classifier/uploads")

# Map of basename -> full upload path
upload_files = {f.name.lower(): f for f in uploads_dir.glob("*")}
print(f"Found {len(upload_files)} files in uploads_dir")

matched = []
with open(csv_path, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        original_name = Path(row["image_path"]).name.lower()
        if original_name in upload_files:
            matched.append((upload_files[original_name], row["label"]))

print(f"Direct filename match: {len(matched)}")
print("Direct Match Counts:", Counter([m[1] for m in matched]))
