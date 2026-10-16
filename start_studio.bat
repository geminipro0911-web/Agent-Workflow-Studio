@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "ROOT_DIR=%CD%"
title Gemini Workflow Studio Launcher

echo ======================================================================
echo           GEMINI WORKFLOW STUDIO - QUICK LAUNCHER (WINDOWS)
echo ======================================================================
echo.

:: 1. Check Python
echo [1/5] Kiem tra moi truong Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Khong tim thay Python tren he thong!
    echo Vui long cai dat Python 3.10+ va tick chon 'Add Python to PATH'.
    echo Tai Python tai: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
python --version

:: 2. Check Node.js and npm
echo.
echo [2/5] Kiem tra moi truong Node.js va npm...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Khong tim thay Node.js tren he thong!
    echo Vui long cai dat Node.js ban LTS hoac Current va them vao PATH.
    echo Tai Node.js tai: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
node --version
call npm --version

:: 3. Check and install Python dependencies
echo.
echo [3/5] Kiem tra cac thu vien Python can thiet...
python -c "import fastapi, uvicorn, pydantic, psutil, websockets" >nul 2>&1
if errorlevel 1 (
    echo Dang cai dat cac thu vien Python con thieu qua pip...
    python -m pip install fastapi uvicorn pydantic psutil pytest pytest-asyncio playwright requests websockets
    if errorlevel 1 (
        echo [WARNING] Co loi khi chay pip install, tiep tuc tien trinh...
    )
) else (
    echo Cac thu vien Python da day du va san sang.
)

:: 4. Check Frontend dependencies
echo.
echo [4/5] Kiem tra dependencies cua Frontend...
if not exist "frontend\node_modules\" (
    echo Thu muc frontend\node_modules chua ton tai, dang tien hanh npm install...
    pushd "%ROOT_DIR%\frontend"
    call npm install
    popd
) else (
    echo Frontend dependencies da san sang.
)

:: 5. Launch Backend and Frontend
echo.
echo [5/5] Khoi dong Backend va Frontend...
echo - Backend port:  8000 (FastAPI REST + WebSocket)
echo - Frontend port: 5173 (Vite React Studio)
echo.

:: Start Backend in separate window
start "Gemini Studio - Backend (Port 8000)" /D "%ROOT_DIR%" cmd /k "chcp 65001 >nul & set PYTHONPATH=%ROOT_DIR% & python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

:: Start Frontend in separate window
start "Gemini Studio - Frontend (Port 5173)" /D "%ROOT_DIR%\frontend" cmd /k "chcp 65001 >nul & npm run dev"

echo Dang cho he thong san sang...
ping 127.0.0.1 -n 4 >nul

echo Dang mo trinh duyet Studio tai http://localhost:5173 ...
start "" "http://localhost:5173" >nul 2>&1

echo.
echo ======================================================================
echo Gemini Workflow Studio da duoc khoi dong thanh cong!
echo - Web UI:       http://localhost:5173
echo - Swagger API:  http://localhost:8000/docs
echo.
echo Giu nguyen cac cua so terminal cua Backend va Frontend khi dang lam viec.
echo Dong cac cua so do hoac nhan Ctrl+C de dung ung dung.
echo ======================================================================
echo.
pause
