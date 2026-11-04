"""Content Validator for ShrimPredict Detection Pipeline.

Uses the trained Machine Learning Shrimp Presence Classifier (Stage 1) to accurately
distinguish real shrimp images from non-shrimp objects (laptops, keyboards, screens,
hands only, tables, documents, water probes, backgrounds).
"""

from __future__ import annotations

from pathlib import Path
import json
import joblib
import numpy as np
import cv2
import onnxruntime as ort

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
MODELS_DIR = SCRIPT_DIR.parent / "models"
MODEL_PATH = MODELS_DIR / "shrimp_presence_model.joblib"
ONNX_PATH = MODELS_DIR / "mobilenetv2-7.onnx"

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

DECAPOD_CLASSES = [118, 119, 120, 121, 122, 123, 124, 125, 112]
TECH_CLASSES = [487, 508, 527, 590, 620, 664, 673, 681, 782, 810, 878, 916]
DOC_FURNITURE_CLASSES = [446, 478, 526, 549, 649, 695, 909, 921]
HUMAN_CLOTHING_CLASSES = [608, 611, 834, 855]


class ShrimpPresenceValidator:
    _instance = None

    def __init__(self):
        if not ONNX_PATH.exists():
            raise FileNotFoundError(f"MobileNetV2 model not found at {ONNX_PATH}")
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Trained presence classifier not found at {MODEL_PATH}")

        self.session = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

        artifact = joblib.load(MODEL_PATH)
        self.scaler = artifact["scaler"]
        self.model = artifact["model"]
        self.thresholds = artifact.get("thresholds", {
            "shrimp_detected_min": 0.65,
            "no_shrimp_max": 0.35,
        })

    @classmethod
    def get_instance(cls) -> ShrimpPresenceValidator:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def extract_features(self, img_bgr: np.ndarray) -> np.ndarray | None:
        if img_bgr is None or img_bgr.size == 0 or img_bgr.ndim != 3:
            return None
        h, w = img_bgr.shape[:2]
        if h < 20 or w < 20:
            return None

        # Resize to 320x320 for lightning-fast morphology analysis
        img_small = cv2.resize(img_bgr, (320, 320), interpolation=cv2.INTER_AREA)

        # 1. Deep Semantic Features
        rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (224, 224), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255.0
        arr = resized.transpose(2, 0, 1)[np.newaxis, ...]
        arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
        logits = self.session.run([self.output_name], {self.input_name: arr})[0][0]
        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / np.sum(exp_logits)

        p_decapod = float(np.sum(probs[DECAPOD_CLASSES]))
        p_tech = float(np.sum(probs[TECH_CLASSES]))
        p_doc_furniture = float(np.sum(probs[DOC_FURNITURE_CLASSES]))
        p_human = float(np.sum(probs[HUMAN_CLOTHING_CLASSES]))
        top1_prob = float(np.max(probs))
        decapod_vs_tech = (p_decapod + 1e-4) / (p_tech + 1e-4)

        # 2. Structural Lines
        gray = cv2.cvtColor(img_small, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 40, 130)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=25, minLineLength=18, maxLineGap=5)
        total_lines = 0
        rectilinear_lines = 0
        if lines is not None and len(lines) > 0:
            lines = lines.reshape(-1, 4)
            dx = lines[:, 2] - lines[:, 0]
            dy = lines[:, 3] - lines[:, 1]
            angles = np.abs(np.arctan2(dy, dx) * (180.0 / np.pi))
            rectilinear_lines = int(np.count_nonzero((angles < 15) | (angles > 165) | ((angles > 75) & (angles < 105))))
            total_lines = len(lines)

        rectilinear_ratio = float(rectilinear_lines / max(1, total_lines))
        edge_density = float(np.count_nonzero(edges) / (320 * 320))

        # 3. Skin Detection & Isolation
        hsv = cv2.cvtColor(img_small, cv2.COLOR_BGR2HSV)
        skin_mask = cv2.inRange(hsv, np.array([0, 30, 60], dtype=np.uint8), np.array([25, 200, 255], dtype=np.uint8))
        skin_ratio = float(np.count_nonzero(skin_mask) / (320 * 320))

        non_skin_mask = cv2.bitwise_not(skin_mask)
        non_skin_edges = cv2.bitwise_and(edges, edges, mask=non_skin_mask)
        non_skin_edge_density = float(np.count_nonzero(non_skin_edges) / (320 * 320))
        specimen_to_hand_ratio = float(non_skin_edge_density / (skin_ratio + 1e-3))

        # 4. Color Distribution & Pigment
        sat = hsv[:, :, 1] / 255.0
        val = hsv[:, :, 2] / 255.0
        hue = hsv[:, :, 0]

        shrimp_pigment = (
            (sat >= 0.10) & (sat <= 0.75)
            & (val >= 0.15) & (val <= 0.88)
            & ((hue <= 35) | (hue >= 140))
        )
        shrimp_pigment_ratio = float(np.mean(shrimp_pigment))

        dark_keycap = (val < 0.28) & (sat < 0.25)
        dark_keycap_ratio = float(np.mean(dark_keycap))

        paper_doc = (sat < 0.10) & (val > 0.75)
        paper_doc_ratio = float(np.mean(paper_doc))

        chitin_glint = (val > 0.88) & (sat < 0.35)
        chitin_glint_ratio = float(np.mean(chitin_glint))

        mean_val = float(np.mean(val))
        std_val = float(np.std(val))
        mean_sat = float(np.mean(sat))
        std_sat = float(np.std(sat))

        # 5. Morphology & Curvature
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        min_area = (320 * 320) * 0.012
        large_contours = [c for c in contours if cv2.contourArea(c) > min_area]

        max_aspect = 1.0
        max_curvature_deficiency = 0.0
        max_contour_extent = 0.0

        for c in large_contours[:8]:
            area = cv2.contourArea(c)
            hull = cv2.convexHull(c)
            hull_area = cv2.contourArea(hull)
            if hull_area > 0:
                deficiency = (hull_area - area) / hull_area
                max_curvature_deficiency = max(max_curvature_deficiency, deficiency)
            rect = cv2.minAreaRect(c)
            bw, bh = rect[1]
            if min(bw, bh) > 0:
                aspect = max(bw, bh) / min(bw, bh)
                max_aspect = max(max_aspect, aspect)
            x, y, cw, ch = cv2.boundingRect(c)
            if cw * ch > 0:
                extent = area / (cw * ch)
                max_contour_extent = max(max_contour_extent, extent)

        return np.array([
            p_decapod,
            p_tech,
            p_doc_furniture,
            p_human,
            top1_prob,
            decapod_vs_tech,
            float(total_lines),
            float(rectilinear_lines),
            rectilinear_ratio,
            edge_density,
            skin_ratio,
            non_skin_edge_density,
            specimen_to_hand_ratio,
            shrimp_pigment_ratio,
            dark_keycap_ratio,
            paper_doc_ratio,
            chitin_glint_ratio,
            mean_val,
            std_val,
            mean_sat,
            std_sat,
            max_aspect,
            max_curvature_deficiency,
            max_contour_extent,
        ], dtype=np.float32)

    def validate(self, img_bgr: np.ndarray) -> dict:
        feat = self.extract_features(img_bgr)
        if feat is None:
            return {
                "shrimp_detected": False,
                "presence_state": "no_shrimp",
                "status": "No Shrimp Detected",
                "predicted_class": "No Shrimp",
                "confidence": 0.0,
                "probability_shrimp": 0.0,
                "message": "Invalid or unreadable image file.",
                "is_cooked": False,
                "content_category": "Invalid",
            }

        feat_scaled = self.scaler.transform([feat])
        prob_shrimp = float(self.model.predict_proba(feat_scaled)[0, 1])

        # Feature signals
        p_tech = float(feat[1])
        rectilinear_ratio = float(feat[8])
        skin_ratio = float(feat[10])
        non_skin_edges = float(feat[11])
        paper_ratio = float(feat[15])

        # Three-tier outcome determination
        shrimp_min = self.thresholds.get("shrimp_detected_min", 0.65)
        no_shrimp_max = self.thresholds.get("no_shrimp_max", 0.35)

        if prob_shrimp >= shrimp_min:
            presence_state = "shrimp_detected"
            shrimp_detected = True
            predicted_class = "Shrimp"
            status = "Shrimp Detected"
            confidence = round(prob_shrimp * 100.0, 2)
            content_category = "Shrimp"
            message = "Shrimp successfully detected."
        elif prob_shrimp <= no_shrimp_max:
            presence_state = "no_shrimp"
            shrimp_detected = False
            predicted_class = "No Shrimp"
            status = "No Shrimp Detected"
            confidence = round((1.0 - prob_shrimp) * 100.0, 2)
            if p_tech > 0.40 or rectilinear_ratio > 0.80:
                content_category = "Laptop / Computer"
                message = "Laptop or computer keyboard detected. No shrimp detected."
            elif skin_ratio > 0.50 and non_skin_edges < 0.015:
                content_category = "Human Hand"
                message = "Human hand detected without any shrimp. No shrimp detected."
            elif paper_ratio > 0.55:
                content_category = "Document"
                message = "Paper document or printed text detected. No shrimp detected."
            else:
                content_category = "Background / Object"
                message = "No shrimp detected in the image."
        else:
            presence_state = "uncertain"
            shrimp_detected = False
            predicted_class = "Uncertain"
            status = "Uncertain"
            confidence = round(max(prob_shrimp, 1.0 - prob_shrimp) * 100.0, 2)
            content_category = "Uncertain"
            message = "Unable to Identify Shrimp. Please Retake or Upload a Clearer Image."

        # Check for cooked shrimp only if shrimp is positively identified
        is_cooked = False
        if shrimp_detected:
            hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
            skin_m = cv2.inRange(hsv, np.array([0, 30, 60], dtype=np.uint8), np.array([25, 190, 255], dtype=np.uint8))
            non_skin = cv2.bitwise_not(skin_m)
            orange_m = cv2.inRange(hsv, np.array([5, 140, 120], dtype=np.uint8), np.array([22, 255, 255], dtype=np.uint8))
            cooked_in_specimen = cv2.bitwise_and(orange_m, orange_m, mask=non_skin)
            specimen_area = np.count_nonzero(non_skin)
            cooked_area = np.count_nonzero(cooked_in_specimen)
            cooked_ratio = cooked_area / max(1, specimen_area)
            if cooked_ratio >= 0.55:
                is_cooked = True
                content_category = "Cooked Shrimp"
                message = "Shrimp was detected, but it appears to be cooked."

        return {
            "shrimp_detected": shrimp_detected,
            "presence_state": presence_state,
            "status": status,
            "predicted_class": predicted_class,
            "confidence": confidence,
            "probability_shrimp": round(prob_shrimp, 4),
            "message": message,
            "is_cooked": is_cooked,
            "content_category": content_category,
        }


def validate_image_content(image_input) -> dict:
    if isinstance(image_input, np.ndarray):
        img_bgr = image_input
    else:
        path_obj = Path(image_input)
        if not path_obj.exists():
            raise FileNotFoundError(f"Image not found: {image_input}")
        img_bgr = cv2.imread(str(path_obj))

    validator = ShrimpPresenceValidator.get_instance()
    return validator.validate(img_bgr)
