"""
Board & Galaxy View API Routes
"""
from fastapi import APIRouter, Query
from typing import Optional
from loguru import logger
from app.services.supabase_client import get_supabase

router = APIRouter()


@router.get("/galaxy")
async def get_galaxy_view(
    min_relevance: Optional[float] = Query(None, ge=0, le=10, description="Minimum relevance score"),
    pillar_id: Optional[str] = Query(None, description="Filter by pillar ID"),
):
    """
    Get aggregated cluster data for the Galaxy visualization.
    
    Returns clusters with:
    - Average AI relevance score (impact_score)
    - Note count (volume)
    - Pillar information
    - Last update timestamp
    """
    try:
        supabase = get_supabase()
        
        # Query clusters with their pillar info and notes
        query = supabase.table("clusters").select(
            """
            id,
            title,
            last_updated_at,
            pillar_id,
            pillars(id, name),
            notes!inner(id, ai_relevance_score, status)
            """
        )
        
        # Apply pillar filter if provided
        if pillar_id:
            query = query.eq("pillar_id", pillar_id)
        
        # Only get clusters with processed notes
        query = query.eq("notes.status", "processed")
        
        response = query.execute()
        
        if not response.data:
            return []
        
        # Process and aggregate data
        galaxy_data = []
        
        for cluster in response.data:
            notes = cluster.get("notes", [])
            
            if not notes:
                continue
            
            # Calculate average relevance score
            relevance_scores = [note.get("ai_relevance_score", 0) for note in notes if note.get("ai_relevance_score")]
            avg_score = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0
            
            # Apply minimum relevance filter
            if min_relevance and avg_score < min_relevance:
                continue
            
            pillar_info = cluster.get("pillars", {})
            
            galaxy_item = {
                "id": cluster["id"],
                "title": cluster.get("title", "Untitled Cluster"),
                "pillar": pillar_info.get("name", "Unknown") if pillar_info else "Unknown",
                "pillar_id": cluster.get("pillar_id"),
                "impact_score": round(avg_score, 2),
                "volume": len(notes),
                "last_updated": cluster.get("last_updated_at"),
            }
            
            galaxy_data.append(galaxy_item)
        
        # Sort by impact score descending
        galaxy_data.sort(key=lambda x: x["impact_score"], reverse=True)
        
        logger.info(f"✅ Retrieved {len(galaxy_data)} clusters for Galaxy view")
        
        return galaxy_data
        
    except Exception as e:
        logger.error(f"❌ Error fetching galaxy data: {e}")
        raise


@router.get("/pillars")
async def get_pillars():
    """
    Get all available pillars for filtering.
    """
    try:
        supabase = get_supabase()
        response = supabase.table("pillars").select("id, name, description").execute()
        
        logger.info(f"✅ Retrieved {len(response.data)} pillars")
        
        return response.data
        
    except Exception as e:
        logger.error(f"❌ Error fetching pillars: {e}")
        raise

