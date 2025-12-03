"""
Unified Feed API - Polymorphic Feed (Clusters + Notes)
Anti-Bruit logic: Only orphan notes + my notes + active clusters
"""
from typing import List, Union, Literal, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.api.dependencies import get_current_user, get_supabase_client


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
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Feed unifié polymorphique mélangeant Clusters, Notes et Posts
    
    **Logique Anti-Bruit :**
    - **Clusters** : Uniquement ceux actifs dans les dernières 48h
    - **Notes** : Uniquement orphelines (pas encore clustérisées) OU mes notes
    - **Posts** : Posts standards créés manuellement (exclus 'linked_idea')
    
    **Tri :** Par dernière activité (DESC)
    """
    try:
        organization_id = str(current_user.organization_id)
        user_id = str(current_user.id)
        

        
        # ============================================
        # STEP 1: Call Stored Function
        # ============================================
        feed_response = supabase.rpc(
            "get_unified_feed",
            {
                "p_organization_id": organization_id,
                "p_current_user_id": user_id,
                "p_limit": limit
            }
        ).execute()
        
        if not feed_response.data:

            return UnifiedFeedResponse(items=[], total_count=0)
        
        # ============================================
        # STEP 2: Parse Polymorphic Items
        # ============================================
        items = []
        
        for raw_item in feed_response.data:
            item_type = raw_item["type"]
            item_data = raw_item["data"]
            item_data["sort_date"] = raw_item["sort_date"]
            
            if item_type == "CLUSTER":
                items.append(ClusterFeedItem(
                    type="CLUSTER",
                    **item_data
                ))
            elif item_type == "NOTE":
                items.append(NoteFeedItem(
                    type="NOTE",
                    **item_data
                ))
            elif item_type == "POST":
                items.append(PostFeedItem(
                    type="POST",
                    **item_data
                ))
            else:
                logger.warning(f"Unknown feed item type: {item_type}")
        
        # ============================================
        # STEP 3: Get Feed Stats (Optional)
        # ============================================
        stats_response = supabase.table("v_feed_stats").select("*").eq(
            "organization_id", organization_id
        ).execute()
        
        stats = {}
        if stats_response.data and len(stats_response.data) > 0:
            stats = stats_response.data[0]
        

        
        return UnifiedFeedResponse(
            items=items,
            total_count=len(items),
            stats=stats
        )
        
    except Exception as e:
        logger.warning(f"⚠️ RPC 'get_unified_feed' failed or missing: {e}. Falling back to manual fetch.")
        
        # ============================================
        # FALLBACK: Manual Fetch & Merge
        # ============================================
        try:
            # 1. Fetch Posts
            posts_response = supabase.table("posts").select(
                "*, users:user_id(first_name, last_name, avatar_url)"
            ).eq("organization_id", organization_id).order("created_at", desc=True).limit(limit).execute()
            
            posts = posts_response.data or []
            
            # 2. Fetch Notes (Orphans or Mine)
            notes_response = supabase.table("notes").select(
                "*, pillars(name, color)"
            ).eq("organization_id", organization_id).order("created_at", desc=True).limit(limit).execute()
            
            notes = notes_response.data or []
            
            # 3. Fetch Clusters
            clusters_response = supabase.table("clusters").select(
                "*"
            ).eq("organization_id", organization_id).order("last_updated_at", desc=True).limit(limit).execute()
            
            clusters = clusters_response.data or []
            
            # 4. Merge & Transform
            items = []
            
            for p in posts:
                items.append(PostFeedItem(
                    type="POST",
                    id=str(p.get("id")),
                    content=p.get("content", ""),
                    post_type=p.get("post_type", "standard"),
                    user_id=str(p.get("user_id")),
                    user_info=p.get("users"),
                    likes_count=p.get("likes_count", 0),
                    comments_count=p.get("comments_count", 0),
                    is_mine=str(p.get("user_id")) == user_id,
                    created_at=p.get("created_at"),
                    sort_date=p.get("created_at")
                ))
                
            for n in notes:
                items.append(NoteFeedItem(
                    type="NOTE",
                    id=str(n.get("id")),
                    content=n.get("content", ""),
                    content_raw=n.get("content_raw"),
                    content_clarified=n.get("content_clarified"),
                    status=n.get("status", "active"),
                    cluster_id=str(n.get("cluster_id")) if n.get("cluster_id") else None,
                    pillar_id=str(n.get("pillar_id")) if n.get("pillar_id") else None,
                    pillar_name=n.get("pillars", {}).get("name") if n.get("pillars") else None,
                    pillar_color=n.get("pillars", {}).get("color") if n.get("pillars") else None,
                    ai_relevance_score=n.get("ai_relevance_score"),
                    user_id=str(n.get("user_id")),
                    is_mine=str(n.get("user_id")) == user_id,
                    created_at=n.get("created_at"),
                    processed_at=n.get("processed_at"),
                    sort_date=n.get("created_at")
                ))
                
            for c in clusters:
                items.append(ClusterFeedItem(
                    type="CLUSTER",
                    id=str(c.get("id")),
                    title=c.get("title", "Untitled Cluster"),
                    note_count=c.get("note_count", 0),
                    velocity_score=c.get("velocity_score", 0.0),
                    pillar_id=str(c.get("pillar_id")) if c.get("pillar_id") else None,
                    pillar_name=c.get("pillar_name"),
                    pillar_color=c.get("pillar_color"),
                    created_at=c.get("created_at"),
                    last_updated_at=c.get("last_updated_at"),
                    preview_notes=[], # Can't easily fetch preview notes in fallback without N+1
                    sort_date=c.get("last_updated_at")
                ))
            
            # 5. Sort by Date DESC
            items.sort(key=lambda x: x.sort_date, reverse=True)
            
            # 6. Apply Limit
            items = items[:limit]
            

            
            return UnifiedFeedResponse(
                items=items,
                total_count=len(items),
                stats={}
            )
            
        except Exception as fallback_error:
            logger.error(f"❌ Fallback fetch failed: {fallback_error}")
            raise e # Raise original error if fallback also fails


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
