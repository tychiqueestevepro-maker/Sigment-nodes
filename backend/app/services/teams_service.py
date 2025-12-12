"""
Microsoft Teams Service for creating project teams
Multi-tenant: Uses each user's OAuth token from user_integrations table
"""
import os
import httpx
from typing import List, Dict, Optional
from loguru import logger
from app.services.supabase_client import supabase


class TeamsService:
    def __init__(self):
        self.graph_api_base = "https://graph.microsoft.com/v1.0"
    
    def _get_user_token(self, user_id: str) -> Optional[str]:
        """
        Get the user's Teams OAuth token from the database
        """
        try:
            result = supabase.table("user_integrations").select("access_token").eq(
                "user_id", user_id
            ).eq("platform", "teams").single().execute()
            
            if result.data and result.data.get("access_token"):
                logger.info(f"Using OAuth token for user {user_id}")
                return result.data["access_token"]
            else:
                logger.warning(f"No Teams token found for user {user_id}")
                return None
        except Exception as e:
            logger.error(f"Error fetching Teams token for user {user_id}: {e}")
            return None
    
    async def _get_user_id_by_email(self, access_token: str, email: str) -> Optional[str]:
        """
        Get Microsoft user ID by email address using the user's token
        Tries multiple methods to find the user
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            # Method 1: Try direct user lookup by userPrincipalName
            try:
                url = f"{self.graph_api_base}/users/{email}"
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Found user {email} via direct lookup: {data.get('id')}")
                    return data.get("id")
            except Exception as e:
                logger.debug(f"Direct lookup failed for {email}: {e}")
            
            # Method 2: Try /me if this might be the current user
            try:
                me_response = await client.get(f"{self.graph_api_base}/me", headers=headers)
                if me_response.status_code == 200:
                    me_data = me_response.json()
                    me_email = me_data.get("mail") or me_data.get("userPrincipalName", "")
                    if me_email.lower() == email.lower():
                        logger.info(f"Found user {email} via /me: {me_data.get('id')}")
                        return me_data.get("id")
            except Exception as e:
                logger.debug(f"/me lookup failed: {e}")
            
            # Method 3: Try people search (requires People.Read permission)
            try:
                search_url = f"{self.graph_api_base}/me/people?$search=\"{email}\""
                response = await client.get(search_url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("value") and len(data["value"]) > 0:
                        # Get the user ID from people result
                        person = data["value"][0]
                        user_id = person.get("id")
                        if user_id:
                            logger.info(f"Found user {email} via people search: {user_id}")
                            return user_id
            except Exception as e:
                logger.debug(f"People search failed for {email}: {e}")
            
            logger.warning(f"User not found for email: {email}")
            return None
    
    async def create_project_team(
        self,
        project_name: str,
        project_lead_email: str,
        team_emails: List[str],
        user_id: Optional[str] = None
    ) -> Dict:
        """
        Create a Microsoft Teams project with owner and members
        
        Args:
            project_name: Name of the project/team
            project_lead_email: Email of the project lead (will be team owner)
            team_emails: List of team member emails
            user_id: ID of the user initiating the action (for OAuth token lookup)
        
        Returns:
            Dict with success status, team_id, team_name, and member_statuses
        """
        try:
            logger.info(f"Creating Teams project: {project_name} by user {user_id}")
            
            # Get user's OAuth token
            if not user_id:
                return {"success": False, "error": "User ID required for Teams operations"}
            
            access_token = self._get_user_token(user_id)
            if not access_token:
                return {"success": False, "error": "Please connect your Microsoft Teams account first"}
            
            # Track member statuses
            member_statuses = []
            
            # Get lead user ID
            lead_id = await self._get_user_id_by_email(access_token, project_lead_email)
            member_statuses.append({
                "email": project_lead_email,
                "role": "lead",
                "found": lead_id is not None,
                "teams_id": lead_id
            })
            
            if not lead_id:
                return {
                    "success": False,
                    "error": f"Project lead not found in Teams: {project_lead_email}",
                    "member_statuses": member_statuses
                }
            
            # Get member IDs and track status
            member_ids = []
            for email in team_emails:
                teams_user_id = await self._get_user_id_by_email(access_token, email)
                member_statuses.append({
                    "email": email,
                    "role": "member",
                    "found": teams_user_id is not None,
                    "teams_id": teams_user_id
                })
                if teams_user_id and teams_user_id != lead_id:
                    member_ids.append({"id": teams_user_id, "email": email})
                elif teams_user_id == lead_id:
                    logger.info(f"Skipping {email} - already the team owner")
            
            # Create team with ONLY the owner (cannot add multiple members at creation)
            team_payload = {
                "template@odata.bind": f"{self.graph_api_base}/teamsTemplates('standard')",
                "displayName": project_name,
                "description": f"Team for {project_name} - Created by SIGMENT",
                "members": [
                    {
                        "@odata.type": "#microsoft.graph.aadUserConversationMember",
                        "roles": ["owner"],
                        "user@odata.bind": f"{self.graph_api_base}/users('{lead_id}')"
                    }
                ]
            }
            
            # Create the team using user's token
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            team_id = None
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.graph_api_base}/teams",
                    headers=headers,
                    json=team_payload
                )
                
                if response.status_code == 202:
                    # Team creation is asynchronous, get the team ID from Location header
                    location = response.headers.get("Location")
                    logger.info(f"Team creation initiated. Location: {location}")
                    
                    # Extract team ID from location header if available
                    # Format: /teams('team-id')/operations('operation-id')
                    if location and "/teams('" in location:
                        try:
                            team_id = location.split("/teams('")[1].split("')")[0]
                            logger.info(f"Extracted team ID: {team_id}")
                        except:
                            pass
                    
                    # Wait a bit for the team to be created before adding members
                    import asyncio
                    await asyncio.sleep(5)  # Wait 5 seconds for team creation
                    
                elif response.status_code in [200, 201]:
                    team_data = response.json()
                    team_id = team_data.get("id")
                    logger.info(f"Team created successfully: {team_id}")
                else:
                    response.raise_for_status()
            
            # Add members to the team one by one (if we have a team_id)
            members_added = 1  # Owner already added
            if team_id and member_ids:
                logger.info(f"Adding {len(member_ids)} members to team {team_id}")
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    for member in member_ids:
                        try:
                            member_payload = {
                                "@odata.type": "#microsoft.graph.aadUserConversationMember",
                                "roles": [],
                                "user@odata.bind": f"{self.graph_api_base}/users('{member['id']}')"
                            }
                            
                            add_response = await client.post(
                                f"{self.graph_api_base}/teams/{team_id}/members",
                                headers=headers,
                                json=member_payload
                            )
                            
                            if add_response.status_code in [200, 201]:
                                members_added += 1
                                logger.info(f"Added member {member['email']} to team")
                            else:
                                logger.warning(f"Failed to add member {member['email']}: {add_response.status_code}")
                                
                        except Exception as e:
                            logger.error(f"Error adding member {member['email']}: {e}")
            
            # Count found vs not found
            found_count = sum(1 for s in member_statuses if s["found"])
            not_found_count = sum(1 for s in member_statuses if not s["found"])
            
            # Send welcome message to the team's General channel
            if team_id:
                await self._send_welcome_message(
                    access_token=access_token,
                    team_id=team_id,
                    project_name=project_name,
                    project_lead_email=project_lead_email,
                    member_statuses=member_statuses
                )
            
            return {
                "success": True,
                "team_id": team_id,
                "team_name": project_name,
                "message": "Team created successfully",
                "members_added": members_added,
                "member_statuses": member_statuses,
                "found_count": found_count,
                "not_found_count": not_found_count
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
    
    async def _send_welcome_message(
        self, 
        access_token: str,
        team_id: str, 
        project_name: str,
        project_lead_email: str,
        member_statuses: list
    ):
        """
        Send a welcome message to the General channel with project info
        (similar to Slack welcome message)
        """
        try:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Wait a bit more for the team to be fully provisioned
            import asyncio
            await asyncio.sleep(3)
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Get channels
                channels_response = await client.get(
                    f"{self.graph_api_base}/teams/{team_id}/channels",
                    headers=headers
                )
                
                if channels_response.status_code != 200:
                    logger.warning(f"Could not get channels: {channels_response.status_code}")
                    return
                    
                channels = channels_response.json().get("value", [])
                
                # Find General channel
                general_channel = next(
                    (ch for ch in channels if ch.get("displayName") == "General"),
                    None
                )
                
                if not general_channel:
                    logger.warning("General channel not found")
                    return
                    
                channel_id = general_channel["id"]
                
                # Build the welcome message (similar to Slack)
                lead_info = next((m for m in member_statuses if m["role"] == "lead"), None)
                members_found = [m for m in member_statuses if m["role"] == "member" and m["found"]]
                members_not_found = [m for m in member_statuses if m["role"] == "member" and not m["found"]]
                
                # Build HTML message
                message_html = f"""
                    <h2>{project_name}</h2>
                    <p><strong>Project launched successfully!</strong></p>
                    <p>This team has been created automatically by SIGMENT.</p>
                    <hr/>
                    <p><strong>Project Lead:</strong> {project_lead_email} {'✅' if lead_info and lead_info['found'] else '⚠️'}</p>
                """
                
                if members_found or members_not_found:
                    message_html += "<p><strong>Team Members:</strong></p><ul>"
                    
                    for member in members_found:
                        message_html += f"<li>✅ {member['email']} - added</li>"
                    
                    for member in members_not_found:
                        message_html += f"<li>⚠️ {member['email']} - <em>add manually</em></li>"
                    
                    message_html += "</ul>"
                
                message_payload = {
                    "body": {
                        "contentType": "html",
                        "content": message_html
                    }
                }
                
                msg_response = await client.post(
                    f"{self.graph_api_base}/teams/{team_id}/channels/{channel_id}/messages",
                    headers=headers,
                    json=message_payload
                )
                
                if msg_response.status_code in [200, 201]:
                    logger.info(f"Welcome message sent to team {team_id}")
                else:
                    logger.warning(f"Failed to send welcome message: {msg_response.status_code} - {msg_response.text[:200]}")
                    
        except Exception as e:
            logger.error(f"Error sending welcome message: {e}")


# Singleton instance
teams_service = TeamsService()
