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
                ).in_("cluster_id", cluster_ids).in_("status", ["processed", "review", "approved", "refused", "archived"]).order("created_at", desc=True).limit(len(cluster_ids) * 3).execute()
                
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

        # Fetch user's liked clusters
        user_liked_clusters = set()
        if cluster_ids:
            try:
                liked_resp = supabase.table("cluster_likes").select("cluster_id").eq(
                    "user_id", user_id
                ).in_("cluster_id", cluster_ids).execute()
                user_liked_clusters = {l["cluster_id"] for l in (liked_resp.data or [])}
            except Exception as e:
                logger.warning(f"Could not fetch user cluster likes: {e}")

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
                likes_count=c.get("likes_count", 0),
                comments_count=c.get("comments_count", 0),
                is_liked=(c["id"] in user_liked_clusters),
                created_at=c["created_at"],
                last_updated_at=c["last_updated_at"],
                preview_notes=preview_notes_map.get(c["id"], []),
                sort_date=c["last_updated_at"]
            ))

        # ============================================
        # 1.5. FETCH NOTES FROM SMALL CLUSTERS (Exploded)
        # ============================================
        small_notes_data = []
        if small_cluster_ids:
            try:
                small_notes = supabase.table("notes").select(
                    "*, pillars(name, color), title_clarified"
                ).in_("cluster_id", small_cluster_ids).in_("status", ["processed", "review", "approved", "refused", "archived"]).execute()
                small_notes_data = small_notes.data or []
            except Exception as e:
                logger.warning(f"Failed to fetch small cluster notes: {e}")

        # ============================================
        # 2. FETCH NOTES (Orphan OR Mine)
        # ============================================
        # Include all notes that have been actioned (processed, review, approved, refused, archived)
        # These represent ideas at various stages of their lifecycle
        notes_response = supabase.table("notes").select(
            "*, pillars(name, color), title_clarified"
        ).eq("organization_id", organization_id).in_("status", ["processed", "review", "approved", "refused", "archived"]).or_(
            f"cluster_id.is.null,user_id.eq.{user_id}"
        ).order("created_at", desc=True).limit(limit).execute()
        
        # Collect all note IDs from small_notes_data and notes_response
        all_note_ids = [n["id"] for n in small_notes_data]
        all_note_ids.extend([n["id"] for n in notes_response.data])
        
        # Fetch user's liked notes in batch
        user_liked_notes = set()
        if all_note_ids:
            try:
                liked_resp = supabase.table("note_likes").select("note_id").eq(
                    "user_id", user_id
                ).in_("note_id", all_note_ids).execute()
                user_liked_notes = {l["note_id"] for l in (liked_resp.data or [])}
            except Exception as e:
                logger.warning(f"Could not fetch user note likes: {e}")
        
        # Process small_notes_data (notes from small clusters)
        for n in small_notes_data:
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
                likes_count=n.get("likes_count", 0),
                comments_count=n.get("comments_count", 0),
                is_liked=(n["id"] in user_liked_notes),
                created_at=n["created_at"],
                processed_at=n.get("processed_at"),
                sort_date=n.get("processed_at") or n["created_at"]
            ))
        
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
                likes_count=n.get("likes_count", 0),
                comments_count=n.get("comments_count", 0),
                is_liked=(n["id"] in user_liked_notes),
                created_at=n["created_at"],
                processed_at=n.get("processed_at"),
                sort_date=n.get("processed_at") or n["created_at"]
            ))

        # ============================================
        # 3. FETCH POSTS
        # ============================================
        posts_response = supabase.table("posts").select(
            "*, users(first_name, last_name, email, avatar_url)"
        ).eq("organization_id", organization_id).neq("post_type", "linked_idea").neq("status", "scheduled").gte("created_at", cutoff_30d.isoformat()).order("created_at", desc=True).limit(limit).execute()
        
        # Fetch user's likes and saves for all posts in one query
        post_ids = [p["id"] for p in posts_response.data]
        user_likes = set()
        user_saves = set()
        
        if post_ids:
            try:
                likes_resp = supabase.table("post_likes").select("post_id").eq("user_id", user_id).in_("post_id", post_ids).execute()
                user_likes = {l["post_id"] for l in (likes_resp.data or [])}
            except Exception as e:
                logger.warning(f"Could not fetch user likes: {e}")
            
            try:
                saves_resp = supabase.table("post_saves").select("post_id").eq("user_id", user_id).in_("post_id", post_ids).execute()
                user_saves = {s["post_id"] for s in (saves_resp.data or [])}
            except Exception as e:
                logger.warning(f"Could not fetch user saves: {e}")
        
        for p in posts_response.data:
            user_info = p.get("users") or {}
            items.append(PostFeedItem(
                type="POST",
                id=p["id"],
                content=p["content"],
                post_type=p["post_type"],
                media_urls=p.get("media_urls"),
                has_poll=p.get("has_poll", False),
                user_id=p["user_id"],
                user_info={
                    "first_name": user_info.get("first_name"),
                    "last_name": user_info.get("last_name"),
                    "email": user_info.get("email"),
                    "avatar_url": user_info.get("avatar_url"),
                },
                likes_count=p.get("likes_count", 0),
                comments_count=p.get("comments_count", 0),
                saves_count=p.get("saves_count", 0),
                shares_count=p.get("shares_count", 0),
                virality_score=p.get("virality_score", 0.0),  # Use worker-calculated score
                is_liked=(p["id"] in user_likes),
                is_saved=(p["id"] in user_saves),
                is_mine=(p["user_id"] == user_id),
                created_at=p["created_at"],
                sort_date=p["created_at"]
            ))

        # ============================================
        # 4. MERGE & SORT (ALGORITHMIC RANKING)
        # ============================================
        # Advanced ranking algorithm using existing analyzed data:
        # - Clusters: velocity_score (0-100)
        # - Notes: ai_relevance_score (0-10) -> normalized to 0-100
        # - Posts: virality_score (0-100)
        # Plus a freshness boost based on content age
        
        def calculate_feed_score(item) -> float:
            """
            Calculate composite score for ranking.
            Score = base_score (normalized 0-100) + freshness_boost (0-30)
            """
            base_score = 0.0
            
            # Get base score based on item type
            if item.type == "CLUSTER":
                # Use velocity_score directly (already 0-100 scale)
                base_score = item.velocity_score or 0.0
            elif item.type == "NOTE":
                # Normalize ai_relevance_score from 0-10 to 0-100
                ai_score = item.ai_relevance_score or 0.0
                base_score = ai_score * 10  # Convert 0-10 to 0-100
            elif item.type == "POST":
                # Use virality_score directly (calculated by worker, 0-100+ scale)
                base_score = item.virality_score or 0.0
                base_score = min(base_score, 100)  # Cap at 100 for normalization
            
            # Calculate freshness boost (newer = higher boost)
            # Max 30 points for content < 1 hour old, decreasing over 48h
            try:
                if isinstance(item.sort_date, str):
                    item_date = datetime.fromisoformat(item.sort_date.replace('Z', '+00:00'))
                else:
                    item_date = item.sort_date
                    
                # Make cutoff timezone-aware to match item_date
                now = datetime.utcnow()
                if item_date.tzinfo is not None:
                    from datetime import timezone
                    now = now.replace(tzinfo=timezone.utc)
                    
                age_hours = (now - item_date).total_seconds() / 3600
                
                if age_hours <= 1:
                    freshness_boost = 30  # Max boost for very recent
                elif age_hours <= 6:
                    freshness_boost = 25
                elif age_hours <= 12:
                    freshness_boost = 20
                elif age_hours <= 24:
                    freshness_boost = 15
                elif age_hours <= 48:
                    freshness_boost = 10
                else:
                    freshness_boost = 0  # No boost for older content
            except Exception:
                freshness_boost = 0
            
            # Combined score
            total_score = base_score + freshness_boost
            
            return total_score
        
        # Sort by calculated score DESC (higher score = higher in feed)
        items.sort(key=calculate_feed_score, reverse=True)
        
        # Apply limit
        items = items[:limit]
        
        logger.info(f"📊 Feed sorted by algorithm: {len(items)} items ranked")

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
async def toggle_like_note(
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
async def toggle_like_cluster(
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
