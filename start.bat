@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Synthetic Voice Studio - Unified Startup Script
:: ============================================================================
:: This script starts both the Flask backend and React frontend in one go.
:: Requirements:
::   - Python 3.9+ with venv at .\venv\
::   - Node.js 16+ with dependencies at .\frontend\node_modules\
:: ============================================================================

color 0B
title Voice Clone Studio - Launcher

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                  SYNTHETIC VOICE STUDIO                        ║
echo ║                     Unified Launcher                           ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

:: Resolve the directory this .bat file lives in
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo [INFO] Project Directory: %PROJECT_DIR%
echo.

:: ============================================================================
:: PRE-FLIGHT CHECKS
:: ============================================================================

echo ┌─────────────────────────────────────────────────────────────────┐
echo │ Step 1: Pre-flight Checks                                       │
echo └─────────────────────────────────────────────────────────────────┘
echo.

:: Check Python virtual environment
echo [CHECK] Python virtual environment...
if not exist "%PROJECT_DIR%\venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found!
    echo.
    echo Expected location: %PROJECT_DIR%\venv
    echo.
    echo To create it:
    echo   cd "%PROJECT_DIR%"
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements_api.txt
    echo.
    pause
    exit /b 1
)
echo [OK] Virtual environment found.

:: Check frontend dependencies
echo [CHECK] Frontend dependencies...
if not exist "%PROJECT_DIR%\frontend\node_modules" (
    echo [WARN] node_modules not found. Installing dependencies...
    cd /d "%PROJECT_DIR%\frontend"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies.
        cd /d "%PROJECT_DIR%"
        pause
        exit /b 1
    )
    cd /d "%PROJECT_DIR%"
)
echo [OK] Frontend dependencies found.

:: Check for Python installation
echo [CHECK] Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found in PATH.
    echo Please install Python 3.9+ from https://www.python.org/
    pause
    exit /b 1
)
echo [OK] Python found.

:: Check for Node.js installation
echo [CHECK] Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found in PATH.
    echo Please install Node.js 16+ from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found.

:: Check if ports are already in use
echo [CHECK] Port availability...
netstat -ano | findstr ":5000 " >nul 2>&1
if not errorlevel 1 (
    echo [WARN] Port 5000 is already in use!
    echo        Another Flask server may be running.
    echo        Kill it or the new backend may fail to start.
    echo.
)

netstat -ano | findstr ":5173 " >nul 2>&1
if not errorlevel 1 (
    echo [WARN] Port 5173 is already in use!
    echo        Another Vite dev server may be running.
    echo.
)

echo.
echo ┌─────────────────────────────────────────────────────────────────┐
echo │ Step 2: Starting Services                                       │
echo └─────────────────────────────────────────────────────────────────┘
echo.

:: ============================================================================
:: START BACKEND
:: ============================================================================

echo [1/2] Starting Flask Backend Server...
echo       Location: %PROJECT_DIR%
echo       Port: 5000
echo.

start "Voice Clone Backend - Flask API Server" cmd /k "cd /d "%PROJECT_DIR%" && venv\Scripts\activate && echo [BACKEND] Starting Flask API server... && python api_server.py"

:: Wait for backend to initialize
echo       Waiting for backend to initialize (5 seconds)...
timeout /t 5 /nobreak > nul

:: ============================================================================
:: START FRONTEND
:: ============================================================================

echo [2/2] Starting React Frontend Server...
echo       Location: %PROJECT_DIR%\frontend
echo       Port: 5173 (Vite default)
echo.

start "Voice Clone Frontend - Vite Dev Server" cmd /k "cd /d "%PROJECT_DIR%\frontend" && echo [FRONTEND] Starting Vite dev server... && npm run dev"

:: Wait for frontend to initialize
echo       Waiting for frontend to initialize (3 seconds)...
timeout /t 3 /nobreak > nul

:: ============================================================================
:: COMPLETION MESSAGE
:: ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    STARTUP COMPLETE                            ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo ✓ Backend API Server : http://localhost:5000/api
echo ✓ Frontend Web UI    : http://localhost:5173
echo.
echo ┌─────────────────────────────────────────────────────────────────┐
echo │ USAGE NOTES                                                      │
echo └─────────────────────────────────────────────────────────────────┘
echo.
echo • Both servers are running in separate windows
echo • The FIRST voice generation will take 30-60 seconds
echo   (AI models need to load into GPU/CPU memory)
echo • Subsequent generations are much faster (5-15 seconds)
echo • Your browser should auto-open to http://localhost:5173
echo.
echo • To stop: Close both server windows or press Ctrl+C in each
echo.
echo ┌─────────────────────────────────────────────────────────────────┐
echo │ TROUBLESHOOTING                                                  │
echo └─────────────────────────────────────────────────────────────────┘
echo.
echo • If backend fails: Check Python dependencies are installed
echo • If frontend fails: Run "npm install" in the frontend folder
echo • If ports conflict: Kill existing processes on ports 5000/5173
echo • For GPU issues: Ensure CUDA toolkit is installed (optional)
echo.
echo Device in use: Check backend window for CUDA or CPU
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  Press any key to close this launcher window                   ║
echo ║  (Servers will continue running in their own windows)          ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
pause > nul

endlocal
