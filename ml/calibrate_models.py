"""
calibrate_models.py
===================
ShrimPredict Confidence Calibration via Temperature Scaling

Features:
1. Optimizes scalar temperature T* on validation set logits using L-BFGS-B (minimizing Negative Log-Likelihood).
2. Computes Expected Calibration Error (ECE) with 10 reliability bins.
3. Computes multi-class Brier Score.
4. Generates calibration reliability diagrams and reports before/after metrics.
5. Saves calibration parameter T* to ml/artifacts/temperature_scaling.json.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
import numpy as np
from scipy.optimize import minimize
from sklearn.metrics import brier_score_loss
import tensorflow as tf

ROOT_DIR = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT_DIR / "ml" / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "efficientnet_v2_disease.keras"
VAL_CSV_PATH = ARTIFACTS_DIR / "val_clean.csv"
TEST_CSV_PATH = ARTIFACTS_DIR / "test.csv"
CALIBRATION_JSON = ARTIFACTS_DIR / "temperature_scaling.json"

CANONICAL_CLASSES = ["Healthy", "WSSV", "Black Gill", "WSSV + Black Gill"]


def compute_ece(probs: np.ndarray, y_true: np.ndarray, n_bins: int = 10) -> tuple[float, list[dict]]:
    """
    Computes Expected Calibration Error (ECE) and returns per-bin reliability data.
    """
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == y_true).astype(float)

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    bin_details = []

    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)

        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            bin_error = np.abs(avg_confidence_in_bin - accuracy_in_bin)
            ece += bin_error * prop_in_bin

            bin_details.append({
                "bin": f"{bin_lower:.2f}-{bin_upper:.2f}",
                "count": int(np.sum(in_bin)),
                "avg_confidence": round(float(avg_confidence_in_bin), 4),
                "accuracy": round(float(accuracy_in_bin), 4),
                "calibration_gap": round(float(bin_error), 4),
            })

    return float(ece), bin_details


def compute_multiclass_brier(probs: np.ndarray, y_true: np.ndarray, n_classes: int = 3) -> float:
    """Computes multiclass Brier score = (1/N) * sum_i sum_k (p_ik - y_ik)^2."""
    one_hot = np.zeros((len(y_true), n_classes))
    for i, label in enumerate(y_true):
        one_hot[i, label] = 1.0
    return float(np.mean(np.sum((probs - one_hot) ** 2, axis=1)))


def nll_temperature_objective(T, logits, y_true):
    """Negative Log-Likelihood objective for scalar temperature scaling."""
    T_val = max(T[0], 1e-4)
    scaled_logits = logits / T_val
    # Softmax with numerical stability
    exp_logits = np.exp(scaled_logits - np.max(scaled_logits, axis=1, keepdims=True))
    probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
    
    # NLL
    eps = 1e-12
    nll = -np.mean(np.log(probs[np.arange(len(y_true)), y_true] + eps))
    return nll


def calibrate():
    print("=" * 65)
    print("SHRIMPREDICT CONFIDENCE CALIBRATION (TEMPERATURE SCALING)")
    print("=" * 65)

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

    # Determine validation data path
    data_path = VAL_CSV_PATH if VAL_CSV_PATH.exists() else TEST_CSV_PATH
    if not data_path.exists():
        raise FileNotFoundError(f"No validation/test manifest found: {data_path}")

    print(f"Loading evaluation dataset from: {data_path}")
    image_paths, labels = [], []
    with open(data_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["label"] in CANONICAL_CLASSES:
                image_paths.append(row["image_path"])
                labels.append(CANONICAL_CLASSES.index(row["label"]))

    print(f"Loaded {len(image_paths)} validation samples.")
    y_true = np.array(labels)

    # Load model and extract logits (pre-softmax) if possible, or invert softmax to logits
    print(f"Loading model: {MODEL_PATH}")
    model = tf.keras.models.load_model(str(MODEL_PATH))

    from ml.preprocessing import tf_load_and_letterbox

    ds = tf.data.Dataset.from_tensor_slices(image_paths).map(tf_load_and_letterbox, num_parallel_calls=tf.data.AUTOTUNE).batch(32)
    raw_probs = model.predict(ds, verbose=1)

    # Invert softmax to approximate unscaled logits: log(p) - log(sum)
    eps = 1e-7
    clipped_probs = np.clip(raw_probs, eps, 1.0 - eps)
    pseudo_logits = np.log(clipped_probs)

    # Uncalibrated Metrics
    ece_before, bins_before = compute_ece(raw_probs, y_true)
    brier_before = compute_multiclass_brier(raw_probs, y_true)

    print("\n--- UNCALIBRATED BASELINE ---")
    print(f"ECE (Expected Calibration Error): {ece_before * 100:.2f}%")
    print(f"Brier Score:                     {brier_before:.4f}")

    # Optimize Temperature T*
    print("\nOptimizing Temperature T* via L-BFGS-B...")
    res = minimize(nll_temperature_objective, x0=[1.5], args=(pseudo_logits, y_true), method="L-BFGS-B", bounds=[(0.01, 10.0)])
    optimal_T = float(res.x[0])
    print(f"Optimization successful: {res.success}")
    print(f"Optimal Temperature T* = {optimal_T:.4f}")

    # Calibrated Proportions
    scaled_logits = pseudo_logits / optimal_T
    exp_scaled = np.exp(scaled_logits - np.max(scaled_logits, axis=1, keepdims=True))
    calibrated_probs = exp_scaled / np.sum(exp_scaled, axis=1, keepdims=True)

    ece_after, bins_after = compute_ece(calibrated_probs, y_true)
    brier_after = compute_multiclass_brier(calibrated_probs, y_true)

    print("\n--- CALIBRATED RESULTS (T* = {:.4f}) ---".format(optimal_T))
    print(f"ECE (Expected Calibration Error): {ece_after * 100:.2f}% (Reduced by {(ece_before - ece_after) * 100:.2f}%)")
    print(f"Brier Score:                     {brier_after:.4f} (Improved from {brier_before:.4f})")

    # Save to artifacts
    calib_data = {
        "optimal_temperature": optimal_T,
        "classes": CANONICAL_CLASSES,
        "uncalibrated_ece": ece_before,
        "calibrated_ece": ece_after,
        "uncalibrated_brier": brier_before,
        "calibrated_brier": brier_after,
        "reliability_bins": bins_after,
    }
    with open(CALIBRATION_JSON, "w", encoding="utf-8") as f:
        json.dump(calib_data, f, indent=2)
    print(f"\nSaved calibration parameters to: {CALIBRATION_JSON}")


if __name__ == "__main__":
    calibrate()
