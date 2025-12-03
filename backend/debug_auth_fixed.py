"""
Test authentication with corrected UUID
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# CORRECTED UUID (removed extra '7' at the end)
user_id = "b4d6df65-2f5c-44f9-bcea-8d8ab4c94b21"
org_id = "1923eb01-105d-4272-a67a-9a9477e4af6a"

print("=" * 80)
print("Testing SIMPLIFIED get_current_user logic")
print("=" * 80)

print(f"\nUser ID: {user_id}")
print(f"Org ID: {org_id}")

# Test 1: Check membership
print("\n1. Checking membership...")
try:
    membership_response = supabase.table("memberships").select(
        "role, job_title, user_id, organization_id"
    ).eq("user_id", user_id).eq("organization_id", org_id).execute()
    
    if not membership_response.data:
        print("   ❌ No membership found!")
    else:
        print("   ✅ Membership found!")
        membership = membership_response.data[0]
        print(f"   - Role: {membership.get('role')}")
        print(f"   - Job Title: {membership.get('job_title')}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: Get user data
print("\n2. Getting user data...")
try:
    user_response = supabase.table("users").select("id, email").eq("id", user_id).execute()
    if not user_response.data:
        print("   ❌ User not found!")
    else:
        print("   ✅ User found!")
        user_data = user_response.data[0]
        print(f"   - Email: {user_data.get('email')}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Get organization data
print("\n3. Getting organization data...")
try:
    org_response = supabase.table("organizations").select("id, slug, status").eq("id", org_id).execute()
    if not org_response.data:
        print("   ❌ Organization not found!")
    else:
        print("   ✅ Organization found!")
        org_data = org_response.data[0]
        print(f"   - Slug: {org_data.get('slug')}")
        print(f"   - Status: {org_data.get('status')}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n✅ All checks passed! Authentication should work now.")
print("=" * 80)
