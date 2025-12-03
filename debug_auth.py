
import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.supabase_client import supabase

async def debug_auth():
    email = "tycgfr@gmail.com"
    print(f"Debugging auth for {email}...")
    
    # 1. Get User
    user_response = supabase.table("users").select("*").eq("email", email).execute()
    if not user_response.data:
        print("User not found")
        return
    
    user = user_response.data[0]
    print(f"User found: {user['id']}")
    
    # 2. Get Membership
    try:
        membership_response = supabase.table("memberships").select(
            """
            role,
            job_title,
            organizations!inner(*)
            """
        ).eq("user_id", user["id"]).limit(1).execute()
        
        if not membership_response.data:
            print("No membership found")
            return
            
        membership = membership_response.data[0]
        print("Membership data structure:")
        print(membership)
        
        org = membership.get("organizations")
        print(f"Organization type: {type(org)}")
        print(f"Organization data: {org}")
        
    except Exception as e:
        print(f"Error querying memberships: {e}")

if __name__ == "__main__":
    asyncio.run(debug_auth())
