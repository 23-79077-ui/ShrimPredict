from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from content_validator import validate_image_content
except ImportError:
    from .content_validator import validate_image_content


def detect_shrimp(image_path: Path) -> dict:
    """Backward-compatible shrimp detector wrapper used by Flask."""
    return validate_image_content(image_path)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(detect_shrimp(Path(sys.argv[1])), indent=2))
    else:
        print("Usage: python shrimp_detector.py <image_path>")
