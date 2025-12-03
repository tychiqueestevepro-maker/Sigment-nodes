"""
Authentication API endpoints
Handles user signup, login, and session management
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from loguru import logger
from typing import Optional
import uuid

from app.services.supabase_client import supabase

router = APIRouter()


class SignupRequest(BaseModel):
    """Request body for user signup"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)
    organization_name: str = Field(..., min_length=3)
    organization_slug: str = Field(..., pattern=r'^[a-z0-9-]+$')
    job_title: str = "Owner"


class LoginRequest(BaseModel):
    """Request body for user login"""
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    """Response after successful authentication"""
    user: dict
    organization: dict
    access_token: Optional[str] = None
    redirect_target: Optional[str] = None


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(data: SignupRequest):
    """
    Create a new user account with organization
    
    Flow:
    1. Create user in users table
    2. Create organization
    3. Create BOARD membership linking user to org
    4. Return user + org data
    """
    try:
        # 1. Check if email already exists
        existing_user = supabase.table("users").select("id").eq("email", data.email).execute()
        if existing_user.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # 2. Check if org slug is available
        existing_org = supabase.table("organizations").select("id").eq("slug", data.organization_slug).execute()
        if existing_org.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization slug already taken"
            )
        
        # 3. Create user
        # Note: In production, you should hash the password using bcrypt/argon2
        user_id = str(uuid.uuid4())
        user_response = supabase.table("users").insert({
            "id": user_id,
            "email": data.email,
            "password": data.password,  # TODO: Hash password before storing
            "first_name": data.first_name,
            "last_name": data.last_name,
            "role": "board"  # Required field in DB schema
        }).execute()
        
        if not user_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
        
        new_user = user_response.data[0]
        logger.info(f"Created user: {new_user['email']}")
        
        # 4. Create organization
        org_response = supabase.table("organizations").insert({
            "slug": data.organization_slug,
            "name": data.organization_name,
            "description": f"{data.organization_name}'s workspace"
        }).execute()
        
        if not org_response.data:
            # Rollback: delete user if org creation fails
            supabase.table("users").delete().eq("id", user_id).execute()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create organization"
            )
        
        new_org = org_response.data[0]
        logger.info(f"Created organization: {new_org['slug']}")
        
        # 5. Create OWNER membership
        membership_response = supabase.table("memberships").insert({
            "user_id": user_id,
            "organization_id": new_org["id"],
            "role": "OWNER",
            "job_title": data.job_title
        }).execute()
        
        if not membership_response.data:
            # Rollback: delete user and org if membership creation fails
            supabase.table("organizations").delete().eq("id", new_org["id"]).execute()
            supabase.table("users").delete().eq("id", user_id).execute()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create membership"
            )
        
        logger.info(f"Created OWNER membership for user {user_id} in org {new_org['id']}")
        
        # 6. Return success response
        return {
            "user": {
                "id": new_user["id"],
                "email": new_user["email"],
                "first_name": new_user.get("first_name", ""),
                "last_name": new_user.get("last_name", ""),
                "role": "OWNER",
                "job_title": data.job_title
            },
            "organization": {
                "id": new_org["id"],
                "slug": new_org["slug"],
                "name": new_org["name"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup failed: {str(e)}"
        )


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest):
    """
    Authenticate user and return user + organization data
    
    Note: This is a simplified version. In production:
    - Use proper password hashing (bcrypt/argon2)
    - Implement JWT tokens
    - Add session management
    """
    try:
        # 1. Find user by email
        user_response = supabase.table("users").select("*").eq("email", data.email).execute()
        
        if not user_response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        user = user_response.data[0]
        
        # 2. Verify password (TODO: use proper password hashing)
        if user["password"] != data.password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # 3. Get user's first organization with status check
        membership_response = supabase.table("memberships").select(
            """
            role,
            job_title,
            organizations!inner(*)
            """
        ).eq("user_id", user["id"]).limit(1).execute()
        
        if not membership_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No organization found for this user"
            )
        
        membership = membership_response.data[0]
        
        # Handle potential list return for organizations (Supabase quirk)
        org_data = membership.get("organizations")
        if isinstance(org_data, list):
            if not org_data:
                raise HTTPException(status_code=404, detail="Organization data empty")
            organization = org_data[0]
        else:
            organization = org_data
            
        if not organization:
             raise HTTPException(status_code=404, detail="Organization data missing")
        
        # CRITICAL: Check Organization Status
        # Default to 'active' if status column is missing (backward compatibility)
        org_status = organization.get("status", "active")
        
        if org_status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization access suspended. Contact support."
            )
            
        if org_status == "past_due":
            # Optional: Warning or block depending on business logic
            # For now, we allow but maybe log it
            logger.warning(f"Organization {organization.get('slug')} is past due")

        logger.info(f"User {user['email']} logged in successfully")
        
        # Determine redirect target
        role = membership["role"].upper()
        if role == "OWNER":
            redirect_target = "owner"
        elif role == "BOARD":
            redirect_target = "board"
        else:
            redirect_target = "member"
        
        return {
            "user": {
                "id": user["id"],
                "email": user["email"],
                "first_name": user.get("first_name", ""),
                "last_name": user.get("last_name", ""),
                "role": role,
                "job_title": membership.get("job_title", "")
            },
            "organization": organization,
            "access_token": "mock_token_" + str(uuid.uuid4()), # Placeholder for JWT
            "redirect_target": redirect_target
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        # Log the full traceback for debugging
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/logout")
async def logout():
    """
    Logout user
    In production, this should invalidate the JWT token
    """
    return {"message": "Logged out successfully"}
