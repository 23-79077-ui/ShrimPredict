import sys
import json
from pathlib import Path

sys.path.insert(0, ".")
from ml.wssv_transfer.forest_fallback import predict_with_forest, _features, FOREST_MODEL_PATH

uploads_dir = Path("backend/uploads/disease_scans")
model = json.loads(FOREST_MODEL_PATH.read_text(encoding="utf-8"))

print("=== TESTING ALL ACTUAL USER UPLOADED IMAGES ===")
for img_path in sorted(uploads_dir.glob("*")):
    if img_path.is_file():
        res = predict_with_forest(img_path)
        feats = _features(img_path, 96, 6)
        print(f"\nFile: {img_path.name}")
        print(f"  Disease: {res['disease_name']} | Risk: {res['risk_level']} | Confidence: {res['confidence_score']}%")
        print(f"  Visual Evidence: {res['visual_evidence']}")
        print(f"  Features -> Brightness: {feats[0]:.3f}, Sat: {feats[2]:.3f}, PunctateSpotRatio: {feats[4]:.4f}, UniformBrightRatio: {feats[5]:.4f}, Pigment: {feats[8]:.4f}, ContrastStd: {feats[9]:.4f}")
