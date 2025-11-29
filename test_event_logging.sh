#!/bin/bash

# Test script for Event Logging System
# This script verifies that the event logging system is working correctly

echo "🧪 SIGMENT - Event Logging System Test"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "1️⃣ Checking backend status..."
HEALTH_CHECK=$(curl -s http://localhost:8000/health)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend is running${NC}"
    echo "   Response: $HEALTH_CHECK"
else
    echo -e "${RED}❌ Backend is not running${NC}"
    echo "   Please start the backend first: ./start.sh"
    exit 1
fi

echo ""
echo "2️⃣ Testing event logging endpoints..."
echo ""

# Test note creation endpoint
echo "   Testing note creation..."
USER_ID="a39e733e-85e9-4fcb-82a9-c18aace5c9ad" # Test user ID

# Create a test note
NOTE_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/notes/ \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"content_raw\": \"Test note for event logging system - $(date)\"
  }")

NOTE_ID=$(echo $NOTE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$NOTE_ID" ]; then
    echo -e "${RED}   ❌ Failed to create note${NC}"
    echo "   Response: $NOTE_RESPONSE"
    exit 1
else
    echo -e "${GREEN}   ✅ Note created: $NOTE_ID${NC}"
fi

echo ""
echo "3️⃣ Waiting for AI processing (15 seconds)..."
sleep 15

echo ""
echo "4️⃣ Fetching timeline events for note..."
TIMELINE_RESPONSE=$(curl -s http://localhost:8000/api/v1/notes/$NOTE_ID/timeline)

# Check if we got events
EVENT_COUNT=$(echo $TIMELINE_RESPONSE | grep -o '"id"' | wc -l)

if [ "$EVENT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}   ✅ Found $EVENT_COUNT events in timeline${NC}"
    echo ""
    echo "   Timeline events:"
    echo "$TIMELINE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TIMELINE_RESPONSE"
else
    echo -e "${YELLOW}   ⚠️  No events found yet (AI processing may still be in progress)${NC}"
    echo "   Response: $TIMELINE_RESPONSE"
fi

echo ""
echo "========================================"
echo "Test Summary:"
echo "- Backend: ✅ Running"
echo "- Note Created: ✅ $NOTE_ID"
echo "- Timeline Events: ${EVENT_COUNT:-0} events"
echo ""
echo "📝 Next steps:"
echo "1. Ensure the database migration has been run (see database/add_note_events_table.sql)"
echo "2. Check the Member app at http://localhost:3000/track"
echo "3. Select your note to view the timeline"
echo ""
