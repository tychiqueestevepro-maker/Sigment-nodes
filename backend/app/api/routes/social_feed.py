"""
Social Feed API Routes
Endpoints pour le feed social avec pagination par curseur et filtrage par tag
"""
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field, validator
from loguru import logger

from app.api.dependencies import get_current_user, get_supabase_client
from app.workers.social_feed_tasks import trigger_virality_recalculation


router = APIRouter(prefix="/feed", tags=["Social Feed"])


# ============================================
# PYDANTIC MODELS
# ============================================

class CreatePostRequest(BaseModel):
    content: Optional[str] = Field(default="", max_length=5000)
    media_urls: Optional[List[str]] = None
    post_type: str = Field(default="standard", pattern="^(standard|announcement|poll|event)$")
    tag_names: Optional[List[str]] = None  # Tags à associer au post
    scheduled_at: Optional[str] = None  # ISO datetime string for scheduling
    status: Optional[str] = "published"  # draft, scheduled, published


class PostResponse(BaseModel):
    id: str
    user_id: str
    organization_id: str
    content: str
    media_urls: Optional[List[str]]
    post_type: str
    status: Optional[str] = "published"
    scheduled_at: Optional[str] = None
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
    poll: Optional[Dict[str, Any]] = None


class FeedResponse(BaseModel):
    posts: List[PostResponse]
    next_cursor: Optional[float] = None  # Last seen score pour pagination
    has_more: bool = False


class EngagementResponse(BaseModel):
    success: bool
    action: str  # "liked", "unliked", "saved", "unsaved"
    new_count: int


class MediaUploadResponse(BaseModel):
    url: str
    message: str


# Allowed image MIME types for post media
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


# ============================================
# ENDPOINT 0: Upload Media
# ============================================

@router.post("/media/upload", response_model=MediaUploadResponse)
def upload_post_media(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Upload an image for a post.
    
    - Accepts image files (JPEG, PNG, GIF, WebP)
    - Max file size: 10MB
    - Stores in Supabase Storage bucket 'post-media'
    - Returns public URL
    """
    try:
        # 1. Validate file type
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}"
            )
        
        # 2. Read file content
        file_content = file.file.read()
        
        # 3. Validate file size
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024*1024)}MB"
            )
        
        # 4. Generate unique filename: {org_id}/{user_id}/{uuid}.{ext}
        user_id = str(current_user.id)
        org_id = str(current_user.organization_id)
        file_ext = file.filename.split(".")[-1] if file.filename else "jpg"
        unique_filename = f"{org_id}/{user_id}/{uuid4()}.{file_ext}"
        
        logger.info(f"Uploading post media for user {user_id}: {unique_filename}")
        
        # 5. Upload to Supabase Storage
        try:
            upload_response = supabase.storage.from_("post-media").upload(
                path=unique_filename,
                file=file_content,
                file_options={"content-type": file.content_type, "upsert": "true"}
            )
            logger.info(f"Upload response: {upload_response}")
        except Exception as storage_error:
            logger.error(f"Storage upload error: {storage_error}")
            raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {str(storage_error)}")
        
        # 6. Get public URL
        public_url = supabase.storage.from_("post-media").get_public_url(unique_filename)
        
        logger.info(f"Media uploaded successfully. URL: {public_url}")
        
        return MediaUploadResponse(
            url=public_url,
            message="Media uploaded successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading post media: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 1: Create Post
# ============================================

@router.post("/posts", response_model=PostResponse)
def create_post(
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
            "virality_level": "local",
            "status": request.status or "published",
            "scheduled_at": request.scheduled_at
        }
        
        post_response = supabase.table("posts").insert(post_data).execute()
        
        if not post_response.data:
            raise HTTPException(status_code=500, detail="Failed to create post")
        
        post = post_response.data[0]
        post_id = post["id"]
        
        # Associate tags (if provided)
        if request.tag_names and len(request.tag_names) > 0:
            _associate_tags_to_post(post_id, organization_id, request.tag_names, supabase)
        
        # Trigger virality calculation (async)
        trigger_virality_recalculation(post_id)
        
        logger.info(f"✅ Post created: {post_id} by user {user_id}")
        
        return PostResponse(**post)
        
    except Exception as e:
        logger.error(f"❌ Error creating post: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============================================
# ENDPOINT: Get Scheduled Posts
# ============================================

@router.get("/posts/scheduled", response_model=List[PostResponse])
def get_scheduled_posts(
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """Retrieve scheduled posts for current user"""
    try:
        user_id = str(current_user.id)
        
        response = supabase.table("posts").select(
            "*, users(first_name, last_name, email, avatar_url)"
        ).eq("user_id", user_id).eq("status", "scheduled").order("scheduled_at", desc=False).execute()
        
        if not response.data:
            return []
            
        # Fetch polls for these posts
        post_ids = [p["id"] for p in response.data]
        polls_map = {}
        if post_ids:
            try:
                polls_resp = supabase.table("polls").select("*, poll_options(*)").in_("post_id", post_ids).execute()
                for pl in (polls_resp.data or []):
                    # Format options for frontend
                    raw_options = pl.get("poll_options") or []
                    # Sort options
                    raw_options.sort(key=lambda x: x.get("display_order", 0))
                    
                    # Transform options to match PollOptionResponse format roughly or simple dict
                    options = [
                        {
                            "id": opt["id"],
                            "text": opt["option_text"], # Frontend expects 'text' usually in UI components or 'option_text'
                            "votes_count": 0, # No votes yet for scheduled
                            "percentage": 0,
                            "is_voted": False
                        }
                        for opt in raw_options
                    ]
                    
                    pl["options"] = options
                    polls_map[pl["post_id"]] = pl
            except Exception as poll_error:
                logger.warning(f"Failed to fetch polls for scheduled posts: {poll_error}")

        posts = []
        for p in response.data:
            user_info = p.get("users") or {}
            
            # Get associated poll
            poll_data = polls_map.get(p["id"])
            if poll_data:
                 # Ensure structure matches what CreatePollExpects or PollResponse
                 # Frontend needs: question, options, allow_multiple, expires_at
                 pass

            # Use PostResponse model
            posts.append(PostResponse(
                id=p["id"],
                user_id=p["user_id"],
                organization_id=p["organization_id"],
                content=p["content"],
                media_urls=p.get("media_urls"),
                post_type=p["post_type"],
                status=p.get("status", "scheduled"),
                scheduled_at=p.get("scheduled_at"),
                likes_count=p.get("likes_count", 0),
                comments_count=p.get("comments_count", 0),
                shares_count=p.get("shares_count", 0),
                saves_count=p.get("saves_count", 0),
                virality_score=p.get("virality_score", 0),
                virality_level=p.get("virality_level", "local"),
                created_at=p["created_at"],
                poll=poll_data, # Add poll data
                user_info={
                    "first_name": user_info.get("first_name"),
                    "last_name": user_info.get("last_name"),
                    "email": user_info.get("email"),
                    "avatar_url": user_info.get("avatar_url"),
                }
            ))
            
        return posts
        
    except Exception as e:
        logger.error(f"❌ Error fetching scheduled posts: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============================================
# ENDPOINT: Delete Post
# ============================================
@router.delete("/posts/{post_id}")
def delete_post(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """Delete a post"""
    try:
        user_id = str(current_user.id)
        # Verify ownership
        post_resp = supabase.table("posts").select("user_id").eq("id", post_id).single().execute()
        if not post_resp.data:
             raise HTTPException(status_code=404, detail="Post not found")
             
        if post_resp.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        supabase.table("posts").delete().eq("id", post_id).execute()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting post {post_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT: Update Post (Schedule/Content)
# ============================================
class UpdatePostRequest(BaseModel):
    content: Optional[str] = None
    media_urls: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    status: Optional[str] = None

@router.patch("/posts/{post_id}")
def update_post(
    post_id: str,
    request: UpdatePostRequest,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """Update post content or schedule"""
    try:
        user_id = str(current_user.id)
        # Verify ownership
        post_resp = supabase.table("posts").select("user_id").eq("id", post_id).single().execute()
        if not post_resp.data:
             raise HTTPException(status_code=404, detail="Post not found")

        if post_resp.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        # Pydantic v2: model_dump, v1: dict
        try:
            updates = {k: v for k, v in request.model_dump(exclude_unset=True).items()}
        except AttributeError:
             updates = {k: v for k, v in request.dict(exclude_unset=True).items()}

        if updates:
            supabase.table("posts").update(updates).eq("id", post_id).execute()
            
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating post {post_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 2: Get Social Feed (Pagination par curseur)
# ============================================

@router.get("/", response_model=FeedResponse)
@router.get("/", response_model=FeedResponse)
def get_social_feed(
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
            "get_social_feed_optimized",
            {
                "p_user_org_id": organization_id,
                "p_limit": limit + 1,  # +1 pour détecter s'il y a plus de résultats
                "p_last_seen_score": last_seen_score,
                "p_current_user_id": user_id
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
        
        return FeedResponse(
            posts=posts_data,
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
@router.get("/tag/{tag_name}", response_model=FeedResponse)
def get_feed_by_tag(
    tag_name: str,
    limit: int = Query(default=20, ge=1, le=100),
    last_seen_score: Optional[float] = Query(default=None),
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Récupère le feed filtré par tag avec la logique "Local OR Viral"
    """
    try:
        organization_id = str(current_user.organization_id)
        user_id = str(current_user.id)
        
        # Call RPC function
        feed_response = supabase.rpc(
            "get_feed_by_tag_optimized",
            {
                "p_user_org_id": organization_id,
                "p_tag_name": tag_name,
                "p_limit": limit + 1,
                "p_last_seen_score": last_seen_score,
                "p_current_user_id": user_id
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
        
        return FeedResponse(
            posts=posts_data,
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
def toggle_like_post(
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
def toggle_save_post(
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
def get_post_by_id(
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
        
        # Check if user has liked (non-blocking)
        is_liked = False
        try:
            like_check = supabase.table("post_likes").select("id").eq(
                "post_id", post_id
            ).eq("user_id", user_id).execute()
            is_liked = bool(like_check.data and len(like_check.data) > 0)
        except Exception:
            pass
        
        # Check if user has saved (non-blocking)
        is_saved = False
        try:
            save_check = supabase.table("post_saves").select("id").eq(
                "post_id", post_id
            ).eq("user_id", user_id).execute()
            is_saved = bool(save_check.data and len(save_check.data) > 0)
        except Exception:
            pass
        
        user_info = post.get("users") or {}
        
        return {
            "id": post["id"],
            "content": post["content"],
            "post_type": post["post_type"],
            "media_urls": post.get("media_urls"),
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
    except OSError as e:
        # Handle [Errno 35] Resource temporarily unavailable and similar
        logger.warning(f"⚠️ Connection issue fetching post {post_id}: {e}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable, please retry")
    except Exception as e:
        logger.error(f"❌ Error fetching post {post_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 6: Get Trending Tags
# ============================================

@router.get("/tags/trending")
def get_trending_tags(
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

def _associate_tags_to_post(post_id: str, organization_id: str, tag_names: List[str], supabase):
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





# ============================================
# PYDANTIC MODELS FOR COMMENTS
# ============================================

class CreateCommentRequest(BaseModel):
    content: str = Field(..., max_length=2000)  # Can be empty if media_url or poll provided
    parent_comment_id: Optional[str] = None
    media_url: Optional[str] = None  # Image URL for the comment
    poll_data: Optional[Dict[str, Any]] = None  # Quick poll data: {question, options, color}
    
    @validator('content', always=True)
    def content_or_media_required(cls, v, values):
        # Content can be empty only if there's a media_url or poll
        # But we can't check those here as they come after content
        # So we just allow empty content and validate in endpoint
        return v if v else ""


class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    content: str
    media_url: Optional[str] = None
    poll_data: Optional[Dict[str, Any]] = None  # Quick poll data
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
def create_comment(
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
        
        # Validate that either content, media_url, or poll_data is provided
        if not request.content.strip() and not request.media_url and not request.poll_data:
            raise HTTPException(status_code=400, detail="Comment must have content, an image, or a poll")
        
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
        
        # Prepare poll_data with initial votes structure if provided
        poll_data_to_save = None
        if request.poll_data:
            poll_data_to_save = {
                "question": request.poll_data.get("question", ""),
                "options": [
                    {"text": opt, "votes": 0} 
                    for opt in request.poll_data.get("options", [])
                ],
                "color": request.poll_data.get("color", "#3B82F6"),
                "voter_ids": [],
                "total_votes": 0
            }
        
        # Créer le commentaire
        comment_data = {
            "post_id": post_id,
            "user_id": user_id,
            "content": request.content,
            "parent_comment_id": request.parent_comment_id,
            "media_url": request.media_url,
            "poll_data": poll_data_to_save
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
def get_post_comments(
    post_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort: str = Query(default="recent", pattern="^(recent|oldest)$"),
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Récupère les commentaires racines d'un post (avec réponses imbriquées)
    """
    try:
        user_id = str(current_user.id)
        
        # Get comments via RPC
        comments_response = supabase.rpc(
            "get_comments_with_replies",
            {
                "p_post_id": post_id,
                "p_current_user_id": user_id,
                "p_limit": limit,
                "p_offset": offset
            }
        ).execute()
        
        comments_data = comments_response.data or []
        
        # We need total count separately or we approximate
        # For full correctness we can query total count
        count_response = supabase.table("post_comments").select(
            "id", count="exact"
        ).eq("post_id", post_id).is_("parent_comment_id", "null").execute()
        total_count = count_response.count or 0
        
        has_more = (offset + len(comments_data)) < total_count
        
        return CommentsListResponse(
            comments=comments_data,
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
def get_comment_replies(
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
        
        # Verify parent comment exists
        # Optional: strictly speaking if we just query replies and get empty list it's fine, 
        # but 404 is better if parent doesn't exist.
        parent = supabase.table("post_comments").select("id").eq("id", comment_id).execute()
        if not parent.data:
            raise HTTPException(status_code=404, detail="Comment not found")

        # Get replies via RPC
        replies_response = supabase.rpc(
            "get_comment_replies_optimized",
            {
                "p_comment_id": comment_id,
                "p_current_user_id": user_id,
                "p_limit": limit,
                "p_offset": offset
            }
        ).execute()

        replies_data = replies_response.data or []
        
        # Get total count
        count_response = supabase.table("post_comments").select(
            "id", count="exact"
        ).eq("parent_comment_id", comment_id).execute()
        
        total_count = count_response.count or 0
        
        has_more = (offset + len(replies_data)) < total_count
        
        return CommentsListResponse(
            comments=replies_data,
            total_count=total_count,
            has_more=has_more
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching replies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT 10: Like/Unlike Comment
# ============================================

@router.post("/comments/{comment_id}/like", response_model=EngagementResponse)
def toggle_like_comment(
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
def delete_comment(
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




# ============================================
# COMMENT POLL VOTE
# ============================================

class CommentPollVoteRequest(BaseModel):
    option_index: int


@router.post("/comments/{comment_id}/poll/vote")
def vote_comment_poll(
    comment_id: str,
    request: CommentPollVoteRequest,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """Vote on a poll within a comment"""
    try:
        user_id = str(current_user.id)
        
        # Fetch the comment
        comment_response = supabase.table("post_comments").select(
            "id, poll_data"
        ).eq("id", comment_id).single().execute()
        
        if not comment_response.data:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        poll_data = comment_response.data.get("poll_data")
        if not poll_data:
            raise HTTPException(status_code=400, detail="This comment has no poll")
        
        # Check if user already voted
        if user_id in poll_data.get("voter_ids", []):
            raise HTTPException(status_code=400, detail="You have already voted on this poll")
        
        # Validate option index
        options = poll_data.get("options", [])
        if request.option_index < 0 or request.option_index >= len(options):
            raise HTTPException(status_code=400, detail="Invalid option index")
        
        # Update the poll data
        options[request.option_index]["votes"] = options[request.option_index].get("votes", 0) + 1
        poll_data["options"] = options
        poll_data["voter_ids"] = poll_data.get("voter_ids", []) + [user_id]
        poll_data["total_votes"] = poll_data.get("total_votes", 0) + 1
        
        # Save updated poll data
        update_response = supabase.table("post_comments").update({
            "poll_data": poll_data
        }).eq("id", comment_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to update poll")
        
        logger.info(f"✅ User {user_id} voted on comment poll {comment_id}")
        
        return {"poll_data": poll_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error voting on comment poll: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# POLLS SYSTEM - Models
# ============================================

class PollOptionCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=200)


class CreatePollRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    options: List[PollOptionCreate] = Field(..., min_items=2, max_items=10)
    allow_multiple: bool = False
    expires_in_hours: Optional[int] = None  # None = no expiration
    color: Optional[str] = "#374151"  # Default gray


class PollOptionResponse(BaseModel):
    id: str
    text: str
    votes_count: int
    percentage: float = 0.0
    is_voted: bool = False


class PollResponse(BaseModel):
    id: str
    post_id: str
    question: str
    options: List[PollOptionResponse]
    allow_multiple: bool
    total_votes: int
    color: Optional[str] = "#374151"
    expires_at: Optional[str] = None
    is_expired: bool = False
    user_voted: bool = False
    user_votes: List[str] = []  # List of option IDs user voted for
    created_at: str


class VotePollRequest(BaseModel):
    option_ids: List[str] = Field(..., min_items=1)


# ============================================
# ENDPOINT: Create Poll for a Post
# ============================================

@router.post("/posts/{post_id}/poll", response_model=PollResponse)
def create_poll(
    post_id: str,
    request: CreatePollRequest,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Create a poll attached to a post
    Only the post author can create a poll
    """
    try:
        user_id = str(current_user.id)
        
        # Verify post exists and user is the author
        post = supabase.table("posts").select("id, user_id").eq("id", post_id).single().execute()
        if not post.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        if post.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only the post author can create a poll")
        
        # Check if poll already exists
        existing = supabase.table("polls").select("id").eq("post_id", post_id).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Poll already exists for this post")
        
        # Calculate expiration if provided
        from datetime import datetime, timedelta
        expires_at = None
        if request.expires_in_hours:
            expires_at = (datetime.utcnow() + timedelta(hours=request.expires_in_hours)).isoformat()
        
        # Create poll
        poll_data = {
            "post_id": post_id,
            "question": request.question,
            "allow_multiple": request.allow_multiple,
            "color": request.color or "#374151",
            "expires_at": expires_at
        }
        
        poll_response = supabase.table("polls").insert(poll_data).execute()
        if not poll_response.data:
            raise HTTPException(status_code=500, detail="Failed to create poll")
        
        poll = poll_response.data[0]
        
        # Create options
        options_data = [
            {
                "poll_id": poll["id"],
                "option_text": opt.text,
                "display_order": idx
            }
            for idx, opt in enumerate(request.options)
        ]
        
        options_response = supabase.table("poll_options").insert(options_data).execute()
        if not options_response.data:
            raise HTTPException(status_code=500, detail="Failed to create poll options")
        
        # Update post to indicate it has a poll
        supabase.table("posts").update({"has_poll": True}).eq("id", post_id).execute()
        
        logger.info(f"✅ Poll created: {poll['id']} for post {post_id}")
        
        # Return formatted response
        options = [
            PollOptionResponse(
                id=opt["id"],
                text=opt["option_text"],
                votes_count=0,
                percentage=0.0,
                is_voted=False
            )
            for opt in options_response.data
        ]
        
        return PollResponse(
            id=poll["id"],
            post_id=post_id,
            question=poll["question"],
            options=options,
            allow_multiple=poll["allow_multiple"],
            total_votes=0,
            color=poll.get("color", "#374151"),
            expires_at=poll.get("expires_at"),
            is_expired=False,
            user_voted=False,
            user_votes=[],
            created_at=poll["created_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating poll: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT: Get Poll by Post ID
# ============================================

@router.get("/posts/{post_id}/poll", response_model=PollResponse)
def get_poll(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Get poll details for a post
    """
    try:
        user_id = str(current_user.id)
        
        # Get poll
        poll_response = supabase.table("polls").select("*").eq("post_id", post_id).single().execute()
        if not poll_response.data:
            raise HTTPException(status_code=404, detail="Poll not found")
        
        poll = poll_response.data
        
        # Get options
        options_response = supabase.table("poll_options").select("*").eq(
            "poll_id", poll["id"]
        ).order("display_order").execute()
        
        options_data = options_response.data or []
        
        # Get user's votes
        option_ids = [opt["id"] for opt in options_data]
        user_votes = []
        if option_ids:
            votes_response = supabase.table("poll_votes").select("poll_option_id").eq(
                "user_id", user_id
            ).in_("poll_option_id", option_ids).execute()
            user_votes = [v["poll_option_id"] for v in (votes_response.data or [])]
        
        # Check if expired
        from datetime import datetime
        is_expired = False
        if poll.get("expires_at"):
            expires_at = datetime.fromisoformat(poll["expires_at"].replace("Z", "+00:00"))
            is_expired = datetime.now(expires_at.tzinfo) > expires_at
        
        # Calculate percentages
        total = poll.get("total_votes", 0) or 0
        options = [
            PollOptionResponse(
                id=opt["id"],
                text=opt["option_text"],
                votes_count=opt.get("votes_count", 0),
                percentage=round((opt.get("votes_count", 0) / total * 100), 1) if total > 0 else 0.0,
                is_voted=opt["id"] in user_votes
            )
            for opt in options_data
        ]
        
        return PollResponse(
            id=poll["id"],
            post_id=post_id,
            question=poll["question"],
            options=options,
            allow_multiple=poll.get("allow_multiple", False),
            total_votes=total,
            color=poll.get("color", "#374151"),
            expires_at=poll.get("expires_at"),
            is_expired=is_expired,
            user_voted=len(user_votes) > 0,
            user_votes=user_votes,
            created_at=poll["created_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching poll: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT: Vote on Poll
# ============================================

@router.post("/polls/{poll_id}/vote")
def vote_poll(
    poll_id: str,
    request: VotePollRequest,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Vote on a poll
    """
    try:
        user_id = str(current_user.id)
        
        # Get poll
        poll_response = supabase.table("polls").select("*, post_id").eq("id", poll_id).single().execute()
        if not poll_response.data:
            raise HTTPException(status_code=404, detail="Poll not found")
        
        poll = poll_response.data
        
        # Check if expired
        from datetime import datetime
        if poll.get("expires_at"):
            expires_at = datetime.fromisoformat(poll["expires_at"].replace("Z", "+00:00"))
            if datetime.now(expires_at.tzinfo) > expires_at:
                raise HTTPException(status_code=400, detail="Poll has expired")
        
        # Get valid option IDs for this poll
        options_response = supabase.table("poll_options").select("id").eq("poll_id", poll_id).execute()
        valid_option_ids = {opt["id"] for opt in (options_response.data or [])}
        
        # Validate option IDs
        for opt_id in request.option_ids:
            if opt_id not in valid_option_ids:
                raise HTTPException(status_code=400, detail=f"Invalid option ID: {opt_id}")
        
        # Check multiple vote restriction
        if not poll.get("allow_multiple") and len(request.option_ids) > 1:
            raise HTTPException(status_code=400, detail="This poll only allows one vote")
        
        # Get user's existing votes
        existing_votes = supabase.table("poll_votes").select("id, poll_option_id").eq(
            "user_id", user_id
        ).in_("poll_option_id", list(valid_option_ids)).execute()
        
        existing_vote_ids = {v["poll_option_id"]: v["id"] for v in (existing_votes.data or [])}
        
        # Remove old votes if not allow_multiple
        if not poll.get("allow_multiple") and existing_vote_ids:
            for vote_id in existing_vote_ids.values():
                supabase.table("poll_votes").delete().eq("id", vote_id).execute()
        
        # Add new votes
        new_votes = []
        for opt_id in request.option_ids:
            if opt_id not in existing_vote_ids:
                new_votes.append({
                    "poll_option_id": opt_id,
                    "user_id": user_id
                })
        
        if new_votes:
            supabase.table("poll_votes").insert(new_votes).execute()
        
        logger.info(f"✅ User {user_id} voted on poll {poll_id}")
        
        # Return updated poll
        return get_poll(poll["post_id"], current_user, supabase)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error voting on poll: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINT: Unvote on Poll
# ============================================

@router.delete("/polls/{poll_id}/vote")
def unvote_poll(
    poll_id: str,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase_client)
):
    """
    Remove user's vote from a poll
    """
    try:
        user_id = str(current_user.id)
        
        # Get poll
        poll_response = supabase.table("polls").select("*, post_id").eq("id", poll_id).single().execute()
        if not poll_response.data:
            raise HTTPException(status_code=404, detail="Poll not found")
        
        poll = poll_response.data
        
        # Get option IDs for this poll
        options_response = supabase.table("poll_options").select("id").eq("poll_id", poll_id).execute()
        option_ids = [opt["id"] for opt in (options_response.data or [])]
        
        # Delete user's votes
        if option_ids:
            supabase.table("poll_votes").delete().eq("user_id", user_id).in_("poll_option_id", option_ids).execute()
        
        logger.info(f"✅ User {user_id} removed vote from poll {poll_id}")
        
        # Return updated poll
        return get_poll(poll["post_id"], current_user, supabase)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error removing vote: {e}")
        raise HTTPException(status_code=500, detail=str(e))
