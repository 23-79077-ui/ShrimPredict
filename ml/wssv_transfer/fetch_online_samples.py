import os
import sys
import json
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "dataset_samples"
HEALTHY_DIR = DATA_DIR / "Healthy"
WSSV_DIR = DATA_DIR / "WSSV"

HEALTHY_DIR.mkdir(parents=True, exist_ok=True)
WSSV_DIR.mkdir(parents=True, exist_ok=True)

# List of public open dataset raw images for Healthy and WSSV shrimp
SAMPLE_URLS = {
    "Healthy": [
        "https://raw.githubusercontent.com/Saon110/bd-fish-disease-dataset/main/healthy_shrimp_1.jpg",
        "https://raw.githubusercontent.com/Saon110/bd-fish-disease-dataset/main/healthy_shrimp_2.jpg",
        "https://raw.githubusercontent.com/Saon110/bd-fish-disease-dataset/main/healthy_shrimp_3.jpg",
    ],
    "WSSV": [
        "https://raw.githubusercontent.com/Saon110/bd-fish-disease-dataset/main/wssv_shrimp_1.jpg",
        "https://raw.githubusercontent.com/Saon110/bd-fish-disease-dataset/main/wssv_shrimp_2.jpg",
    ]
}

def fetch_all():
    print("Downloading sample dataset images...")
    count = 0
    for label, urls in SAMPLE_URLS.items():
        out_dir = HEALTHY_DIR if label == "Healthy" else WSSV_DIR
        for idx, url in enumerate(urls):
            dest = out_dir / f"{label.lower()}_sample_{idx+1}.jpg"
            try:
                urllib.request.urlretrieve(url, dest)
                print(f"Downloaded {dest.name}")
                count += 1
            except Exception as e:
                print(f"Could not download {url}: {e}")
    print(f"Finished downloading {count} dataset images.")

if __name__ == "__main__":
    fetch_all()
