"""
Microsoft Teams OAuth2 Service for user authentication and token management
"""
import os
import httpx
from typing import Optional, Dict
from loguru import logger
from datetime import datetime, timedelta


class TeamsOAuthService:
    def __init__(self):
        self.graph_api_base = "https://graph.microsoft.com/v1.0"
        
        # OAuth scopes (delegated permissions)
        self.scopes = [
            "Team.Create",
            "TeamMember.ReadWrite.All",
            "User.Read",
            "User.Read.All",  # Required to search users by email
            "Group.ReadWrite.All",
            "offline_access"  # For refresh token
        ]
    
    @property
    def tenant_id(self):
        return os.getenv("AZURE_TENANT_ID")
    
    @property
    def client_id(self):
        return os.getenv("AZURE_CLIENT_ID")
    
    @property
    def client_secret(self):
        return os.getenv("AZURE_CLIENT_SECRET")
    
    @property
    def redirect_uri(self):
        return os.getenv("AZURE_REDIRECT_URI", "http://localhost:8000/api/v1/integrations/teams/callback")
    
    def get_authorization_url(self, state: str) -> str:
        """
        Generate Microsoft OAuth authorization URL
        
        Args:
            state: Random state parameter for CSRF protection
            
        Returns:
            Authorization URL to redirect user to
        """
        scope_string = " ".join(self.scopes)
        
        # Use 'organizations' for work/school accounts only (Azure AD accounts)
        # This excludes personal Microsoft accounts (consumers)
        tenant = "organizations"
        
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "response_mode": "query",
            "scope": scope_string,
            "state": state
        }
        
        # Build query string with URL encoding
        from urllib.parse import urlencode
        query = urlencode(params)
        auth_url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?{query}"
        
        logger.info(f"Generated Microsoft OAuth URL (multi-tenant) with scopes: {scope_string}")
        return auth_url
    
    async def exchange_code_for_token(self, code: str) -> Dict:
        """
        Exchange authorization code for access token
        
        Args:
            code: Authorization code from OAuth callback
            
        Returns:
            Dict containing access_token, refresh_token, expires_in, etc.
        """
        try:
            # Use 'organizations' for multi-tenant (work/school accounts only)
            token_url = "https://login.microsoftonline.com/organizations/oauth2/v2.0/token"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    token_url,
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "code": code,
                        "redirect_uri": self.redirect_uri,
                        "grant_type": "authorization_code",
                        "scope": " ".join(self.scopes)
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                response.raise_for_status()
                data = response.json()
                
                logger.info("Successfully exchanged code for Microsoft token")
                
                # Calculate expiration timestamp
                expires_in = data.get("expires_in", 3600)
                expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                
                return {
                    "access_token": data["access_token"],
                    "refresh_token": data.get("refresh_token"),
                    "token_type": data.get("token_type", "Bearer"),
                    "expires_in": expires_in,
                    "expires_at": expires_at.isoformat(),
                    "scope": data.get("scope", ""),
                    "user_id": None,  # Will be fetched separately if needed
                    "team_id": self.tenant_id
                }
                
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text
            logger.error(f"HTTP error exchanging Microsoft code: {error_detail}")
            raise Exception(f"Failed to exchange Microsoft authorization code: {error_detail}")
        except Exception as e:
            logger.error(f"Error exchanging Microsoft code: {e}")
            raise
    
    async def refresh_access_token(self, refresh_token: str) -> Dict:
        """
        Refresh an expired access token using refresh token
        
        Args:
            refresh_token: Refresh token
            
        Returns:
            Dict with new access_token and expiration info
        """
        try:
            # Use 'organizations' for multi-tenant (work/school accounts only)
            token_url = "https://login.microsoftonline.com/organizations/oauth2/v2.0/token"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    token_url,
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "refresh_token": refresh_token,
                        "grant_type": "refresh_token",
                        "scope": " ".join(self.scopes)
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                response.raise_for_status()
                data = response.json()
                
                logger.info("Successfully refreshed Microsoft token")
                
                expires_in = data.get("expires_in", 3600)
                expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                
                return {
                    "access_token": data["access_token"],
                    "refresh_token": data.get("refresh_token", refresh_token),  # May return new refresh token
                    "expires_in": expires_in,
                    "expires_at": expires_at.isoformat(),
                    "scope": data.get("scope", "")
                }
                
        except Exception as e:
            logger.error(f"Error refreshing Microsoft token: {e}")
            raise
    
    async def verify_token(self, access_token: str) -> bool:
        """
        Verify if a Microsoft access token is still valid
        
        Args:
            access_token: Microsoft access token to verify
            
        Returns:
            True if token is valid, False otherwise
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.graph_api_base}/me",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                return response.status_code == 200
                
        except Exception as e:
            logger.error(f"Error verifying Microsoft token: {e}")
            return False
    
    async def get_user_info(self, access_token: str) -> Optional[Dict]:
        """
        Get user information from Microsoft Graph
        
        Args:
            access_token: Valid access token
            
        Returns:
            User info dict or None
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.graph_api_base}/me",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            logger.error(f"Error getting Microsoft user info: {e}")
            return None


# Singleton instance
teams_oauth_service = TeamsOAuthService()
