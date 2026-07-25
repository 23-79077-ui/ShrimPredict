param(
  [string]$Python = ".\.venv311\Scripts\python.exe",
  [string]$DataDir = "data",
  [int]$BatchSize = 16
)

& $Python ml\wssv_transfer\prepare_dataset.py --data-dir $DataDir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python ml\wssv_transfer\train_transfer_model.py --batch-size $BatchSize
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Training complete. Start API with:"
Write-Host "$Python ml\wssv_transfer\flask_api.py"
