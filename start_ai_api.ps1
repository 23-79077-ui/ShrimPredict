$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$Python = Join-Path $Root ".venv311\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    Write-Error "Error: .venv311 virtual environment not found at $Python"
    exit 1
}

Write-Host "Starting ShrimPredict AI Flask API on http://127.0.0.1:5001 using .venv311..." -ForegroundColor Cyan
& $Python ml\wssv_transfer\flask_api.py
