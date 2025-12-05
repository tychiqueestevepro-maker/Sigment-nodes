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
    created_at: datetime
    processed_at: Optional[datetime] = None
    sort_date: datetime


class PostFeedItem(BaseModel):
    """Post standard dans le feed unifié"""
    type: Literal["POST"] = "POST"
    id: str
    content: str
    post_type: str
    user_id: str
    user_info: Optional[dict] = None
    likes_count: int
    comments_count: int
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
async def get_unified_feed(
    limit: int = Query(default=50, ge=1, le=100, description="Nombre d'items à retourner"),
    current_user: CurrentUser = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Feed unifié polymorphique mélangeant Clusters, Notes et Posts
    
    **Logique Anti-Bruit (Implémentation Python) :**
    - **Clusters** : Uniquement ceux actifs dans les dernières 48h
    - **Notes** : Uniquement orphelines (pas encore clustérisées) OU mes notes
    - **Posts** : Posts standards créés manuellement (exclus 'linked_idea')
    
    **Tri :** Par dernière activité (DESC)
    """
    organization_id = str(current_user.organization_id)
    user_id = str(current_user.id)
    
    items = []
    from datetime import timedelta
    
    try:
        # ============================================
        # 1. FETCH CLUSTERS (Active last 48h)
        # ============================================
        cutoff_48h = datetime.utcnow() - timedelta(hours=48)
        cutoff_30d = datetime.utcnow() - timedelta(days=30)
        
        # Fetch clusters sorted by update time
        clusters_response = supabase.table("clusters").select(
            "*, pillars(name, color)"
        ).eq("organization_id", organization_id).order("last_updated_at", desc=True).limit(limit).execute()
        
        active_clusters = []
        cluster_ids = [] # IDs for preview notes (only for big clusters)
        small_cluster_ids = [] # IDs for clusters with < 2 notes (to be exploded)
        
        for c in clusters_response.data:
            # Filter active in last 48h
            try:
                c_date = datetime.fromisoformat(c["last_updated_at"].replace('Z', '+00:00'))
                if c_date < cutoff_48h.replace(tzinfo=c_date.tzinfo):
                    continue
            except Exception:
                pass
            
            # LOGIC: 1 note = Note Card, 2+ notes = Cluster Card
            if c.get("note_count", 0) >= 2:
                active_clusters.append(c)
                cluster_ids.append(c["id"])
            else:
                small_cluster_ids.append(c["id"])
            
        # Fetch preview notes for BIG clusters (optimization: 1 query)
        preview_notes_map = {}
        if cluster_ids:
            try:
                p_notes = supabase.table("notes").select(
                    "id, content_clarified, content_raw, user_id, created_at, cluster_id, status"
                ).in_("cluster_id", cluster_ids).in_("status", ["processed", "review", "approved", "refused"]).order("created_at", desc=True).limit(len(cluster_ids) * 3).execute()
                
                for n in p_notes.data:
                    cid = n["cluster_id"]
                    if cid not in preview_notes_map:
                        preview_notes_map[cid] = []
                    if len(preview_notes_map[cid]) < 3:
                        preview_notes_map[cid].append({
                            "id": n["id"],
                            "content": n.get("content_clarified") or n.get("content_raw"),
                            "user_id": n["user_id"],
                            "created_at": n["created_at"]
                        })
            except Exception as e:
                logger.warning(f"Failed to fetch preview notes: {e}")

        # Add BIG clusters to items
        for c in active_clusters:
            items.append(ClusterFeedItem(
                type="CLUSTER",
                id=c["id"],
                title=c["title"],
                note_count=c.get("note_count", 0),
                velocity_score=c.get("velocity_score", 0),
                pillar_id=c.get("pillar_id"),
                pillar_name=c.get("pillars", {}).get("name") if c.get("pillars") else None,
                pillar_color=c.get("pillars", {}).get("color") if c.get("pillars") else None,
                created_at=c["created_at"],
                last_updated_at=c["last_updated_at"],
                preview_notes=preview_notes_map.get(c["id"], []),
                sort_date=c["last_updated_at"]
            ))

        # ============================================
        # 1.5. FETCH NOTES FROM SMALL CLUSTERS (Exploded)
        # ============================================
        if small_cluster_ids:
            try:
                small_notes = supabase.table("notes").select(
                    "*, pillars(name, color), title_clarified"
                ).in_("cluster_id", small_cluster_ids).in_("status", ["processed", "review", "approved", "refused"]).execute()
                
                for n in small_notes.data:
                    # Generate title with fallback: title_clarified > truncated content_clarified
                    title = n.get("title_clarified")
                    if not title:
                        clarified = n.get("content_clarified") or n.get("content_raw") or ""
                        title = clarified[:80] + "..." if len(clarified) > 80 else clarified
                    
                    items.append(NoteFeedItem(
                        type="NOTE",
                        id=n["id"],
                        title=title,
                        content=n.get("content_clarified") or n.get("content_raw") or "",
                        content_raw=n.get("content_raw"),
                        content_clarified=n.get("content_clarified"),
                        status=n["status"],
                        cluster_id=n.get("cluster_id"),
                        pillar_id=n.get("pillar_id"),
                        pillar_name=n.get("pillars", {}).get("name") if n.get("pillars") else None,
                        pillar_color=n.get("pillars", {}).get("color") if n.get("pillars") else None,
                        ai_relevance_score=n.get("ai_relevance_score"),
                        user_id=n["user_id"],
                        is_mine=(n["user_id"] == user_id),
                        created_at=n["created_at"],
                        processed_at=n.get("processed_at"),
                        sort_date=n.get("processed_at") or n["created_at"]
                    ))
            except Exception as e:
                logger.warning(f"Failed to fetch small cluster notes: {e}")

        # ============================================
        # 2. FETCH NOTES (Orphan OR Mine)
        # ============================================
        # Include all notes that have been actioned (processed, review, approved, refused)
        # These represent ideas at various stages of their lifecycle
        notes_response = supabase.table("notes").select(
            "*, pillars(name, color), title_clarified"
        ).eq("organization_id", organization_id).in_("status", ["processed", "review", "approved", "refused"]).or_(
            f"cluster_id.is.null,user_id.eq.{user_id}"
        ).order("created_at", desc=True).limit(limit).execute()
        
        # Track existing note IDs to avoid duplicates
        existing_note_ids = {i.id for i in items if i.type == "NOTE"}
        
        for n in notes_response.data:
            if n["id"] in existing_note_ids:
                continue
            
            # Generate title with fallback: title_clarified > truncated content_clarified
            title = n.get("title_clarified")
            if not title:
                clarified = n.get("content_clarified") or n.get("content_raw") or ""
                title = clarified[:80] + "..." if len(clarified) > 80 else clarified
                
            items.append(NoteFeedItem(
                type="NOTE",
                id=n["id"],
                title=title,
                content=n.get("content_clarified") or n.get("content_raw") or "",
                content_raw=n.get("content_raw"),
                content_clarified=n.get("content_clarified"),
                status=n["status"],
                cluster_id=n.get("cluster_id"),
                pillar_id=n.get("pillar_id"),
                pillar_name=n.get("pillars", {}).get("name") if n.get("pillars") else None,
                pillar_color=n.get("pillars", {}).get("color") if n.get("pillars") else None,
                ai_relevance_score=n.get("ai_relevance_score"),
                user_id=n["user_id"],
                is_mine=(n["user_id"] == user_id),
                created_at=n["created_at"],
                processed_at=n.get("processed_at"),
                sort_date=n.get("processed_at") or n["created_at"]
            ))

        # ============================================
        # 3. FETCH POSTS
        # ============================================
        posts_response = supabase.table("posts").select(
            "*, users(first_name, last_name, email, avatar_url)"
        ).eq("organization_id", organization_id).neq("post_type", "linked_idea").gte("created_at", cutoff_30d.isoformat()).order("created_at", desc=True).limit(limit).execute()
        
        for p in posts_response.data:
            user_info = p.get("users") or {}
            items.append(PostFeedItem(
                type="POST",
                id=p["id"],
                content=p["content"],
                post_type=p["post_type"],
                user_id=p["user_id"],
                user_info={
                    "first_name": user_info.get("first_name"),
                    "last_name": user_info.get("last_name"),
                    "email": user_info.get("email"),
                    "avatar_url": user_info.get("avatar_url"),
                },
                likes_count=p.get("likes_count", 0),
                comments_count=p.get("comments_count", 0),
                is_mine=(p["user_id"] == user_id),
                created_at=p["created_at"],
                sort_date=p["created_at"]
            ))

        # ============================================
        # 4. MERGE & SORT
        # ============================================
        # Sort by sort_date DESC
        items.sort(key=lambda x: str(x.sort_date), reverse=True)
        
        # Apply limit
        items = items[:limit]

    except Exception as e:
        logger.error(f"❌ Python Feed Fetch failed: {e}")
        # Fail Fast: Return 500 with clear error
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching feed: {str(e)}"
        )
    
    # ============================================
    # STEP 3: Get Feed Stats (Optional)
    # ============================================
    stats = {}
    try:
        # Try to use the view, if it fails, return empty stats
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
async def get_feed_stats(
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
async def get_feed_item_details(
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
        
        if item_type == "cluster":
            # Fetch cluster with all notes
            cluster_response = supabase.table("clusters").select(
                "*, notes!inner(*, users(email, first_name, last_name))"
            ).eq("id", item_id).eq("organization_id", organization_id).single().execute()
            
            if not cluster_response.data:
                return {"error": "Cluster not found"}, 404
            
            return cluster_response.data
            
        elif item_type == "note":
            # Fetch note with details
            note_response = supabase.table("notes").select(
                "*, users(email, first_name, last_name), pillars(name, color), clusters(title)"
            ).eq("id", item_id).eq("organization_id", organization_id).single().execute()
            
            if not note_response.data:
                return {"error": "Note not found"}, 404
            
            return note_response.data
        
        else:
            return {"error": "Invalid item type"}, 400
        
    except Exception as e:
        logger.error(f"❌ Error fetching item details: {e}")
        raise
