"""
Unified Feed API - Polymorphic Feed (Clusters + Notes)
Anti-Bruit logic: Only orphan notes + my notes + active clusters
"""
from typing import List, Union, Literal, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query, HTTPException, status
from loguru import logger

from app.api.dependencies import get_current_user, get_supabase_client, CurrentUser


router = APIRouter(prefix="/feed/unified", tags=["Unified Feed"])


# ============================================
# MODELS - Polymorphic Feed Items
# ============================================

class ClusterFeedItem(BaseModel):
    """Cluster dans le feed unifié"""
    type: Literal["CLUSTER"] = "CLUSTER"
    id: str
    title: str
    note_count: int
    velocity_score: float
    pillar_id: Optional[str] = None
    pillar_name: Optional[str] = None
    pillar_color: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False
    created_at: datetime
    last_updated_at: datetime
    preview_notes: Optional[List[dict]] = Field(default_factory=list)
    sort_date: datetime


class NoteFeedItem(BaseModel):
    """Note dans le feed unifié"""
    type: Literal["NOTE"] = "NOTE"
    id: str
    title: Optional[str] = None  # AI-generated clarified title
    content: str
    content_raw: Optional[str] = None
    content_clarified: Optional[str] = None
    status: str
    cluster_id: Optional[str] = None
    pillar_id: Optional[str] = None
    pillar_name: Optional[str] = None
    pillar_color: Optional[str] = None
    ai_relevance_score: Optional[float] = None
    user_id: str
    is_mine: bool
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False
    created_at: datetime
    processed_at: Optional[datetime] = None
    sort_date: datetime


class PostFeedItem(BaseModel):
    """Post standard dans le feed unifié"""
    type: Literal["POST"] = "POST"
    id: str
    content: str
    post_type: str
    media_urls: Optional[List[str]] = None
    has_poll: bool = False
    user_id: str
    user_info: Optional[dict] = None
    likes_count: int
    comments_count: int
    saves_count: Optional[int] = 0
    shares_count: Optional[int] = 0
    virality_score: float = 0.0  # For algorithmic ranking
    is_liked: bool = False
    is_saved: bool = False
    is_mine: bool
    created_at: datetime
    sort_date: datetime


# Union discriminée pour le polymorphisme
FeedItem = Union[ClusterFeedItem, NoteFeedItem, PostFeedItem]


class UnifiedFeedResponse(BaseModel):
    """Réponse du feed unifié"""
    items: List[FeedItem]
    total_count: int
    stats: dict = Field(default_factory=dict)


# ============================================
# ENDPOINT: Get Unified Feed
# ============================================

@router.get("/", response_model=UnifiedFeedResponse)
@router.get("/", response_model=UnifiedFeedResponse)
def get_unified_feed(
    limit: int = Query(default=50, ge=1, le=100, description="Number of items to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    current_user: CurrentUser = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Unified polymorphic feed combining Clusters, Notes and Posts.
    
    **OPTIMIZED VERSION - Uses SQL RPC function for performance**
    
    **Anti-Noise Logic:**
    - **Clusters**: Only active ones in last 48h with 2+ notes
    - **Notes**: Only orphan (not clustered) OR my notes OR from small clusters
    - **Posts**: Standard posts (excludes 'linked_idea'), last 30 days
    """
    organization_id = str(current_user.organization_id)
    user_id = str(current_user.id)
    
    items = []
    
    # ============================================
    # EXECUTE OPTIMIZED RPC
    # ============================================
    try:
        response = supabase.rpc(
            'get_unified_feed_optimized',
            {
                'p_organization_id': organization_id,
                'p_user_id': user_id,
                'p_limit': limit,
                'p_offset': offset
            }
        ).execute()
        
        if response.data:
            # ============================================
            # MAP RPC RESULT TO PYDANTIC MODELS
            # ============================================
            for row in response.data:
                item_type = row.get('item_type')
                
                if item_type == 'CLUSTER':
                    items.append(ClusterFeedItem(
                        type="CLUSTER",
                        id=row['id'],
                        title=row.get('title') or 'Untitled Cluster',
                        note_count=row.get('note_count') or 0,
                        velocity_score=row.get('velocity_score') or 0.0,
                        pillar_id=row.get('pillar_id'),
                        pillar_name=row.get('pillar_name'),
                        pillar_color=row.get('pillar_color'),
                        likes_count=row.get('likes_count') or 0,
                        comments_count=row.get('comments_count') or 0,
                        is_liked=row.get('is_liked') or False,
                        created_at=row['created_at'],
                        last_updated_at=row.get('last_updated_at') or row['created_at'],
                        preview_notes=row.get('preview_notes') or [],
                        sort_date=row['sort_date']
                    ))
                    
                elif item_type == 'NOTE':
                    title = row.get('title_clarified')
                    if not title:
                        content = row.get('content') or row.get('content_clarified') or row.get('content_raw') or ""
                        title = content[:80] + "..." if len(content) > 80 else content
                    
                    items.append(NoteFeedItem(
                        type="NOTE",
                        id=row['id'],
                        title=title,
                        content=row.get('content') or "",
                        content_raw=row.get('content_raw'),
                        content_clarified=row.get('content_clarified'),
                        status=row.get('status') or 'processed',
                        cluster_id=row.get('cluster_id'),
                        pillar_id=row.get('pillar_id'),
                        pillar_name=row.get('pillar_name'),
                        pillar_color=row.get('pillar_color'),
                        ai_relevance_score=row.get('ai_relevance_score'),
                        user_id=row.get('user_id') or "",
                        is_mine=row.get('is_mine') or False,
                        likes_count=row.get('likes_count') or 0,
                        comments_count=row.get('comments_count') or 0,
                        is_liked=row.get('is_liked') or False,
                        created_at=row['created_at'],
                        processed_at=row.get('processed_at'),
                        sort_date=row['sort_date']
                    ))
                    
                elif item_type == 'POST':
                    items.append(PostFeedItem(
                        type="POST",
                        id=row['id'],
                        content=row.get('content') or "",
                        post_type=row.get('post_type') or 'standard',
                        media_urls=row.get('media_urls'),
                        has_poll=row.get('has_poll') or False,
                        user_id=row.get('user_id') or "",
                        user_info=row.get('user_info'),
                        likes_count=row.get('likes_count') or 0,
                        comments_count=row.get('comments_count') or 0,
                        saves_count=row.get('saves_count') or 0,
                        shares_count=row.get('shares_count') or 0,
                        virality_score=row.get('virality_score') or 0.0,
                        is_liked=row.get('is_liked') or False,
                        is_saved=row.get('is_saved') or False,
                        is_mine=row.get('is_mine') or False,
                        created_at=row['created_at'],
                        sort_date=row['sort_date']
                    ))
            
            logger.info(f"📊 Feed (optimized RPC): {len(items)} items returned")
        else:
            logger.info(f"📊 Feed: No items found for org {organization_id}")

    except Exception as e:
        logger.error(f"❌ RPC Failed provided by optimized feed with error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching feed: {str(e)}"
        )
    
    # ============================================
    # GET FEED STATS (Optional)
    # ============================================
    stats = {}
    try:
        stats_response = supabase.table("v_feed_stats").select("*").eq(
            "organization_id", organization_id
        ).execute()
        
        if stats_response.data and len(stats_response.data) > 0:
            stats = stats_response.data[0]
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch feed stats: {e}")
        stats = {}
    
    return UnifiedFeedResponse(
        items=items,
        total_count=len(items),
        stats=stats
    )


# ============================================
# ENDPOINT: Get Feed Stats
# ============================================

@router.get("/stats")
def get_feed_stats(
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Statistiques du feed unifié
    
    Retourne:
    - Nombre de notes orphelines
    - Nombre de notes clustérisées
    - Nombre de clusters actifs
    - Date de la dernière note
    """
    try:
        organization_id = str(current_user.organization_id)
        
        stats_response = supabase.table("v_feed_stats").select("*").eq(
            "organization_id", organization_id
        ).execute()
        
        if not stats_response.data or len(stats_response.data) == 0:
            return {
                "orphan_notes_count": 0,
                "clustered_notes_count": 0,
                "active_clusters_count": 0,
                "last_note_at": None
            }
        
        return stats_response.data[0]
        
    except Exception as e:
        logger.error(f"❌ Error fetching feed stats: {e}")
        raise


# ============================================
# ENDPOINT: Get Item Details (Polymorphic)
# ============================================

@router.get("/{item_type}/{item_id}")
def get_feed_item_details(
    item_type: Literal["cluster", "note"],
    item_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Récupère les détails complets d'un item du feed
    
    **item_type** : "cluster" ou "note"
    **item_id** : UUID de l'item
    """
    try:
        organization_id = str(current_user.organization_id)
        user_id = str(current_user.id)
        
        if item_type == "cluster":
            # Fetch cluster with all notes
            cluster_response = supabase.table("clusters").select(
                "*, pillars(name, color)"
            ).eq("id", item_id).eq("organization_id", organization_id).single().execute()
            
            if not cluster_response.data:
                raise HTTPException(status_code=404, detail="Cluster not found")
            
            cluster = cluster_response.data
            
            # Check if user liked this cluster
            is_liked = False
            try:
                like_check = supabase.table("cluster_likes").select("id").eq(
                    "cluster_id", item_id
                ).eq("user_id", user_id).execute()
                is_liked = bool(like_check.data and len(like_check.data) > 0)
            except:
                pass
            
            # Get preview notes
            preview_notes = []
            try:
                notes_resp = supabase.table("notes").select(
                    "id, content_clarified, content_raw"
                ).eq("cluster_id", item_id).limit(5).execute()
                for n in (notes_resp.data or []):
                    preview_notes.append({
                        "id": n["id"],
                        "content": n.get("content_clarified") or n.get("content_raw")
                    })
            except:
                pass
            
            return {
                "id": cluster["id"],
                "title": cluster["title"],
                "note_count": cluster.get("note_count", 0),
                "pillar_id": cluster.get("pillar_id"),
                "pillar_name": cluster.get("pillars", {}).get("name") if cluster.get("pillars") else None,
                "pillar_color": cluster.get("pillars", {}).get("color") if cluster.get("pillars") else None,
                "likes_count": cluster.get("likes_count", 0),
                "comments_count": cluster.get("comments_count", 0),
                "is_liked": is_liked,
                "preview_notes": preview_notes,
                "created_at": cluster["created_at"],
                "last_updated_at": cluster["last_updated_at"],
            }
            
        elif item_type == "note":
            # Fetch note with details
            note_response = supabase.table("notes").select(
                "*, users(email, first_name, last_name, avatar_url), pillars(name, color), clusters(title)"
            ).eq("id", item_id).eq("organization_id", organization_id).single().execute()
            
            if not note_response.data:
                raise HTTPException(status_code=404, detail="Note not found")
            
            note = note_response.data
            
            # Check if user liked this note
            is_liked = False
            try:
                like_check = supabase.table("note_likes").select("id").eq(
                    "note_id", item_id
                ).eq("user_id", user_id).execute()
                is_liked = bool(like_check.data and len(like_check.data) > 0)
            except:
                pass
            
            user_info = note.get("users") or {}
            
            return {
                "id": note["id"],
                "title": note.get("title_clarified"),
                "content": note.get("content_clarified") or note.get("content_raw"),
                "content_raw": note.get("content_raw"),
                "content_clarified": note.get("content_clarified"),
                "status": note["status"],
                "pillar_id": note.get("pillar_id"),
                "pillar_name": note.get("pillars", {}).get("name") if note.get("pillars") else None,
                "pillar_color": note.get("pillars", {}).get("color") if note.get("pillars") else None,
                "cluster_id": note.get("cluster_id"),
                "ai_relevance_score": note.get("ai_relevance_score"),
                "user_id": note["user_id"],
                "user_info": {
                    "email": user_info.get("email"),
                    "first_name": user_info.get("first_name"),
                    "last_name": user_info.get("last_name"),
                    "avatar_url": user_info.get("avatar_url"),
                },
                "likes_count": note.get("likes_count", 0),
                "comments_count": note.get("comments_count", 0),
                "is_liked": is_liked,
                "created_at": note["created_at"],
                "processed_at": note.get("processed_at"),
            }
        
        else:
            raise HTTPException(status_code=400, detail="Invalid item type")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching item details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT: Like/Unlike Note
# ============================================

class EngagementResponse(BaseModel):
    success: bool
    action: str
    new_count: int


@router.post("/notes/{note_id}/like", response_model=EngagementResponse)
def toggle_like_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Like ou Unlike une note (toggle)
    """
    try:
        user_id = str(current_user.id)
        organization_id = str(current_user.organization_id)
        
        # Vérifier que la note existe et appartient à l'org
        note = supabase.table("notes").select("id, likes_count").eq(
            "id", note_id
        ).eq("organization_id", organization_id).execute()
        
        if not note.data or len(note.data) == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Check if already liked
        existing = supabase.table("note_likes").select("id").eq(
            "note_id", note_id
        ).eq("user_id", user_id).execute()
        
        if existing.data and len(existing.data) > 0:
            # Unlike
            supabase.table("note_likes").delete().eq(
                "note_id", note_id
            ).eq("user_id", user_id).execute()
            action = "unliked"
        else:
            # Like
            supabase.table("note_likes").insert({
                "note_id": note_id,
                "user_id": user_id
            }).execute()
            action = "liked"
        
        # Get updated count (trigger should have updated it)
        updated_note = supabase.table("notes").select("likes_count").eq("id", note_id).single().execute()
        new_count = updated_note.data.get("likes_count", 0) if updated_note.data else 0
        
        logger.info(f"✅ Note {action}: {note_id} by user {user_id}")
        
        return EngagementResponse(success=True, action=action, new_count=new_count)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error toggling like for note {note_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT: Like/Unlike Cluster
# ============================================

@router.post("/clusters/{cluster_id}/like", response_model=EngagementResponse)
def toggle_like_cluster(
    cluster_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Like ou Unlike un cluster (toggle)
    """
    try:
        user_id = str(current_user.id)
        organization_id = str(current_user.organization_id)
        
        # Vérifier que le cluster existe et appartient à l'org
        cluster = supabase.table("clusters").select("id, likes_count").eq(
            "id", cluster_id
        ).eq("organization_id", organization_id).execute()
        
        if not cluster.data or len(cluster.data) == 0:
            raise HTTPException(status_code=404, detail="Cluster not found")
        
        # Check if already liked
        existing = supabase.table("cluster_likes").select("id").eq(
            "cluster_id", cluster_id
        ).eq("user_id", user_id).execute()
        
        if existing.data and len(existing.data) > 0:
            # Unlike
            supabase.table("cluster_likes").delete().eq(
                "cluster_id", cluster_id
            ).eq("user_id", user_id).execute()
            action = "unliked"
        else:
            # Like
            supabase.table("cluster_likes").insert({
                "cluster_id": cluster_id,
                "user_id": user_id
            }).execute()
            action = "liked"
        
        # Get updated count
        updated_cluster = supabase.table("clusters").select("likes_count").eq("id", cluster_id).single().execute()
        new_count = updated_cluster.data.get("likes_count", 0) if updated_cluster.data else 0
        
        logger.info(f"✅ Cluster {action}: {cluster_id} by user {user_id}")
        
        return EngagementResponse(success=True, action=action, new_count=new_count)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error toggling like for cluster {cluster_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
