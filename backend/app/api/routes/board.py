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
            
            # Extract note IDs for moderation actions
            note_ids = [note.get("id") for note in notes if note.get("id")]
            
            galaxy_item = {
                "id": cluster["id"],
                "title": cluster.get("title", "Untitled Cluster"),
                "pillar": pillar_info.get("name", "Unknown") if pillar_info else "Unknown",
                "pillar_id": cluster.get("pillar_id"),
                "impact_score": round(avg_score, 2),
                "volume": len(notes),
                "last_updated": cluster.get("last_updated_at"),
                "note_ids": note_ids,  # Add note IDs for moderation
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


@router.get("/cluster/{cluster_id}/history")
async def get_cluster_history(cluster_id: str):
    """
    Get the complete history of a cluster with all snapshots (Time Machine).
    
    Returns:
    - Cluster basic info
    - All snapshots ordered chronologically
    - Notes (evidence) for each snapshot
    """
    try:
        supabase = get_supabase()
        
        # 1. Get cluster basic info
        cluster_response = supabase.table("clusters").select(
            """
            id,
            title,
            pillar_id,
            pillars(id, name),
            note_count,
            avg_relevance_score,
            created_at,
            last_updated_at
            """
        ).eq("id", cluster_id).execute()
        
        if not cluster_response.data:
            logger.error(f"❌ Cluster {cluster_id} not found")
            return {"error": "Cluster not found"}, 404
        
        cluster = cluster_response.data[0]
        
        # 2. Get all snapshots for this cluster (ordered by created_at ASC)
        snapshots_response = supabase.table("cluster_snapshots").select(
            """
            id,
            synthesis_text,
            metrics_json,
            included_note_ids,
            created_at
            """
        ).eq("cluster_id", cluster_id).order("created_at", desc=False).execute()
        
        snapshots = snapshots_response.data if snapshots_response.data else []
        
        # 3. For each snapshot, get the associated notes (evidence)
        enriched_snapshots = []
        for snapshot in snapshots:
            note_ids = snapshot.get("included_note_ids", [])
            
            if note_ids:
                # Get notes details
                notes_response = supabase.table("notes").select(
                    """
                    id,
                    content_clarified,
                    ai_relevance_score,
                    created_at,
                    users(first_name, last_name, job_title, department)
                    """
                ).in_("id", note_ids).execute()
                
                evidence = []
                for note in notes_response.data if notes_response.data else []:
                    user_info = note.get("users", {})
                    # Build full name
                    first_name = user_info.get("first_name", "")
                    last_name = user_info.get("last_name", "")
                    full_name = f"{first_name} {last_name}".strip() or "Anonymous"
                    
                    evidence.append({
                        "id": note["id"],
                        "content": note.get("content_clarified", ""),
                        "relevance_score": note.get("ai_relevance_score"),
                        "author": {
                            "name": full_name,
                            "job_title": user_info.get("job_title", "Unknown"),
                            "department": user_info.get("department", "Unknown")
                        },
                        "created_at": note.get("created_at")
                    })
            else:
                evidence = []
            
            enriched_snapshots.append({
                "id": snapshot["id"],
                "synthesis": snapshot.get("synthesis_text", ""),
                "metrics": snapshot.get("metrics_json", {}),
                "evidence_count": len(evidence),
                "evidence": evidence,
                "timestamp": snapshot.get("created_at")
            })
        
        # 4. Build the response
        result = {
            "cluster": {
                "id": cluster["id"],
                "title": cluster.get("title", "Untitled"),
                "pillar": cluster.get("pillars", {}).get("name", "Unknown") if cluster.get("pillars") else "Unknown",
                "note_count": cluster.get("note_count", 0),
                "avg_impact": round(cluster.get("avg_relevance_score", 0), 2),
                "created_at": cluster.get("created_at"),
                "last_updated_at": cluster.get("last_updated_at")
            },
            "snapshots": enriched_snapshots,
            "total_snapshots": len(enriched_snapshots)
        }
        
        logger.info(f"✅ Retrieved history for cluster {cluster_id}: {len(enriched_snapshots)} snapshots")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error fetching cluster history: {e}")
        raise


@router.get("/review-notes")
async def get_review_notes():
    """
    Get all notes with 'review' status for the Review Queue page.
    
    Returns notes that have been marked for review by executives.
    """
    try:
        supabase = get_supabase()
        
        # Query notes with review status, including cluster info
        response = supabase.table("notes").select(
            """
            id,
            content_raw,
            content_clarified,
            created_at,
            processed_at,
            ai_relevance_score,
            cluster_id,
            user_id,
            clusters(id, title, pillar_id, pillars(id, name))
            """
        ).eq("status", "review").order("created_at", desc=True).execute()
        
        if not response.data:
            return []
        
        # Transform data for frontend
        review_notes = []
        for note in response.data:
            cluster_info = note.get("clusters", {})
            pillar_info = cluster_info.get("pillars", {}) if cluster_info else {}
            
            # Truncate title if needed
            raw_content = note.get("content_raw", "")
            clarified = note.get("content_clarified", "")
            title = clarified if clarified else (raw_content[:100] + "..." if len(raw_content) > 100 else raw_content)
            
            review_notes.append({
                "id": note["id"],
                "title": title,
                "content": raw_content,
                "category": pillar_info.get("name", "UNCATEGORIZED") if pillar_info else "UNCATEGORIZED",
                "status": "Ready",
                "author": "User",  # We'll enhance this later with proper user data
                "date": note.get("created_at", ""),
                "relevance_score": note.get("ai_relevance_score", 0),
                "cluster_id": note.get("cluster_id"),
                "cluster_title": cluster_info.get("title") if cluster_info else None,
            })
        
        logger.info(f"✅ Retrieved {len(review_notes)} notes for review")
        
        return review_notes
        
    except Exception as e:
        logger.error(f"❌ Error fetching review notes: {e}")
        raise

