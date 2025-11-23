"""
Supabase client wrapper
"""
from supabase import create_client, Client
from app.core.config import settings


class SupabaseClient:
    """Singleton Supabase client"""
    
    _instance: Client = None
    
    @classmethod
    def get_client(cls) -> Client:
        """Get or create Supabase client instance"""
        if cls._instance is None:
            cls._instance = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY
            )
        return cls._instance


# Global instance
supabase = SupabaseClient.get_client()


# Helper function for routes
def get_supabase() -> Client:
    """Get Supabase client instance"""
    return SupabaseClient.get_client()

