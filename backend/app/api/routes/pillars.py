"""
Pillars API endpoints
"""
from fastapi import APIRouter, HTTPException
from loguru import logger

from app.services.supabase_client import supabase

router = APIRouter()


@router.get("/")
async def get_pillars():
    """
    Get all pillars
    """
    try:
        response = supabase.table("pillars").select("*").execute()
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching pillars: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pillar_id}")
async def get_pillar(pillar_id: str):
    """
    Get single pillar with cluster count
    """
    try:
        response = supabase.table("pillars").select(
            "*, clusters(count)"
        ).eq("id", pillar_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Pillar not found")
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching pillar: {e}")
        raise HTTPException(status_code=500, detail=str(e))

