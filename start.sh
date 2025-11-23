#!/bin/bash

# SIGMENT Quick Start Script
# This script starts all services in separate terminal windows

echo "🚀 Starting SIGMENT..."

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
echo "📦 Starting Redis..."
docker-compose up -d

# Wait for Redis to be ready
sleep 2

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "📦 Creating Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# Start Backend Services
echo "🐍 Starting FastAPI backend..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/backend && source venv/bin/activate && uvicorn main:app --reload --port 8000"'

sleep 2

echo "⚙️  Starting Celery worker..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/backend && source venv/bin/activate && celery -A app.workers.celery_app worker --loglevel=info"'

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

sleep 2

# Start Frontend
echo "⚛️  Starting Next.js frontend..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/frontend && npm run dev"'

echo ""
echo "✅ SIGMENT is starting!"
echo ""
echo "📍 Access points:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/api/docs"
echo ""
echo "⚠️  Make sure to configure your .env file with valid credentials"
echo ""

