"""
Social Feed API Routes
Endpoints pour le feed social avec pagination par curseur et filtrage par tag
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from loguru import logger

from app.api.dependencies import get_current_user, get_supabase_client
from app.workers.social_feed_tasks import trigger_virality_recalculation


router = APIRouter(prefix="/feed", tags=["Social Feed"])


# ============================================
# PYDANTIC MODELS
# ============================================

class CreatePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    media_urls: Optional[List[str]] = None
    post_type: str = Field(default="standard", pattern="^(standard|announcement|poll|event)$")
    tag_names: Optional[List[str]] = None  # Tags à associer au post


class PostResponse(BaseModel):
    id: str
    user_id: str
    organization_id: str
    content: str
    media_urls: Optional[List[str]]
    post_type: str
    likes_count: int
    comments_count: int
    shares_count: int
    saves_count: int
    virality_score: float
    virality_level: str
    created_at: str
    hours_old: Optional[float] = None
    tags: Optional[List[Dict[str, Any]]] = None
    user_info: Optional[Dict[str, Any]] = None
    is_liked: Optional[bool] = False
    is_saved: Optional[bool] = False


class FeedResponse(BaseModel):
    posts: List[PostResponse]
    next_cursor: Optional[float] = None  # Last seen score pour pagination
    has_more: bool = False


class EngagementResponse(BaseModel):
    success: bool
    action: str  # "liked", "unliked", "saved", "unsaved"
    new_count: int


# ============================================
# ENDPOINT 1: Create Post
# ============================================

@router.post("/posts", response_model=PostResponse)
async def create_post(
    request: CreatePostRequest,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Créer un nouveau post dans le feed social
    """
    try:
        # Convert UUID objects to strings for JSON serialization
        user_id = str(current_user.id)
        organization_id = str(current_user.organization_id)
        
        # Create post
        post_data = {
            "user_id": user_id,
            "organization_id": organization_id,
            "content": request.content,
            "media_urls": request.media_urls or [],
            "post_type": request.post_type,
            "virality_score": 50.0,  # Initial score avec Cold Start Boost
            "virality_level": "local"
        }
        
        post_response = supabase.table("posts").insert(post_data).execute()
        
        if not post_response.data:
            raise HTTPException(status_code=500, detail="Failed to create post")
        
        post = post_response.data[0]
        post_id = post["id"]
        
        # Associate tags (if provided)
        if request.tag_names and len(request.tag_names) > 0:
            await _associate_tags_to_post(post_id, organization_id, request.tag_names, supabase)
        
        # Trigger virality calculation (async)
        trigger_virality_recalculation(post_id)
        
        logger.info(f"✅ Post created: {post_id} by user {user_id}")
        
        return PostResponse(**post)
        
    except Exception as e:
        logger.error(f"❌ Error creating post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 2: Get Social Feed (Pagination par curseur)
# ============================================

@router.get("/", response_model=FeedResponse)
async def get_social_feed(
    limit: int = Query(default=20, ge=1, le=100),
    last_seen_score: Optional[float] = Query(default=None, description="Cursor pagination: last virality_score seen"),
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Récupère le feed social avec pagination par curseur
    
    **Logique "Local OR Viral":**
    - Posts de mon organisation (local)
    - OU posts viraux (viral, national, global) de n'importe quelle organisation
    
    **Pagination:**
    - Utilisez `last_seen_score` pour charger la page suivante
    - Les posts sont triés par `virality_score DESC, created_at DESC`
    """
    try:
        organization_id = str(current_user.organization_id)
        user_id = str(current_user.id)
        
        # Call RPC function pour performance optimale
        feed_response = supabase.rpc(
            "get_social_feed",
            {
                "p_user_org_id": organization_id,
                "p_limit": limit + 1,  # +1 pour détecter s'il y a plus de résultats
                "p_last_seen_score": last_seen_score
            }
        ).execute()
        
        posts_data = feed_response.data or []
        
        # Check if there are more results
        has_more = len(posts_data) > limit
        if has_more:
            posts_data = posts_data[:limit]  # Remove extra item
        
        # Calculate next cursor
        next_cursor = None
        if has_more and len(posts_data) > 0:
            next_cursor = posts_data[-1]["virality_score"]
        
        # Enrich posts with tags and user info
        enriched_posts = await _enrich_posts(posts_data, user_id, supabase)
        
        return FeedResponse(
            posts=enriched_posts,
            next_cursor=next_cursor,
            has_more=has_more
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching social feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 3: Get Feed by Tag
# ============================================

@router.get("/tag/{tag_name}", response_model=FeedResponse)
async def get_feed_by_tag(
    tag_name: str,
    limit: int = Query(default=20, ge=1, le=100),
    last_seen_score: Optional[float] = Query(default=None),
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Récupère le feed filtré par tag avec la logique "Local OR Viral"
    
    **Filtrage:**
    - Posts avec le tag spécifié
    - ET (Posts de mon organisation OU posts viraux)
    """
    try:
        organization_id = str(current_user.organization_id)
        user_id = str(current_user.id)
        
        # Call RPC function
        feed_response = supabase.rpc(
            "get_feed_by_tag",
            {
                "p_user_org_id": organization_id,
                "p_tag_name": tag_name,
                "p_limit": limit + 1,
                "p_last_seen_score": last_seen_score
            }
        ).execute()
        
        posts_data = feed_response.data or []
        
        # Check if there are more results
        has_more = len(posts_data) > limit
        if has_more:
            posts_data = posts_data[:limit]
        
        # Calculate next cursor
        next_cursor = None
        if has_more and len(posts_data) > 0:
            next_cursor = posts_data[-1]["virality_score"]
        
        # Enrich posts
        enriched_posts = await _enrich_posts(posts_data, user_id, supabase)
        
        return FeedResponse(
            posts=enriched_posts,
            next_cursor=next_cursor,
            has_more=has_more
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching feed by tag '{tag_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 4: Like/Unlike Post
# ============================================

@router.post("/posts/{post_id}/like", response_model=EngagementResponse)
async def toggle_like_post(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Toggle like sur un post (like si pas déjà liké, unlike sinon)
    """
    try:
        user_id = str(current_user.id)
        
        # Check if already liked
        existing_like = supabase.table("post_likes").select("id").eq(
            "post_id", post_id
        ).eq("user_id", user_id).execute()
        
        if existing_like.data and len(existing_like.data) > 0:
            # Unlike
            supabase.table("post_likes").delete().eq(
                "post_id", post_id
            ).eq("user_id", user_id).execute()
            action = "unliked"
        else:
            # Like
            supabase.table("post_likes").insert({
                "post_id": post_id,
                "user_id": user_id
            }).execute()
            action = "liked"
        
        # Get updated count
        post = supabase.table("posts").select("likes_count").eq("id", post_id).single().execute()
        new_count = post.data["likes_count"] if post.data else 0
        
        # Trigger virality recalculation
        trigger_virality_recalculation(post_id)
        
        return EngagementResponse(success=True, action=action, new_count=new_count)
        
    except Exception as e:
        logger.error(f"❌ Error toggling like for post {post_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 5: Save/Unsave Post
# ============================================

@router.post("/posts/{post_id}/save", response_model=EngagementResponse)
async def toggle_save_post(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Toggle save/bookmark sur un post
    """
    try:
        user_id = str(current_user.id)
        
        # Check if already saved
        existing_save = supabase.table("post_saves").select("id").eq(
            "post_id", post_id
        ).eq("user_id", user_id).execute()
        
        if existing_save.data and len(existing_save.data) > 0:
            # Unsave
            supabase.table("post_saves").delete().eq(
                "post_id", post_id
            ).eq("user_id", user_id).execute()
            action = "unsaved"
        else:
            # Save
            supabase.table("post_saves").insert({
                "post_id": post_id,
                "user_id": user_id
            }).execute()
            action = "saved"
        
        # Get updated count
        post = supabase.table("posts").select("saves_count").eq("id", post_id).single().execute()
        new_count = post.data["saves_count"] if post.data else 0
        
        # Trigger virality recalculation (Save vaut 10 points!)
        trigger_virality_recalculation(post_id)
        
        return EngagementResponse(success=True, action=action, new_count=new_count)
        
    except Exception as e:
        logger.error(f"❌ Error toggling save for post {post_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 6: Get Trending Tags
# ============================================

@router.get("/tags/trending")
async def get_trending_tags(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Récupère les tags tendances (triés par trend_score DESC)
    """
    try:
        organization_id = str(current_user.organization_id)
        
        tags_response = supabase.table("tags").select("*").eq(
            "organization_id", organization_id
        ).order("trend_score", desc=True).limit(limit).execute()
        
        return {"tags": tags_response.data or []}
        
    except Exception as e:
        logger.error(f"❌ Error fetching trending tags: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# HELPER FUNCTIONS
# ============================================

async def _associate_tags_to_post(post_id: str, organization_id: str, tag_names: List[str], supabase):
    """
    Associe des tags à un post (crée les tags s'ils n'existent pas)
    """
    for tag_name in tag_names:
        tag_name = tag_name.strip().lower()
        
        if not tag_name:
            continue
        
        # Find or create tag
        tag_response = supabase.table("tags").select("id").eq(
            "organization_id", organization_id
        ).eq("name", tag_name).execute()
        
        if tag_response.data and len(tag_response.data) > 0:
            tag_id = tag_response.data[0]["id"]
        else:
            # Create tag
            new_tag = supabase.table("tags").insert({
                "organization_id": organization_id,
                "name": tag_name,
                "trend_score": 0
            }).execute()
            tag_id = new_tag.data[0]["id"]
        
        # Create post_tag association
        supabase.table("post_tags").insert({
            "post_id": post_id,
            "tag_id": tag_id
        }).execute()


async def _enrich_posts(posts_data: List[Dict], user_id: str, supabase) -> List[PostResponse]:
    """
    Enrichit les posts avec les tags, user info, et état like/save
    """
    enriched = []
    
    for post in posts_data:
        post_id = post["id"]
        
        # Get tags
        tags_response = supabase.table("post_tags").select(
            "tags(id, name, trend_score)"
        ).eq("post_id", post_id).execute()
        
        tags = [pt["tags"] for pt in (tags_response.data or []) if pt.get("tags")]
        
        # Get user info
        user_response = supabase.table("users").select(
            "id, email, first_name, last_name, avatar_url"
        ).eq("id", post["user_id"]).single().execute()
        
        user_info = user_response.data if user_response.data else {}
        
        # Check if liked/saved by current user
        is_liked = await _check_user_engagement(post_id, user_id, "post_likes", supabase)
        is_saved = await _check_user_engagement(post_id, user_id, "post_saves", supabase)
        
        enriched.append(PostResponse(
            **post,
            tags=tags,
            user_info=user_info,
            is_liked=is_liked,
            is_saved=is_saved
        ))
    
    return enriched


async def _check_user_engagement(post_id: str, user_id: str, table: str, supabase) -> bool:
    """
    Vérifie si un user a liké/sauvegardé un post
    """
    response = supabase.table(table).select("id").eq(
        "post_id", post_id
    ).eq("user_id", user_id).execute()
    
    return response.data and len(response.data) > 0
