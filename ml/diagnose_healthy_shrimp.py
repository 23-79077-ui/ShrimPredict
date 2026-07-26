import os
import sys
import json
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.wssv_transfer.forest_fallback import _features, _run_tree, FOREST_MODEL_PATH

# Create a realistic Healthy Shrimp simulation image (smooth brownish/grayish shell with natural water shine, but NO white spots)
img_healthy = Image.new("RGB", (300, 300), color=(120, 110, 95))
draw = ImageDraw.Draw(img_healthy)
# Draw smooth body segments and subtle natural highlight (broad, smooth gradient, not punctate spots)
draw.polygon([(40, 150), (120, 80), (250, 150), (180, 220)], fill=(140, 130, 110))
draw.line([(80, 100), (200, 160)], fill=(160, 150, 130), width=15) # smooth highlight
test_healthy_path = Path("ml/test_healthy_shrimp.jpg")
img_healthy.save(test_healthy_path)

# Extract features
feats = _features(test_healthy_path, 96, 6)
model = json.loads(FOREST_MODEL_PATH.read_text(encoding="utf-8"))
tree_probs = [_run_tree(tree, feats) for tree in model["trees"]]
base_prob = sum(tree_probs) / len(tree_probs)

print("--- HEALTHY SHRIMP DIAGNOSTIC ---")
print(f"Base Forest Probability: {base_prob:.4f}")
print(f"Feature 0 (Mean Brightness): {feats[0]:.4f}")
print(f"Feature 1 (Std Brightness): {feats[1]:.4f}")
print(f"Feature 2 (Mean Saturation): {feats[2]:.4f}")
print(f"Feature 4 (Punctate Spot Ratio): {feats[4]:.4f}")
print(f"Feature 5 (Uniform Bright Ratio): {feats[5]:.4f}")
print(f"Feature 8 (Shrimp Pigment Ratio): {feats[8]:.4f}")
print(f"Feature 9 (Spot Contrast Std): {feats[9]:.4f}")
