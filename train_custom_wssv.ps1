# train_custom_wssv.ps1
# ShrimPredict - Fine-tune AI Model on Custom/User WSSV & Healthy Samples
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = Join-Path $Root ".venv311\Scripts\python.exe"
}

if (-not (Test-Path $Python)) {
    Write-Error "Error: Python virtual environment (.venv) not found."
    exit 1
}

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  ShrimPredict: Fine-Tuning AI Model on User Photos" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "WSSV Folder   : $Root\data\user_train_samples\WSSV" -ForegroundColor Green
Write-Host "Healthy Folder: $Root\data\user_train_samples\Healthy" -ForegroundColor Green
Write-Host ""

& $Python ml\train_custom_samples.py --epochs 8
