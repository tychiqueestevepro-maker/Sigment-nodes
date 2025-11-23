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
        
        updated_note = response.data[0]
        
        # If note was refused, trigger cluster reprocessing
        if update.status == "refused" and current.data.get("cluster_id"):
            reprocess_cluster_on_moderation_task.delay(
                note_id=str(note_id),
                cluster_id=current.data["cluster_id"]
            )
        
        logger.info(f"Note updated: {note_id}")
        
        return updated_note
        
    except Exception as e:
        logger.error(f"Error updating note: {e}")
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

