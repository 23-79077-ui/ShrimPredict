# TRAINING_PIPELINE_AUDIT.md
## ShrimPredict Deep Training Pipeline Audit

---

### 1. Executive Summary

This document audits the legacy vs. upgraded training and inference pipelines in ShrimPredict. The objective is to identify all architectural, data, and preprocessing inconsistencies that previously caused false positives, uncalibrated confidence, and data leakage, and establish the exact roadmap for leak-free, reliable training.

---

### 2. Pipeline Audit Matrix

| Pipeline Component | Legacy Implementation | Identified Defects | Upgraded Implementation |
| :--- | :--- | :--- | :--- |
| **Dataset** | `augmented_12k_dataset` (12,104 synthetic crops) | Augmented variants of 381 WSSV specimens leaked across train/test splits. | `shrimp-dataset` (5,662 files, 2,506 unique specimen clusters). |
| **Labels** | 3 classes (`Healthy`, `WSSV`, `Black Gill`); Co-infection (409 files) discarded. | Loss of 15% of diseased specimens; forcing co-infection into binary viral choice corrupted feature maps. | Canonical 4-class mutually exclusive target (`Healthy`, `WSSV`, `Black Gill`, `WSSV + Black Gill`) preserving `ground_truth_raw`. |
| **Split Strategy** | Random 85/15 file-level shuffle in `train_upgraded_model.py`. | **Severe Data Leakage:** Same shrimp specimen with different rotations was in both train and test. | Perceptual-hash (`dHash`) specimen-level cluster split: Train ~70%, Val ~15%, Test ~15%. Overlap = 0. |
| **Preprocessing** | Direct bilinear resize to $224 \times 224$ (`img.resize((224, 224))`). | **Aspect-Ratio Squashing:** Rectangular shrimp (4:3, 16:9) were stretched, distorting round white spots into ellipses. | Aspect-preserving letterbox with neutral gray `(128, 128, 128)` padding. Tested on portrait, landscape, square, wide, and tall. |
| **Normalization** | Discrepant: Node/Sharp normalized to `[-1, 1]`; Python passed `[0, 255]`. | Risk of double normalization: EfficientNetV2B0 has internal `Rescaling` & `Normalization` layers expecting `[0, 255]`. | Unified `preprocess_for_inference` enforcing exact range `[0.0, 255.0]` with runtime min, max, mean, std logging. |
| **Augmentation** | Ad-hoc Keras Sequential with random zoom, contrast, rotation. | Risk of altering diagnostic pigment; aggressive blurs destroying small calcified WSSV lesions. | Conservative biological augmentation: flip, rotation $\pm 15^\circ$, brightness $\pm 12\%$, contrast $\pm 10\%$, sensor noise $\sigma=0.02$. |
| **Model Architecture** | EfficientNetV2B0 + Dropout(0.35) + Dense(3). | Mutually exclusive 3-class head unable to distinguish co-infection. | EfficientNetV2B0 + GAP + BatchNorm + Dropout(0.30) + Dense(4, softmax). |
| **Loss Function** | Categorical Cross-Entropy with label smoothing (0.02). | Handled class imbalance poorly due to 4:1 Healthy-to-WSSV ratio. | Controlled evaluation: Normal Cross-Entropy vs. Balanced Class-Weighted Cross-Entropy vs. Focal Loss. |
| **Class Balancing** | None in baseline; unweighted. | Dominant classes (`Black Gill` and `Healthy`) overwhelmed scarce acute `WSSV`. | Balanced class weighting: $w_j = \frac{N}{K \cdot n_j}$ ($w_{\text{WSSV}} = 4.17$, $w_{\text{Co-inf}} = 3.51$). |
| **Validation Strategy** | File-level validation holdout. | Contaminated with leaked augmented copies. | Specimen-clustered validation holdout (782 images, 375 unique specimens). |
| **Test Strategy** | Single synthetic `test.csv` derived from `augmented_12k_dataset`. | Overly optimistic 98% accuracy failing to reflect farm photography conditions. | Three independent held-out distributions: TEST-A (Clean Specimen Test), TEST-B (Difficult / Hard Negatives), TEST-C (Real-World Farm Scans). |
| **Inference Integration** | Hardcoded veto in `flask_api.py` (`black_gill_confidence >= 60%`). | Rule-based pixel heuristic with 26% FPR on healthy shrimp overrode deep learning models. | Heuristic stripped of veto power; converted to advisory signal inside Bayesian soft-voting consensus. |
| **Confidence Calibration** | Uncalibrated raw softmax (reporting 99.95% on false predictions). | Overconfident predictions causing diagnostic errors. | Validation-only temperature scaling ($T^*$) minimizing NLL; ECE and Brier score tracking. |
| **Uncertainty Logic** | Outputting `"Unknown"` whenever models disagreed or veto fired. | Empty payload bug: dropped probability and debug maps. | Principled Normalized Shannon Entropy ($H_n > 0.90$) and Top-1 vs Top-2 Probability Margin ($< 0.10$). |

---

### 3. Known Root Causes & Pipeline Defects

1. **The Heuristic Override Defect:**
   - In [`flask_api.py`](file:///c:/Users/HP/Documents/ShrimPredict/ml/wssv_transfer/flask_api.py), `_choose_primary_result` had a hard-coded veto checking if `black_gill_result >= 60%`. This fired on normal dark pond liner pixels, returning `None` prediction which defaulted to `"Unknown (70.13%)"` with an empty `{}` breakdown.
2. **Benchmark Leakage:**
   - In prior experiments, the test set contained augmented variants of the exact same shrimp specimens found in the training set. This yielded false 98% accuracy that completely broke down when farmers uploaded novel phone photos.
3. **Co-infection Neglect:**
   - 409 images labeled `White_Spot_Syndrome_Virus_and_Black_Gill` were omitted or collapsed into a single category without explicit tracking, preventing the system from identifying co-infected shrimp.
4. **Aspect-Ratio Squashing:**
   - Bilinear resizing directly to $224 \times 224$ distorted elongated shrimp anatomy and circular white spot lesions.

---

### 4. Step-by-Step Resolution Plan

1. **Zero-Leakage Specimen Splits:** Cluster by 64-bit dHash (Hamming distance $\le 6$). Verify $\text{Train} \cap \text{Val} = \text{Train} \cap \text{Test} = \text{Val} \cap \text{Test} = \emptyset$.
2. **Four Mutually Exclusive Classes:** Train on `[Healthy, WSSV, Black Gill, WSSV + Black Gill]`, maintaining `ground_truth_raw`.
3. **Aspect-Preserving Letterboxing:** Centralize all image loading into `ml/preprocessing.py` with symmetrical neutral gray padding (`128, 128, 128`).
4. **Controlled Baseline Training:** Train unweighted, unaugmented baseline first (`baseline_model.keras`) to establish empirical reference point.
5. **Class Imbalance & Augmentation:** Apply balanced class weights ($w_j$) and conservative biological augmentations (flip, $\pm 15^\circ$ rotation, $\pm 12\%$ brightness, $\pm 10\%$ contrast, $\sigma=0.02$ sensor noise).
6. **Hard-Negative Mining:** Save validation mistakes with confidence $\ge 50\%$ to `hard_negatives.csv` for failure mode categorization.
7. **Validation-Only Calibration:** Learn temperature parameter $T^*$ strictly on validation holdout logits.
8. **Multi-Distribution Evaluation:** Benchmark frozen model against TEST-A (clean), TEST-B (difficult), and TEST-C (real-world farm scans).
9. **Failure Categorization:** Export `error_analysis.csv` mapping mistakes to root cause categories.
