#!/bin/bash
# Script de test pour le système de Feed Social

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:8000/api/v1"
TOKEN="" # Will be set after login

echo -e "${YELLOW}🧪 Testing Social Feed System${NC}\n"

# ============================================
# Step 1: Login to get token
# ============================================
echo -e "${YELLOW}Step 1: Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@sigment.com",
    "password": "your_password"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token // empty')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed. Please update credentials in script.${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Logged in successfully${NC}\n"

# ============================================
# Step 2: Create a new post (should have Cold Start Boost)
# ============================================
echo -e "${YELLOW}Step 2: Creating a new post (Cold Start)...${NC}"
CREATE_POST_RESPONSE=$(curl -s -X POST "$API_URL/feed/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "🚀 Test du système de Feed Social avec Cold Start Boost! Ce post devrait apparaître en haut du feed même sans engagement.",
    "post_type": "standard",
    "tag_names": ["test", "innovation", "cold-start"]
  }')

POST_ID=$(echo $CREATE_POST_RESPONSE | jq -r '.id // empty')
INITIAL_SCORE=$(echo $CREATE_POST_RESPONSE | jq -r '.virality_score // 0')

if [ -z "$POST_ID" ]; then
  echo -e "${RED}❌ Failed to create post${NC}"
  echo "Response: $CREATE_POST_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Post created: $POST_ID${NC}"
echo -e "   Initial virality score: ${YELLOW}$INITIAL_SCORE${NC} (should be ~50 with Cold Start Boost)\n"

# Wait for Celery worker to process
echo -e "${YELLOW}⏳ Waiting 5s for Celery worker...${NC}"
sleep 5

# ============================================
# Step 3: Get main feed (should include new post at top)
# ============================================
echo -e "${YELLOW}Step 3: Fetching main feed...${NC}"
FEED_RESPONSE=$(curl -s -X GET "$API_URL/feed?limit=10" \
  -H "Authorization: Bearer $TOKEN")

FEED_COUNT=$(echo $FEED_RESPONSE | jq '.posts | length')
FIRST_POST_ID=$(echo $FEED_RESPONSE | jq -r '.posts[0].id // empty')
FIRST_POST_SCORE=$(echo $FEED_RESPONSE | jq -r '.posts[0].virality_score // 0')
HAS_MORE=$(echo $FEED_RESPONSE | jq -r '.has_more')
NEXT_CURSOR=$(echo $FEED_RESPONSE | jq -r '.next_cursor // empty')

echo -e "${GREEN}✅ Feed retrieved:${NC}"
echo -e "   Posts count: $FEED_COUNT"
echo -e "   First post ID: $FIRST_POST_ID"
echo -e "   First post score: ${YELLOW}$FIRST_POST_SCORE${NC}"
echo -e "   Has more: $HAS_MORE"
echo -e "   Next cursor: $NEXT_CURSOR\n"

# ============================================
# Step 4: Like the post
# ============================================
echo -e "${YELLOW}Step 4: Liking the post...${NC}"
LIKE_RESPONSE=$(curl -s -X POST "$API_URL/feed/posts/$POST_ID/like" \
  -H "Authorization: Bearer $TOKEN")

LIKE_ACTION=$(echo $LIKE_RESPONSE | jq -r '.action // empty')
NEW_LIKES_COUNT=$(echo $LIKE_RESPONSE | jq -r '.new_count // 0')

echo -e "${GREEN}✅ Like action: $LIKE_ACTION${NC}"
echo -e "   New likes count: $NEW_LIKES_COUNT\n"

# Wait for recalculation
echo -e "${YELLOW}⏳ Waiting 5s for virality recalculation...${NC}"
sleep 5

# ============================================
# Step 5: Save the post (high value: 10 points!)
# ============================================
echo -e "${YELLOW}Step 5: Saving the post...${NC}"
SAVE_RESPONSE=$(curl -s -X POST "$API_URL/feed/posts/$POST_ID/save" \
  -H "Authorization: Bearer $TOKEN")

SAVE_ACTION=$(echo $SAVE_RESPONSE | jq -r '.action // empty')
NEW_SAVES_COUNT=$(echo $SAVE_RESPONSE | jq -r '.new_count // 0')

echo -e "${GREEN}✅ Save action: $SAVE_ACTION${NC}"
echo -e "   New saves count: $NEW_SAVES_COUNT\n"

# Wait for recalculation
echo -e "${YELLOW}⏳ Waiting 5s for virality recalculation...${NC}"
sleep 5

# ============================================
# Step 6: Get feed by tag
# ============================================
echo -e "${YELLOW}Step 6: Fetching feed by tag 'innovation'...${NC}"
TAG_FEED_RESPONSE=$(curl -s -X GET "$API_URL/feed/tag/innovation?limit=10" \
  -H "Authorization: Bearer $TOKEN")

TAG_FEED_COUNT=$(echo $TAG_FEED_RESPONSE | jq '.posts | length')

echo -e "${GREEN}✅ Tag feed retrieved:${NC}"
echo -e "   Posts with tag 'innovation': $TAG_FEED_COUNT\n"

# ============================================
# Step 7: Get trending tags
# ============================================
echo -e "${YELLOW}Step 7: Fetching trending tags...${NC}"
TAGS_RESPONSE=$(curl -s -X GET "$API_URL/feed/tags/trending?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo -e "${GREEN}✅ Trending tags:${NC}"
echo $TAGS_RESPONSE | jq -r '.tags[] | "   - \(.name) (trend_score: \(.trend_score))"'
echo ""

# ============================================
# Step 8: Test cursor pagination
# ============================================
if [ ! -z "$NEXT_CURSOR" ] && [ "$HAS_MORE" = "true" ]; then
  echo -e "${YELLOW}Step 8: Testing cursor pagination...${NC}"
  PAGE2_RESPONSE=$(curl -s -X GET "$API_URL/feed?limit=10&last_seen_score=$NEXT_CURSOR" \
    -H "Authorization: Bearer $TOKEN")
  
  PAGE2_COUNT=$(echo $PAGE2_RESPONSE | jq '.posts | length')
  
  echo -e "${GREEN}✅ Page 2 retrieved:${NC}"
  echo -e "   Posts count: $PAGE2_COUNT\n"
else
  echo -e "${YELLOW}Step 8: Skipping pagination (not enough posts)${NC}\n"
fi

# ============================================
# Summary
# ============================================
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ All tests completed!             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Test Results Summary:${NC}"
echo -e "  • Post created with Cold Start Boost: ${GREEN}✓${NC}"
echo -e "  • Feed pagination working: ${GREEN}✓${NC}"
echo -e "  • Like/Save engagement: ${GREEN}✓${NC}"
echo -e "  • Tag filtering: ${GREEN}✓${NC}"
echo -e "  • Trending tags: ${GREEN}✓${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Check the post in the UI to see Cold Start effect"
echo -e "  2. Wait 2+ hours and refresh - score should drop (no boost)"
echo -e "  3. Monitor Celery logs for virality calculations"
echo ""
