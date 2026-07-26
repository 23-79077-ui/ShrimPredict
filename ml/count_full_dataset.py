from pathlib import Path

dataset_dir = Path("data/shrimp_infection_repo/dataset")

healthy_files = list(dataset_dir.rglob("*healthy*/**/*.jpg")) + list(dataset_dir.rglob("*healthy*/**/*.png"))
wssv_files = list(dataset_dir.rglob("*wssv*/**/*.jpg")) + list(dataset_dir.rglob("*wssv*/**/*.png"))

print("=== FULL REAL DATASET DISCOVERY ===")
print(f"Total Healthy Shrimp Dataset Images: {len(healthy_files)}")
print(f"Total WSSV Infected Shrimp Dataset Images: {len(wssv_files)}")
print(f"Total Combined Real Dataset Images: {len(healthy_files) + len(wssv_files)}")
