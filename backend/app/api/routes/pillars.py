"""
Pillars API endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from loguru import logger

from app.services.supabase_client import supabase
from app.api.dependencies import CurrentUser, get_current_user

router = APIRouter()


@router.get("/")
async def get_pillars(current_user: CurrentUser = Depends(get_current_user)):
    """
    Get all pillars for the current user's organization.
    Strict organization filtering.
    """
    try:
        response = supabase.table("pillars").select("*")\
            .eq("organization_id", str(current_user.organization_id))\
            .order("created_at", desc=False)\
            .execute()
        
        logger.info(f"✅ Retrieved {len(response.data) if response.data else 0} pillars for org {current_user.organization_id}")
        
        return response.data if response.data else []
        
    except Exception as e:
        logger.error(f"Error fetching pillars: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pillar_id}")
async def get_pillar(pillar_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """
    Get single pillar with cluster count.
    Strict organization filtering.
    """
    try:
        response = supabase.table("pillars").select(
            "*, clusters(count)"
        ).eq("id", pillar_id).eq("organization_id", str(current_user.organization_id)).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Pillar not found")
        
        logger.info(f"✅ Retrieved pillar {pillar_id} for org {current_user.organization_id}")
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching pillar: {e}")
        raise HTTPException(status_code=500, detail=str(e))

