#!/bin/bash
# Quick Install Script for Social Feed System
# Ce script configure le système de Feed Social en une seule commande

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🚀 Social Feed System - Quick Install                    ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================
# Step 1: Check Prerequisites
# ============================================
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL (psql) not found. Please install PostgreSQL first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  backend/.env not found. You'll need to configure database connection manually.${NC}"
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}\n"

# ============================================
# Step 2: Database Configuration
# ============================================
echo -e "${YELLOW}Step 2: Database Setup${NC}"
echo -e "Please provide your database connection details:\n"

read -p "Database host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Database port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database name: " DB_NAME
if [ -z "$DB_NAME" ]; then
    echo -e "${RED}❌ Database name is required${NC}"
    exit 1
fi

read -p "Database user: " DB_USER
if [ -z "$DB_USER" ]; then
    echo -e "${RED}❌ Database user is required${NC}"
    exit 1
fi

read -sp "Database password: " DB_PASSWORD
echo ""
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}❌ Database password is required${NC}"
    exit 1
fi

export PGPASSWORD="$DB_PASSWORD"

# ============================================
# Step 3: Apply Migration
# ============================================
echo -e "\n${YELLOW}Step 3: Applying database migration...${NC}"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f database/add_social_feed_system.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration applied successfully${NC}\n"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

# ============================================
# Step 4: Load Seed Data (Optional)
# ============================================
echo -e "${YELLOW}Step 4: Load seed data (test data)?${NC}"
read -p "Do you want to load test data? (y/N): " LOAD_SEED

if [[ "$LOAD_SEED" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Loading seed data...${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f database/seed_social_feed.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Seed data loaded successfully${NC}\n"
    else
        echo -e "${RED}❌ Failed to load seed data${NC}"
    fi
else
    echo -e "${BLUE}ℹ️  Skipping seed data${NC}\n"
fi

# ============================================
# Step 5: Verify Installation
# ============================================
echo -e "${YELLOW}Step 5: Verifying installation...${NC}"

# Check if tables exist
TABLES_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('posts', 'tags', 'post_tags', 'post_likes', 'post_saves', 'post_comments');
")

if [ "$TABLES_COUNT" -eq 6 ]; then
    echo -e "${GREEN}✅ All tables created successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Expected 6 tables, found $TABLES_COUNT${NC}"
fi

# Check if functions exist
FUNCTIONS_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM pg_proc 
    WHERE proname IN ('get_social_feed', 'get_feed_by_tag');
")

if [ "$FUNCTIONS_COUNT" -eq 2 ]; then
    echo -e "${GREEN}✅ Stored functions created successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Expected 2 functions, found $FUNCTIONS_COUNT${NC}"
fi

# ============================================
# Step 6: Check Backend Server
# ============================================
echo -e "\n${YELLOW}Step 6: Checking backend server...${NC}"

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server is running${NC}"
    echo -e "${BLUE}ℹ️  API documentation: ${NC}http://localhost:8000/api/docs"
else
    echo -e "${YELLOW}⚠️  Backend server not detected (might need restart)${NC}"
    echo -e "${BLUE}ℹ️  Please restart your backend server to load new routes${NC}"
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ Installation Complete!                                  ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 What was installed:${NC}"
echo -e "  • ✅ Database tables (posts, tags, post_tags, etc.)"
echo -e "  • ✅ Indexes for performance"
echo -e "  • ✅ Stored functions (get_social_feed, get_feed_by_tag)"
echo -e "  • ✅ Database triggers"
if [[ "$LOAD_SEED" =~ ^[Yy]$ ]]; then
    echo -e "  • ✅ Test data (sample posts, tags, etc.)"
fi
echo ""
echo -e "${BLUE}📚 Next Steps:${NC}"
echo -e "  1. ${YELLOW}Restart your backend server${NC} if it was already running:"
echo -e "     ${BLUE}cd backend && uvicorn main:app --reload${NC}"
echo ""
echo -e "  2. ${YELLOW}Check the API documentation:${NC}"
echo -e "     ${BLUE}http://localhost:8000/api/docs${NC}"
echo -e "     Look for the \"Social Feed\" section"
echo ""
echo -e "  3. ${YELLOW}Run tests:${NC}"
echo -e "     ${BLUE}./test_social_feed.sh${NC}"
echo -e "     (Don't forget to update credentials in the script first)"
echo ""
echo -e "  4. ${YELLOW}Read the documentation:${NC}"
echo -e "     • ${BLUE}GUIDE_SOCIAL_FEED_SYSTEM.md${NC} - Complete guide"
echo -e "     • ${BLUE}ARCHITECTURE_SOCIAL_FEED.md${NC} - Architecture diagrams"
echo -e "     • ${BLUE}README_SOCIAL_FEED_DELIVERY.md${NC} - Implementation summary"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 Social Feed System is ready to use!                     ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Clean up
unset PGPASSWORD
