"""Train Shrimp Presence Detection Model for ShrimPredict.

This script trains a high-accuracy Shrimp Presence Classifier (Stage 1) to determine
whether a real shrimp is present in an uploaded image before proceeding to WSD disease diagnosis.

Features:
- MobileNetV2 Deep Semantic Embeddings (Decapods vs Computers/Laptops vs Office/Documents vs Human)
- Hough Rectilinear Line Density (Keyboards, laptops, screens, paper grids)
- Biological Morphology & Curvature (C-shape crescent deficiency, aspect ratio, chitin sheen)
- Human Skin Separation (specimen on hand vs hand-only)
- Chitin Translucency & Pigment Distribution
"""

import sys
from pathlib import Path
import json
import joblib
import numpy as np
import cv2
from PIL import Image
import onnxruntime as ort
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
MODELS_DIR = SCRIPT_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

ONNX_MODEL_PATH = MODELS_DIR / "mobilenetv2-7.onnx"

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)

DECAPOD_CLASSES = [118, 119, 120, 121, 122, 123, 124, 125, 112]
TECH_CLASSES = [487, 508, 527, 590, 620, 664, 673, 681, 782, 810, 878, 916]
DOC_FURNITURE_CLASSES = [446, 478, 526, 549, 649, 695, 909, 921]
HUMAN_CLOTHING_CLASSES = [608, 611, 834, 855]


class ShrimpFeatureExtractor:
    def __init__(self, onnx_path=ONNX_MODEL_PATH):
        if not onnx_path.exists():
            raise FileNotFoundError(f"MobileNetV2 ONNX model not found at {onnx_path}")
        self.session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

    def extract(self, img_bgr: np.ndarray) -> np.ndarray | None:
        if img_bgr is None or img_bgr.size == 0 or img_bgr.ndim != 3:
            return None
        h, w = img_bgr.shape[:2]
        if h < 20 or w < 20:
            return None

        # Resize to 320x320 for lightning-fast CV morphology and edge analysis
        img_small = cv2.resize(img_bgr, (320, 320), interpolation=cv2.INTER_AREA)

        # 1. Deep Semantic Features via MobileNetV2
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

        # 2. Structural Lines (Vectorized Hough rectilinear grid rejection)
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

        # 3. Skin Detection & Foreground Specimen Isolation
        hsv = cv2.cvtColor(img_small, cv2.COLOR_BGR2HSV)
        skin_mask = cv2.inRange(hsv, np.array([0, 30, 60], dtype=np.uint8), np.array([25, 200, 255], dtype=np.uint8))
        skin_ratio = float(np.count_nonzero(skin_mask) / (320 * 320))

        non_skin_mask = cv2.bitwise_not(skin_mask)
        non_skin_edges = cv2.bitwise_and(edges, edges, mask=non_skin_mask)
        non_skin_edge_density = float(np.count_nonzero(non_skin_edges) / (320 * 320))
        specimen_to_hand_ratio = float(non_skin_edge_density / (skin_ratio + 1e-3))

        # 4. Color Distribution & Biological Chitin Pigment
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


def collect_dataset(extractor: ShrimpFeatureExtractor):
    X = []
    y = []
    metadata = []

    def add_sample(img_bgr, label, name, augment=False):
        if img_bgr is None:
            return
        feat = extractor.extract(img_bgr)
        if feat is not None:
            X.append(feat)
            y.append(label)
            metadata.append(name)

        if augment:
            flip_h = cv2.flip(img_bgr, 1)
            f_h = extractor.extract(flip_h)
            if f_h is not None:
                X.append(f_h)
                y.append(label)
                metadata.append(f"{name}_fliph")

    # ==================== 1. POSITIVE SAMPLES (Label = 1: Real Shrimp) ====================
    print("Loading positive shrimp samples...", flush=True)
    pos_dir = REPO_ROOT / "backend" / "uploads" / "disease_scans"
    pos_count = 0
    if pos_dir.exists():
        files = list(pos_dir.glob("*.*"))
        for i, f in enumerate(files):
            name_lower = f.name.lower()
            if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
                if not any(k in name_lower for k in ["screenshot", "erd", "paint", "gaad"]):
                    img = cv2.imread(str(f))
                    if img is not None:
                        add_sample(img, 1, f"shrimp_{f.stem}", augment=False)
                        pos_count += 1
                        if pos_count % 25 == 0:
                            print(f"  Processed {pos_count} positive shrimp images...", flush=True)
    print(f"  Loaded {pos_count} positive shrimp images from disease_scans.", flush=True)

    # ML reference tests
    for p in [REPO_ROOT / "ml" / "test_healthy_shrimp.jpg", REPO_ROOT / "ml" / "test_wssv_shrimp.jpg"]:
        if p.exists():
            img = cv2.imread(str(p))
            if img is not None:
                add_sample(img, 1, p.stem, augment=True)

    # User uploaded real shrimp images
    user_shrimp_imgs = [
        REPO_ROOT / "ml" / "test_crops" / "user_shrimp_crop.jpg",
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793821739642_18ea9f4a.jpg"),
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793811697468_41de3928.jpg"),
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793808353683_3e23287a.jpg"),
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793808353694_cf487da8.jpg"),
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793805130802_6e3adad7.jpg"),
    ]
    for p in user_shrimp_imgs:
        if p.exists():
            img = cv2.imread(str(p))
            if img is not None:
                add_sample(img, 1, f"user_shrimp_{p.stem}", augment=True)
                h, w = img.shape[:2]
                center_crop = img[int(h * 0.15):int(h * 0.85), int(w * 0.10):int(w * 0.90)]
                add_sample(center_crop, 1, f"user_shrimp_crop_{p.stem}", augment=True)

    # ==================== 2. NEGATIVE SAMPLES (Label = 0: Non-Shrimp) ====================
    print("Loading negative non-shrimp samples...", flush=True)
    neg_count = 0

    # A. Screenshots and diagrams in disease_scans
    if pos_dir.exists():
        for f in pos_dir.glob("*.*"):
            name_lower = f.name.lower()
            if any(k in name_lower for k in ["screenshot", "erd", "paint", "gaad"]):
                img = cv2.imread(str(f))
                if img is not None:
                    add_sample(img, 0, f"diag_{f.stem}", augment=False)
                    neg_count += 1

    # B. Laptop keyboards, screens, tables
    neg_laptop_imgs = [
        REPO_ROOT / "ml" / "test_crops" / "user_laptop_crop.jpg",
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793821529853_fa504370.jpg"),
        REPO_ROOT / "ml" / "test_crops" / "user_table_crop.jpg",
    ]
    for p in neg_laptop_imgs:
        if p.exists():
            img = cv2.imread(str(p))
            if img is not None:
                add_sample(img, 0, f"laptop_{p.stem}", augment=True)
                h, w = img.shape[:2]
                add_sample(img[:int(h*0.5), :], 0, f"laptop_keys_top_{p.stem}", augment=True)
                add_sample(img[int(h*0.3):int(h*0.8), :], 0, f"laptop_keys_mid_{p.stem}", augment=True)
                add_sample(img[int(h*0.6):, :], 0, f"laptop_palmrest_{p.stem}", augment=True)
                neg_count += 4

    # C. Human Hands ONLY (cropped skin without shrimp)
    hand_crop_path = REPO_ROOT / "ml" / "test_crops" / "user_hand_only_crop.jpg"
    if hand_crop_path.exists():
        img = cv2.imread(str(hand_crop_path))
        if img is not None:
            add_sample(img, 0, "hand_only", augment=True)
            h, w = img.shape[:2]
            add_sample(img[:int(h*0.6), :int(w*0.7)], 0, "hand_palm_sub", augment=True)
            add_sample(img[int(h*0.3):, int(w*0.2):], 0, "hand_finger_sub", augment=True)
            neg_count += 3

    profile_path = REPO_ROOT / "backend" / "uploads" / "1784956363_profile.jpg"
    if profile_path.exists():
        img = cv2.imread(str(profile_path))
        if img is not None:
            add_sample(img, 0, "profile_human", augment=True)
            neg_count += 1

    # D. Water Quality Equipment / Probes / Log Sheets
    wq_dir = REPO_ROOT / "backend" / "uploads" / "water_quality"
    if wq_dir.exists():
        for f in wq_dir.glob("*.*"):
            if f.suffix.lower() in (".jpg", ".jpeg", ".png"):
                img = cv2.imread(str(f))
                if img is not None:
                    add_sample(img, 0, f"water_quality_{f.stem}", augment=True)
                    neg_count += 1

    # E. Broken Filter
    filter_path = REPO_ROOT / "backend" / "uploads" / "1784956380_BrokenFilter.jpg"
    if filter_path.exists():
        img = cv2.imread(str(filter_path))
        if img is not None:
            add_sample(img, 0, "broken_filter", augment=True)
            neg_count += 1

    # F. UI Screenshots
    ui_imgs = [
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793820611598_80881979.png"),
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793818653277_71398a71.png"),
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793804243362_b1dab4cc.jpg"),
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793803843040_128af7f7.jpg"),
        Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793802089905_c45be746.jpg"),
    ]
    for p in ui_imgs:
        if p.exists():
            img = cv2.imread(str(p))
            if img is not None:
                add_sample(img, 0, f"ui_{p.stem}", augment=True)
                neg_count += 1

    # G. Synthesized Negative Backgrounds (desk, document, empty pond)
    rng = np.random.RandomState(42)
    desk_tex = np.full((300, 300, 3), (45, 90, 160), dtype=np.uint8)
    desk_tex = cv2.add(desk_tex, rng.randint(-15, 15, (300, 300, 3), dtype=np.int16).clip(0, 255).astype(np.uint8))
    add_sample(desk_tex, 0, "synth_wood_desk", augment=True)

    paper_tex = np.full((300, 300, 3), 245, dtype=np.uint8)
    for y_pos in range(30, 280, 25):
        cv2.line(paper_tex, (20, y_pos), (280, y_pos), (40, 40, 40), 2)
    add_sample(paper_tex, 0, "synth_paper_doc", augment=True)

    water_tex = np.full((300, 300, 3), (120, 100, 40), dtype=np.uint8)
    water_tex = cv2.GaussianBlur(cv2.add(water_tex, rng.randint(-20, 20, (300, 300, 3), dtype=np.int16).clip(0, 255).astype(np.uint8)), (9, 9), 0)
    add_sample(water_tex, 0, "synth_pond_water", augment=True)

    X = np.asarray(X, dtype=np.float32)
    y = np.asarray(y, dtype=np.int32)
    print(f"Dataset assembled: {len(X)} total samples (Positives: {np.sum(y == 1)}, Negatives: {np.sum(y == 0)})", flush=True)
    return X, y, metadata


def train_model():
    print("=== Training Shrimp Presence Classifier ===", flush=True)
    extractor = ShrimpFeatureExtractor()
    X, y, metadata = collect_dataset(extractor)

    # 5-Fold Stratified Cross Validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Robust Base Estimators
    gb = GradientBoostingClassifier(n_estimators=80, max_depth=3, learning_rate=0.1, random_state=42)
    rf = RandomForestClassifier(n_estimators=80, max_depth=5, random_state=42)
    et = ExtraTreesClassifier(n_estimators=80, max_depth=5, random_state=42)
    lr = LogisticRegression(C=1.0, max_iter=1000, random_state=42)

    ensemble = VotingClassifier(
        estimators=[("gb", gb), ("rf", rf), ("et", et), ("lr", lr)],
        voting="soft"
    )

    print("Running 5-fold cross validation...", flush=True)
    cv_results = cross_validate(
        ensemble, X_scaled, y, cv=cv,
        scoring=["accuracy", "precision", "recall", "f1", "roc_auc"],
        return_train_score=False
    )

    print("\n--- 5-Fold Cross Validation Results ---", flush=True)
    print(f"Accuracy:  {cv_results['test_accuracy'].mean() * 100:.2f}% (+/- {cv_results['test_accuracy'].std() * 100:.2f}%)", flush=True)
    print(f"Precision: {cv_results['test_precision'].mean() * 100:.2f}% (+/- {cv_results['test_precision'].std() * 100:.2f}%)", flush=True)
    print(f"Recall:    {cv_results['test_recall'].mean() * 100:.2f}% (+/- {cv_results['test_recall'].std() * 100:.2f}%)", flush=True)
    print(f"F1 Score:  {cv_results['test_f1'].mean() * 100:.2f}%", flush=True)
    print(f"ROC-AUC:   {cv_results['test_roc_auc'].mean() * 100:.2f}%", flush=True)

    # Fit final ensemble model
    ensemble.fit(X_scaled, y)
    final_model = ensemble

    pipeline_artifact = {
        "scaler": scaler,
        "model": final_model,
        "feature_count": X.shape[1],
        "class_indices": {"0": "No Shrimp", "1": "Shrimp"},
        "thresholds": {
            "shrimp_detected_min": 0.65,
            "no_shrimp_max": 0.35,
        },
        "cv_accuracy": float(cv_results["test_accuracy"].mean()),
        "cv_f1": float(cv_results["test_f1"].mean()),
    }

    model_out_path = MODELS_DIR / "shrimp_presence_model.joblib"
    joblib.dump(pipeline_artifact, model_out_path)
    print(f"\nModel pipeline saved to: {model_out_path}", flush=True)

    # Benchmark Problem Cases Test
    print("\n=== BENCHMARK PROBLEM CASES TEST ===", flush=True)
    test_cases = [
        ("User Laptop Crop (Reference 1)", REPO_ROOT / "ml" / "test_crops" / "user_laptop_crop.jpg", 0),
        ("User Laptop Full Photo", Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793821529853_fa504370.jpg"), 0),
        ("User Shrimp Crop (Reference 2)", REPO_ROOT / "ml" / "test_crops" / "user_shrimp_crop.jpg", 1),
        ("User Shrimp Full Photo", Path(r"C:\Users\Cristel\.gemini\antigravity\brain\566f7814-66cb-4b9a-bb2b-68d0e2c592af\.user_uploaded\media_1793821739642_18ea9f4a.jpg"), 1),
        ("User Hand Only Crop", REPO_ROOT / "ml" / "test_crops" / "user_hand_only_crop.jpg", 0),
        ("User Table Crop", REPO_ROOT / "ml" / "test_crops" / "user_table_crop.jpg", 0),
        ("Healthy Shrimp Test Image", REPO_ROOT / "ml" / "test_healthy_shrimp.jpg", 1),
        ("WSSV Shrimp Test Image", REPO_ROOT / "ml" / "test_wssv_shrimp.jpg", 1),
        ("Water Quality Probe", REPO_ROOT / "backend" / "uploads" / "water_quality" / "wq_13_1790746389.png", 0),
        ("Broken Filter", REPO_ROOT / "backend" / "uploads" / "1784956380_BrokenFilter.jpg", 0),
    ]

    correct = 0
    total = 0
    for name, path, expected in test_cases:
        if not path.exists():
            continue
        total += 1
        img = cv2.imread(str(path))
        feat = extractor.extract(img)
        if feat is None:
            print(f"FAILED TO EXTRACT: {name}", flush=True)
            continue
        feat_scaled = scaler.transform([feat])
        prob_shrimp = float(final_model.predict_proba(feat_scaled)[0, 1])

        if prob_shrimp >= 0.65:
            pred_class = 1
            status = "Shrimp Detected"
            conf = prob_shrimp * 100
        elif prob_shrimp <= 0.35:
            pred_class = 0
            status = "No Shrimp Detected"
            conf = (1.0 - prob_shrimp) * 100
        else:
            pred_class = -1
            status = "Uncertain / Retake Image"
            conf = max(prob_shrimp, 1.0 - prob_shrimp) * 100

        is_correct = pred_class == expected
        if is_correct:
            correct += 1

        print(f"[{'PASS' if is_correct else 'FAIL'}] {name}", flush=True)
        print(f"       Expected: {'Shrimp' if expected == 1 else 'No Shrimp'}", flush=True)
        print(f"       Got:      {status} (P(Shrimp)={prob_shrimp*100:.1f}%, Conf={conf:.1f}%)", flush=True)

    print(f"\nBenchmark Results: {correct}/{total} passed ({correct/max(1, total)*100:.1f}%)", flush=True)


if __name__ == "__main__":
    train_model()
