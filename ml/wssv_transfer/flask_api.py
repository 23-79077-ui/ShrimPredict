from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from black_gill_specialist import predict_black_gill
from desktop_shrimp import is_desktop_model_ready, predict_desktop_shrimp
from quality_validator import validate_image_quality
from shrimp_detector import detect_shrimp

MODEL_DIR = Path(os.getenv("SHRIMP_WSSV_MODEL_DIR", REPO_ROOT / "ml" / "artifacts" / "wssv_transfer" / "efficientnetb0"))
IMAGE_SIZE = int(os.getenv("SHRIMP_WSSV_IMAGE_SIZE", "224"))
FOREST_MODEL_PATH = Path(os.getenv("SHRIMP_FOREST_MODEL_PATH", REPO_ROOT / "frontend" / "public" / "models" / "shrimp-disease" / "wssv-forest-model.json"))
MIN_FINAL_CONFIDENCE = float(os.getenv("SHRIMP_MIN_FINAL_CONFIDENCE", "68"))
MIN_HEALTHY_CONFIDENCE = float(os.getenv("SHRIMP_MIN_HEALTHY_CONFIDENCE", "78"))
DESKTOP_MIN_CONFIDENCE = float(os.getenv("SHRIMP_DESKTOP_MIN_CONFIDENCE", "70"))
BLACK_GILL_REVIEW_CONFIDENCE = float(os.getenv("SHRIMP_BLACK_GILL_REVIEW_CONFIDENCE", "95"))
BLACK_GILL_TRIGGER_CONFIDENCE = float(os.getenv("SHRIMP_BLACK_GILL_TRIGGER_CONFIDENCE", "86"))
BLACK_GILL_ACCEPT_CONFIDENCE = float(os.getenv("SHRIMP_BLACK_GILL_ACCEPT_CONFIDENCE", "60"))

app = Flask(__name__)
CORS(app)


def _confidence(result: dict) -> float:
    return float(result.get("confidence_score", result.get("confidence", 0)) or 0)


def _is_healthy(result: dict) -> bool:
    text = f"{result.get('prediction', '')} {result.get('disease_name', '')} {result.get('status', '')}".lower()
    return "healthy" in text and "black gill" not in text and "white spot" not in text and "wssv" not in text


def _is_uncertain(result: dict) -> bool:
    text = f"{result.get('prediction', '')} {result.get('disease_name', '')} {result.get('status', '')}".lower()
    return "needs review" in text or "uncertain" in text


def _is_wssv(result: dict | None) -> bool:
    if not result:
        return False
    text = f"{result.get('prediction', '')} {result.get('disease_name', '')} {result.get('status', '')}".lower()
    return "white spot" in text or "wssv" in text


def _is_black_gill(result: dict | None) -> bool:
    if not result:
        return False
    text = f"{result.get('prediction', '')} {result.get('disease_name', '')}".lower()
    return "black gill disease" in text and "no black gill" not in text


def _model_error(model_used: str, error: Exception) -> dict:
    return {
        "model_used": model_used,
        "prediction": None,
        "disease_name": None,
        "confidence": 0,
        "confidence_score": 0,
        "status": "Unavailable",
        "error": str(error),
    }


def _normalized_result(result: dict) -> dict:
    disease = result.get("prediction") or result.get("disease_name") or "Unknown"
    status = result.get("status") or ("Healthy" if "healthy" in disease.lower() else "Diseased")
    result["prediction"] = disease
    result["disease_name"] = disease
    result["status"] = status
    result["confidence"] = round(_confidence(result), 2)
    result["confidence_score"] = round(_confidence(result), 2)
    return result


def _valid_prediction(result: dict | None) -> bool:
    return bool(result and result.get("prediction") and result.get("status") not in {"Unavailable", "Error"})


def _forest_agrees_with_desktop(desktop_result: dict | None, forest_result: dict | None) -> bool:
    if not _valid_prediction(desktop_result) or not _valid_prediction(forest_result):
        return False
    if _is_wssv(desktop_result) and _is_wssv(forest_result):
        return True
    if _is_healthy(desktop_result) and _is_healthy(forest_result):
        return True
    return False


def _merge_agreeing_forest_confidence(desktop_result: dict, forest_result: dict | None) -> dict:
    result = _normalized_result(dict(desktop_result))
    if not _forest_agrees_with_desktop(result, forest_result):
        return result

    forest_confidence = _confidence(forest_result)
    if forest_confidence > _confidence(result):
        result["confidence"] = round(forest_confidence, 2)
        result["confidence_score"] = round(forest_confidence, 2)
        result["model_used"] = result.get("model_used", "Desktop/Shrimp Trained Model")
        result["description"] = result.get("description", f"{result['prediction']} detected.")
        result["debug"] = dict(result.get("debug", {}))
        result["debug"]["forest_confidence_boost"] = {
            "forest_prediction": forest_result.get("prediction") or forest_result.get("disease_name"),
            "forest_confidence": round(forest_confidence, 2),
            "reason": "Forest agreed with Desktop, so confidence was increased without changing class.",
        }
    return result


def _choose_final_result(
    desktop_result: dict | None,
    black_gill_result: dict | None,
    forest_result: dict | None,
) -> tuple[dict, bool, str]:
    desktop = _normalized_result(dict(desktop_result)) if _valid_prediction(desktop_result) else None
    black_gill = _normalized_result(dict(black_gill_result)) if _valid_prediction(black_gill_result) else None
    forest = _normalized_result(dict(forest_result)) if _valid_prediction(forest_result) else None

    if _is_black_gill(black_gill) and _confidence(black_gill) >= BLACK_GILL_ACCEPT_CONFIDENCE:
        return black_gill, _confidence(black_gill) < MIN_FINAL_CONFIDENCE, "Black Gill specialist detected Black Gill above accept threshold."

    if desktop:
        winner = _merge_agreeing_forest_confidence(desktop, forest)
        if forest and _is_wssv(forest) and not _forest_agrees_with_desktop(desktop, forest):
            winner["debug"] = dict(winner.get("debug", {}))
            winner["debug"]["forest_override_blocked"] = {
                "forest_prediction": forest.get("prediction") or forest.get("disease_name"),
                "forest_confidence": round(_confidence(forest), 2),
                "reason": "Binary WSSV forest is advisory and cannot override Desktop class.",
            }
        force_uncertain = _confidence(winner) < (MIN_HEALTHY_CONFIDENCE if _is_healthy(winner) else MIN_FINAL_CONFIDENCE)
        return winner, force_uncertain, "Desktop three-class model selected as primary classifier."

    if forest:
        return forest, _is_uncertain(forest) or _confidence(forest) < MIN_FINAL_CONFIDENCE, "Forest used only because no valid Desktop prediction was available."

    if black_gill:
        return black_gill, _confidence(black_gill) < MIN_FINAL_CONFIDENCE, "Black Gill specialist used because no Desktop or forest prediction was available."

    return {
        "prediction": "Unknown",
        "disease_name": "Unknown",
        "confidence": 0,
        "confidence_score": 0,
        "status": "Uncertain",
        "risk_level": "Medium",
        "model_used": "No Valid Disease Model",
    }, True, "No model returned a valid diagnostic prediction."


@app.get("/health")
def health():
    keras_ready = (MODEL_DIR / "best_model.keras").exists() and (MODEL_DIR / "labels.json").exists()
    forest_ready = FOREST_MODEL_PATH.exists()
    desktop_ready = is_desktop_model_ready()
    return jsonify({
        "success": True,
        "model_ready": forest_ready or desktop_ready,
        "shrimp_detector_ready": True,
        "quality_validator_ready": True,
        "keras_ready": keras_ready,
        "forest_fallback_ready": forest_ready,
        "desktop_shrimp_model_ready": desktop_ready,
        "black_gill_specialist_ready": True,
        "confidence_thresholds": {
            "minimum_final_confidence": MIN_FINAL_CONFIDENCE,
            "minimum_healthy_confidence": MIN_HEALTHY_CONFIDENCE,
            "desktop_minimum_confidence": DESKTOP_MIN_CONFIDENCE,
            "black_gill_review_confidence": BLACK_GILL_REVIEW_CONFIDENCE,
            "black_gill_trigger_confidence": BLACK_GILL_TRIGGER_CONFIDENCE,
            "black_gill_accept_confidence": BLACK_GILL_ACCEPT_CONFIDENCE,
        },
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
                "content_category": stage1_res.get("content_category", "Unknown Object"),
                "image_quality": "N/A",
                "prediction": None,
                "disease_name": None,
                "status": "No Shrimp Detected",
                "confidence": 0,
                "confidence_score": 0,
                "risk_level": "None",
                "message": stage1_res.get("message", "No shrimp detected."),
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
                "content_category": stage1_res.get("content_category", "Shrimp"),
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

        if not forest_ready and not desktop_ready:
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
        desktop_res = None
        forest_res = None
        black_gill_res = None

        # 1. Desktop/Shrimp Trained Model (primary three-class disease classifier)
        if desktop_ready:
            try:
                desktop_res = predict_desktop_shrimp(temp_path)
                desktop_res = _normalized_result(desktop_res)
                model_results.append(desktop_res)
            except Exception as e:
                print(f"Desktop model prediction error: {e}", file=sys.stderr)
                model_results.append(_model_error("Desktop/Shrimp Trained Model", e))

        desktop_valid = _valid_prediction(desktop_res)
        desktop_confidence = _confidence(desktop_res) if desktop_valid else 0
        should_run_forest = forest_ready and (not desktop_valid or desktop_confidence < DESKTOP_MIN_CONFIDENCE)

        # 2. Binary WSSV Random Forest (fallback/advisory only; never changes Desktop class)
        if should_run_forest:
            try:
                from forest_fallback import predict_with_forest
                forest_res = predict_with_forest(temp_path, FOREST_MODEL_PATH)
                forest_res["model_used"] = "Existing Forest Model"
                forest_res["status"] = "Diseased" if "Healthy" not in forest_res["disease_name"] and "Needs Review" not in forest_res["disease_name"] else ("Healthy" if "Healthy" in forest_res["disease_name"] else "Uncertain")
                forest_res["prediction"] = forest_res["disease_name"]
                forest_res["description"] = f"{forest_res['disease_name']} detected."
                forest_res = _normalized_result(forest_res)
                model_results.append(forest_res)
            except Exception as e:
                print(f"Forest model prediction error: {e}", file=sys.stderr)
                model_results.append(_model_error("Existing Forest Model", e))

        if not model_results or not any(_valid_prediction(item) for item in model_results):
            return jsonify({"success": False, "message": "Failed to generate prediction from available models."}), 500

        should_run_black_gill = (
            not desktop_valid
            or _is_healthy(desktop_res)
            or _is_wssv(desktop_res)
            or desktop_confidence < BLACK_GILL_REVIEW_CONFIDENCE
        )
        if should_run_black_gill:
            try:
                black_gill_res = predict_black_gill(temp_path)
                black_gill_res = _normalized_result(black_gill_res)
                model_results.append(black_gill_res)
            except Exception as e:
                print(f"Black Gill specialist prediction error: {e}", file=sys.stderr)
                model_results.append(_model_error("Black Gill Specialist Model", e))

        winner, force_uncertain, selection_reason = _choose_final_result(desktop_res, black_gill_res, forest_res)

        top_confidence = round(float(winner.get("confidence_score", winner.get("confidence", 0))), 2)
        top_disease = winner.get("prediction", winner.get("disease_name", "Unknown"))
        top_status = winner.get("status", "Diseased" if "Healthy" not in top_disease else "Healthy")
        top_model_used = winner.get("model_used", "Desktop/Shrimp Trained Model")
        top_risk = winner.get("risk_level", "Low" if top_status == "Healthy" else "High")
        top_description = winner.get("description", f"{top_disease} detected with high confidence.")
        top_recommendation = winner.get("recommendation", "Monitor shrimp pond closely.")
        top_probabilities = winner.get("probabilities", {})
        top_debug = dict(winner.get("debug", {}))
        pipeline_debug = {
            "desktop_prediction": desktop_res.get("prediction") if desktop_res else None,
            "desktop_confidence": round(_confidence(desktop_res), 2) if desktop_res else 0,
            "desktop_valid": bool(desktop_valid),
            "desktop_minimum_confidence": DESKTOP_MIN_CONFIDENCE,
            "forest_prediction": forest_res.get("prediction") if forest_res else None,
            "forest_confidence": round(_confidence(forest_res), 2) if forest_res else 0,
            "forest_ran": bool(forest_res),
            "forest_used_as_fallback": bool(forest_res and not desktop_valid),
            "forest_advisory_only": bool(forest_res and desktop_valid),
            "black_gill_prediction": black_gill_res.get("prediction") if black_gill_res else None,
            "black_gill_confidence": round(_confidence(black_gill_res), 2) if black_gill_res else 0,
            "black_gill_ran": bool(black_gill_res),
            "final_selected_prediction": top_disease,
            "final_selected_confidence": top_confidence,
            "selection_reason": selection_reason,
        }
        top_debug["pipeline_selection"] = pipeline_debug

        # Debug Logging
        print("=" * 60, file=sys.stderr)
        print(f"[AI PIPELINE DEBUG LOG]", file=sys.stderr)
        print(f"Desktop Prediction: {pipeline_debug['desktop_prediction']} ({pipeline_debug['desktop_confidence']}%)", file=sys.stderr)
        print(f"Forest Prediction: {pipeline_debug['forest_prediction']} ({pipeline_debug['forest_confidence']}%)", file=sys.stderr)
        print(f"Black Gill Prediction: {pipeline_debug['black_gill_prediction']} ({pipeline_debug['black_gill_confidence']}%)", file=sys.stderr)
        print(f"Final Selected Prediction: {top_disease} ({top_confidence}%)", file=sys.stderr)
        print(f"Selection Reason: {selection_reason}", file=sys.stderr)
        print(f"Loaded Model Name: {top_debug.get('loaded_model_name', top_model_used)}", file=sys.stderr)
        print(f"Model Path: {top_debug.get('model_path', 'Desktop/Shrimp')}", file=sys.stderr)
        print(f"Preprocessing: {top_debug.get('preprocessing', '[-1.0, 1.0] range')}", file=sys.stderr)
        print(f"Predicted Class: {top_disease} ({top_status})", file=sys.stderr)
        print(f"Confidence: {top_confidence}%", file=sys.stderr)
        print(f"Raw Probabilities Array: {top_debug.get('raw_probabilities_array')}", file=sys.stderr)
        print(f"Class Labels: {top_debug.get('class_labels')}", file=sys.stderr)
        print(f"Probabilities Breakdown: {json.dumps(top_probabilities)}", file=sys.stderr)
        print("=" * 60, file=sys.stderr)

        is_needs_review = force_uncertain or "Needs Review" in str(top_disease) or top_status == "Uncertain"
        is_diagnostic_result = top_status in {"Healthy", "Diseased"} and not is_needs_review

        if is_diagnostic_result:
            final_output = {
                "success": True,
                "shrimp_detected": True,
                "content_category": stage1_res.get("content_category", "Shrimp"),
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
                "stage1_details": stage1_res,
                "stage2_details": stage2_res,
                "all_evaluations": model_results,
            }
        else:
            final_output = {
                "success": True,
                "shrimp_detected": True,
                "content_category": stage1_res.get("content_category", "Shrimp"),
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
                "stage1_details": stage1_res,
                "stage2_details": stage2_res,
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
