"""
Users API endpoints
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException
from loguru import logger

from app.services.supabase_client import supabase

router = APIRouter()


@router.get("/{user_id}")
async def get_user(user_id: UUID):
    """
    Get user profile
    """
    try:
        response = supabase.table("users").select("*").eq("id", str(user_id)).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/email/{email}")
async def get_user_by_email(email: str):
    """
    Get user by email (for login/lookup)
    """
    try:
        response = supabase.table("users").select("*").eq("email", email).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

