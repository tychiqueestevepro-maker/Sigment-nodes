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
    Create a new user account with organization using Supabase Auth
    
    Flow:
    1. Use Supabase Auth to create user (handles password hashing + JWT)
    2. Create organization
    3. Create OWNER membership linking auth user to org
    4. Return user + org data + real JWT token
    """
    try:
        # 1. Check if org slug is available first
        existing_org = supabase.table("organizations").select("id").eq("slug", data.organization_slug).execute()
        if existing_org.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization slug already taken"
            )
        
        # 2. Create user via Supabase Auth (handles password hashing automatically)
        auth_response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {
                    "first_name": data.first_name,
                    "last_name": data.last_name
                }
            }
        })
        
        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user account"
            )
        
        user_id = auth_response.user.id
        logger.info(f"Created Supabase Auth user: {data.email}")
        
        # 3. Create organization and owner membership atomically via RPC
        try:
            rpc_response = supabase.rpc("create_organization_and_owner", {
                "p_user_id": user_id,
                "p_email": data.email,
                "p_first_name": data.first_name,
                "p_last_name": data.last_name,
                "p_org_slug": data.organization_slug,
                "p_org_name": data.organization_name,
                "p_job_title": data.job_title
            }).execute()
            
            if not rpc_response.data:
                 raise Exception("RPC returned no data")
                 
            new_org = rpc_response.data
            logger.info(f"Created organization {new_org['slug']} and owner membership for user {user_id}")
            
        except Exception as e:
            # Rollback: delete auth user if RPC fails
            logger.error(f"Failed to create organization/membership via RPC: {e}")
            try:
                supabase.auth.admin.delete_user(user_id)
            except:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create organization. Please try again."
            )
        
        # 5. Get the real JWT access token from Supabase Auth
        access_token = auth_response.session.access_token if auth_response.session else None
        
        if not access_token:
            logger.warning("No session/token in auth response, user may need to verify email")
        
        # 6. Return success response with REAL JWT
        return {
            "user": {
                "id": user_id,
                "email": data.email,
                "first_name": data.first_name,
                "last_name": data.last_name,
                "role": "OWNER",
                "job_title": data.job_title
            },
            "organization": {
                "id": new_org["id"],
                "slug": new_org["slug"],
                "name": new_org["name"]
            },
            "access_token": access_token,
            "redirect_target": "owner"
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
    Authenticate user using Supabase Auth and return user + organization data
    
    Uses Supabase Auth Service for password verification and JWT generation.
    No manual password checking or token generation.
    """
    try:
        # 1. Authenticate with Supabase Auth
        auth_response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })
        
        if not auth_response.user or not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        user = auth_response.user
        user_id = user.id
        email = user.email
        
        logger.info(f"User {email} authenticated via Supabase Auth")
        
        # 2. Get user's membership (Step 1)
        membership_response = supabase.table("memberships").select(
            "organization_id, role, job_title"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not membership_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No organization found for this user"
            )
            
        membership = membership_response.data[0]
        organization_id = membership["organization_id"]
        
        # 3. Get organization details (Step 2)
        try:
            org_response = supabase.table("organizations").select("*").eq("id", organization_id).execute()
            
            if not org_response.data or len(org_response.data) == 0:
                raise HTTPException(status_code=404, detail="Organization data missing")
                
            organization = org_response.data[0]
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching organization: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch organization: {str(e)}")
        
        # 4. Check Organization Status
        org_status = organization.get("status", "active")
        
        if org_status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization access suspended. Contact support."
            )
            
        if org_status == "past_due":
            logger.warning(f"Organization {organization.get('slug')} is past due")

        logger.info(f"User {email} logged in successfully")
        
        # 5. Determine redirect target
        role = membership["role"].upper()
        if role == "OWNER":
            redirect_target = "owner"
        elif role == "BOARD":
            redirect_target = "board"
        else:
            redirect_target = "member"
        
        # 6. Return REAL JWT access token from Supabase Auth
        return {
            "user": {
                "id": user_id,
                "email": email,
                "first_name": user.user_metadata.get("first_name", ""),
                "last_name": user.user_metadata.get("last_name", ""),
                "role": role,
                "job_title": membership.get("job_title", "")
            },
            "organization": organization,
            "access_token": auth_response.session.access_token,
            "redirect_target": redirect_target
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
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
