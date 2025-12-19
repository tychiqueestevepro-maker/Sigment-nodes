"""
Supabase client wrapper with connection pooling and timeout configuration
"""
from supabase import create_client, Client
from app.core.config import settings
from loguru import logger


def _create_configured_client() -> Client:
    """
    Create a Supabase client.
    Simple configuration to ensure compatibility with supabase-py.
    """
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY
    )


class SupabaseClient:
    """Singleton Supabase client with connection pooling"""
    
    _instance: Client = None
    
    @classmethod
    def get_client(cls) -> Client:
        """Get or create Supabase client instance"""
        if cls._instance is None:
            cls._instance = _create_configured_client()
        return cls._instance
    
    @classmethod
    def reset_client(cls):
        """Reset the client instance (useful if connection issues persist)"""
        logger.warning("🔄 Resetting Supabase client due to potential resource issues")
        cls._instance = None
        cls._instance = _create_configured_client()


# Global instance
supabase = SupabaseClient.get_client()


# Helper function for routes
def get_supabase() -> Client:
    """Get Supabase client instance"""
    return SupabaseClient.get_client()


def get_fresh_supabase_client() -> Client:
    """
    Create a new Supabase client instance.
    Use this for auth operations (signup/login) to avoid polluting the global client state.
    """
    return _create_configured_client()
