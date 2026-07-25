# ShrimPredict

ShrimPredict is a capstone web application for shrimp farm management. It includes a React + Vite frontend, PHP + MySQL backend, and a TensorFlow/Keras transfer-learning pipeline for shrimp White Spot Syndrome Virus detection.

## Structure

- `frontend/` - React application
- `backend/` - PHP API and upload directory
- `database/` - SQL schema and sample data
- `ml/wssv_transfer/` - real WSSV model preparation, training, evaluation, inference, and Flask API scripts
- `data/` - local public datasets, ignored by Git

## Run The Web App

1. Start Apache and MySQL in XAMPP.
2. Create the database named `shrim_predict_db` and import `database/shrim_predict.sql`.
3. Copy or serve `backend/` through Apache so `/api/*.php` is reachable.
4. From `frontend/`, run `npm install`, then `npm.cmd run dev`.
5. Open `http://localhost:5173`.

## Train The Real WSSV Model

1. Put public datasets under `data/`.
2. Install ML dependencies:

```powershell
.\.venv311\Scripts\python.exe -m pip install -r ml\wssv_transfer\requirements.txt
```

3. Prepare and inspect the dataset:

```powershell
.\.venv311\Scripts\python.exe ml\wssv_transfer\prepare_dataset.py --data-dir data
```

4. Train EfficientNetB0 first, with automatic fallback candidates if target recall is not met:

```powershell
.\.venv311\Scripts\python.exe ml\wssv_transfer\train_transfer_model.py --batch-size 16
```

5. Start the Flask AI API after `best_model.keras` is produced:

```powershell
.\.venv311\Scripts\python.exe ml\wssv_transfer\flask_api.py
```

The PHP scan endpoint calls `http://127.0.0.1:5001/predict` by default. Override it with `SHRIMP_AI_API_URL` if needed.

## Current Local Dataset Prep Result

The local dataset prep accepted 951 healthy/WSSV images, removed 548 duplicates, excluded non-WSSV disease-only labels, and created balanced 80/10/10 split manifests in `ml/artifacts/wssv_dataset/`.

## Dataset Citations

See `ml/wssv_transfer/DATASETS.md` for public dataset sources and licenses, including ShrimpDiseaseImageBD and TigerShrimpBD.

## TensorFlow Note

This machine currently has TensorFlow installed in `.venv311`, but importing TensorFlow fails with a Windows native DLL initialization error. The training and Flask API code are ready, but local training cannot complete until that runtime issue is fixed or the scripts are run in a clean Python/Colab/WSL environment.
