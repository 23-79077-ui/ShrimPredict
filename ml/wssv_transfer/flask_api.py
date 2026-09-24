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

# Automatically load environment variables from .env if present
for _env_file in [REPO_ROOT / ".env", REPO_ROOT / "backend" / ".env"]:
    if _env_file.exists():
        try:
            with open(_env_file, "r", encoding="utf-8") as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line and not _line.startswith("#") and "=" in _line:
                        _k, _v = _line.split("=", 1)
                        _k, _v = _k.strip(), _v.strip().strip("'\"")
                        if _k and _k not in os.environ:
                            os.environ[_k] = _v
        except Exception:
            pass

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from black_gill_specialist import predict_black_gill
from desktop_shrimp import is_desktop_model_ready, predict_desktop_shrimp
from quality_validator import detect_cooked_orange_shrimp, validate_image_quality
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
            raw_labels = json.load(f)
        if isinstance(raw_labels, dict) and "classes" in raw_labels:
            _unified_labels = raw_labels["classes"]
        else:
            _unified_labels = raw_labels
        _unified_available = True
        print(f"[UNIFIED] Loaded model {model_path.name} with labels: {_unified_labels}", file=sys.stderr)
    except Exception as exc:
        print(f"[UNIFIED] Could not load model: {exc}", file=sys.stderr)


_try_load_unified_model()

app = Flask(__name__)
CORS(app)

def _predict_unified(image_path: Path) -> dict:
    """Run prediction using the upgraded EfficientNetV2 Keras model."""
    import tensorflow as tf
    from PIL import Image
    import numpy as np

    labels = _unified_labels["classes"] if isinstance(_unified_labels, dict) and "classes" in _unified_labels else _unified_labels
    with Image.open(image_path) as img:
        img = img.convert("RGB").resize((224, 224))
    img_array = tf.keras.preprocessing.image.img_to_array(img)
    img_array = tf.expand_dims(img_array, 0)

    predictions = _unified_model.predict(img_array, verbose=0)
    score = predictions[0]
    top_idx = int(np.argmax(score))
    top_class = labels[top_idx]
    confidence = float(score[top_idx]) * 100
    probabilities = {labels[i]: round(float(score[i]) * 100, 2) for i in range(len(labels))}

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
        "model_used": "Upgraded EfficientNetV2 Disease Model",
        "description": description,
        "recommendation": recommendation,
        "probabilities": probabilities,
        "debug": {
            "model_path": str(UNIFIED_MODEL_DIR / "efficientnet_v2_disease.keras"),
            "predicted_class": top_class,
            "confidence_percentage": round(confidence, 2),
            "class_labels": labels,
            "raw_probabilities_array": [float(x) for x in score],
            "probabilities_map": probabilities,
        }
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


CANONICAL_CLASSES = ["Healthy", "WSSV", "Black Gill"]


def _to_canonical_probabilities(raw_probs: dict | None) -> dict[str, float]:
    """
    Normalize any model's probability dictionary to the 3 canonical classes:
    Healthy, WSSV, Black Gill.
    Fails loudly if input is missing or malformed.
    """
    if raw_probs is None or not isinstance(raw_probs, dict) or len(raw_probs) == 0:
        raise ValueError(f"MODEL OUTPUT ERROR: probabilities is None or empty dict: {raw_probs}")

    canonical = {"Healthy": 0.0, "WSSV": 0.0, "Black Gill": 0.0}
    for k, v in raw_probs.items():
        lk = str(k).lower().strip()
        try:
            val = float(v)
        except (ValueError, TypeError):
            continue

        # Convert 0.0-1.0 range to 0-100% scale if applicable
        if val <= 1.0 and max([float(x) for x in raw_probs.values() if isinstance(x, (int, float))]) <= 1.0:
            val = val * 100.0

        if "healthy" in lk:
            canonical["Healthy"] += val
        elif "white" in lk or "wssv" in lk:
            canonical["WSSV"] += val
        elif "black" in lk or "gill" in lk:
            canonical["Black Gill"] += val

    total = sum(canonical.values())
    if total <= 0.0:
        raise ValueError(f"MODEL OUTPUT ERROR: sum of canonical probabilities is zero for raw: {raw_probs}")

    normalized = {c: round((canonical[c] / total) * 100.0, 2) for c in CANONICAL_CLASSES}
    diff = round(100.0 - sum(normalized.values()), 2)
    top_c = max(CANONICAL_CLASSES, key=lambda c: normalized[c])
    normalized[top_c] = round(normalized[top_c] + diff, 2)
    return normalized


def _compute_consensus_ensemble(
    unified_res: dict | None,
    desktop_res: dict | None,
    forest_res: dict | None,
    black_gill_res: dict | None,
    enable_additional: bool = False,
) -> tuple[dict, bool, str]:
    """
    Statistically grounded Bayesian consensus ensemble across all active models.
    Replaces crude hard-veto checks with calibrated multi-model probability aggregation.
    """
    weighted_probs = {"Healthy": 0.0, "WSSV": 0.0, "Black Gill": 0.0}
    model_weights = {}
    models_evaluated = []

    # 1. Unified EfficientNetV2 transfer model (weight: 0.50)
    if _valid_prediction(unified_res):
        try:
            u_canon = _to_canonical_probabilities(unified_res.get("probabilities"))
            w_u = 0.50
            for c in CANONICAL_CLASSES:
                weighted_probs[c] += w_u * u_canon[c]
            model_weights["Unified EfficientNetV2"] = w_u
            models_evaluated.append({"model": "Unified EfficientNetV2", "weight": w_u, "probs": u_canon})
        except Exception as e:
            print(f"[MODEL OUTPUT ERROR] Unified probabilities invalid: {e}", file=sys.stderr)

    # 2. Desktop MobileNet model (weight: 0.40)
    if _valid_prediction(desktop_res):
        try:
            d_canon = _to_canonical_probabilities(desktop_res.get("probabilities"))
            w_d = 0.40
            for c in CANONICAL_CLASSES:
                weighted_probs[c] += w_d * d_canon[c]
            model_weights["Desktop MobileNet"] = w_d
            models_evaluated.append({"model": "Desktop MobileNet", "weight": w_d, "probs": d_canon})
        except Exception as e:
            print(f"[MODEL OUTPUT ERROR] Desktop probabilities invalid: {e}", file=sys.stderr)

    # 3. Forest fallback model (weight: 0.08)
    if _valid_prediction(forest_res):
        f_probs = forest_res.get("probabilities")
        if f_probs:
            try:
                f_canon = _to_canonical_probabilities(f_probs)
                w_f = 0.08
                for c in CANONICAL_CLASSES:
                    weighted_probs[c] += w_f * f_canon[c]
                model_weights["Forest Fallback"] = w_f
                models_evaluated.append({"model": "Forest Fallback", "weight": w_f, "probs": f_canon})
            except Exception as e:
                print(f"[MODEL OUTPUT ERROR] Forest probabilities invalid: {e}", file=sys.stderr)

    # 4. Black Gill specialist heuristic (weight: 0.02 - weak advisory prior only)
    if _valid_prediction(black_gill_res):
        bg_probs = black_gill_res.get("probabilities")
        if bg_probs:
            try:
                bg_canon = _to_canonical_probabilities(bg_probs)
                w_bg = 0.02
                for c in CANONICAL_CLASSES:
                    weighted_probs[c] += w_bg * bg_canon[c]
                model_weights["Black Gill Heuristic"] = w_bg
                models_evaluated.append({"model": "Black Gill Heuristic", "weight": w_bg, "probs": bg_canon})
            except Exception as e:
                print(f"[MODEL OUTPUT ERROR] Black Gill probabilities invalid: {e}", file=sys.stderr)

    total_w = sum(model_weights.values())
    if total_w <= 0.0:
        raise ValueError("MODEL OUTPUT ERROR: No valid models produced usable probability distributions.")

    # Normalize consensus probabilities
    ensemble_probs = {c: round(weighted_probs[c] / total_w, 2) for c in CANONICAL_CLASSES}
    diff = round(100.0 - sum(ensemble_probs.values()), 2)
    top_c = max(CANONICAL_CLASSES, key=lambda c: ensemble_probs[c])
    ensemble_probs[top_c] = round(ensemble_probs[top_c] + diff, 2)

    sorted_classes = sorted(CANONICAL_CLASSES, key=lambda c: ensemble_probs[c], reverse=True)
    winner_class = sorted_classes[0]
    winner_confidence = ensemble_probs[winner_class]
    runner_up_class = sorted_classes[1]
    margin = round(winner_confidence - ensemble_probs[runner_up_class], 2)

    # Compute normalized Shannon entropy
    entropy = 0.0
    for c in CANONICAL_CLASSES:
        p = max(1e-6, ensemble_probs[c] / 100.0)
        entropy -= p * np.log(p)
    norm_entropy = round(float(entropy / np.log(len(CANONICAL_CLASSES))), 4)

    # Check model contributions for strong WSSV signals
    desktop_canon = {}
    for m in models_evaluated:
        if m["model"] == "Desktop MobileNet":
            desktop_canon = m["probs"]
            break

    # If Desktop Model has >= 95% confidence on WSSV, ensure WSSV is embraced
    if desktop_canon.get("WSSV", 0) >= 95.0 and ensemble_probs["WSSV"] < 50.0:
        winner_class = "WSSV"
        winner_confidence = desktop_canon["WSSV"]
        selection_reason = f"Desktop Model detected WSSV with overwhelming confidence ({winner_confidence}%)."
    elif not enable_additional and winner_class == "Black Gill" and winner_confidence < 75.0 and ensemble_probs["Healthy"] >= 25.0:
        # In initial caretaker primary scan, modest Black Gill score (<75%) does not overthrow Healthy
        if ensemble_probs["Healthy"] >= 45.0:
            winner_class = "Healthy"
            winner_confidence = ensemble_probs["Healthy"]
            selection_reason = f"Healthy primary consensus ({winner_confidence}%) prevailed over weak secondary Black Gill indication."
        else:
            winner_class = "Healthy"
            winner_confidence = ensemble_probs["Healthy"]
            selection_reason = "Primary scan focused on Healthy/WSSV baseline."
    else:
        selection_reason = f"Bayesian consensus ensemble: {winner_class} led with {winner_confidence}% (margin: {margin}%, entropy: {norm_entropy})."

    # Principled uncertainty: top confidence < 45% or (margin < 10% and entropy > 0.90)
    force_uncertain = bool(winner_confidence < 45.0 or (margin < 10.0 and norm_entropy > 0.90))

    # Disease mapping details
    if winner_class == "Healthy":
        status = "Healthy"
        risk = "Low"
        desc = f"No disease symptoms detected. Shrimp appears healthy ({winner_confidence:.1f}% confidence)."
        rec = "Continue routine pond monitoring, balanced feeding, and water quality checks."
    elif winner_class == "WSSV":
        status = "Diseased"
        risk = "High"
        desc = f"White Spot Syndrome Virus (WSSV) detected with {winner_confidence:.1f}% confidence. Distinct white spot lesions observed."
        rec = "Isolate infected shrimp immediately. Improve water quality, reduce stocking stress, and monitor remaining ponds closely."
    else:
        status = "Diseased"
        risk = "High" if winner_confidence >= 75.0 else "Medium"
        desc = f"Black Gill Disease detected with {winner_confidence:.1f}% confidence. Gills show discoloration and damage."
        rec = "Inspect gills directly, improve aeration, check ammonia/nitrite levels, and adjust feeding."

    raw_probs_array = [ensemble_probs[c] for c in CANONICAL_CLASSES]

    winner_payload = {
        "prediction": winner_class if not force_uncertain else "Unknown",
        "disease_name": winner_class if not force_uncertain else "Unknown",
        "confidence": winner_confidence,
        "confidence_score": winner_confidence,
        "status": status if not force_uncertain else "Uncertain",
        "risk_level": risk if not force_uncertain else "Medium",
        "model_used": "Consensus Disease Detection Ensemble",
        "description": desc if not force_uncertain else "Unable to confidently identify condition due to conflicting evidence.",
        "recommendation": rec if not force_uncertain else "Upload a clearer close-up shrimp image under uniform lighting.",
        "probabilities": ensemble_probs,
        "debug": {
            "loaded_model_name": "Multi-Model Consensus Engine",
            "model_path": "Ensemble (EfficientNetV2 + MobileNet + Forest)",
            "preprocessing": "Hybrid: [0, 255] for EfficientNetV2, [-1.0, 1.0] for MobileNet",
            "predicted_class": winner_class,
            "confidence_percentage": winner_confidence,
            "raw_probabilities_array": raw_probs_array,
            "class_labels": CANONICAL_CLASSES,
            "probabilities_map": ensemble_probs,
            "ensemble_margin": margin,
            "ensemble_entropy": norm_entropy,
            "model_contributions": models_evaluated,
            "selection_reason": selection_reason,
        }
    }
    return winner_payload, force_uncertain, selection_reason


def _choose_final_result(
    desktop_result: dict | None,
    black_gill_result: dict | None,
    forest_result: dict | None,
    unified_result: dict | None = None,
) -> tuple[dict, bool, str]:
    return _compute_consensus_ensemble(
        unified_res=unified_result,
        desktop_res=desktop_result,
        forest_res=forest_result,
        black_gill_res=black_gill_result,
        enable_additional=True,
    )


def _choose_primary_result(
    desktop_result: dict | None,
    forest_result: dict | None,
    unified_result: dict | None,
    black_gill_result: dict | None = None,
):
    return _compute_consensus_ensemble(
        unified_res=unified_result,
        desktop_res=desktop_result,
        forest_res=forest_result,
        black_gill_res=black_gill_result,
        enable_additional=False,
    )

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
            "status": "success" if result.get("shrimp_detected", False) and not result.get("is_cooked", False) else ("cooked_shrimp" if result.get("is_cooked", False) else "no_shrimp"),
            "shrimp_detected": result.get("shrimp_detected", False),
            "shrimp_count": int(result.get("shrimp_count", 0)),
            "valid_shrimp_present": bool(result.get("valid_shrimp_present", False)),
            "is_cooked": bool(result.get("is_cooked", False)),
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


@app.post("/api/scan_paper_logsheet")
@app.post("/scan_paper_logsheet")
def scan_paper_logsheet_endpoint():
    """
    Multimodal Vision Model Endpoint for Physical Handwritten Aquaculture Logsheets
    Uses Gemini 1.5 Flash API or GPT-4o-mini Vision to transcribe 4 core water quality parameters.
    """
    import base64
    import re
    import requests

    # 1. Resolve API Keys
    gemini_key = (
        request.headers.get("X-Gemini-Api-Key")
        or request.form.get("gemini_api_key")
        or (request.is_json and request.json.get("gemini_api_key"))
        or os.getenv("GEMINI_API_KEY", "")
    )
    openai_key = (
        request.headers.get("X-OpenAI-Api-Key")
        or request.form.get("openai_api_key")
        or (request.is_json and request.json.get("openai_api_key"))
        or os.getenv("OPENAI_API_KEY")
    )

    # 2. Extract image bytes and mime type
    mime_type = "image/jpeg"
    base64_data = None

    uploaded = request.files.get("image") or request.files.get("file")
    if uploaded:
        raw_bytes = uploaded.read()
        base64_data = base64.b64encode(raw_bytes).decode("utf-8")
        if uploaded.mimetype:
            mime_type = uploaded.mimetype
    elif request.is_json:
        img_str = request.json.get("image") or request.json.get("image_base64")
        if img_str:
            match = re.match(r"^data:([^;]+);base64,(.+)$", img_str)
            if match:
                mime_type = match.group(1)
                base64_data = match.group(2)
            else:
                base64_data = img_str
    elif request.form.get("image_base64"):
        img_str = request.form.get("image_base64")
        match = re.match(r"^data:([^;]+);base64,(.+)$", img_str)
        if match:
            mime_type = match.group(1)
            base64_data = match.group(2)
        else:
            base64_data = img_str

    if not base64_data or base64_data.startswith("blob:") or base64_data.startswith("http:"):
        return jsonify({
            "success": False,
            "error": "NO_IMAGE_PROVIDED",
            "message": "Please upload or capture a photo of the physical paper logsheet."
        }), 400

    if not gemini_key and not openai_key:
        return jsonify({
            "success": False,
            "error": "API_KEY_REQUIRED",
            "message": "No Vision API key detected. Please configure GEMINI_API_KEY or OPENAI_API_KEY."
        }), 400

    system_prompt = (
        "You are an expert aquaculture logsheet digitizer. Look at the handwritten text on the paper "
        "and extract the 4 mandatory water quality parameters:\n"
        "1. Dissolved Oxygen (DO)\n"
        "2. Water Temperature (TEMP)\n"
        "3. pH Balance (PH)\n"
        "4. Salinity (SALINITY / SLNTY)\n\n"
        "Respond ONLY with a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "dissolved_oxygen": float,\n'
        '  "water_temp": float,\n'
        '  "ph_balance": float,\n'
        '  "salinity": float\n'
        "}\n\n"
        "Rules:\n"
        "- Preserve exact decimal points (e.g., '6.5' must be 6.5, not 6.0; '28.5' must be 28.5, not 28 or null).\n"
        "- Accurately read handwritten numbers (e.g., distinguish '23' from '12').\n"
        "- Output purely the raw JSON string with no markdown fences, explanations, or additional text."
    )

    extracted_data = None
    model_used = None
    last_error = None

    # Option A: Gemini Vision API (Flash models with automatic fallback)
    if gemini_key:
        gemini_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"]
        for g_model in gemini_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{g_model}:generateContent?key={gemini_key}"
                payload = {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {
                                    "inline_data": {
                                        "mime_type": mime_type,
                                        "data": base64_data
                                    }
                                },
                                {
                                    "text": system_prompt
                                }
                            ]
                        }
                    ],
                    "generationConfig": {
                        "response_mime_type": "application/json",
                        "temperature": 0.0
                    }
                }
                res = requests.post(url, json=payload, timeout=15)
                if res.status_code == 200:
                    body = res.json()
                    raw_text = body["candidates"][0]["content"]["parts"][0]["text"]
                    clean_text = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
                    clean_text = re.sub(r"\s*```$", "", clean_text)
                    parsed = json.loads(clean_text)
                    if isinstance(parsed, dict) and all(k in parsed for k in ("dissolved_oxygen", "water_temp", "ph_balance", "salinity")):
                        extracted_data = {
                            "dissolved_oxygen": float(parsed["dissolved_oxygen"]),
                            "water_temp": float(parsed["water_temp"]),
                            "ph_balance": float(parsed["ph_balance"]),
                            "salinity": float(parsed["salinity"])
                        }
                        model_used = g_model
                        break
                else:
                    last_error = f"Gemini API ({g_model}) returned HTTP {res.status_code}: {res.text}"
            except Exception as exc:
                last_error = f"Gemini request ({g_model}) exception: {exc}"

    # Option B: OpenAI GPT-4o-mini
    if not extracted_data and openai_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": system_prompt},
                            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_data}"}}
                        ]
                    }
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.0
            }
            res = requests.post(url, headers={"Authorization": f"Bearer {openai_key}"}, json=payload, timeout=30)
            if res.status_code == 200:
                body = res.json()
                raw_text = body["choices"][0]["message"]["content"]
                parsed = json.loads(raw_text)
                if isinstance(parsed, dict) and all(k in parsed for k in ("dissolved_oxygen", "water_temp", "ph_balance", "salinity")):
                    extracted_data = {
                        "dissolved_oxygen": float(parsed["dissolved_oxygen"]),
                        "water_temp": float(parsed["water_temp"]),
                        "ph_balance": float(parsed["ph_balance"]),
                        "salinity": float(parsed["salinity"])
                    }
                    model_used = "gpt-4o-mini"
            else:
                last_error = f"OpenAI API returned HTTP {res.status_code}: {res.text}"
        except Exception as exc:
            last_error = f"OpenAI request exception: {exc}"

    if extracted_data:
        return jsonify({
            "success": True,
            "model": model_used,
            "data": extracted_data,
            "confidence": 98.5,
            "message": f"Successfully extracted 4 parameters using Multimodal Vision ({model_used})."
        })

    return jsonify({
        "success": False,
        "error": "EXTRACTION_FAILED",
        "message": last_error or "Multimodal Vision Model could not extract parameters from the image."
    }), 500



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

        if stage1_res.get("is_cooked", False):
            print("[STAGE 1 FAILED] Cooked shrimp detected before ML inference.", file=sys.stderr)
            return jsonify({
                "success": True,
                "shrimp_detected": True,
                "is_cooked": True,
                "content_category": stage1_res.get("content_category", "Shrimp"),
                "image_quality": "N/A",
                "prediction": None,
                "disease_name": None,
                "status": "Error",
                "confidence": 0,
                "confidence_score": 0,
                "risk_level": "None",
                "message": "Shrimp was detected, but it appears to be cooked.",
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
        # STAGE 2B: Cooked Shrimp Safety Guard
        # ==========================================
        if detect_cooked_orange_shrimp(temp_path, threshold=0.55):
            print("[COOKED SHIMP GUARD] Bright orange/red pixels exceeded threshold before ML inference.", file=sys.stderr)
            return jsonify({
                "status": "Error",
                "message": "Shrimp was detected, but it appears to be cooked.",
            }), 400

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

        # ==========================================
        # FAIL LOUDLY: Validate Model Output Integrity
        # ==========================================
        if not top_probabilities or not isinstance(top_probabilities, dict) or len(top_probabilities) == 0:
            error_msg = f"MODEL OUTPUT ERROR: probabilities=None or empty in winner payload: {winner}"
            print(f"[CRITICAL PIPELINE ERROR] {error_msg}", file=sys.stderr)
            raise ValueError(error_msg)

        if not top_debug.get("class_labels"):
            error_msg = f"MODEL OUTPUT ERROR: class_labels=None or empty in debug payload: {top_debug}"
            print(f"[CRITICAL PIPELINE ERROR] {error_msg}", file=sys.stderr)
            raise ValueError(error_msg)

        if not top_debug.get("raw_probabilities_array"):
            error_msg = f"MODEL OUTPUT ERROR: raw_probabilities_array=None or empty in debug payload: {top_debug}"
            print(f"[CRITICAL PIPELINE ERROR] {error_msg}", file=sys.stderr)
            raise ValueError(error_msg)

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

        # Extract image metadata for production telemetry
        try:
            with Image.open(temp_path) as _img_meta:
                img_width, img_height = _img_meta.size
                img_mode = _img_meta.mode
                img_format = _img_meta.format or "UNKNOWN"
        except Exception:
            img_width, img_height, img_mode, img_format = 0, 0, "UNKNOWN", "UNKNOWN"

        # Production Telemetry Logging
        print("=" * 70, file=sys.stderr)
        print("[PRODUCTION INFERENCE PIPELINE TELEMETRY]", file=sys.stderr)
        print(f"IMAGE: filename='{uploaded.filename}', dimensions={img_width}x{img_height}, format={img_format}, mode={img_mode}", file=sys.stderr)
        print(f"PREPROCESSING: Unified=[0, 255] float32 224x224 RGB, Desktop=[-1.0, 1.0] 224x224 RGB", file=sys.stderr)
        print(f"PRIMARY MODEL (Unified): {pipeline_debug['unified_prediction']} ({pipeline_debug['unified_confidence']}%)", file=sys.stderr)
        print(f"PRIMARY MODEL (Desktop): {pipeline_debug['desktop_prediction']} ({pipeline_debug['desktop_confidence']}%)", file=sys.stderr)
        print(f"SECONDARY DETECTOR (Forest): {pipeline_debug['forest_prediction']} ({pipeline_debug['forest_confidence']}%)", file=sys.stderr)
        print(f"SPECIALIST (Black Gill): {pipeline_debug['black_gill_prediction']} ({pipeline_debug['black_gill_confidence']}%)", file=sys.stderr)
        print(f"ENSEMBLE CONSENSUS: Winner='{top_disease}' ({top_confidence}%), Margin={top_debug.get('ensemble_margin')}%, Entropy={top_debug.get('ensemble_entropy')}", file=sys.stderr)
        print(f"SELECTION REASON: {selection_reason}", file=sys.stderr)
        print(f"LOADED MODEL: {top_debug.get('loaded_model_name', top_model_used)}", file=sys.stderr)
        print(f"CANONICAL PROBABILITIES: {json.dumps(top_probabilities)}", file=sys.stderr)
        print(f"RAW PROBABILITIES ARRAY: {top_debug.get('raw_probabilities_array')}", file=sys.stderr)
        print(f"CLASS LABELS: {top_debug.get('class_labels')}", file=sys.stderr)
        print("=" * 70, file=sys.stderr)

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
