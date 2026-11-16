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

try:
    from quality_validator import detect_cooked_orange_shrimp
except ImportError:
    from .quality_validator import detect_cooked_orange_shrimp

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
MODELS_DIR = SCRIPT_DIR.parent / "models"
MODEL_PATH = MODELS_DIR / "shrimp_presence_model.joblib"
ONNX_PATH = MODELS_DIR / "mobilenetv2-7.onnx"

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

DECAPOD_CLASSES = [112, 118, 119, 120, 121, 122, 123, 124, 125, 126]
TECH_CLASSES = [487, 508, 527, 590, 620, 664, 673, 681, 782, 810, 878, 916]
DOC_FURNITURE_CLASSES = [446, 478, 526, 549, 649, 695, 909, 921]
HUMAN_CLOTHING_CLASSES = [
    400, 411, 419, 424, 425, 434, 435, 445, 452, 457, 459, 460, 474, 501, 502,
    514, 515, 516, 529, 560, 567, 579, 582, 585, 592, 593, 608, 610, 611, 614,
    615, 629, 630, 631, 643, 652, 655, 658, 668, 676, 677, 680, 692, 697, 734,
    747, 748, 756, 770, 773, 777, 780, 796, 799, 805, 806, 828, 834, 837, 838,
    841, 842, 851, 855, 869, 888, 902, 983
]
VEHICLE_CLASSES = [
    403, 407, 436, 444, 468, 475, 479, 511, 555, 569, 573, 575, 627, 654, 656,
    665, 670, 671, 675, 705, 717, 734, 751, 817, 829, 864, 866, 867, 895
]

DOG_CLASSES = set(range(151, 269))
CAT_CLASSES = set(range(281, 294))
WILD_CARNIVORES = set(range(269, 281))
BEARS = set(range(294, 298))
FARM_UNGULATE_CLASSES = set(range(339, 356))
ELEPHANTS = {101, 385, 386}
PRIMATES = set(range(365, 385))
RODENTS_RABBITS = set(range(330, 339))
OTHER_MAMMALS = set(range(356, 365)) | {387, 388}
BIRDS = (set(range(7, 21)) | set(range(22, 25)) | set(range(80, 101)) | set(range(127, 139)) | set(range(140, 151)))
REPTILES = set(range(25, 72))
INSECTS_ARACHNIDS = set(range(72, 80)) | set(range(300, 330))


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
        self._last_probs = None
        self.class_index = self._load_class_index()

    def _load_class_index(self) -> dict:
        idx_path = MODELS_DIR / "imagenet_class_index.json"
        if idx_path.exists():
            try:
                with open(idx_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def get_class_name(self, idx: int) -> str:
        entry = self.class_index.get(str(idx))
        if entry and len(entry) >= 2:
            return entry[1].replace("_", " ").title()
        return f"Class {idx}"

    @classmethod
    def get_instance(cls) -> ShrimpPresenceValidator:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def extract_features(self, img_bgr: np.ndarray | None) -> np.ndarray | None:
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
        outputs = self.session.run([self.output_name], {self.input_name: arr})
        logits = np.asarray(outputs[0])[0]
        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / np.sum(exp_logits)
        self._last_probs = probs

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

    def validate(self, img_bgr: np.ndarray | None) -> dict:
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
                "is_crayfish": False,
                "content_category": "Invalid",
            }

        # Check semantic non-shrimp categories first (humans, animals, vehicles, tech, documents)
        skin_ratio = float(feat[10])
        rectilinear_ratio = float(feat[8])
        paper_doc_ratio = float(feat[15])

        probs = self._last_probs
        if probs is not None:
            top1 = int(np.argmax(probs))
            top1_prob = float(probs[top1])
            p_decapod = float(np.sum(probs[DECAPOD_CLASSES]))

            p_elephant = float(np.sum([probs[i] for i in ELEPHANTS]))
            p_dog = float(np.sum([probs[i] for i in DOG_CLASSES]))
            p_cat = float(np.sum([probs[i] for i in CAT_CLASSES]))
            p_farm = float(np.sum([probs[i] for i in FARM_UNGULATE_CLASSES]))

            # 1. Humans / People (Tao)
            p_human_full = float(np.sum([probs[c] for c in HUMAN_CLOTHING_CLASSES if c < len(probs)]))
            is_human = False
            if p_decapod < 0.03 and p_elephant < 0.25 and p_dog < 0.35 and p_cat < 0.35 and p_farm < 0.35:
                if p_human_full >= 0.20 or (top1 in HUMAN_CLOTHING_CLASSES and top1_prob >= 0.15):
                    is_human = True
                elif skin_ratio >= 0.14 and p_human_full >= 0.08:
                    is_human = True
                elif skin_ratio >= 0.20 and p_human_full >= 0.05 and p_decapod < 0.01:
                    is_human = True

            # 2. Non-shrimp Animals (Elephants, Dogs, Cats, Cattle, Birds, etc.)
            p_primate = float(np.sum([probs[i] for i in PRIMATES]))
            p_carnivore = float(np.sum([probs[i] for i in WILD_CARNIVORES]))
            p_bear = float(np.sum([probs[i] for i in BEARS]))
            p_bird = float(np.sum([probs[i] for i in BIRDS]))
            p_reptile = float(np.sum([probs[i] for i in REPTILES]))
            p_rodent = float(np.sum([probs[i] for i in RODENTS_RABBITS]))
            p_other_mammals = float(np.sum([probs[i] for i in OTHER_MAMMALS]))
            p_insect = float(np.sum([probs[i] for i in INSECTS_ARACHNIDS]))

            is_animal = False
            if p_decapod < 0.05 and not is_human:
                if p_elephant >= 0.35 or (top1 in ELEPHANTS and top1_prob >= 0.25):
                    is_animal = True
                elif p_dog >= 0.65 or (top1 in DOG_CLASSES and top1_prob >= 0.40 and p_dog >= 0.50):
                    is_animal = True
                elif p_cat >= 0.65 or (top1 in CAT_CLASSES and top1_prob >= 0.40 and p_cat >= 0.50):
                    is_animal = True
                elif p_farm >= 0.50 or (top1 in FARM_UNGULATE_CLASSES and top1_prob >= 0.40 and p_farm >= 0.45):
                    is_animal = True
                elif p_primate >= 0.55 or (top1 in PRIMATES and top1_prob >= 0.40 and p_primate >= 0.45):
                    is_animal = True
                elif p_carnivore >= 0.55 or (top1 in WILD_CARNIVORES and top1_prob >= 0.40 and p_carnivore >= 0.45):
                    is_animal = True
                elif p_bear >= 0.55 or (top1 in BEARS and top1_prob >= 0.40 and p_bear >= 0.45):
                    is_animal = True
                elif p_bird >= 0.65 or (top1 in BIRDS and top1_prob >= 0.45 and p_bird >= 0.55):
                    is_animal = True
                elif p_reptile >= 0.60 or (top1 in REPTILES and top1_prob >= 0.45 and p_reptile >= 0.55):
                    is_animal = True
                elif p_rodent >= 0.55 or (top1 in RODENTS_RABBITS and top1_prob >= 0.40 and p_rodent >= 0.45):
                    is_animal = True
                elif p_other_mammals >= 0.55 or (top1 in OTHER_MAMMALS and top1_prob >= 0.40 and p_other_mammals >= 0.45):
                    is_animal = True
                elif p_insect >= 0.60 or (top1 in INSECTS_ARACHNIDS and top1_prob >= 0.45 and p_insect >= 0.55):
                    is_animal = True

            # 3. Vehicles
            p_vehicle = float(np.sum([probs[c] for c in VEHICLE_CLASSES if c < len(probs)]))
            is_vehicle = False
            if p_decapod < 0.03 and not is_human and not is_animal:
                if p_vehicle >= 0.35 or (top1 in VEHICLE_CLASSES and top1_prob >= 0.25):
                    is_vehicle = True

            # 4. Electronic Devices / Keyboards / Screens
            p_tech_full = float(np.sum([probs[c] for c in TECH_CLASSES if c < len(probs)]))
            is_tech = False
            if p_decapod < 0.03 and not is_human and not is_animal and not is_vehicle:
                if p_tech_full >= 0.35 or (top1 in TECH_CLASSES and top1_prob >= 0.25) or rectilinear_ratio >= 0.78:
                    is_tech = True

            # 5. Documents / Paper Text
            is_doc = False
            if p_decapod < 0.03 and not is_human and not is_animal and not is_vehicle and not is_tech:
                if paper_doc_ratio >= 0.55:
                    is_doc = True

            if is_human or is_animal or is_vehicle or is_tech or is_doc:
                category_name = (
                    "Person / Human" if is_human else (
                        "Non-Shrimp Animal" if is_animal else (
                            "Vehicle" if is_vehicle else (
                                "Electronic Device" if is_tech else "Document"
                            )
                        )
                    )
                )
                rejection_msg = (
                    "No shrimp detected. Person or human detected. Only real shrimp can be scanned for disease diagnosis."
                    if is_human else (
                        "No shrimp detected. Non-shrimp animal detected. Only real shrimp can be scanned for disease diagnosis."
                        if is_animal else (
                            "No shrimp detected. Vehicle or transport detected. Only real shrimp can be scanned for disease diagnosis."
                            if is_vehicle else (
                                "No shrimp detected. Electronic device or keyboard detected. Only real shrimp can be scanned for disease diagnosis."
                                if is_tech else
                                "No shrimp detected. Paper document detected. Only real shrimp can be scanned for disease diagnosis."
                            )
                        )
                    )
                )
                return {
                    "shrimp_detected": False,
                    "presence_state": "no_shrimp",
                    "status": "No Shrimp Detected",
                    "display_status": "No Shrimp Detected",
                    "predicted_class": category_name,
                    "confidence": 100.0,
                    "probability_shrimp": 0.0,
                    "message": rejection_msg,
                    "is_cooked": False,
                    "is_crayfish": False,
                    "content_category": category_name,
                }

        # Check for cooked shrimp only after ruling out humans, animals, vehicles, and electronics
        if skin_ratio < 0.16 and detect_cooked_orange_shrimp(img_bgr):
            return {
                "shrimp_detected": True,
                "is_cooked": True,
                "valid_shrimp_present": False,
                "presence_state": "cooked_shrimp",
                "status": "cooked_shrimp",
                "display_status": "Unavailable to scan: Cooked Shrimp",
                "predicted_class": "Cooked Shrimp",
                "confidence": 98.0,
                "probability_shrimp": 0.98,
                "message": "Shrimp was detected, but it appears to be cooked. Please upload raw uncooked shrimp for diagnosis.",
                "is_crayfish": False,
                "content_category": "Cooked Shrimp",
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
                message = "Laptop or computer keyboard detected. Only real shrimp can be scanned for disease diagnosis."
            elif skin_ratio > 0.50 and non_skin_edges < 0.015:
                content_category = "Human Hand"
                message = "Human hand detected without any shrimp. Only real shrimp can be scanned for disease diagnosis."
            elif paper_ratio > 0.55:
                content_category = "Document"
                message = "Paper document or printed text detected. Only real shrimp can be scanned for disease diagnosis."
            else:
                content_category = "Background / Object"
                message = "No shrimp detected in the image. Only real shrimp can be scanned for disease diagnosis."
        else:
            presence_state = "uncertain"
            shrimp_detected = False
            predicted_class = "Uncertain"
            status = "Uncertain"
            confidence = round(max(prob_shrimp, 1.0 - prob_shrimp) * 100.0, 2)
            content_category = "Uncertain"
            message = "Unable to Identify Shrimp. Please Retake or Upload a Clearer Image."

        return {
            "shrimp_detected": shrimp_detected,
            "presence_state": presence_state,
            "status": status,
            "display_status": "Ready for Scan" if shrimp_detected else ("Unable to Identify Shrimp. Please Retake or Upload a Clearer Image." if presence_state == "uncertain" else "No Shrimp Detected"),
            "predicted_class": predicted_class,
            "confidence": confidence,
            "probability_shrimp": round(prob_shrimp, 4),
            "message": message,
            "is_cooked": False,
            "is_crayfish": False,
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
        if img_bgr is None:
            return {
                "shrimp_detected": False,
                "presence_state": "no_shrimp",
                "status": "No Shrimp Detected",
                "display_status": "No Shrimp Detected",
                "predicted_class": "Invalid",
                "confidence": 0.0,
                "probability_shrimp": 0.0,
                "message": "Invalid or unreadable image file.",
                "is_cooked": False,
                "is_crayfish": False,
                "content_category": "Invalid",
            }

    validator = ShrimpPresenceValidator.get_instance()
    return validator.validate(img_bgr)
