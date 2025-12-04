#!/bin/bash

# Apply SQL updates to Supabase database
# This script applies the unified feed SQL updates

set -e

echo "🔄 Applying SQL updates to database..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Error: .env file not found!"
    exit 1
fi

# Check if we have the Supabase URL and key
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env"
    exit 1
fi

# Apply the SQL file using Python and Supabase client
cd backend
source venv/bin/activate

python3 << 'PYTHON_SCRIPT'
import os
from supabase import create_client

# Read SQL file
with open("../database/add_unified_feed.sql", "r") as f:
    sql_content = f.read()

# Connect to Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    print("❌ Missing Supabase credentials")
    exit(1)

supabase = create_client(supabase_url, supabase_key)

print("📝 Executing SQL updates...")
try:
    # Execute the SQL
    result = supabase.rpc("exec_sql", {"sql": sql_content}).execute()
    print("✅ SQL updates applied successfully!")
except Exception as e:
    print(f"⚠️  Note: Direct SQL execution may not be available via RPC")
    print(f"   Please apply the SQL manually via Supabase Dashboard > SQL Editor")
    print(f"   File: database/add_unified_feed.sql")
    print(f"   Error: {e}")
PYTHON_SCRIPT

echo ""
echo "✅ Database update process completed!"
echo ""
echo "📝 If automatic execution failed, please:"
echo "   1. Go to your Supabase Dashboard"
echo "   2. Navigate to SQL Editor"
echo "   3. Copy and paste the contents of database/add_unified_feed.sql"
echo "   4. Execute the SQL"
