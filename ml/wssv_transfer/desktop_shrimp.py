from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
PREDICTOR_SCRIPT = SCRIPT_DIR / "desktop_shrimp_predictor.js"
MODEL_DIR = SCRIPT_DIR.parent / "artifacts" / "desktop_shrimp"
NODE_MODULE_DIRS = [
    Path("C:/Users/HP/Desktop/Shrimp/Shrimp/server/node_modules"),
    SCRIPT_DIR / "node_modules",
    REPO_ROOT / "node_modules",
    REPO_ROOT / "frontend" / "node_modules",
]


def _node_package_exists(package_name: str) -> bool:
    parts = package_name.split("/")
    return any((node_modules / Path(*parts)).exists() for node_modules in NODE_MODULE_DIRS)


def is_desktop_model_ready() -> bool:
    return (
        MODEL_DIR.exists()
        and (MODEL_DIR / "model.json").exists()
        and (MODEL_DIR / "weights.bin").exists()
        and PREDICTOR_SCRIPT.exists()
        and _node_package_exists("@tensorflow/tfjs")
        and _node_package_exists("sharp")
    )


def predict_desktop_shrimp(image_path: Path) -> dict:
    if not is_desktop_model_ready():
        raise FileNotFoundError(f"Desktop/Shrimp model or predictor script not found at {MODEL_DIR}")

    cmd = ["node", str(PREDICTOR_SCRIPT), str(image_path)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=20, check=False)

    if result.returncode != 0:
        err_msg = result.stderr.strip() or result.stdout.strip() or "Failed to run Desktop/Shrimp model predictor."
        raise RuntimeError(f"Desktop/Shrimp prediction error: {err_msg}")

    # Parse stdout (filtering out any non-JSON log header lines)
    output_lines = [line.strip() for line in result.stdout.splitlines() if line.strip().startswith("{")]
    if not output_lines:
        raise ValueError(f"No JSON output from Desktop/Shrimp predictor: {result.stdout}")

    return json.loads(output_lines[-1])


if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_img = Path(sys.argv[1])
        print(json.dumps(predict_desktop_shrimp(test_img), indent=2))
    else:
        print(f"Desktop model ready: {is_desktop_model_ready()}")
