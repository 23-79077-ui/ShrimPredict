from __future__ import annotations

import io
import json
import os
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from black_gill_specialist import predict_black_gill
from desktop_shrimp import is_desktop_model_ready, predict_desktop_shrimp
from quality_validator import validate_image_quality
from shrimp_detector import count_shrimp_in_image, detect_shrimp

MODEL_DIR = Path(os.getenv("SHRIMP_WSSV_MODEL_DIR", REPO_ROOT / "ml" / "artifacts" / "wssv_transfer" / "efficientnetb0"))
IMAGE_SIZE = int(os.getenv("SHRIMP_WSSV_IMAGE_SIZE", "224"))
FOREST_MODEL_PATH = Path(os.getenv("SHRIMP_FOREST_MODEL_PATH", REPO_ROOT / "frontend" / "public" / "models" / "shrimp-disease" / "wssv-forest-model.json"))
MIN_FINAL_CONFIDENCE = float(os.getenv("SHRIMP_MIN_FINAL_CONFIDENCE", "68"))
MIN_HEALTHY_CONFIDENCE = float(os.getenv("SHRIMP_MIN_HEALTHY_CONFIDENCE", "78"))
DESKTOP_MIN_CONFIDENCE = float(os.getenv("SHRIMP_DESKTOP_MIN_CONFIDENCE", "70"))
BLACK_GILL_REVIEW_CONFIDENCE = float(os.getenv("SHRIMP_BLACK_GILL_REVIEW_CONFIDENCE", "95"))
BLACK_GILL_TRIGGER_CONFIDENCE = float(os.getenv("SHRIMP_BLACK_GILL_TRIGGER_CONFIDENCE", "86"))
BLACK_GILL_ACCEPT_CONFIDENCE = float(os.getenv("SHRIMP_BLACK_GILL_ACCEPT_CONFIDENCE", "60"))

UNIFIED_MODEL_DIR = REPO_ROOT / "ml" / "artifacts"
_unified_model = None
_unified_labels = None
_unified_available = False


def _decode_image(image_bytes):
    if image_bytes is None or len(image_bytes) == 0:
        return None

    try:
        np_arr = np.frombuffer(image_bytes, np.uint8)
    except ValueError:
        return None

    if np_arr.size == 0:
        return None

    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        return None
    return image


def _skin_mask(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    lower_skin = np.array([0, 20, 70], dtype=np.uint8)
    upper_skin = np.array([20, 255, 255], dtype=np.uint8)
    return cv2.inRange(hsv, lower_skin, upper_skin)


def _has_human_face(image_bytes):
    image = _decode_image(image_bytes)
    if image is None:
        return False

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascades = [
        cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml"),
        cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml"),
    ]

    for cascade in cascades:
        if cascade.empty():
            continue
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
        )
        if len(faces) > 0:
            return True

    return False


def _has_human_skin_tone(image_bytes, min_skin_ratio=0.12):
    image = _decode_image(image_bytes)
    if image is None:
        return False

    mask = _skin_mask(image)
    skin_pixels = np.sum(mask > 0)
    total_pixels = image.shape[0] * image.shape[1]
    skin_ratio = skin_pixels / total_pixels if total_pixels else 0
    return skin_ratio >= min_skin_ratio


def is_human(image_bytes):
    return _has_human_face(image_bytes) or _has_human_skin_tone(image_bytes)


def is_human_face(image_bytes):
    return is_human(image_bytes)


def is_blue_background(image_bytes, min_blue_ratio=0.25):
    """Reject scans that do not have a sufficiently blue background."""
    image = _decode_image(image_bytes)
    if image is None:
        return False

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    lower_blue = np.array([90, 50, 50], dtype=np.uint8)
    upper_blue = np.array([135, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower_blue, upper_blue)

    blue_pixels = np.sum(mask > 0)
    total_pixels = image.shape[0] * image.shape[1]
    blue_ratio = blue_pixels / total_pixels if total_pixels else 0
    return blue_ratio >= min_blue_ratio


def _reject_invalid_scan(message: str):
    return jsonify({
        "success": False,
        "shrimp_detected": False,
        "error": message,
    }), 400


def _run_image_guardrails(image_bytes):
    # Background check intentionally disabled: users may scan shrimp images taken
    # under different lighting/background conditions while still keeping the rest of
    # the quality and content validation in place.
    if is_human(image_bytes):
        return _reject_invalid_scan("Human detected. Please capture only the shrimp.")
    return None


def _try_load_unified_model():
    """Attempt to load the unified Keras model. Fails silently if TF is broken or model is missing."""
    global _unified_model, _unified_labels, _unified_available

    model_path = UNIFIED_MODEL_DIR / "efficientnet_v2_disease.keras"
    if not model_path.exists():
        model_path = UNIFIED_MODEL_DIR / "unified_model" / "unified_disease_model.keras"

    labels_path = UNIFIED_MODEL_DIR / "efficientnet_v2_disease_labels.json"
    if not labels_path.exists():
        labels_path = UNIFIED_MODEL_DIR / "labels.json"
    if not labels_path.exists():
        labels_path = UNIFIED_MODEL_DIR / "wssv_transfer" / "efficientnetb0" / "labels.json"

    if not model_path.exists() or not labels_path.exists():
        print("[UNIFIED] Model or labels file not found, skipping loading.", file=sys.stderr)
        return

    try:
        import tensorflow as tf

        _unified_model = tf.keras.models.load_model(str(model_path))
        with open(labels_path, "r", encoding="utf-8") as f:
            _unified_labels = json.load(f)
        _unified_available = True
        print(f"[UNIFIED] Loaded model {model_path.name} with labels: {_unified_labels}", file=sys.stderr)
    except Exception as exc:
        print(f"[UNIFIED] Could not load model: {exc}", file=sys.stderr)


_try_load_unified_model()

app = Flask(__name__)
CORS(app)

def _predict_unified(image_path: Path) -> dict:
    """Run prediction using the unified Keras model."""
    import tensorflow as tf
    from PIL import Image
    import numpy as np

    with Image.open(image_path) as img:
        img = img.convert("RGB").resize((224, 224))
    img_array = tf.keras.preprocessing.image.img_to_array(img)
    img_array = tf.expand_dims(img_array, 0)

    predictions = _unified_model.predict(img_array, verbose=0)
    score = predictions[0]
    top_idx = int(np.argmax(score))
    top_class = _unified_labels[top_idx]
    confidence = float(score[top_idx]) * 100
    probabilities = {_unified_labels[i]: round(float(score[i]) * 100, 2) for i in range(len(_unified_labels))}

    if "healthy" in top_class.lower():
        status = "Healthy"
        risk = "Low"
        recommendation = "Maintain current feeding and water quality."
        description = f"Healthy shrimp detected with {confidence:.1f}% confidence."
    elif "white_spot" in top_class.lower() or "wssv" in top_class.lower():
        status = "Diseased"
        risk = "High"
        recommendation = "Increase water quality checks and isolate affected pond immediately."
        description = f"White Spot Syndrome Virus (WSSV) detected with {confidence:.1f}% confidence."
    else:
        status = "Diseased"
        risk = "Medium"
        recommendation = "Adjust water parameters and monitor shrimp behavior closely."
        description = f"Black Gill Disease detected with {confidence:.1f}% confidence."

    return {
        "prediction": top_class.replace("_", " "),
        "disease_name": top_class.replace("_", " "),
        "confidence": round(confidence, 2),
        "confidence_score": round(confidence, 2),
        "status": status,
        "risk_level": risk,
        "model_used": "Unified 3-Class EfficientNetB0",
        "description": description,
        "recommendation": recommendation,
        "probabilities": probabilities,
    }
# --- End unified model section ---


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


def _is_primary_diagnosis(result: dict | None) -> bool:
    if not result:
        return False
    label = str(result.get('prediction') or result.get('disease_name') or '').strip().lower()
    return label in {
        "healthy",
        "healthy shrimp",
        "white spot syndrome virus",
        "white spot syndrome virus (wssv)",
        "wssv",
    }


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
    unified_result: dict | None = None,
) -> tuple[dict, bool, str]:
    desktop = _normalized_result(dict(desktop_result)) if _valid_prediction(desktop_result) else None
    black_gill = _normalized_result(dict(black_gill_result)) if _valid_prediction(black_gill_result) else None
    forest = _normalized_result(dict(forest_result)) if _valid_prediction(forest_result) else None
    unified = _normalized_result(dict(unified_result)) if _valid_prediction(unified_result) else None

    # If unified model produced a high-confidence result, prefer it
    if unified and _confidence(unified) >= MIN_FINAL_CONFIDENCE:
        return unified, False, "Unified 3-class EfficientNetB0 model selected as primary classifier."

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

    if unified:
        return unified, _confidence(unified) < MIN_FINAL_CONFIDENCE, "Unified model used as fallback."

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


def _choose_primary_result(
    desktop_result: dict | None,
    forest_result: dict | None,
    unified_result: dict | None,
    black_gill_result: dict | None = None,
):
    """Select only Healthy or WSSV results for the initial scan."""
    if (
        _is_black_gill(black_gill_result)
        and _confidence(black_gill_result) >= BLACK_GILL_ACCEPT_CONFIDENCE
    ):
        return {
            "prediction": None,
            "disease_name": None,
            "confidence": _confidence(black_gill_result),
            "confidence_score": _confidence(black_gill_result),
            "status": "Uncertain",
            "risk_level": "Medium",
            "model_used": "Primary Healthy/WSSV Models",
            "description": "The primary model suggested Healthy, but the Black Gill safety check found possible Black Gill Disease.",
            "recommendation": "Enable additional detection to confirm the secondary disease assessment.",
        }, True, "Black Gill safety check blocked the Healthy primary result."

    candidates = [
        _normalized_result(dict(result))
        for result in (unified_result, desktop_result, forest_result)
        if _valid_prediction(result) and _is_primary_diagnosis(result)
    ]

    if not candidates:
        return {
            "prediction": None,
            "disease_name": None,
            "confidence": 0,
            "confidence_score": 0,
            "status": "Uncertain",
            "risk_level": "Medium",
            "model_used": "Primary Healthy/WSSV Models",
            "description": "Unable to confidently classify the image as Healthy or White Spot Syndrome Virus.",
            "recommendation": "Enable additional detection for secondary disease screening.",
        }, True, "No Healthy or WSSV prediction was available."

    candidates.sort(key=_confidence, reverse=True)
    winner = candidates[0]
    threshold = MIN_HEALTHY_CONFIDENCE if _is_healthy(winner) else MIN_FINAL_CONFIDENCE
    force_uncertain = _confidence(winner) < threshold
    return winner, force_uncertain, "Primary Healthy/WSSV model selected."

@app.get("/health")
def health():
    keras_ready = (MODEL_DIR / "best_model.keras").exists() and (MODEL_DIR / "labels.json").exists()
    forest_ready = FOREST_MODEL_PATH.exists()
    desktop_ready = is_desktop_model_ready()
    return jsonify({
        "success": True,
        "model_ready": forest_ready or desktop_ready or _unified_available,
        "shrimp_detector_ready": True,
        "quality_validator_ready": True,
        "keras_ready": keras_ready,
        "forest_fallback_ready": forest_ready,
        "desktop_shrimp_model_ready": desktop_ready,
        "black_gill_specialist_ready": True,
        "unified_model_ready": _unified_available,
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


@app.post("/count")
@app.post("/detect-preview")
def count_preview_endpoint():
    uploaded = request.files.get("image") or request.files.get("file")
    if not uploaded:
        return jsonify({"success": False, "shrimp_detected": False, "shrimp_count": 0, "valid_shrimp_present": False, "message": "No image uploaded."}), 400

    suffix = Path(uploaded.filename or "preview.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        uploaded.save(temp_file)

    try:
        result = count_shrimp_in_image(temp_path)
        response = {
            "success": True,
            "status": "success" if result.get("shrimp_detected", False) else "no_shrimp",
            "shrimp_detected": result.get("shrimp_detected", False),
            "shrimp_count": int(result.get("shrimp_count", 0)),
            "valid_shrimp_present": bool(result.get("valid_shrimp_present", False)),
            "status": result.get("status", "No shrimp detected"),
            "message": result.get("message", "No shrimp were detected in the uploaded photo."),
            "confidence": result.get("confidence", 0.0),
        }
        return jsonify(response)
    except Exception as exc:
        return jsonify({"success": False, "shrimp_detected": False, "shrimp_count": 0, "valid_shrimp_present": False, "message": str(exc)}), 500
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass


@app.post("/predict")
@app.post("/scan")
@app.post("/pipeline")
@app.post("/api/pipeline")
@app.post("/api/process")
@app.post("/api/scan")
def predict_endpoint():
    # Support both 'image' and 'file' payload keys
    uploaded = request.files.get("image") or request.files.get("file")
    if not uploaded:
        return jsonify({"success": False, "shrimp_detected": False, "message": "No image uploaded."}), 400

    enable_additional = request.form.get("enable_additional", "false").lower() in {"1", "true", "yes", "on"}

    suffix = Path(uploaded.filename or "scan.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        uploaded.save(temp_file)

    try:
        # Read the saved bytes from disk rather than the exhausted upload stream
        image_bytes = temp_path.read_bytes()

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

        if not forest_ready and not desktop_ready and not _unified_available:
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
        unified_res = None

        # 0. Unified 3-Class EfficientNetB0 (preferred if available)
        if _unified_available:
            try:
                unified_res = _predict_unified(temp_path)
                unified_res = _normalized_result(unified_res)
                model_results.append(unified_res)
            except Exception as e:
                print(f"Unified model prediction error: {e}", file=sys.stderr)
                model_results.append(_model_error("Unified 3-Class EfficientNetB0", e))

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

        should_run_black_gill = enable_additional and (
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

        if enable_additional:
            winner, force_uncertain, selection_reason = _choose_final_result(desktop_res, black_gill_res, forest_res, unified_res)
        else:
            primary_black_gill_res = None
            if desktop_valid and _is_healthy(desktop_res):
                try:
                    primary_black_gill_res = _normalized_result(predict_black_gill(temp_path))
                    model_results.append(primary_black_gill_res)
                except Exception as e:
                    print(f"Black Gill safety check error: {e}", file=sys.stderr)
            winner, force_uncertain, selection_reason = _choose_primary_result(
                desktop_res,
                forest_res,
                unified_res,
                primary_black_gill_res,
            )
            black_gill_res = primary_black_gill_res

        top_confidence = round(float(winner.get("confidence_score", winner.get("confidence", 0))), 2)
        top_disease = winner.get("prediction") or winner.get("disease_name") or "Unknown"
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
            "enable_additional": enable_additional,
            "unified_prediction": unified_res.get("prediction") if unified_res else None,
            "unified_confidence": round(_confidence(unified_res), 2) if unified_res else 0,
            "unified_ran": bool(unified_res),
            "unified_available": _unified_available,
            "final_selected_prediction": top_disease,
            "final_selected_confidence": top_confidence,
            "selection_reason": selection_reason,
        }
        top_debug["pipeline_selection"] = pipeline_debug

        # Debug Logging
        print("=" * 60, file=sys.stderr)
        print(f"[AI PIPELINE DEBUG LOG]", file=sys.stderr)
        print(f"Unified Prediction: {pipeline_debug['unified_prediction']} ({pipeline_debug['unified_confidence']}%)", file=sys.stderr)
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
                "can_run_additional": False,
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
                "can_run_additional": not enable_additional,
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
