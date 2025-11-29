"""
Notes API endpoints
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, HTTPException, BackgroundTasks
from loguru import logger

from app.models.note import NoteCreate, NoteSync, NoteResponse, NoteUpdate
from app.services.supabase_client import supabase
from app.workers.tasks import process_note_task, reprocess_cluster_on_moderation_task

router = APIRouter()


@router.post("/", response_model=NoteResponse)
async def create_note(note: NoteCreate):
    """
    Create a single note (online mode)
    Returns immediately with "draft" status
    """
    try:
        # Insert note
        response = supabase.table("notes").insert({
            "user_id": str(note.user_id),
            "content_raw": note.content_raw,
            "status": "draft"
        }).execute()
        
        created_note = response.data[0]
        note_id = created_note["id"]
        
        # Trigger async processing
        process_note_task.delay(note_id)
        
        logger.info(f"Note created: {note_id}")
        
        return created_note
        
    except Exception as e:
        logger.error(f"Error creating note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync", response_model=List[NoteResponse])
async def sync_notes(payload: NoteSync):
    """
    Batch sync notes from offline-first frontend
    """
    try:
        created_notes = []
        
        for note in payload.notes:
            response = supabase.table("notes").insert({
                "user_id": str(note.user_id),
                "content_raw": note.content_raw,
                "status": "draft"
            }).execute()
            
            created_note = response.data[0]
            created_notes.append(created_note)
            
            # Trigger async processing
            process_note_task.delay(created_note["id"])
        
        logger.info(f"Synced {len(created_notes)} notes")
        
        return created_notes
        
    except Exception as e:
        logger.error(f"Error syncing notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}", response_model=List[NoteResponse])
async def get_user_notes(user_id: UUID, status: str = None):
    """
    Get all notes for a user, optionally filtered by status
    """
    try:
        query = supabase.table("notes").select("*").eq("user_id", str(user_id))
        
        if status:
            query = query.eq("status", status)
        
        response = query.order("created_at", desc=True).execute()
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching user notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(note_id: UUID):
    """
    Get a single note by ID
    """
    try:
        response = supabase.table("notes").select("*").eq("id", str(note_id)).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Note not found")
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: UUID, update: NoteUpdate):
    """
    Update note (Admin only - for moderation)
    """
    try:
        # Get current note
        current = supabase.table("notes").select("*").eq("id", str(note_id)).single().execute()
        
        if not current.data:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Prepare update
        update_data = {}
        if update.status:
            update_data["status"] = update.status
        if update.cluster_id:
            update_data["cluster_id"] = str(update.cluster_id)
        
        # Update note
        response = supabase.table("notes").update(update_data).eq("id", str(note_id)).execute()
        
        # Check if update was successful
        if not response.data or len(response.data) == 0:
            logger.error(f"Update returned empty data for note {note_id}")
            raise HTTPException(status_code=500, detail="Note update returned no data")
        
        updated_note = response.data[0]
        
        # If note was refused, trigger cluster reprocessing
        if update.status == "refused" and current.data.get("cluster_id"):
            reprocess_cluster_on_moderation_task.delay(
                note_id=str(note_id),
                cluster_id=current.data["cluster_id"]
            )
        
        logger.info(f"Note updated: {note_id} - status: {update.status}")
        
        return updated_note
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating note {note_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/{note_id}")
async def delete_note(note_id: UUID):
    """
    Delete a note (Admin only)
    """
    try:
        supabase.table("notes").delete().eq("id", str(note_id)).execute()
        
        logger.info(f"Note deleted: {note_id}")
        
        return {"status": "deleted", "note_id": str(note_id)}
        
    except Exception as e:
        logger.error(f"Error deleting note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}")
async def get_user_notes(user_id: UUID):
    """
    Get all notes for a specific user (for Track Queue page)
    Returns all notes regardless of status with their current processing state
    """
    try:
        # Query all notes for this user, including cluster info
        response = supabase.table("notes").select(
            """
            id,
            content_raw,
            content_clarified,
            status,
            created_at,
            processed_at,
            ai_relevance_score,
            cluster_id,
            clusters(id, title, pillar_id, pillars(id, name))
            """
        ).eq("user_id", str(user_id)).order("created_at", desc=True).execute()
        
        if not response.data:
            return []
        
        # Transform data for frontend
        user_notes = []
        for note in response.data:
            cluster_info = note.get("clusters", {})
            pillar_info = cluster_info.get("pillars", {}) if cluster_info else {}
            
            # Determine status display
            status = note.get("status", "draft")
            status_display = {
                "draft": "Draft",
                "processing": "Processing",
                "processed": "Processed",
                "review": "In Review",
                "approved": "Approved",
                "refused": "Refused"
            }.get(status, status.capitalize())
            
            # Create title from clarified content or raw content
            raw_content = note.get("content_raw", "")
            clarified = note.get("content_clarified", "")
            title = clarified if clarified else (raw_content[:100] + "..." if len(raw_content) > 100 else raw_content)
            
            user_notes.append({
                "id": note["id"],
                "title": title,
                "content": raw_content,
                "category": pillar_info.get("name", "PENDING") if pillar_info else "PENDING",
                "status": status_display,
                "status_raw": status,
                "date": note.get("created_at", ""),
                "processed_date": note.get("processed_at"),
                "relevance_score": note.get("ai_relevance_score", 0),
                "cluster_id": note.get("cluster_id"),
                "cluster_title": cluster_info.get("title") if cluster_info else None,
            })
        
        logger.info(f"✅ Retrieved {len(user_notes)} notes for user {user_id}")
        
        return user_notes
        
    except Exception as e:
        logger.error(f"❌ Error fetching user notes: {e}")
        logger.exception(e)  # Full traceback
        raise HTTPException(status_code=500, detail=str(e))

