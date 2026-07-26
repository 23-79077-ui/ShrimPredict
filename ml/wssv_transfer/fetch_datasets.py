import os
import sys
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
WSSV_DATA_DIR = DATA_DIR / "shrimp-disease" / "Raw Images"

def ensure_dirs():
    (WSSV_DATA_DIR / "Healthy").mkdir(parents=True, exist_ok=True)
    (WSSV_DATA_DIR / "WSSV").mkdir(parents=True, exist_ok=True)
    (WSSV_DATA_DIR / "BG").mkdir(parents=True, exist_ok=True)
    (WSSV_DATA_DIR / "BG_WSSV").mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "tigershrimpbd" / "Healthy").mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "tigershrimpbd" / "WSSV").mkdir(parents=True, exist_ok=True)

if __name__ == "__main__":
    ensure_dirs()
    print("Dataset directories created at:", DATA_DIR)
