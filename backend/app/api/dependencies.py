"""
FastAPI Dependencies for Authentication and Authorization
Provides RBAC (Role-Based Access Control) utilities
"""
from typing import Optional
from uuid import UUID
from fastapi import Header, HTTPException, status
from loguru import logger

from app.services.supabase_client import supabase, get_supabase

def get_supabase_client():
    """Dependency to get Supabase client"""
    return get_supabase()


from pydantic import BaseModel

class CurrentUser(BaseModel):
    """Model for the current authenticated user"""
    id: UUID
    email: str
    organization_id: UUID
    role: str
    job_title: str = ""
    
    class Config:
        arbitrary_types_allowed = True

    def is_owner(self) -> bool:
        """Check if user is an OWNER"""
        return self.role.upper() == "OWNER"
    
    def is_board_or_owner(self) -> bool:
        """Check if user is BOARD or OWNER"""
        return self.role.upper() in ["BOARD", "OWNER"]
    
    def is_member(self) -> bool:
        """Check if user is a MEMBER"""
        return self.role.upper() == "MEMBER"


async def get_current_user(
    x_user_id: Optional[str] = Header(None),
    x_organization_id: Optional[str] = Header(None)
) -> CurrentUser:
    """
    Dependency to get the current authenticated user from headers
    
    In production, this should:
    1. Validate JWT token from Authorization header
    2. Extract user_id and organization_id from the token
    3. Verify token signature and expiration
    
    For now, we use simple headers for development:
    - X-User-Id: UUID of the user
    - X-Organization-Id: UUID of the organization
    
    Raises:
        HTTPException: 401 if authentication fails
    """
    if not x_user_id or not x_organization_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication headers (X-User-Id, X-Organization-Id)"
        )
    
    try:
        user_id = UUID(x_user_id)
        org_id = UUID(x_organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user or organization ID format"
        )
    
    # Fetch user and verify membership - SIMPLIFIED without complex joins
    try:
        # 1. Check membership exists
        membership_response = supabase.table("memberships").select(
            "role, job_title, user_id, organization_id"
        ).eq("user_id", str(user_id)).eq("organization_id", str(org_id)).execute()
        
        if not membership_response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or not a member of this organization"
            )
        
        membership = membership_response.data[0]
        
        # 2. Get user data separately
        user_response = supabase.table("users").select("id, email").eq("id", str(user_id)).execute()
        if not user_response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        user_data = user_response.data[0]
        
        # 3. Get organization data separately
        org_response = supabase.table("organizations").select("id, slug, status").eq("id", str(org_id)).execute()
        if not org_response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Organization not found"
            )
        org_data = org_response.data[0]
        
        # Check organization status
        org_status = org_data.get("status", "active")
        if org_status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization access suspended"
            )
        
        return CurrentUser(
            id=user_id,
            email=user_data["email"],
            organization_id=org_id,
            role=membership["role"],
            job_title=membership.get("job_title", "")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication failed: {str(e)}"
        )


async def require_board_or_owner(current_user: CurrentUser = None) -> CurrentUser:
    """
    Dependency to require BOARD or OWNER role
    
    Usage:
        @router.patch("/notes/{note_id}")
        async def moderate_note(
            note_id: UUID,
            current_user: CurrentUser = Depends(require_board_or_owner)
        ):
            ...
    
    Raises:
        HTTPException: 403 if user is not BOARD or OWNER
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    if not current_user.is_board_or_owner():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires BOARD or OWNER role"
        )
    
    return current_user


async def require_owner(current_user: CurrentUser = None) -> CurrentUser:
    """
    Dependency to require OWNER role
    
    Raises:
        HTTPException: 403 if user is not OWNER
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    if not current_user.is_owner():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires OWNER role"
        )
    
    return current_user


async def get_optional_user(
    x_user_id: Optional[str] = Header(None),
    x_organization_id: Optional[str] = Header(None)
) -> Optional[CurrentUser]:
    """
    Dependency to get the current authenticated user from headers, but returns None if missing.
    Allows endpoints to handle authentication fallback (e.g. reading from body).
    """
    if not x_user_id or not x_organization_id:
        return None
    
    try:
        return await get_current_user(x_user_id, x_organization_id)
    except HTTPException:
        return None


async def get_current_organization(
    x_organization_id: Optional[str] = Header(None)
) -> Optional[UUID]:
    """
    Dependency to get just the organization ID from headers
    """
    if not x_organization_id:
        return None
    try:
        return UUID(x_organization_id)
    except ValueError:
        return None
