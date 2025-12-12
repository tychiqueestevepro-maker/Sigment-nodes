"""
Slack OAuth2 Service for user authentication and token management
"""
import os
import httpx
from typing import Optional, Dict
from loguru import logger
from datetime import datetime, timedelta


class SlackOAuthService:
    def __init__(self):
        # OAuth scopes needed for channel creation and management
        self.scopes = [
            "channels:manage",      # Create and manage public channels
            "groups:write",         # Create and manage private channels
            "chat:write",           # Post messages
            "users:read",           # Read user information
            "users:read.email",     # Match users by email
            "team:read"             # Read workspace information
        ]
    
    @property
    def client_id(self):
        return os.getenv("SLACK_CLIENT_ID")
    
    @property
    def client_secret(self):
        return os.getenv("SLACK_CLIENT_SECRET")
    
    @property
    def redirect_uri(self):
        return os.getenv("SLACK_REDIRECT_URI", "http://localhost:8000/api/v1/integrations/slack/callback")
    
    def get_authorization_url(self, state: str) -> str:
        """
        Generate Slack OAuth authorization URL
        
        Args:
            state: Random state parameter for CSRF protection
            
        Returns:
            Authorization URL to redirect user to
        """
        scope_string = " ".join(self.scopes)
        
        params = {
            "client_id": self.client_id,
            "scope": scope_string,
            "redirect_uri": self.redirect_uri,
            "state": state
        }
        
        # Build query string
        query = "&".join([f"{k}={v}" for k, v in params.items()])
        auth_url = f"https://slack.com/oauth/v2/authorize?{query}"
        
        logger.info(f"Generated Slack OAuth URL with scopes: {scope_string}")
        return auth_url
    
    async def exchange_code_for_token(self, code: str) -> Dict:
        """
        Exchange authorization code for access token
        
        Args:
            code: Authorization code from OAuth callback
            
        Returns:
            Dict containing access_token, team_id, user_id, scope, etc.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://slack.com/api/oauth.v2.access",
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "code": code,
                        "redirect_uri": self.redirect_uri
                    }
                )
                
                response.raise_for_status()
                data = response.json()
                
                if not data.get("ok"):
                    error = data.get("error", "Unknown error")
                    logger.error(f"Slack OAuth error: {error}")
                    raise Exception(f"Slack OAuth failed: {error}")
                
                logger.info(f"Successfully exchanged code for Slack token")
                
                return {
                    "access_token": data["access_token"],
                    "token_type": data.get("token_type", "Bearer"),
                    "scope": data.get("scope", ""),
                    "team_id": data["team"]["id"],
                    "team_name": data["team"]["name"],
                    "user_id": data["authed_user"]["id"],
                    # Slack tokens don't typically expire, but we set a far future date
                    "expires_at": None
                }
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error exchanging Slack code: {e}")
            raise Exception(f"Failed to exchange Slack authorization code: {str(e)}")
        except Exception as e:
            logger.error(f"Error exchanging Slack code: {e}")
            raise
    
    async def verify_token(self, access_token: str) -> bool:
        """
        Verify if a Slack access token is still valid
        
        Args:
            access_token: Slack access token to verify
            
        Returns:
            True if token is valid, False otherwise
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://slack.com/api/auth.test",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                data = response.json()
                return data.get("ok", False)
                
        except Exception as e:
            logger.error(f"Error verifying Slack token: {e}")
            return False
    
    async def revoke_token(self, access_token: str) -> bool:
        """
        Revoke a Slack access token
        
        Args:
            access_token: Token to revoke
            
        Returns:
            True if successfully revoked
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://slack.com/api/auth.revoke",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                data = response.json()
                success = data.get("ok", False)
                
                if success:
                    logger.info("Successfully revoked Slack token")
                else:
                    logger.warning(f"Failed to revoke Slack token: {data.get('error')}")
                
                return success
                
        except Exception as e:
            logger.error(f"Error revoking Slack token: {e}")
            return False


# Singleton instance
slack_oauth_service = SlackOAuthService()
