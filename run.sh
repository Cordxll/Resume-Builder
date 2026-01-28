#!/bin/bash

# Start Backend and Frontend
echo "Starting Resume Builder Application..."

# Check if Python virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "Setting up Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
else
    echo "Python environment found"
fi

# Check if Node modules are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
else
    echo "Frontend dependencies found"
fi

# Start backend in background
echo "Starting backend server..."
cd backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "======================================"
echo "Resume Builder is now running!"
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "======================================"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
