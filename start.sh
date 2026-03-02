#!/bin/bash

echo "================================================"
echo "Starting Voice Clone Project"
echo "================================================"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "[ERROR] Virtual environment not found!"
    echo "Please run: python -m venv venv"
    echo "Then: source venv/bin/activate"
    echo "And: pip install -r requirements_api.txt"
    exit 1
fi

# Start backend in background
echo "[1/2] Starting Flask Backend Server..."
source venv/bin/activate
python api_server.py &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "[2/2] Starting React Frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================================"
echo "Both servers are running!"
echo "================================================"
echo "Backend API: http://localhost:5000"
echo "Frontend UI: http://localhost:5173"
echo "================================================"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
