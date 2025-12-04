#!/usr/bin/env python3
"""
Apply the fixed unified feed SQL to the database
"""
import os
import sys
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

load_dotenv()

from supabase import create_client
from loguru import logger

# Get Supabase credentials from environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

# Create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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
    
    # Note: Supabase Python client doesn't support executing raw SQL directly
    # We need to use the REST API or execute via psql
    print("⚠️  To apply this SQL, you have two options:")
    print()
    print("1. **Via Supabase Dashboard** (Recommended):")
    print("   - Go to: https://supabase.com/dashboard/project/[your-project]/sql")
    print("   - Copy the contents of database/add_unified_feed.sql")
    print("   - Paste and run in the SQL Editor")
    print()
    print("2. **Via psql** (if you have it installed):")
    print(f"   psql \"{SUPABASE_URL.replace('https://', 'postgresql://postgres:[PASSWORD]@').replace('.supabase.co', '.supabase.co:5432/postgres')}\" -f {sql_file_path}")
    print()
    print("=" * 60)
    print("📋 SQL Preview (first 500 chars):")
    print("=" * 60)
    print(sql_content[:500])
    print("...")
    print()
    
except Exception as e:
    print(f"❌ Error reading SQL file: {e}")
    sys.exit(1)

print("💡 After applying the SQL, run test_feed_endpoint.py again to verify")
