@echo off
setlocal
cd /d "%~dp0"
echo Starting ShrimPredict AI Flask API using .venv311...
if exist ".venv311\Scripts\python.exe" (
    ".venv311\Scripts\python.exe" ml\wssv_transfer\flask_api.py
) else (
    echo Error: .venv311 virtual environment not found!
    echo Please make sure .venv311 exists in the root folder.
    pause
)
