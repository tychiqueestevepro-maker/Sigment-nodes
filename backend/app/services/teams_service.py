"""
Microsoft Teams Service for creating project teams
"""
import os
import httpx
from typing import List, Dict, Optional
from loguru import logger


class TeamsService:
    def __init__(self):
        self.tenant_id = os.getenv("AZURE_TENANT_ID")
        self.client_id = os.getenv("AZURE_CLIENT_ID")
        self.client_secret = os.getenv("AZURE_CLIENT_SECRET")
        self.graph_api_base = "https://graph.microsoft.com/v1.0"
        self.access_token: Optional[str] = None
    
    async def _get_access_token(self) -> str:
        """
        Get Microsoft Graph API access token using Client Credentials flow
        """
        if self.access_token:
            return self.access_token
        
        token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, data=data)
            response.raise_for_status()
            token_data = response.json()
            self.access_token = token_data["access_token"]
            return self.access_token
    
    async def _get_user_id_by_email(self, email: str) -> Optional[str]:
        """
        Get Microsoft user ID by email address
        """
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Use $filter to find user by email
            url = f"{self.graph_api_base}/users?$filter=mail eq '{email}' or userPrincipalName eq '{email}'"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                if data.get("value") and len(data["value"]) > 0:
                    return data["value"][0]["id"]
                else:
                    logger.warning(f"User not found for email: {email}")
                    return None
        except Exception as e:
            logger.error(f"Error finding user {email}: {e}")
            return None
    
    async def create_project_team(
        self,
        project_name: str,
        project_lead_email: str,
        team_emails: List[str]
    ) -> Dict:
        """
        Create a Microsoft Teams project with owner and members
        
        Args:
            project_name: Name of the project/team
            project_lead_email: Email of the project lead (will be team owner)
            team_emails: List of team member emails
        
        Returns:
            Dict with success status, team_id, and team_name
        """
        try:
            logger.info(f"Creating Teams project: {project_name}")
            
            # Get user IDs
            lead_id = await self._get_user_id_by_email(project_lead_email)
            if not lead_id:
                return {
                    "success": False,
                    "error": f"Project lead not found: {project_lead_email}"
                }
            
            # Get member IDs (filter out None values for users not found)
            member_ids = []
            for email in team_emails:
                user_id = await self._get_user_id_by_email(email)
                if user_id and user_id != lead_id:  # Don't add lead as member
                    member_ids.append({"id": user_id, "email": email})
                elif user_id == lead_id:
                    logger.info(f"Skipping {email} - already the team owner")
                else:
                    logger.warning(f"Team member not found: {email}")
            
            # Prepare members array for team creation
            members = [
                {
                    "@odata.type": "#microsoft.graph.aadUserConversationMember",
                    "roles": ["owner"],
                    "user@odata.bind": f"{self.graph_api_base}/users('{lead_id}')"
                }
            ]
            
            # Add regular members
            for member in member_ids:
                members.append({
                    "@odata.type": "#microsoft.graph.aadUserConversationMember",
                    "roles": [],
                    "user@odata.bind": f"{self.graph_api_base}/users('{member['id']}')"
                })
            
            # Create team payload
            team_payload = {
                "template@odata.bind": f"{self.graph_api_base}/teamsTemplates('standard')",
                "displayName": project_name,
                "description": f"Team for {project_name}",
                "members": members
            }
            
            # Create the team
            token = await self._get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.graph_api_base}/teams",
                    headers=headers,
                    json=team_payload
                )
                
                if response.status_code == 202:
                    # Team creation is asynchronous, get the Location header
                    location = response.headers.get("Location")
                    logger.info(f"Team creation initiated. Location: {location}")
                    
                    # Extract team ID from response or location
                    # The response might be empty for async operations
                    # We'll need to poll or wait
                    
                    # For now, return success
                    return {
                        "success": True,
                        "team_name": project_name,
                        "message": "Team creation initiated successfully",
                        "members_added": len(member_ids) + 1  # +1 for owner
                    }
                else:
                    response.raise_for_status()
                    team_data = response.json()
                    team_id = team_data.get("id")
                    
                    logger.info(f"Team created successfully: {team_id}")
                    
                    # Optionally send welcome message
                    # await self._send_welcome_message(team_id, lead_id, project_lead_email)
                    
                    return {
                        "success": True,
                        "team_id": team_id,
                        "team_name": project_name,
                        "members_added": len(member_ids) + 1
                    }
                    
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP error creating team: {e.response.status_code} - {e.response.text}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
        except Exception as e:
            error_msg = f"Error creating team: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
    
    async def _send_welcome_message(self, team_id: str, lead_id: str, lead_email: str):
        """
        Send a welcome message to the General channel
        (This would require getting the channel ID first)
        """
        try:
            token = await self._get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Get channels
            async with httpx.AsyncClient() as client:
                channels_response = await client.get(
                    f"{self.graph_api_base}/teams/{team_id}/channels",
                    headers=headers
                )
                channels_response.raise_for_status()
                channels = channels_response.json().get("value", [])
                
                # Find General channel
                general_channel = next(
                    (ch for ch in channels if ch.get("displayName") == "General"),
                    None
                )
                
                if general_channel:
                    channel_id = general_channel["id"]
                    
                    # Send welcome message
                    message_payload = {
                        "body": {
                            "contentType": "html",
                            "content": f"<p>🚀 Project created successfully!</p><p>Owner: <at id='0'>{lead_email}</at></p>"
                        },
                        "mentions": [
                            {
                                "id": 0,
                                "mentionText": lead_email,
                                "mentioned": {
                                    "user": {
                                        "id": lead_id,
                                        "displayName": lead_email,
                                        "userIdentityType": "aadUser"
                                    }
                                }
                            }
                        ]
                    }
                    
                    await client.post(
                        f"{self.graph_api_base}/teams/{team_id}/channels/{channel_id}/messages",
                        headers=headers,
                        json=message_payload
                    )
                    logger.info(f"Welcome message sent to team {team_id}")
                    
        except Exception as e:
            logger.error(f"Error sending welcome message: {e}")


# Singleton instance
teams_service = TeamsService()
