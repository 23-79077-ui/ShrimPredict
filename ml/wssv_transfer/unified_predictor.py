import os
import json
import numpy as np
from PIL import Image
from pathlib import Path
import tensorflow as tf

def predict_unified(image_path: Path, model_dir: Path) -> dict:
    model_path = model_dir / "unified_disease_model.keras"
    labels_path = model_dir / "labels.json"
    
    if not model_path.exists() or not labels_path.exists():
        raise FileNotFoundError("Unified model or labels.json not found in artifacts directory.")
        
    with open(labels_path, "r") as f:
        class_names = json.load(f)
        
    model = tf.keras.models.load_model(model_path)
    
    with Image.open(image_path) as img:
        img = img.convert("RGB").resize((224, 224))
        
    img_array = tf.keras.preprocessing.image.img_to_array(img)
    img_array = tf.expand_dims(img_array, 0) # Create a batch
    
    predictions = model.predict(img_array, verbose=0)
    score = tf.nn.softmax(predictions[0]) if not model.layers[-1].activation.__name__ == 'softmax' else predictions[0]
    
    top_class_idx = np.argmax(score)
    top_class_name = class_names[top_class_idx]
    confidence = float(score[top_class_idx]) * 100
    
    probabilities = {class_names[i]: float(score[i]) * 100 for i in range(len(class_names))}
    
    return {
        "prediction": top_class_name,
        "disease_name": top_class_name,
        "confidence": confidence,
        "confidence_score": confidence,
        "status": "Diseased" if "Healthy" not in top_class_name else "Healthy",
        "probabilities": probabilities,
        "model_used": "Unified 3-Class EfficientNetB0"
    }
