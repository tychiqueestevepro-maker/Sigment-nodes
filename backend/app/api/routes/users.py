"""
Users API endpoints
"""
from typing import Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field
from loguru import logger
import os

from app.services.supabase_client import supabase
from app.api.dependencies import get_current_user, CurrentUser

router = APIRouter()

# Allowed image MIME types
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


# ============================================
# Pydantic Models
# ============================================

class UserUpdate(BaseModel):
    """Model for updating user profile"""
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    job_title: Optional[str] = Field(None, max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    seniority_level: Optional[int] = Field(None, ge=1, le=5)
    avatar_url: Optional[str] = None

    class Config:
        extra = "ignore"  # Ignore extra fields


class UserResponse(BaseModel):
    """Response model for user data"""
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    seniority_level: Optional[int] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AvatarUploadResponse(BaseModel):
    """Response model for avatar upload"""
    avatar_url: str
    message: str


# ============================================
# Endpoints
# ============================================

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get the current authenticated user's profile
    """
    try:
        response = supabase.table("users").select("*").eq("id", str(current_user.id)).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching current user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/me", response_model=UserResponse)
async def update_current_user_profile(
    updates: UserUpdate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Update the current authenticated user's profile
    
    Users can only update their OWN record.
    """
    try:
        # Build update dict with only non-None values
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        logger.info(f"Updating user {current_user.id} with: {update_data}")
        
        # Update the user record - ONLY the current user's record
        response = supabase.table("users").update(update_data).eq("id", str(current_user.id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found or update failed")
        
        logger.info(f"User {current_user.id} profile updated successfully")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/me/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Upload a profile picture/avatar for the current user.
    
    - Accepts image files (JPEG, PNG, GIF, WebP)
    - Max file size: 2MB
    - Stores in Supabase Storage bucket 'avatars'
    - Updates user's avatar_url in the database
    """
    try:
        # 1. Validate file type
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}"
            )
        
        # 2. Read file content
        file_content = await file.read()
        
        # 3. Validate file size
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024*1024)}MB"
            )
        
        # 4. Generate unique filename: {user_id}/{uuid}.{ext}
        file_ext = file.filename.split(".")[-1] if file.filename else "jpg"
        unique_filename = f"{current_user.id}/{uuid4()}.{file_ext}"
        
        logger.info(f"Uploading avatar for user {current_user.id}: {unique_filename}")
        
        # 5. Upload to Supabase Storage
        try:
            upload_response = supabase.storage.from_("avatars").upload(
                path=unique_filename,
                file=file_content,
                file_options={"content-type": file.content_type, "upsert": "true"}
            )
            logger.info(f"Upload response: {upload_response}")
        except Exception as storage_error:
            logger.error(f"Storage upload error: {storage_error}")
            raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {str(storage_error)}")
        
        # 6. Get public URL
        public_url_response = supabase.storage.from_("avatars").get_public_url(unique_filename)
        avatar_url = public_url_response
        
        logger.info(f"Avatar uploaded successfully. URL: {avatar_url}")
        
        # 7. Update user's avatar_url in database
        update_response = supabase.table("users").update({
            "avatar_url": avatar_url
        }).eq("id", str(current_user.id)).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to update user avatar URL")
        
        logger.info(f"User {current_user.id} avatar_url updated successfully")
        
        return AvatarUploadResponse(
            avatar_url=avatar_url,
            message="Avatar uploaded successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading avatar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/me/avatar")
async def delete_avatar(
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Delete the current user's avatar
    """
    try:
        # Get current avatar URL
        user_response = supabase.table("users").select("avatar_url").eq("id", str(current_user.id)).single().execute()
        
        if user_response.data and user_response.data.get("avatar_url"):
            # Extract file path from URL
            avatar_url = user_response.data["avatar_url"]
            # The path is typically after /avatars/
            if "/avatars/" in avatar_url:
                file_path = avatar_url.split("/avatars/")[-1]
                try:
                    supabase.storage.from_("avatars").remove([file_path])
                    logger.info(f"Deleted avatar file: {file_path}")
                except Exception as e:
                    logger.warning(f"Could not delete avatar file: {e}")
        
        # Clear avatar_url in database
        supabase.table("users").update({"avatar_url": None}).eq("id", str(current_user.id)).execute()
        
        return {"message": "Avatar deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting avatar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
async def get_user(user_id: UUID):
    """
    Get user profile by ID
    """
    try:
        response = supabase.table("users").select("*").eq("id", str(user_id)).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/email/{email}")
async def get_user_by_email(email: str):
    """
    Get user by email (for login/lookup)
    """
    try:
        response = supabase.table("users").select("*").eq("email", email).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(status_code=500, detail=str(e))
