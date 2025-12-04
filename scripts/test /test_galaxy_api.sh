#!/bin/bash
# Test script for Galaxy API

echo "🌌 Testing SIGMENT Galaxy API"
echo ""

echo "1️⃣ Testing API health..."
curl -s http://localhost:8000/health | jq . || echo "Failed"
echo ""

echo "2️⃣ Testing Galaxy endpoint..."
curl -s http://localhost:8000/api/v1/board/galaxy | jq . || echo "Failed"
echo ""

echo "3️⃣ Testing Pillars endpoint..."
curl -s http://localhost:8000/api/v1/board/pillars | jq . || echo "Failed"
echo ""

echo "4️⃣ Testing with filters..."
curl -s "http://localhost:8000/api/v1/board/galaxy?min_relevance=5" | jq . || echo "Failed"
echo ""

echo "✅ Tests complete!"

