import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.wssv_transfer.quality_validator import detect_cooked_orange_shrimp


def test_detects_bright_cooked_orange_shrimp():
    image = np.full((220, 220, 3), (0, 128, 255), dtype=np.uint8)
    assert detect_cooked_orange_shrimp(image, threshold=0.05) is True


def test_ignores_non_orange_image():
    image = np.full((220, 220, 3), (90, 150, 90), dtype=np.uint8)
    assert detect_cooked_orange_shrimp(image, threshold=0.05) is False
