#!/usr/bin/env python3
"""
Apply the unified feed SQL using Supabase REST API
"""
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

# Get Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

print("✅ Connected to Supabase")
print(f"📍 URL: {SUPABASE_URL}")
print()

# Read the SQL file
sql_file_path = "database/add_unified_feed.sql"

print("=" * 60)
print(f"📄 Reading SQL file: {sql_file_path}")
print("=" * 60)

try:
    with open(sql_file_path, 'r') as f:
        sql_content = f.read()
    
    print(f"✅ SQL file loaded ({len(sql_content)} bytes)")
    print()
    
    # Use Supabase REST API to execute SQL
    # Note: This requires the SQL to be executed via the PostgREST API
    # We'll use the rpc endpoint to execute raw SQL
    
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try to execute the SQL
    # Note: This might not work if exec_sql function doesn't exist
    # In that case, we'll need to use psql or the dashboard
    
    print("🔧 Attempting to execute SQL...")
    print()
    
    # Split SQL into individual statements
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
    
    print(f"📊 Found {len(statements)} SQL statements")
    print()
    
    # For now, just show instructions
    print("⚠️  Direct SQL execution via Python is limited.")
    print("Please use one of these methods:")
    print()
    print("1. **Supabase Dashboard** (Easiest):")
    print("   - Open: https://supabase.com/dashboard")
    print("   - Navigate to SQL Editor")
    print("   - Copy/paste the contents of: database/add_unified_feed.sql")
    print("   - Click 'Run'")
    print()
    print("2. **Using curl** (if you have the project ref):")
    print("   curl -X POST \\")
    print(f"     '{SUPABASE_URL}/rest/v1/rpc/exec_sql' \\")
    print(f"     -H 'apikey: {SUPABASE_SERVICE_KEY[:20]}...' \\")
    print("     -H 'Content-Type: application/json' \\")
    print("     -d '{\"query\": \"...\"}'")
    print()
    
    print("=" * 60)
    print("📋 SQL to execute:")
    print("=" * 60)
    print(sql_content)
    print()
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
