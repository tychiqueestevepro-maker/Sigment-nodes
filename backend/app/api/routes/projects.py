"""
Projects API endpoints for Slack and Teams integration
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import List
from loguru import logger

from app.services.slack_service import slack_service
from app.services.teams_service import teams_service
from app.api.dependencies import get_current_user

router = APIRouter()


class CreateProjectChannelRequest(BaseModel):
    projectName: str
    projectLeadEmail: EmailStr
    teamEmails: List[EmailStr]


@router.post("/create-channel")
async def create_project_channel(
    request: CreateProjectChannelRequest,
    current_user = Depends(get_current_user)
):
    """
    Create a Slack channel for a new project
    
    This endpoint is triggered when an admin validates a project.
    It creates a private Slack channel using the user's OAuth token,
    invites the team, and posts a welcome message.
    """
    try:
        logger.info(f"Creating Slack channel for project: {request.projectName} by user {current_user.id}")
        
        result = await slack_service.create_project_channel(
            project_name=request.projectName,
            project_lead_email=request.projectLeadEmail,
            team_emails=request.teamEmails,
            user_id=str(current_user.id)
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to create Slack channel")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating project channel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-teams-channel")
async def create_teams_channel(request: CreateProjectChannelRequest):
    """
    Create a Microsoft Teams team for a new project
    
    This endpoint is triggered when an admin validates a project via Teams.
    It creates a private Team, adds the lead as owner and team members.
    """
    try:
        logger.info(f"Creating Teams team for project: {request.projectName}")
        
        result = await teams_service.create_project_team(
            project_name=request.projectName,
            project_lead_email=request.projectLeadEmail,
            team_emails=request.teamEmails
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to create Teams team")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Teams team: {e}")
        raise HTTPException(status_code=500, detail=str(e))
