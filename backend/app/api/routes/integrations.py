"""
API routes for Slack and Teams OAuth integrations
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
from loguru import logger
import secrets
from datetime import datetime

from app.api.dependencies import get_current_user, get_supabase_client
from app.services.slack_oauth_service import slack_oauth_service
from app.services.teams_oauth_service import teams_oauth_service

router = APIRouter()

# Temporary storage for OAuth states (in production, use Redis)
oauth_states = {}


class IntegrationStatus(BaseModel):
    slack: bool
    teams: bool


class IntegrationInfo(BaseModel):
    platform: str
    connected: bool
    team_name: Optional[str] = None
    team_id: Optional[str] = None
    connected_at: Optional[str] = None


# ============================================================================
# SLACK ROUTES
# ============================================================================

@router.get("/slack/connect")
async def connect_slack(request: Request, current_user = Depends(get_current_user)):
    """
    Initiate Slack OAuth flow
    Returns authorization URL for user to visit
    """
    try:
        # Get org slug from header or path
        org_slug = request.headers.get("X-Organization-Id", "sigment")
        
        # Generate CSRF protection state
        state = secrets.token_urlsafe(32)
        oauth_states[state] = {
            "user_id": str(current_user.id),
            "platform": "slack",
            "org_slug": org_slug,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Get authorization URL
        auth_url = slack_oauth_service.get_authorization_url(state)
        
        logger.info(f"User {current_user.id} initiating Slack OAuth for org {org_slug}")
        
        return {
            "authorization_url": auth_url,
            "state": state
        }
        
    except Exception as e:
        logger.error(f"Error initiating Slack OAuth: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/slack/callback")
async def slack_callback(
    code: str = Query(...),
    state: str = Query(...)
):
    """
    Handle Slack OAuth callback
    Exchange code for access token and store in database
    """
    try:
        # Verify state
        if state not in oauth_states:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        state_data = oauth_states.pop(state)
        user_id = state_data["user_id"]
        org_slug = state_data.get("org_slug", "sigment")
        
        # Exchange code for token
        token_data = await slack_oauth_service.exchange_code_for_token(code)
        
        # Store integration in database
        supabase = get_supabase_client()
        
        integration_data = {
            "user_id": user_id,
            "platform": "slack",
            "access_token": token_data["access_token"],
            "token_type": token_data["token_type"],
            "scope": token_data["scope"],
            "team_id": token_data["team_id"],
            "user_platform_id": token_data["user_id"],
            "expires_at": token_data.get("expires_at")
        }
        
        # Upsert (insert or update if exists)
        result = supabase.table("user_integrations").upsert(
            integration_data,
            on_conflict="user_id,platform"
        ).execute()
        
        logger.info(f"Slack integration saved for user {user_id}")
        
        # Redirect to success page with correct org slug
        return RedirectResponse(
            url=f"http://localhost:3000/{org_slug}/review?integration=slack&status=success"
        )
        
    except Exception as e:
        logger.error(f"Error in Slack callback: {e}")
        return RedirectResponse(
            url=f"http://localhost:3000/sigment/review?integration=slack&status=error&message={str(e)}"
        )


# ============================================================================
# TEAMS ROUTES
# ============================================================================

@router.get("/teams/connect")
async def connect_teams(request: Request, current_user = Depends(get_current_user)):
    """
    Initiate Microsoft Teams OAuth flow
    Returns authorization URL for user to visit
    """
    try:
        # Get org slug from header or path
        org_slug = request.headers.get("X-Organization-Id", "sigment")
        
        # Generate CSRF protection state
        state = secrets.token_urlsafe(32)
        oauth_states[state] = {
            "user_id": str(current_user.id),
            "platform": "teams",
            "org_slug": org_slug,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Get authorization URL
        auth_url = teams_oauth_service.get_authorization_url(state)
        
        logger.info(f"User {current_user.id} initiating Teams OAuth for org {org_slug}")
        
        return {
            "authorization_url": auth_url,
            "state": state
        }
        
    except Exception as e:
        logger.error(f"Error initiating Teams OAuth: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams/callback")
async def teams_callback(
    code: str = Query(...),
    state: str = Query(...)
):
    """
    Handle Microsoft Teams OAuth callback
    Exchange code for access token and store in database
    """
    try:
        # Verify state
        if state not in oauth_states:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        state_data = oauth_states.pop(state)
        user_id = state_data["user_id"]
        org_slug = state_data.get("org_slug", "sigment")
        
        # Exchange code for token
        token_data = await teams_oauth_service.exchange_code_for_token(code)
        
        # Store integration in database
        supabase = get_supabase_client()
        
        integration_data = {
            "user_id": user_id,
            "platform": "teams",
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "token_type": token_data["token_type"],
            "scope": token_data["scope"],
            "team_id": token_data["team_id"],
            "expires_at": token_data["expires_at"]
        }
        
        # Upsert (insert or update if exists)
        result = supabase.table("user_integrations").upsert(
            integration_data,
            on_conflict="user_id,platform"
        ).execute()
        
        logger.info(f"Teams integration saved for user {user_id}")
        
        # Redirect to success page with correct org slug
        return RedirectResponse(
            url=f"http://localhost:3000/{org_slug}/review?integration=teams&status=success"
        )
        
    except Exception as e:
        logger.error(f"Error in Teams callback: {e}")
        return RedirectResponse(
            url=f"http://localhost:3000/sigment/review?integration=teams&status=error&message={str(e)}"
        )


# ============================================================================
# COMMON ROUTES
# ============================================================================

@router.get("/status", response_model=IntegrationStatus)
async def get_integration_status(current_user = Depends(get_current_user)):
    """
    Check which platforms are connected for the current user
    """
    try:
        supabase = get_supabase_client()
        
        # Query user integrations
        result = supabase.table("user_integrations").select("platform").eq(
            "user_id", str(current_user.id)
        ).execute()
        
        platforms = [row["platform"] for row in result.data]
        
        return IntegrationStatus(
            slack="slack" in platforms,
            teams="teams" in platforms
        )
        
    except Exception as e:
        logger.error(f"Error getting integration status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_integrations(current_user = Depends(get_current_user)):
    """
    List all integrations for the current user with details
    """
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("user_integrations").select(
            "platform, team_id, created_at"
        ).eq("user_id", str(current_user.id)).execute()
        
        integrations = []
        for row in result.data:
            integrations.append(IntegrationInfo(
                platform=row["platform"],
                connected=True,
                team_id=row.get("team_id"),
                connected_at=row.get("created_at")
            ))
        
        return integrations
        
    except Exception as e:
        logger.error(f"Error listing integrations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{platform}/disconnect")
async def disconnect_platform(
    platform: str,
    current_user = Depends(get_current_user)
):
    """
    Disconnect a platform integration
    """
    try:
        if platform not in ["slack", "teams"]:
            raise HTTPException(status_code=400, detail="Invalid platform")
        
        supabase = get_supabase_client()
        
        # Get the integration before deleting (to revoke token if needed)
        result = supabase.table("user_integrations").select("access_token").eq(
            "user_id", str(current_user.id)
        ).eq("platform", platform).execute()
        
        if result.data:
            access_token = result.data[0]["access_token"]
            
            # Revoke token if it's Slack
            if platform == "slack":
                await slack_oauth_service.revoke_token(access_token)
        
        # Delete from database
        supabase.table("user_integrations").delete().eq(
            "user_id", str(current_user.id)
        ).eq("platform", platform).execute()
        
        logger.info(f"User {current_user.id} disconnected {platform}")
        
        return {
            "success": True,
            "platform": platform,
            "message": f"{platform.capitalize()} integration removed"
        }
        
    except Exception as e:
        logger.error(f"Error disconnecting {platform}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{platform}/token")
async def get_platform_token(
    platform: str,
    current_user = Depends(get_current_user)
):
    """
    Get access token for a platform (for internal use by other services)
    """
    try:
        if platform not in ["slack", "teams"]:
            raise HTTPException(status_code=400, detail="Invalid platform")
        
        supabase = get_supabase_client()
        
        result = supabase.table("user_integrations").select(
            "access_token, refresh_token, expires_at"
        ).eq("user_id", str(current_user.id)).eq("platform", platform).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=404,
                detail=f"No {platform} integration found. Please connect first."
            )
        
        integration = result.data[0]
        
        # Check if token is expired (for Teams)
        if platform == "teams" and integration.get("expires_at"):
            expires_at = datetime.fromisoformat(integration["expires_at"].replace('Z', '+00:00'))
            if expires_at < datetime.utcnow():
                # Token expired, refresh it
                refresh_token = integration["refresh_token"]
                new_token_data = await teams_oauth_service.refresh_access_token(refresh_token)
                
                # Update in database
                supabase.table("user_integrations").update({
                    "access_token": new_token_data["access_token"],
                    "refresh_token": new_token_data["refresh_token"],
                    "expires_at": new_token_data["expires_at"]
                }).eq("user_id", str(current_user.id)).eq("platform", platform).execute()
                
                return {"access_token": new_token_data["access_token"]}
        
        return {"access_token": integration["access_token"]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting {platform} token: {e}")
        raise HTTPException(status_code=500, detail=str(e))
