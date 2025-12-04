#!/usr/bin/env python3
"""
Apply the unified feed SQL using direct PostgreSQL connection
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Get Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD", "")

if not SUPABASE_URL:
    print("❌ Missing SUPABASE_URL in .env")
    sys.exit(1)

# Extract project ref from URL
# Format: https://PROJECT_REF.supabase.co
project_ref = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")

print("=" * 60)
print("🔧 SQL Migration: Unified Feed Function")
print("=" * 60)
print()

# Read the SQL file
sql_file_path = "database/add_unified_feed.sql"

try:
    with open(sql_file_path, 'r') as f:
        sql_content = f.read()
    
    print(f"✅ SQL file loaded: {sql_file_path}")
    print(f"📊 Size: {len(sql_content)} bytes")
    print()
    
except Exception as e:
    print(f"❌ Error reading SQL file: {e}")
    sys.exit(1)

print("=" * 60)
print("📋 INSTRUCTIONS TO APPLY SQL")
print("=" * 60)
print()
print("**Option 1: Supabase Dashboard** (Recommended)")
print("-" * 60)
print("1. Open your Supabase project dashboard")
print("2. Go to: SQL Editor (left sidebar)")
print("3. Click 'New Query'")
print("4. Copy the entire content from: database/add_unified_feed.sql")
print("5. Paste it into the editor")
print("6. Click 'Run' or press Cmd+Enter")
print()
print("**Option 2: Using psql** (if installed)")
print("-" * 60)
if SUPABASE_DB_PASSWORD:
    connection_string = f"postgresql://postgres:{SUPABASE_DB_PASSWORD}@db.{project_ref}.supabase.co:5432/postgres"
    print(f"psql \"{connection_string}\" -f {sql_file_path}")
else:
    print(f"psql \"postgresql://postgres:[YOUR_DB_PASSWORD]@db.{project_ref}.supabase.co:5432/postgres\" -f {sql_file_path}")
    print()
    print("⚠️  You need your database password from Supabase Dashboard > Settings > Database")
print()
print("=" * 60)
print("🔍 What this SQL does:")
print("=" * 60)
print("✓ Creates/replaces the get_unified_feed() function")
print("✓ Fixes column ambiguity issues (c.id, n.id, post.id)")
print("✓ Removes non-existent avatar_url column")
print("✓ Creates optimized indexes for feed queries")
print("✓ Creates v_feed_stats view for statistics")
print()
print("=" * 60)
print("📝 After applying, test with:")
print("=" * 60)
print("python test_feed_endpoint.py")
print()
