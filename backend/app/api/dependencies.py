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

from fastapi import Header, HTTPException, status, Request

class CurrentUser(BaseModel):
    """Model for the current authenticated user"""
    id: UUID
    email: str
    organization_id: Optional[UUID] = None
    role: str = "MEMBER"
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
    request: Request,
    authorization: str = Header(None)
) -> CurrentUser:
    """
    Dependency to get the current authenticated user from JWT token
    
    SECURITY ENFORCED:
    1. Validates 'Authorization: Bearer <token>' via Supabase Auth
    2. Extracts user_id from verified token claims
    3. Resolves Organization Context from Path Param OR Header (Verified)
    4. Verifies membership in the target organization
    5. REJECTS requests without a valid Organization Context
    
    Raises:
        HTTPException: 401 if token is invalid or missing
        HTTPException: 403 if user is not a member of the organization
        HTTPException: 400 if organization context is missing
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )
    
    try:
        # 1. Validate JWT Token
        try:
            scheme, token = authorization.split()
            if scheme.lower() != 'bearer':
                raise ValueError("Invalid scheme")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme"
            )
            
        # Use Supabase Auth to get user from token
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
            
        user_id = UUID(user_response.user.id)
        email = user_response.user.email
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )
    
    # 2. Determine Organization Context
    # Priority: 1. Path Param (orgSlug/org_slug) -> 2. Header (X-Organization-Id)
    org_id = None
    
    # Check Path Params
    path_org_slug = request.path_params.get("orgSlug") or request.path_params.get("org_slug")
    
    if path_org_slug:
        # Resolve slug to ID
        try:
            org_res = supabase.table("organizations").select("id, status").eq("slug", path_org_slug).single().execute()
            if org_res.data:
                org_id = UUID(org_res.data["id"])
                if org_res.data.get("status") == "suspended":
                    raise HTTPException(status_code=403, detail="Organization suspended")
        except Exception as e:
            # If it's a "Row not found" error (Supabase/PostgREST specific), we can ignore it and try header
            # Otherwise, it's a DB error that should be raised
            if "JSON object requested, multiple (or no) rows returned" in str(e) or "Results contain 0 rows" in str(e):
                pass
            else:
                logger.error(f"DB Error resolving org slug: {e}")
                raise HTTPException(status_code=500, detail="Database error resolving organization")
            
    # Fallback to Header if no path param
    if not org_id:
        x_org_id = request.headers.get("X-Organization-Id")
        if x_org_id:
            try:
                org_id = UUID(x_org_id)
            except ValueError:
                pass

    # CRITICAL: Enforce Organization Context
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization context required (Path param or X-Organization-Id header)"
        )

    # 3. Verify Membership
    try:
        membership_response = supabase.table("memberships").select(
            "role, job_title"
        ).eq("user_id", str(user_id)).eq("organization_id", str(org_id)).execute()
        
        if not membership_response.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this organization"
            )
        
        membership = membership_response.data[0]
        role = membership.get("role", "MEMBER")
        job_title = membership.get("job_title", "")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Membership check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify organization membership"
        )
    
    return CurrentUser(
        id=user_id,
        email=email,
        organization_id=org_id,
        role=role,
        job_title=job_title
    )


async def require_board_or_owner(current_user: CurrentUser = None) -> CurrentUser:
    """
    Dependency to require BOARD or OWNER role
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
    request: Request,
    authorization: str = Header(None)
) -> Optional[CurrentUser]:
    """
    Dependency to get the current authenticated user from headers, but returns None if missing.
    """
    if not authorization:
        return None
    
    try:
        return await get_current_user(request, authorization)
    except HTTPException:
        return None

