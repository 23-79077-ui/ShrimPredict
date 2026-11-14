from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

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

DISEASE_DETAILS = {
    "Healthy": {
        "prediction": "Healthy Shrimp",
        "status": "Healthy",
        "risk_level": "Low",
        "description": "No disease symptoms detected. Shrimp appears healthy.",
        "recommendation": "Continue routine pond monitoring, balanced feeding, and water quality checks.",
    },
    "Black_Gill": {
        "prediction": "Black Gill Disease",
        "status": "Diseased",
        "risk_level": "High",
        "description": "Black Gill Disease detected with high confidence. Gills show dark discoloration and damage.",
        "recommendation": "Isolate affected shrimp, inspect water quality (ammonia/nitrite levels), improve aeration, and adjust feeding.",
    },
    "White_Spot_Syndrome_Virus": {
        "prediction": "White Spot Syndrome Virus (WSSV)",
        "status": "Diseased",
        "risk_level": "High",
        "description": "White Spot Syndrome Virus (WSSV) detected with high confidence. Distinct white spot lesions observed.",
        "recommendation": "Isolate infected shrimp immediately. Improve water quality, reduce stocking stress, and monitor remaining ponds closely.",
    },
    "Shell_Disease": {
        "prediction": "Shell Disease",
        "status": "Diseased",
        "risk_level": "Medium",
        "description": "Shell Disease detected. Chitinoclastic shell lesions observed.",
        "recommendation": "Improve water quality, maintain proper mineral balance, and prevent physical handling injuries.",
    },
    "Vibriosis": {
        "prediction": "Vibriosis",
        "status": "Diseased",
        "risk_level": "High",
        "description": "Vibriosis bacterial infection detected.",
        "recommendation": "Monitor bacterial loads, apply strict biosecurity protocols, and adjust feeding regimes.",
    },
}

_py_tf_model = None
_py_tf_labels = None


def _node_package_exists(package_name: str) -> bool:
    parts = package_name.split("/")
    return any((node_modules / Path(*parts)).exists() for node_modules in NODE_MODULE_DIRS)


def _node_model_ready() -> bool:
    return (
        MODEL_DIR.exists()
        and (MODEL_DIR / "model.json").exists()
        and (MODEL_DIR / "weights.bin").exists()
        and PREDICTOR_SCRIPT.exists()
        and _node_package_exists("@tensorflow/tfjs")
        and _node_package_exists("sharp")
    )


def _load_python_tf_model():
    """Load the Teachable Machine TFJS LayersModel directly in Python TensorFlow."""
    global _py_tf_model, _py_tf_labels
    if _py_tf_model is not None:
        return _py_tf_model, _py_tf_labels

    import tensorflow as tf

    model_json_path = MODEL_DIR / "model.json"
    weights_path = MODEL_DIR / "weights.bin"
    metadata_path = MODEL_DIR / "metadata.json"

    mj = json.loads(model_json_path.read_text(encoding="utf-8"))
    labels = ["Healthy", "Black_Gill", "White_Spot_Syndrome_Virus"]
    if metadata_path.exists():
        meta = json.loads(metadata_path.read_text(encoding="utf-8"))
        if isinstance(meta.get("labels"), list) and meta["labels"]:
            labels = meta["labels"]

    model = tf.keras.models.model_from_json(json.dumps(mj["modelTopology"]))
    buf = weights_path.read_bytes()
    offset = 0
    w_by_name = {}
    for entry in mj.get("weightsManifest", []):
        for w in entry.get("weights", []):
            shape = w["shape"]
            count = int(np.prod(shape))
            arr = np.frombuffer(buf, dtype=np.float32, count=count, offset=offset).reshape(shape).copy()
            offset += count * 4
            w_by_name[w["name"]] = arr

    def _assign_recursive(layer):
        sublayers = getattr(layer, "layers", None)
        if sublayers:
            for sub in sublayers:
                _assign_recursive(sub)
        for weight in getattr(layer, "weights", []):
            key = weight.name.split(":")[0]
            if key in w_by_name:
                weight.assign(w_by_name[key])

    _assign_recursive(model)
    _py_tf_model = model
    _py_tf_labels = labels
    return _py_tf_model, _py_tf_labels


def is_desktop_model_ready() -> bool:
    artifacts_exist = MODEL_DIR.exists() and (MODEL_DIR / "model.json").exists() and (MODEL_DIR / "weights.bin").exists()
    if not artifacts_exist:
        return False
    try:
        import tensorflow  # noqa: F401
        return True
    except Exception:
        return _node_model_ready()


def _predict_with_python_tf(image_path: Path) -> dict:
    model, labels = _load_python_tf_model()
    with Image.open(image_path) as img:
        img = ImageOps.exif_transpose(img).convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)
        arr = (np.asarray(img, dtype=np.float32) / 127.5) - 1.0

    probs = model.predict(arr[None, ...], verbose=0)[0].tolist()
    best_idx = int(np.argmax(probs))
    raw_label = labels[best_idx] if best_idx < len(labels) else "Healthy"
    confidence = round(float(probs[best_idx]) * 100.0, 2)

    details = DISEASE_DETAILS.get(
        raw_label,
        {
            "prediction": raw_label.replace("_", " "),
            "status": "Healthy" if "healthy" in raw_label.lower() else "Diseased",
            "risk_level": "Low" if "healthy" in raw_label.lower() else "High",
            "description": f"{raw_label.replace('_', ' ')} detected with high confidence.",
            "recommendation": "Monitor shrimp pond closely and consult an aquaculture specialist.",
        },
    )

    probabilities_map = {}
    for idx, lbl in enumerate(labels):
        fmt_name = DISEASE_DETAILS.get(lbl, {}).get("prediction", lbl.replace("_", " "))
        probabilities_map[fmt_name] = round(float(probs[idx]) * 100.0, 2)

    return {
        "success": True,
        "prediction": details["prediction"],
        "disease_name": details["prediction"],
        "confidence": confidence,
        "confidence_score": confidence,
        "status": details["status"],
        "risk_level": details["risk_level"],
        "model_used": "Desktop/Shrimp Trained Model",
        "description": details["description"],
        "recommendation": details["recommendation"],
        "probabilities": probabilities_map,
        "raw_label": raw_label,
        "debug": {
            "loaded_model_name": "tm-my-image-model-python-tf",
            "model_path": str(MODEL_DIR / "model.json"),
            "preprocessing": "MobileNet [-1.0, 1.0] range: (pixel / 127.5) - 1.0",
            "predicted_class": details["prediction"],
            "confidence_percentage": confidence,
            "raw_probabilities_array": probs,
            "class_labels": labels,
            "probabilities_map": probabilities_map,
        },
    }


def predict_desktop_shrimp(image_path: Path) -> dict:
    if not is_desktop_model_ready():
        raise FileNotFoundError(f"Desktop/Shrimp model or runtime not found at {MODEL_DIR}")

    try:
        return _predict_with_python_tf(image_path)
    except Exception:
        if not _node_model_ready():
            raise

    cmd = ["node", str(PREDICTOR_SCRIPT), str(image_path)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=20, check=False)

    if result.returncode != 0:
        err_msg = result.stderr.strip() or result.stdout.strip() or "Failed to run Desktop/Shrimp model predictor."
        raise RuntimeError(f"Desktop/Shrimp prediction error: {err_msg}")

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
