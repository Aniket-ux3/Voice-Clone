#!/bin/bash
set -e

echo "================================================"
echo " Synthetic Voice Studio — Startup"
echo "================================================"
echo ""

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d "venv" ]; then
    echo "[ERROR] Virtual environment not found at ./venv"
    echo "Create it: python3 -m venv venv && source venv/bin/activate && pip install -r requirements_api.txt"
    exit 1
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "[INFO] Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo "[1/2] Starting Flask backend (port 7860)..."
source venv/bin/activate
python api_server.py &
BACKEND_PID=$!

sleep 4

echo "[2/2] Starting React frontend (port 8080)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "================================================"
echo " Both servers are running"
echo "================================================"
echo " Backend API : http://localhost:7860/api"
echo " Frontend UI : http://localhost:8080"
echo "================================================"
echo " Press Ctrl+C to stop both servers"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
