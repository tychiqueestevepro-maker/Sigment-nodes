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
# ENDPOINT 5.5: Get Single Post
# ============================================

@router.get("/posts/{post_id}")
async def get_post_by_id(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Récupère un post par son ID avec toutes les infos d'engagement
    """
    try:
        user_id = str(current_user.id)
        organization_id = str(current_user.organization_id)
        
        # Fetch post with user info
        post_response = supabase.table("posts").select(
            "*, users(id, email, first_name, last_name, avatar_url)"
        ).eq("id", post_id).eq("organization_id", organization_id).single().execute()
        
        if not post_response.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        post = post_response.data
        
        # Check if user has liked
        is_liked = False
        try:
            like_check = supabase.table("post_likes").select("id").eq(
                "post_id", post_id
            ).eq("user_id", user_id).execute()
            is_liked = bool(like_check.data and len(like_check.data) > 0)
        except:
            pass
        
        # Check if user has saved
        is_saved = False
        try:
            save_check = supabase.table("post_saves").select("id").eq(
                "post_id", post_id
            ).eq("user_id", user_id).execute()
            is_saved = bool(save_check.data and len(save_check.data) > 0)
        except:
            pass
        
        user_info = post.get("users") or {}
        
        return {
            "id": post["id"],
            "content": post["content"],
            "post_type": post["post_type"],
            "user_id": post["user_id"],
            "user_info": {
                "id": user_info.get("id"),
                "email": user_info.get("email"),
                "first_name": user_info.get("first_name"),
                "last_name": user_info.get("last_name"),
                "avatar_url": user_info.get("avatar_url"),
            },
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "saves_count": post.get("saves_count", 0),
            "shares_count": post.get("shares_count", 0),
            "is_liked": is_liked,
            "is_saved": is_saved,
            "created_at": post["created_at"],
            "updated_at": post["updated_at"],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching post {post_id}: {e}")
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


# ============================================
# PYDANTIC MODELS FOR COMMENTS
# ============================================

class CreateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: Optional[str] = None


class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    content: str
    parent_comment_id: Optional[str]
    created_at: str
    updated_at: str
    user_info: Dict[str, Any]
    likes_count: int = 0
    is_liked: bool = False
    replies_count: int = 0
    replies: Optional[List[Dict[str, Any]]] = None  # Utilise Dict pour éviter circular ref


class CommentsListResponse(BaseModel):
    comments: List[CommentResponse]
    total_count: int
    has_more: bool


# ============================================
# ENDPOINT 7: Create Comment
# ============================================

@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(
    post_id: str,
    request: CreateCommentRequest,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Créer un commentaire sur un post
    """
    try:
        user_id = str(current_user.id)
        
        # Vérifier que le post existe
        post = supabase.table("posts").select("id").eq("id", post_id).execute()
        if not post.data or len(post.data) == 0:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Si c'est une réponse, vérifier que le parent existe
        if request.parent_comment_id:
            parent = supabase.table("post_comments").select("id").eq(
                "id", request.parent_comment_id
            ).execute()
            if not parent.data or len(parent.data) == 0:
                raise HTTPException(status_code=404, detail="Parent comment not found")
        
        # Créer le commentaire
        comment_data = {
            "post_id": post_id,
            "user_id": user_id,
            "content": request.content,
            "parent_comment_id": request.parent_comment_id
        }
        
        comment_response = supabase.table("post_comments").insert(comment_data).execute()
        
        if not comment_response.data:
            raise HTTPException(status_code=500, detail="Failed to create comment")
        
        comment = comment_response.data[0]
        
        # Fetch user info
        user_response = supabase.table("users").select(
            "id, email, first_name, last_name, avatar_url"
        ).eq("id", user_id).single().execute()
        
        user_info = user_response.data if user_response.data else {}
        
        # Trigger virality recalculation
        trigger_virality_recalculation(post_id)
        
        logger.info(f"✅ Comment created: {comment['id']} on post {post_id}")
        
        return CommentResponse(
            **comment,
            user_info=user_info,
            likes_count=0,
            is_liked=False,
            replies_count=0
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 8: Get Post Comments
# ============================================

@router.get("/posts/{post_id}/comments", response_model=CommentsListResponse)
async def get_post_comments(
    post_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort: str = Query(default="recent", pattern="^(recent|oldest)$"),
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Récupère les commentaires racines d'un post (parent_comment_id IS NULL)
    """
    try:
        user_id = str(current_user.id)
        
        # Get total count
        count_response = supabase.table("post_comments").select(
            "id", count="exact"
        ).eq("post_id", post_id).is_("parent_comment_id", "null").execute()
        
        total_count = count_response.count or 0
        
        # Get comments
        order_desc = sort == "recent"
        
        comments_response = supabase.table("post_comments").select("*").eq(
            "post_id", post_id
        ).is_(
            "parent_comment_id", "null"
        ).order(
            "created_at", desc=order_desc
        ).range(offset, offset + limit - 1).execute()
        
        comments_data = comments_response.data or []
        
        # Enrich with user info, replies count, and likes
        enriched_comments = []
        for comment in comments_data:
            enriched = await _enrich_comment(comment, user_id, supabase)
            enriched_comments.append(enriched)
        
        has_more = (offset + limit) < total_count
        
        return CommentsListResponse(
            comments=enriched_comments,
            total_count=total_count,
            has_more=has_more
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 9: Get Comment Replies
# ============================================

@router.get("/comments/{comment_id}/replies", response_model=CommentsListResponse)
async def get_comment_replies(
    comment_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Récupère les réponses d'un commentaire
    """
    try:
        user_id = str(current_user.id)
        
        # Vérifier que le commentaire parent existe
        parent = supabase.table("post_comments").select("id").eq(
            "id", comment_id
        ).execute()
        
        if not parent.data or len(parent.data) == 0:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        # Get total count
        count_response = supabase.table("post_comments").select(
            "id", count="exact"
        ).eq("parent_comment_id", comment_id).execute()
        
        total_count = count_response.count or 0
        
        # Get replies
        replies_response = supabase.table("post_comments").select("*").eq(
            "parent_comment_id", comment_id
        ).order("created_at", desc=False).range(offset, offset + limit - 1).execute()
        
        replies_data = replies_response.data or []
        
        # Enrich with user info
        enriched_replies = []
        for reply in replies_data:
            enriched = await _enrich_comment(reply, user_id, supabase)
            enriched_replies.append(enriched)
        
        has_more = (offset + limit) < total_count
        
        return CommentsListResponse(
            comments=enriched_replies,
            total_count=total_count,
            has_more=has_more
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching replies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 10: Like/Unlike Comment
# ============================================

@router.post("/comments/{comment_id}/like", response_model=EngagementResponse)
async def toggle_like_comment(
    comment_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Like ou Unlike un commentaire (toggle)
    """
    try:
        user_id = str(current_user.id)
        
        # Vérifier que le commentaire existe
        comment = supabase.table("post_comments").select("id, post_id").eq(
            "id", comment_id
        ).execute()
        
        if not comment.data or len(comment.data) == 0:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        # Check if already liked
        existing = supabase.table("comment_likes").select("id").eq(
            "comment_id", comment_id
        ).eq("user_id", user_id).execute()
        
        if existing.data and len(existing.data) > 0:
            # Unlike
            supabase.table("comment_likes").delete().eq(
                "comment_id", comment_id
            ).eq("user_id", user_id).execute()
            action = "unliked"
        else:
            # Like
            supabase.table("comment_likes").insert({
                "comment_id": comment_id,
                "user_id": user_id
            }).execute()
            action = "liked"
        
        # Get updated count
        count_response = supabase.table("comment_likes").select(
            "id", count="exact"
        ).eq("comment_id", comment_id).execute()
        
        new_count = count_response.count or 0
        
        logger.info(f"✅ Comment {action}: {comment_id} by user {user_id}")
        
        return EngagementResponse(success=True, action=action, new_count=new_count)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error toggling like for comment {comment_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 11: Delete Comment
# ============================================

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Supprimer un commentaire (seulement l'auteur)
    """
    try:
        user_id = str(current_user.id)
        
        # Fetch comment to verify ownership
        comment = supabase.table("post_comments").select("user_id, post_id").eq(
            "id", comment_id
        ).execute()
        
        if not comment.data or len(comment.data) == 0:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        # Check ownership
        if comment.data[0]["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="You can only delete your own comments")
        
        # Delete (CASCADE will delete replies too)
        supabase.table("post_comments").delete().eq("id", comment_id).execute()
        
        # Trigger virality recalculation
        post_id = comment.data[0]["post_id"]
        trigger_virality_recalculation(post_id)
        
        logger.info(f"✅ Comment deleted: {comment_id}")
        
        return {"success": True, "message": "Comment deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# HELPER: Enrich Comment
# ============================================

async def _enrich_comment(comment: Dict, user_id: str, supabase, depth: int = 0, max_depth: int = 5) -> CommentResponse:
    """
    Enrichit un commentaire avec user info, likes count, replies count ET les réponses imbriquées
    
    Args:
        comment: Le commentaire brut
        user_id: L'ID de l'utilisateur actuel (pour is_liked)
        supabase: Client Supabase
        depth: Niveau de profondeur actuel
        max_depth: Profondeur maximum pour les réponses imbriquées
    """
    comment_id = comment["id"]
    
    # Get user info
    user_response = supabase.table("users").select(
        "id, email, first_name, last_name, avatar_url"
    ).eq("id", comment["user_id"]).single().execute()
    
    user_info = user_response.data if user_response.data else {}
    
    # Count likes (with error handling if table doesn't exist)
    likes_count = 0
    is_liked = False
    try:
        likes_response = supabase.table("comment_likes").select(
            "id", count="exact"
        ).eq("comment_id", comment_id).execute()
        likes_count = likes_response.count or 0
        
        # Check if current user liked
        is_liked_response = supabase.table("comment_likes").select("id").eq(
            "comment_id", comment_id
        ).eq("user_id", user_id).execute()
        is_liked = bool(is_liked_response.data and len(is_liked_response.data) > 0)
    except Exception as e:
        logger.warning(f"Could not fetch comment likes (table may not exist): {e}")
        likes_count = 0
        is_liked = False
    
    # Count replies
    replies_response = supabase.table("post_comments").select(
        "id", count="exact"
    ).eq("parent_comment_id", comment_id).execute()
    
    replies_count = replies_response.count or 0
    
    # Fetch nested replies recursively (jusqu'à max_depth)
    replies = []
    if depth < max_depth and replies_count > 0:
        try:
            nested_replies_response = supabase.table("post_comments").select("*").eq(
                "parent_comment_id", comment_id
            ).order("created_at", desc=False).limit(50).execute()
            
            for nested_reply in (nested_replies_response.data or []):
                enriched_reply = await _enrich_comment(
                    nested_reply, user_id, supabase, depth + 1, max_depth
                )
                replies.append(enriched_reply.model_dump())
        except Exception as e:
            logger.warning(f"Could not fetch nested replies: {e}")
    
    result = CommentResponse(
        **comment,
        user_info=user_info,
        likes_count=likes_count,
        is_liked=is_liked,
        replies_count=replies_count,
        replies=replies if replies else None
    )
    
    return result

