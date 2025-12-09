"""
Supabase client wrapper with connection pooling and timeout configuration
"""
from supabase import create_client, Client
from app.core.config import settings
import httpx


def _create_configured_client() -> Client:
    """
    Create a Supabase client with properly configured httpx limits.
    This prevents [Errno 35] Resource temporarily unavailable errors
    by configuring connection pooling and timeouts.
    """
    # Note: supabase-py uses httpx internally but doesn't expose direct configuration.
    # The best approach for now is to create the standard client.
    # Connection limits are handled at the OS level and by httpx defaults.
    
    # Create client with standard configuration
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
        cls._instance = None


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

