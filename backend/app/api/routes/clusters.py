"""
Clusters API endpoints
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query
from loguru import logger

from app.services.supabase_client import supabase

router = APIRouter()


@router.get("/")
async def get_clusters(pillar_id: Optional[UUID] = None):
    """
    Get all clusters, optionally filtered by pillar
    """
    try:
        query = supabase.table("clusters").select("*, pillars(name, color)")
        
        if pillar_id:
            query = query.eq("pillar_id", str(pillar_id))
        
        response = query.order("last_updated_at", desc=True).execute()
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching clusters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{cluster_id}")
async def get_cluster(cluster_id: UUID):
    """
    Get cluster details with notes
    """
    try:
        response = supabase.table("clusters").select(
            "*, pillars(name, color), notes!inner(*, users(job_title, department))"
        ).eq("id", str(cluster_id)).eq("notes.status", "processed").single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Cluster not found")
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching cluster: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{cluster_id}/snapshots")
async def get_cluster_snapshots(
    cluster_id: UUID,
    limit: int = Query(default=50, le=100)
):
    """
    Get cluster snapshots (for time-lapse feature)
    Returns snapshots ordered by creation date
    """
    try:
        response = supabase.table("cluster_snapshots").select("*").eq(
            "cluster_id", str(cluster_id)
        ).order("created_at", desc=False).limit(limit).execute()
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching cluster snapshots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{cluster_id}/timeline")
async def get_cluster_timeline(cluster_id: UUID):
    """
    Get cluster evolution timeline (simplified for time-lapse slider)
    Returns key snapshots with timestamp
    """
    try:
        response = supabase.table("cluster_snapshots").select(
            "id, created_at, synthesis_text, note_count, avg_relevance_score, metrics_json"
        ).eq("cluster_id", str(cluster_id)).order("created_at", desc=False).execute()
        
        if not response.data:
            return []
        
        # Format for timeline slider
        timeline = [
            {
                "timestamp": snapshot["created_at"],
                "note_count": snapshot["note_count"],
                "avg_score": snapshot["avg_relevance_score"],
                "synthesis": snapshot["synthesis_text"],
                "metrics": snapshot["metrics_json"],
                "snapshot_id": snapshot["id"]
            }
            for snapshot in response.data
        ]
        
        return timeline
        
    except Exception as e:
        logger.error(f"Error fetching cluster timeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))

