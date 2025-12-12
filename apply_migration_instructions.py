#!/usr/bin/env python3
"""
Apply comments migration using Supabase REST API
"""
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from dotenv import load_dotenv

# Load env
load_dotenv(Path(__file__).parent / "backend" / ".env")

# Get Supabase connection details
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing Supabase credentials in backend/.env")
    print("Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)")
    sys.exit(1)

print(f"🔗 Supabase URL: {SUPABASE_URL}")
print("\n⚠️  To apply this migration, please:")
print("=" * 60)
print("1. Go to your Supabase Dashboard:")
print(f"   {SUPABASE_URL.replace('https://', 'https://app.supabase.com/project/')}/editor")
print("\n2. Go to SQL Editor")
print("\n3. Click 'New Query'")
print("\n4. Copy and paste the contents of:")
print("   database/add_social_feed_optimized.sql")
print("\n5. Click 'Run'")
print("=" * 60)
print("\nThis will update the comment RPC functions to include all required fields.")
print("\nAfter running, refresh your browser to see your comments! 🎉")
