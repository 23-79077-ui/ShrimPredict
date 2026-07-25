param(
  [string]$DatasetDir = "data\shrimp-disease",
  [int]$Epochs = 12
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Venv = Join-Path $Root ".venv311"
$Python = Join-Path $Venv "Scripts\python.exe"
$Converter = Join-Path $Venv "Scripts\tensorflowjs_converter.exe"

Set-Location $Root

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw "Python launcher not found. Install Python 3.11 first from https://www.python.org/downloads/release/python-3119/ and check 'Add python.exe to PATH'."
}

py -3.11 -c "import sys; print(sys.version)" | Out-Host

if (-not (Test-Path $Python)) {
  py -3.11 -m venv $Venv
}

& $Python -m pip install --upgrade pip
& $Python -m pip install -r ml\requirements.txt tensorflowjs
& $Python ml\train_wssv_classifier.py --dataset-dir $DatasetDir --epochs $Epochs
& $Converter --input_format=keras ml\artifacts\wssv_classifier\wssv_classifier.keras frontend\public\models\shrimp-disease

Write-Host ""
Write-Host "Done. Check this file:"
Write-Host "frontend\public\models\shrimp-disease\model.json"
