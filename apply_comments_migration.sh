#!/bin/bash
# Script to apply SQL migration for fixing comments

set -e

echo "🔄 Applying migration to fix comments RPC functions..."
echo "=================================================="

# Check if psql is available
if ! command -v psql &gt; /dev/null; then
    echo "❌ psql not found. Please install PostgreSQL client tools."
    echo ""
    echo "On macOS: brew install postgresql"
    echo "On Ubuntu: sudo apt-get install postgresql-client"
    echo ""
    echo "Alternatively, run the SQL manually in Supabase SQL Editor:"
    echo "File: database/add_social_feed_optimized.sql"
    exit 1
fi

# Load environment variables
if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
else
    echo "❌ backend/.env not found"
    exit 1
fi

# Extract connection details from Supabase URL
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not found in .env"
    echo "Please run the SQL manually in Supabase SQL Editor:"
    echo "File: database/add_social_feed_optimized.sql"
    exit 1
fi

echo "✅ Executing SQL migration..."
psql "$DATABASE_URL" -f database/add_social_feed_optimized.sql

echo ""
echo "✅ Migration applied successfully!"
echo "🔄 Please refresh your browser to see the changes"
