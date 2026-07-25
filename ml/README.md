# WSSV Training Pipeline

This trains the caretaker disease scanner for White Spot Syndrome Virus (WSSV) using the Kaggle shrimp disease dataset with raw folders:

- `Healthy`
- `BG`
- `WSSV`
- `BG_WSSV`

Default training is WSSV-focused:

- `wssv`: `WSSV` and `BG_WSSV`
- `non_wssv`: `Healthy` and `BG`

## Dataset

Use the Kaggle dataset named `Shrimp Disease Image Dataset for Detection Models` or the matching `ShrimpDiseaseImageBD` dataset. Extract it locally, then point the trainer either to the dataset root or directly to the `Raw Images` folder.

## Train

```powershell
cd C:\Users\Cristel\Documents\ShrimPredict
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ml\requirements.txt
python ml\train_wssv_classifier.py --dataset-dir "C:\path\to\ShrimpDiseaseImageBD" --epochs 12
```

Artifacts are saved to:

```text
ml/artifacts/wssv_classifier/
```

The important files are:

- `wssv_classifier.keras`
- `best_wssv_classifier.keras`
- `labels.json`

## Use In App

The current frontend keeps a WSSV-prioritized fallback while no browser model is exported. To serve this model directly in the caretaker scan page, convert the Keras model to TensorFlow.js and place it here:

```text
frontend/public/models/shrimp-disease/model.json
frontend/public/models/shrimp-disease/group1-shard*.bin
```

Then load TensorFlow.js in the frontend runtime or install `@tensorflow/tfjs` and wire the model loader.
