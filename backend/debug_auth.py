"""
Test authentication with headers
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Test values from the screenshot
user_id = "b4d6df65-2f5c-44f9-bcea-8d8ab4c94b721"
org_id = "1923eb01-105d-4272-a67a-9a9477e4af6a"

print("=" * 80)
print("Testing get_current_user logic")
print("=" * 80)

print(f"\nUser ID: {user_id}")
print(f"Org ID: {org_id}")

# Try the exact query from get_current_user
try:
    print("\n1. Testing membership query...")
    membership_response = supabase.table("memberships").select(
        """
        role,
        job_title,
        users!inner(id, email),
        organizations!inner(id, slug, status)
        """
    ).eq("user_id", user_id).eq("organization_id", org_id).execute()
    
    print(f"   Response data: {membership_response.data}")
    
    if not membership_response.data:
        print("   ❌ No membership found!")
    else:
        print("   ✅ Membership found!")
        membership = membership_response.data[0]
        print(f"   - Role: {membership.get('role')}")
        print(f"   - User: {membership.get('users')}")
        print(f"   - Org: {membership.get('organizations')}")
        
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

# Test simpler query
print("\n2. Testing simple membership query...")
try:
    simple_response = supabase.table("memberships").select("*").eq("user_id", user_id).eq("organization_id", org_id).execute()
    print(f"   Found {len(simple_response.data) if simple_response.data else 0} memberships")
    if simple_response.data:
        print(f"   Data: {simple_response.data[0]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Check if user exists
print("\n3. Checking if user exists...")
try:
    user_response = supabase.table("users").select("*").eq("id", user_id).execute()
    print(f"   Found {len(user_response.data) if user_response.data else 0} users")
    if user_response.data:
        print(f"   User: {user_response.data[0].get('email')}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 80)
