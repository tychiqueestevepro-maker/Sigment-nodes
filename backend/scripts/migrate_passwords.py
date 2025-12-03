"""
Migration script to hash existing plaintext passwords in the database
Run this ONCE after deploying the password hashing feature
"""
import asyncio
from app.services.supabase_client import supabase
from app.core.auth import hash_password
from loguru import logger


async def migrate_passwords():
    """
    Hash all existing plaintext passwords
    WARNING: This assumes passwords are currently stored in plaintext
    """
    try:
        # 1. Fetch all users
        response = supabase.table("users").select("id, email, password").execute()
        
        if not response.data:
            logger.info("No users found")
            return
            
        users = response.data
        logger.info(f"Found {len(users)} users to migrate")
        
        # 2. Hash each password
        for user in users:
            user_id = user["id"]
            email = user["email"]
            plain_password = user["password"]
            
            # Skip if password looks already hashed (bcrypt starts with $2b$)
            if plain_password.startswith("$2b$"):
                logger.info(f"✅ User {email}: Password already hashed, skipping")
                continue
                
            # Hash the password
            hashed = hash_password(plain_password)
            
            # Update in database
            supabase.table("users").update({
                "password": hashed
            }).eq("id", user_id).execute()
            
            logger.info(f"✅ User {email}: Password hashed successfully")
        
        logger.info(f"✅ Migration complete: {len(users)} users processed")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(migrate_passwords())
