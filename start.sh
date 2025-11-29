#!/bin/bash

# SIGMENT Quick Start Script
# This script starts all services in separate terminal windows

set -e  # Exit on error

echo "🚀 Starting SIGMENT..."
echo ""

# Get the absolute path of the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file based on .env.example"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

# Start Redis
echo "📦 Checking Redis status..."
if docker ps | grep -q "redis.*Up"; then
    echo "✅ Redis is already running"
else
    echo "📦 Starting Redis..."
    docker-compose up -d
    
    # Wait for Redis to be ready and verify connection
    echo "⏳ Waiting for Redis to be ready..."
    sleep 3
    
    # Verify Redis is running
    if docker-compose ps | grep -q "redis.*Up"; then
        echo "✅ Redis is running"
    else
        echo "❌ Redis failed to start"
        exit 1
    fi
fi

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "📦 Creating Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    echo "📦 Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    cd ..
else
    echo "✅ Python virtual environment exists"
fi

# Start Backend Services
echo ""
echo "🐍 Starting FastAPI backend..."
osascript -e 'tell app "Terminal" 
    do script "cd '"$SCRIPT_DIR"'/backend && source venv/bin/activate && echo \"🐍 FastAPI Backend Starting...\" && uvicorn main:app --reload --port 8000"
end tell' > /dev/null

sleep 3

echo "⚙️  Starting Celery worker..."
osascript -e 'tell app "Terminal" 
    do script "cd '"$SCRIPT_DIR"'/backend && source venv/bin/activate && echo \"⚙️  Celery Worker Starting...\" && celery -A app.workers.celery_app worker --loglevel=info"
end tell' > /dev/null

# Check if node_modules exists for Member
if [ ! -d "frontend/member/node_modules" ]; then
    echo ""
    echo "📦 Installing Member frontend dependencies..."
    cd frontend/member
    npm install
    cd ../..
else
    echo "✅ Member frontend dependencies installed"
fi

# Check if node_modules exists for Board
if [ ! -d "frontend/board/node_modules" ]; then
    echo ""
    echo "📦 Installing Board frontend dependencies..."
    cd frontend/board
    npm install
    cd ../..
else
    echo "✅ Board frontend dependencies installed"
fi

sleep 2

# Start Member Frontend
echo ""
echo "⚛️  Starting Member frontend (port 3000)..."
osascript -e 'tell app "Terminal" 
    do script "cd '"$SCRIPT_DIR"'/frontend/member && echo \"⚛️  Member App Starting on port 3000...\" && npm run dev"
end tell' > /dev/null

sleep 2

# Start Board Frontend
echo ""
echo "🎯 Starting Board frontend (port 8001)..."
osascript -e 'tell app "Terminal" 
    do script "cd '"$SCRIPT_DIR"'/frontend/board && echo \"🎯 Board App Starting on port 8001...\" && npm run dev"
end tell' > /dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SIGMENT is starting in separate terminal windows!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Access points:"
echo "   👤 Member App:  http://localhost:3000"
echo "   🎯 Board App:   http://localhost:8001"
echo "   🔧 Backend:     http://localhost:8000"
echo "   📚 API Docs:    http://localhost:8000/api/docs"
echo "   📖 ReDoc:       http://localhost:8000/api/redoc"
echo ""
echo "🪟 Check the new Terminal windows for service logs"
echo ""
echo "⚠️  Make sure your .env file has valid credentials"
echo "⚠️  Wait ~15 seconds for all services to fully start"
echo ""
echo "🛑 To stop all services:"
echo "   - Close the Terminal windows"
echo "   - Run: docker-compose down"
echo ""

