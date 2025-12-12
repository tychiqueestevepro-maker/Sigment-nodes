"""
Slack integration service for project channel management
Multi-tenant: Uses each user's OAuth token from user_integrations table
"""
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from loguru import logger
from typing import List, Optional, Dict
from app.core.config import settings
from app.services.supabase_client import supabase
import re


class SlackService:
    def __init__(self):
        # Fallback to bot token for backwards compatibility
        self._default_client = WebClient(token=settings.SLACK_BOT_TOKEN) if settings.SLACK_BOT_TOKEN else None
    
    def _get_user_client(self, user_id: str) -> Optional[WebClient]:
        """
        Get a Slack WebClient using the user's OAuth token from database
        
        Args:
            user_id: The user's ID to look up their token
            
        Returns:
            WebClient configured with user's token, or None if not found
        """
        try:
            result = supabase.table("user_integrations").select("access_token").eq(
                "user_id", user_id
            ).eq("platform", "slack").single().execute()
            
            if result.data and result.data.get("access_token"):
                logger.info(f"Using OAuth token for user {user_id}")
                return WebClient(token=result.data["access_token"])
            else:
                logger.warning(f"No Slack token found for user {user_id}")
                return None
        except Exception as e:
            logger.error(f"Error fetching Slack token for user {user_id}: {e}")
            return None
    
    def _get_client(self, user_id: Optional[str] = None) -> WebClient:
        """
        Get appropriate Slack client - user's OAuth token if available, else default
        """
        if user_id:
            user_client = self._get_user_client(user_id)
            if user_client:
                return user_client
        
        if self._default_client:
            logger.info("Using default bot token")
            return self._default_client
        
        raise Exception("No Slack client available - user must connect their Slack account")
    
    def _sanitize_channel_name(self, project_name: str) -> str:
        """
        Generate a valid Slack channel name from project name
        - Lowercase
        - Replace spaces with hyphens
        - Remove special characters
        - Max 21 chars (to allow for 'proj-' prefix)
        - Prefix with 'proj-'
        """
        # Convert to lowercase
        name = project_name.lower()
        
        # Replace spaces with hyphens
        name = name.replace(" ", "-")
        
        # Remove special characters (keep only alphanumeric and hyphens)
        name = re.sub(r'[^a-z0-9-]', '', name)
        
        # Remove consecutive hyphens
        name = re.sub(r'-+', '-', name)
        
        # Trim to 21 chars
        name = name[:21]
        
        # Remove trailing hyphens
        name = name.rstrip('-')
        
        # Prefix with 'proj-'
        return f"proj-{name}"
    
    def _find_user_by_email(self, client: WebClient, email: str) -> Optional[str]:
        """
        Find Slack User ID by email
        Returns None if user not found
        """
        try:
            response = client.users_lookupByEmail(email=email)
            user_id = response.get("user", {}).get("id")
            logger.info(f"Found Slack user {user_id} for email {email}")
            return user_id
        except SlackApiError as e:
            logger.warning(f"User not found for email {email}: {e}")
            return None
    
    async def create_project_channel(
        self,
        project_name: str,
        project_lead_email: str,
        team_emails: List[str],
        user_id: Optional[str] = None
    ) -> Dict:
        """
        Create a private Slack channel for a project
        
        Args:
            project_name: Name of the project
            project_lead_email: Email of the project lead
            team_emails: List of team member emails
            user_id: ID of the user initiating the action (for OAuth token lookup)
            
        Returns:
            Dict with success status, channel_id, and member statuses
        """
        try:
            # Get the appropriate Slack client (user's OAuth token or fallback to bot)
            client = self._get_client(user_id)
            
            # Track member statuses
            member_statuses = []
            
            # 1. Generate channel name
            channel_name = self._sanitize_channel_name(project_name)
            logger.info(f"Creating Slack channel: {channel_name}")
            
            # 2. Create private channel
            try:
                create_response = client.conversations_create(
                    name=channel_name,
                    is_private=True
                )
                channel_id = create_response["channel"]["id"]
                logger.info(f"Channel created: {channel_id}")
            except SlackApiError as e:
                logger.error(f"Failed to create channel: {e}")
                return {"success": False, "error": f"Failed to create channel: {e.response['error']}"}
            
            # 3. Find project lead user ID and track status
            project_lead_id = self._find_user_by_email(client, project_lead_email)
            member_statuses.append({
                "email": project_lead_email,
                "role": "lead",
                "found": project_lead_id is not None,
                "slack_id": project_lead_id
            })
            
            # 4. Find team member user IDs and track statuses
            team_member_ids = []
            for email in team_emails:
                member_id = self._find_user_by_email(client, email)
                member_statuses.append({
                    "email": email,
                    "role": "member",
                    "found": member_id is not None,
                    "slack_id": member_id
                })
                if member_id:
                    team_member_ids.append(member_id)
            
            # 5. Invite members to channel
            all_user_ids = []
            if project_lead_id:
                all_user_ids.append(project_lead_id)
            all_user_ids.extend(team_member_ids)
            
            invited_count = 0
            if all_user_ids:
                try:
                    client.conversations_invite(
                        channel=channel_id,
                        users=",".join(all_user_ids)
                    )
                    invited_count = len(all_user_ids)
                    logger.info(f"Invited {invited_count} users to {channel_id}")
                except SlackApiError as e:
                    logger.error(f"Failed to invite users: {e}")
            
            # 6. Set channel topic
            if project_lead_id:
                topic = f"Project Lead: <@{project_lead_id}> | Status: Kickoff"
            else:
                topic = f"Project Lead: {project_lead_email} | Status: Kickoff"
            
            try:
                client.conversations_setTopic(
                    channel=channel_id,
                    topic=topic
                )
                logger.info(f"Set channel topic for {channel_id}")
            except SlackApiError as e:
                logger.error(f"Failed to set topic: {e}")
            
            # 7. Post welcome message using Block Kit
            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🚀 {project_name}",
                        "emoji": True
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Project launched successfully!*\n\nThis channel has been created automatically by SIGMENT."
                    }
                },
                {"type": "divider"}
            ]
            
            # Add project lead info
            if project_lead_id:
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Project Lead:* <@{project_lead_id}>"
                    }
                })
            else:
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Project Lead:* {project_lead_email} ⚠️ _Not found in Slack - please add manually_"
                    }
                })
            
            # Add team members with status
            if team_emails:
                team_text_parts = []
                for status in member_statuses:
                    if status["role"] == "member":
                        if status["found"]:
                            team_text_parts.append(f"✅ <@{status['slack_id']}>")
                        else:
                            team_text_parts.append(f"⚠️ {status['email']} _- add manually_")
                
                if team_text_parts:
                    blocks.append({
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Team Members:*\n" + "\n".join(team_text_parts)
                        }
                    })
            
            try:
                client.chat_postMessage(
                    channel=channel_id,
                    text=f"🚀 Project Launched: {project_name}",
                    blocks=blocks
                )
                logger.info(f"Posted welcome message to {channel_id}")
            except SlackApiError as e:
                logger.error(f"Failed to post welcome message: {e}")
            
            # Count found vs not found
            found_count = sum(1 for s in member_statuses if s["found"])
            not_found_count = sum(1 for s in member_statuses if not s["found"])
            
            return {
                "success": True,
                "channel_id": channel_id,
                "channel_name": channel_name,
                "message": f"Project channel {channel_name} created successfully",
                "invited_count": invited_count,
                "member_statuses": member_statuses,
                "found_count": found_count,
                "not_found_count": not_found_count
            }
            
        except Exception as e:
            logger.error(f"Unexpected error creating project channel: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
slack_service = SlackService()
