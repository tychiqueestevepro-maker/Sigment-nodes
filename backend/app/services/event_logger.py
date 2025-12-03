"""
Helper functions for event logging
"""
from typing import Optional
from loguru import logger
from app.services.supabase_client import supabase


def log_note_event(
    note_id: str,
    event_type: str,
    title: str,
    description: Optional[str] = None,
    actor_id: Optional[str] = None,
    organization_id: Optional[str] = None
) -> None:
    """
    Log a note lifecycle event to the note_events table
    
    Args:
        note_id: UUID of the note
        event_type: Type of event (submission, ai_analysis, fusion, reviewing, refusal)
        title: User-friendly title for the event
        description: Optional detailed description
        actor_id: UUID of the user who triggered the event
        organization_id: UUID of the organization (for multi-tenancy context)
    """
    try:
        payload = {
            "note_id": note_id,
            "event_type": event_type,
            "title": title,
            "description": description
        }
        
        if actor_id:
            payload["actor_id"] = actor_id
            
        if organization_id:
            payload["organization_id"] = organization_id
            
        supabase.table("note_events").insert(payload).execute()
        
        logger.info(f"📝 Event logged for note {note_id}: {event_type} - {title}")
        
    except Exception as e:
        # Don't fail the main operation if event logging fails
        logger.error(f"❌ Failed to log event for note {note_id}: {e}")
