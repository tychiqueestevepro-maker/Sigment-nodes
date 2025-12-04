#!/usr/bin/env python3
"""
Quick test script to debug the unified feed endpoint
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

# Test 1: Check if function exists
print("=" * 60)
print("TEST 1: Checking if get_unified_feed function exists...")
print("=" * 60)

try:
    # Try to call the function with dummy data
    result = supabase.rpc(
        "get_unified_feed",
        {
            "p_organization_id": "00000000-0000-0000-0000-000000000000",
            "p_current_user_id": "00000000-0000-0000-0000-000000000000",
            "p_limit": 10
        }
    ).execute()
    
    print(f"✅ Function exists!")
    print(f"📊 Result: {len(result.data) if result.data else 0} items returned")
    print()
    
except Exception as e:
    print(f"❌ Function call failed: {e}")
    print()
    print("💡 The function might not exist. Run the SQL script:")
    print("   database/add_unified_feed.sql")
    print()

# Test 2: Get actual organizations
print("=" * 60)
print("TEST 2: Fetching existing organizations...")
print("=" * 60)

try:
    orgs = supabase.table("organizations").select("id, name, slug").limit(5).execute()
    
    if orgs.data:
        print(f"✅ Found {len(orgs.data)} organizations:")
        for org in orgs.data:
            print(f"   - {org['name']} (slug: {org['slug']}, id: {org['id']})")
        print()
        
        # Test with real organization
        if orgs.data:
            org_id = orgs.data[0]['id']
            
            print("=" * 60)
            print(f"TEST 3: Testing feed with real org: {orgs.data[0]['name']}")
            print("=" * 60)
            
            try:
                # Get a user from this org
                users = supabase.table("users").select("id").eq("organization_id", org_id).limit(1).execute()
                
                user_id = users.data[0]['id'] if users.data else org_id
                
                result = supabase.rpc(
                    "get_unified_feed",
                    {
                        "p_organization_id": org_id,
                        "p_current_user_id": user_id,
                        "p_limit": 50
                    }
                ).execute()
                
                print(f"✅ Feed retrieved successfully!")
                print(f"📊 Total items: {len(result.data) if result.data else 0}")
                
                if result.data:
                    # Count by type
                    types = {}
                    for item in result.data:
                        item_type = item.get('type', 'UNKNOWN')
                        types[item_type] = types.get(item_type, 0) + 1
                    
                    print(f"📈 Breakdown:")
                    for item_type, count in types.items():
                        print(f"   - {item_type}: {count}")
                    
                    print()
                    print("📝 Sample items:")
                    for item in result.data[:3]:
                        print(f"   - Type: {item['type']}, ID: {item['id']}")
                        if item.get('data'):
                            data = item['data']
                            if 'title' in data:
                                print(f"     Title: {data['title']}")
                            elif 'content' in data:
                                content = data['content'][:50] + "..." if len(data['content']) > 50 else data['content']
                                print(f"     Content: {content}")
                else:
                    print("⚠️  Feed is empty (no items returned)")
                    print()
                    print("💡 This could mean:")
                    print("   - No clusters in the last 48h")
                    print("   - No orphan notes")
                    print("   - No posts")
                
            except Exception as e:
                print(f"❌ Feed test failed: {e}")
    else:
        print("⚠️  No organizations found in database")
        
except Exception as e:
    print(f"❌ Failed to fetch organizations: {e}")

print()
print("=" * 60)
print("DONE")
print("=" * 60)
