from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

SCRIPT_DIR = Path(__file__).parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from desktop_shrimp import is_desktop_model_ready, predict_desktop_shrimp
from quality_validator import validate_image_quality
from shrimp_detector import detect_shrimp

MODEL_DIR = Path(os.getenv("SHRIMP_WSSV_MODEL_DIR", "ml/artifacts/wssv_transfer/efficientnetb0"))
IMAGE_SIZE = int(os.getenv("SHRIMP_WSSV_IMAGE_SIZE", "224"))
FOREST_MODEL_PATH = Path(os.getenv("SHRIMP_FOREST_MODEL_PATH", "frontend/public/models/shrimp-disease/wssv-forest-model.json"))

app = Flask(__name__)
CORS(app)


@app.get("/health")
def health():
    keras_ready = (MODEL_DIR / "best_model.keras").exists() and (MODEL_DIR / "labels.json").exists()
    forest_ready = FOREST_MODEL_PATH.exists()
    desktop_ready = is_desktop_model_ready()
    return jsonify({
        "success": True,
        "model_ready": keras_ready or forest_ready or desktop_ready,
        "shrimp_detector_ready": True,
        "quality_validator_ready": True,
        "keras_ready": keras_ready,
        "forest_fallback_ready": forest_ready,
        "desktop_shrimp_model_ready": desktop_ready,
        "model_dir": str(MODEL_DIR),
        "forest_model_path": str(FOREST_MODEL_PATH),
    })


@app.post("/predict")
def predict_endpoint():
    if "image" not in request.files:
        return jsonify({"success": False, "message": "No image uploaded."}), 400

    uploaded = request.files["image"]
    suffix = Path(uploaded.filename or "scan.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        uploaded.save(temp_file)

    try:
        # ==========================================
        # STAGE 1: Shrimp Detection Model (Shrimp vs. Not Shrimp)
        # ==========================================
        stage1_res = detect_shrimp(temp_path)
        if not stage1_res.get("shrimp_detected", False):
            print(f"[STAGE 1 FAILED] No Shrimp Detected: {stage1_res.get('message')}", file=sys.stderr)
            return jsonify({
                "success": True,
                "shrimp_detected": False,
                "image_quality": "N/A",
                "prediction": None,
                "disease_name": None,
                "status": "No Shrimp Detected",
                "confidence": 0,
                "confidence_score": 0,
                "risk_level": "None",
                "message": "No shrimp was detected in the uploaded image. Please upload a clear image containing a shrimp.",
                "stage1_details": stage1_res,
            })

        # ==========================================
        # STAGE 2: Image Quality Validation
        # ==========================================
        stage2_res = validate_image_quality(temp_path)
        if not stage2_res.get("is_quality_valid", True):
            print(f"[STAGE 2 FAILED] Poor Quality: {stage2_res.get('message')}", file=sys.stderr)
            return jsonify({
                "success": True,
                "shrimp_detected": True,
                "image_quality": "Poor Image Quality",
                "prediction": None,
                "disease_name": None,
                "status": "Poor Image Quality",
                "confidence": 0,
                "confidence_score": 0,
                "risk_level": "None",
                "message": stage2_res.get("message", "Please upload a clearer image of a shrimp."),
                "stage2_details": stage2_res,
            })

        # ==========================================
        # STAGE 3 & 4: Multi-Model Healthy vs. Diseased & Disease Classification
        # ==========================================
        keras_ready = (MODEL_DIR / "best_model.keras").exists() and (MODEL_DIR / "labels.json").exists()
        forest_ready = FOREST_MODEL_PATH.exists()
        desktop_ready = is_desktop_model_ready()

        if not keras_ready and not forest_ready and not desktop_ready:
            missing_models = []
            desktop_model_dir = str(Path(__file__).parent.parent / "artifacts" / "desktop_shrimp")
            missing_models.append({
                "model": "Desktop/Shrimp Teachable Machine Model",
                "expected_files": ["model.json", "weights.bin", "metadata.json"],
                "expected_location": desktop_model_dir,
                "status": "model.json: " + ("found" if (Path(desktop_model_dir) / "model.json").exists() else "MISSING")
                         + ", weights.bin: " + ("found" if (Path(desktop_model_dir) / "weights.bin").exists() else "MISSING"),
            })
            missing_models.append({
                "model": "Keras EfficientNet Transfer Learning Model",
                "expected_files": ["best_model.keras", "labels.json"],
                "expected_location": str(MODEL_DIR),
                "status": "MISSING — run training first (see README.md)",
            })
            missing_models.append({
                "model": "Random Forest Fallback Model",
                "expected_files": ["wssv-forest-model.json"],
                "expected_location": str(FOREST_MODEL_PATH),
                "status": "found" if FOREST_MODEL_PATH.exists() else "MISSING",
            })
            return jsonify({
                "success": False,
                "message": "No trained AI disease model is available. The model files may be missing after cloning.",
                "error": "MODEL_NOT_FOUND",
                "missing_models": missing_models,
                "how_to_fix": [
                    "1. Ensure you pulled the latest code: git pull origin main",
                    "2. The Desktop/Shrimp model should be in ml/artifacts/desktop_shrimp/ (model.json + weights.bin).",
                    "3. If files are missing, ask the repository owner to commit the trained model.",
                    "4. Alternatively, train a new model: see README.md section 'Train The Real WSSV Model'.",
                    "5. After obtaining model files, restart the Flask API.",
                ],
            }), 503

        model_results = []

        # 1. Desktop/Shrimp Trained Model
        if desktop_ready:
            try:
                desktop_res = predict_desktop_shrimp(temp_path)
                model_results.append(desktop_res)
            except Exception as e:
                print(f"Desktop model prediction error: {e}", file=sys.stderr)

        # 2. Existing AI Model (Keras Transfer Learning or Forest Fallback)
        if keras_ready:
            try:
                from inference import predict
                existing_res = predict(MODEL_DIR, temp_path, IMAGE_SIZE)
                existing_res["model_used"] = "Existing EfficientNet Model"
                existing_res["status"] = "Diseased" if "Healthy" not in existing_res["disease_name"] else "Healthy"
                existing_res["prediction"] = existing_res["disease_name"]
                existing_res["description"] = f"{existing_res['disease_name']} detected."
                model_results.append(existing_res)
            except Exception as e:
                print(f"Keras model prediction error: {e}", file=sys.stderr)
        elif forest_ready:
            try:
                from forest_fallback import predict_with_forest
                existing_res = predict_with_forest(temp_path, FOREST_MODEL_PATH)
                existing_res["model_used"] = "Existing Forest Model"
                existing_res["status"] = "Diseased" if "Healthy" not in existing_res["disease_name"] and "Needs Review" not in existing_res["disease_name"] else ("Healthy" if "Healthy" in existing_res["disease_name"] else "Uncertain")
                existing_res["prediction"] = existing_res["disease_name"]
                existing_res["description"] = f"{existing_res['disease_name']} detected."
                model_results.append(existing_res)
            except Exception as e:
                print(f"Forest model prediction error: {e}", file=sys.stderr)

        if not model_results:
            return jsonify({"success": False, "message": "Failed to generate prediction from available models."}), 500

        # Sort model results by confidence score descending
        model_results.sort(key=lambda x: float(x.get("confidence_score", x.get("confidence", 0))), reverse=True)
        winner = model_results[0]

        top_confidence = round(float(winner.get("confidence_score", winner.get("confidence", 0))), 2)
        top_disease = winner.get("prediction", winner.get("disease_name", "Unknown"))
        top_status = winner.get("status", "Diseased" if "Healthy" not in top_disease else "Healthy")
        top_model_used = winner.get("model_used", "Desktop/Shrimp Trained Model")
        top_risk = winner.get("risk_level", "Low" if top_status == "Healthy" else "High")
        top_description = winner.get("description", f"{top_disease} detected with high confidence.")
        top_recommendation = winner.get("recommendation", "Monitor shrimp pond closely.")
        top_probabilities = winner.get("probabilities", {})
        top_debug = winner.get("debug", {})

        # Debug Logging
        print("=" * 60, file=sys.stderr)
        print(f"[AI PIPELINE DEBUG LOG]", file=sys.stderr)
        print(f"Loaded Model Name: {top_debug.get('loaded_model_name', top_model_used)}", file=sys.stderr)
        print(f"Model Path: {top_debug.get('model_path', 'Desktop/Shrimp')}", file=sys.stderr)
        print(f"Preprocessing: {top_debug.get('preprocessing', '[-1.0, 1.0] range')}", file=sys.stderr)
        print(f"Predicted Class: {top_disease} ({top_status})", file=sys.stderr)
        print(f"Confidence: {top_confidence}%", file=sys.stderr)
        print(f"Raw Probabilities Array: {top_debug.get('raw_probabilities_array')}", file=sys.stderr)
        print(f"Class Labels: {top_debug.get('class_labels')}", file=sys.stderr)
        print(f"Probabilities Breakdown: {json.dumps(top_probabilities)}", file=sys.stderr)
        print("=" * 60, file=sys.stderr)

        # Confidence Threshold: 90%
        if top_confidence >= 90.0:
            final_output = {
                "success": True,
                "shrimp_detected": True,
                "image_quality": "Good Quality",
                "prediction": top_disease,
                "disease_name": top_disease,
                "confidence": top_confidence,
                "confidence_score": top_confidence,
                "status": top_status,
                "risk_level": top_risk,
                "model_used": top_model_used,
                "description": top_description,
                "recommendation": top_recommendation,
                "probabilities": top_probabilities,
                "debug": top_debug,
                "message": f"Scan completed: {top_disease} ({top_status})",
                "model_dir": str(MODEL_DIR),
                "all_evaluations": model_results,
            }
        else:
            final_output = {
                "success": True,
                "shrimp_detected": True,
                "image_quality": "Good Quality",
                "prediction": None,
                "disease_name": None,
                "confidence": top_confidence,
                "confidence_score": top_confidence,
                "status": "Uncertain",
                "risk_level": "Medium",
                "model_used": top_model_used,
                "description": "Unable to confidently identify the shrimp condition. Please upload a clearer shrimp image.",
                "recommendation": "Retake a clearer close-up photo under good lighting and verify pond water quality.",
                "message": "Unable to confidently identify the shrimp condition. Please upload a clearer shrimp image.",
                "probabilities": top_probabilities,
                "debug": top_debug,
                "model_dir": str(MODEL_DIR),
                "all_evaluations": model_results,
            }

        return jsonify(final_output)

    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass


if __name__ == "__main__":
    app.run(host=os.getenv("SHRIMP_AI_HOST", "127.0.0.1"), port=int(os.getenv("SHRIMP_AI_PORT", "5001")))
