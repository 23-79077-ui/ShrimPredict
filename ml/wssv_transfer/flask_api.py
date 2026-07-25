from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS


MODEL_DIR = Path(os.getenv("SHRIMP_WSSV_MODEL_DIR", "ml/artifacts/wssv_transfer/efficientnetb0"))
IMAGE_SIZE = int(os.getenv("SHRIMP_WSSV_IMAGE_SIZE", "224"))
FOREST_MODEL_PATH = Path(os.getenv("SHRIMP_FOREST_MODEL_PATH", "frontend/public/models/shrimp-disease/wssv-forest-model.json"))

app = Flask(__name__)
CORS(app)


@app.get("/health")
def health():
    keras_ready = (MODEL_DIR / "best_model.keras").exists() and (MODEL_DIR / "labels.json").exists()
    forest_ready = FOREST_MODEL_PATH.exists()
    return jsonify({
        "success": True,
        "model_ready": keras_ready or forest_ready,
        "keras_ready": keras_ready,
        "forest_fallback_ready": forest_ready,
        "model_dir": str(MODEL_DIR),
        "forest_model_path": str(FOREST_MODEL_PATH),
    })


@app.post("/predict")
def predict_endpoint():
    if "image" not in request.files:
        return jsonify({"success": False, "message": "No image uploaded."}), 400
    keras_ready = (MODEL_DIR / "best_model.keras").exists() and (MODEL_DIR / "labels.json").exists()
    forest_ready = FOREST_MODEL_PATH.exists()
    if not keras_ready and not forest_ready:
        return jsonify({"success": False, "message": "No trained WSSV model artifact is available."}), 503

    uploaded = request.files["image"]
    suffix = Path(uploaded.filename or "scan.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        uploaded.save(temp_file)

    try:
        if keras_ready:
            from inference import predict

            result = predict(MODEL_DIR, temp_path, IMAGE_SIZE)
            result["model_type"] = "tensorflow_transfer_learning"
        else:
            from forest_fallback import predict_with_forest

            result = predict_with_forest(temp_path, FOREST_MODEL_PATH)
        return jsonify({"success": True, **result, "model_dir": str(MODEL_DIR)})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass


if __name__ == "__main__":
    app.run(host=os.getenv("SHRIMP_AI_HOST", "127.0.0.1"), port=int(os.getenv("SHRIMP_AI_PORT", "5001")))
