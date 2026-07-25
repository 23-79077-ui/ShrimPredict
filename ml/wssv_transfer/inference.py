from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image, ImageOps


DEFAULT_MODEL_DIR = Path("ml/artifacts/wssv_transfer/efficientnetb0")


def load_image(path: Path, image_size: int) -> np.ndarray:
    with Image.open(path) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image = image.resize((image_size, image_size), Image.Resampling.BILINEAR)
    return np.expand_dims(np.asarray(image, dtype=np.float32), axis=0)


def risk_level(disease_name: str, confidence: float) -> str:
    if "White Spot" in disease_name and confidence >= 85:
        return "High"
    if "White Spot" in disease_name:
        return "Medium"
    return "Low"


def recommendation(disease_name: str) -> str:
    if "White Spot" in disease_name:
        return "\n".join(
            [
                "Isolate infected shrimp.",
                "Improve water quality.",
                "Reduce stocking and handling stress.",
                "Consult an aquatic veterinarian.",
                "Monitor remaining ponds closely.",
            ]
        )
    return "No disease detected. Continue routine pond monitoring."


def predict(model_dir: Path, image_path: Path, image_size: int = 224) -> dict:
    model_path = model_dir / "best_model.keras"
    labels_path = model_dir / "labels.json"
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    labels = json.loads(labels_path.read_text(encoding="utf-8"))
    model = tf.keras.models.load_model(model_path)
    probabilities = model.predict(load_image(image_path, image_size), verbose=0)[0]
    index = int(np.argmax(probabilities))
    confidence = float(probabilities[index] * 100)
    disease_name = labels[index]
    return {
        "disease_name": disease_name,
        "confidence_score": round(confidence, 2),
        "risk_level": risk_level(disease_name, confidence),
        "recommendation": recommendation(disease_name),
        "probabilities": {labels[i]: round(float(probabilities[i] * 100), 2) for i in range(len(labels))},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run WSSV inference on one image.")
    parser.add_argument("image", type=Path)
    parser.add_argument("--model-dir", default=DEFAULT_MODEL_DIR, type=Path)
    parser.add_argument("--image-size", default=224, type=int)
    args = parser.parse_args()
    print(json.dumps(predict(args.model_dir, args.image, args.image_size), indent=2))


if __name__ == "__main__":
    main()
