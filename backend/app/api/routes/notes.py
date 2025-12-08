"""
Notes API endpoints
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from loguru import logger

from app.models.note import NoteCreate, NoteSync, NoteResponse, NoteUpdate, NoteEvent
from app.services.supabase_client import supabase
from app.services.event_logger import log_note_event
from app.workers.tasks import process_note_task, reprocess_cluster_on_moderation_task
from app.api.dependencies import CurrentUser, get_current_user, require_board_or_owner, get_optional_user

router = APIRouter()

@router.get("/", response_model=List[NoteResponse])
@router.get("/", response_model=List[NoteResponse])
def get_notes(
    current_user: CurrentUser = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Get all notes for the current user's organization (Feed)
    Strictly filtered by organization_id
    """
    try:
        # Query notes filtered by organization_id
        response = supabase.table("notes").select("*")\
            .eq("organization_id", str(current_user.organization_id))\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
            
        return response.data if response.data else []
        
    except Exception as e:
        logger.error(f"Error fetching notes feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/", response_model=NoteResponse)
@router.post("/", response_model=NoteResponse)
def create_note(
    note: NoteCreate,
    current_user: Optional[CurrentUser] = Depends(get_optional_user)
):
    """
    Create a single note (online mode)
    Returns immediately with "draft" status
    """
    try:
        # Determine user_id and organization_id
        user_id = str(current_user.id) if current_user else str(note.user_id)
        
        # Priority: Header (current_user) > Body (note.organization_id)
        org_id = None
        if current_user:
            org_id = str(current_user.organization_id)
        elif note.organization_id:
            org_id = str(note.organization_id)
            
        if not org_id:
             raise HTTPException(status_code=400, detail="Missing organization_id. Please provide X-Organization-Id header or organization_id in body.")

        # Insert note with organization_id
        response = supabase.table("notes").insert({
            "user_id": user_id,
            "organization_id": org_id,
            "content_raw": note.content_raw,
            "status": "draft"
        }).execute()
        
        created_note = response.data[0]
        note_id = created_note["id"]
        
        # Trigger async processing
        process_note_task.delay(note_id)
        
        logger.info(f"Note created: {note_id} in org {org_id}")
        
        return created_note
        
    except Exception as e:
        logger.error(f"Error creating note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync", response_model=List[NoteResponse])
@router.post("/sync", response_model=List[NoteResponse])
def sync_notes(
    payload: NoteSync,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Batch sync notes from offline-first frontend
    """
    try:
        created_notes = []
        
        for note in payload.notes:
            # Insert note with organization_id
            response = supabase.table("notes").insert({
                "user_id": str(current_user.id), # Use authenticated user ID
                "organization_id": str(current_user.organization_id),
                "content_raw": note.content_raw,
                "status": "draft"
            }).execute()
            
            created_note = response.data[0]
            created_notes.append(created_note)
            
            # Trigger async processing
            process_note_task.delay(created_note["id"])
        
        logger.info(f"Synced {len(created_notes)} notes for user {current_user.id} in org {current_user.organization_id}")
        
        return created_notes
        
    except Exception as e:
        logger.error(f"Error syncing notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{note_id}", response_model=NoteResponse)
@router.get("/{note_id}", response_model=NoteResponse)
def get_note(
    note_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get a single note by ID
    Enforces organization boundaries
    """
    try:
        response = supabase.table("notes").select("*").eq("id", str(note_id)).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Note not found")
            
        note = response.data
        
        # Verify organization match
        if note.get("organization_id") and str(note["organization_id"]) != str(current_user.organization_id):
            logger.warning(f"User {current_user.id} attempted to access note {note_id} from different org")
            raise HTTPException(status_code=404, detail="Note not found")
        
        return note
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{note_id}", response_model=NoteResponse)
@router.patch("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: UUID, 
    update: NoteUpdate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(require_board_or_owner)
):
    """
    Update note (Board/Owner only - for moderation)
    Enforces organization boundaries
    """
    try:
        # Get current note to verify organization
        current = supabase.table("notes").select("*").eq("id", str(note_id)).single().execute()
        
        if not current.data:
            raise HTTPException(status_code=404, detail="Note not found")
            
        note_data = current.data
        
        # Verify organization match
        if note_data.get("organization_id") and str(note_data["organization_id"]) != str(current_user.organization_id):
            logger.warning(f"User {current_user.id} attempted to update note {note_id} from different org")
            raise HTTPException(status_code=404, detail="Note not found") # Hide cross-org resources
        
        # Prepare update
        update_data = {}
        if update.status:
            update_data["status"] = update.status
            # If moving to review, update processed_at to reflect when it entered review
            if update.status == "review":
                update_data["processed_at"] = "now()"
        if update.cluster_id:
            update_data["cluster_id"] = str(update.cluster_id)
        
        # Update note
        response = supabase.table("notes").update(update_data).eq("id", str(note_id)).execute()
        
        # Check if update was successful
        if not response.data or len(response.data) == 0:
            logger.error(f"Update returned empty data for note {note_id}")
            raise HTTPException(status_code=500, detail="Note update returned no data")
        
        updated_note = response.data[0]
        
        # Log board moderation events
        if update.status == "processed":
            background_tasks.add_task(
                log_note_event,
                note_id=str(note_id),
                event_type="reviewing",
                title="Under Board Review",
                description="Your idea is being reviewed by the executive team",
                actor_id=str(current_user.id),
                organization_id=str(current_user.organization_id)
            )
        elif update.status == "refused":
            background_tasks.add_task(
                log_note_event,
                note_id=str(note_id),
                event_type="refusal",
                title="Idea Closed",
                description="This idea was not selected for implementation at this time",
                actor_id=str(current_user.id),
                organization_id=str(current_user.organization_id)
            )
        elif update.status == "approved": # Handle approved status if added
             background_tasks.add_task(
                log_note_event,
                note_id=str(note_id),
                event_type="approval",
                title="Idea Approved",
                description="This idea has been approved for implementation",
                actor_id=str(current_user.id),
                organization_id=str(current_user.organization_id)
            )
        
        # If note was refused, trigger cluster reprocessing
        if update.status == "refused" and note_data.get("cluster_id"):
            reprocess_cluster_on_moderation_task.delay(
                note_id=str(note_id),
                cluster_id=note_data["cluster_id"]
            )
        
        logger.info(f"Note updated: {note_id} - status: {update.status} by {current_user.id}")
        
        return updated_note
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating note {note_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{note_id}/timeline", response_model=List[NoteEvent])
@router.get("/{note_id}/timeline", response_model=List[NoteEvent])
def get_note_timeline(
    note_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get complete event timeline for a note
    Returns all events ordered chronologically
    Enforces organization boundaries
    """
    try:
        # Verify note exists and belongs to org
        note_check = supabase.table("notes").select("id, organization_id").eq("id", str(note_id)).single().execute()
        
        if not note_check.data:
            raise HTTPException(status_code=404, detail="Note not found")
            
        note = note_check.data
        if note.get("organization_id") and str(note["organization_id"]) != str(current_user.organization_id):
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Fetch all events for this note
        response = supabase.table("note_events").select(
            "id, note_id, event_type, title, description, created_at"
        ).eq("note_id", str(note_id)).order("created_at", desc=False).execute()
        
        logger.info(f"Retrieved {len(response.data) if response.data else 0} events for note {note_id}")
        
        return response.data if response.data else []
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching timeline for note {note_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/{note_id}")
@router.delete("/{note_id}")
def delete_note(
    note_id: UUID,
    current_user: CurrentUser = Depends(require_board_or_owner)
):
    """
    Delete a note (Board/Owner only)
    Enforces organization boundaries
    """
    try:
        # Verify note exists and belongs to org
        note_check = supabase.table("notes").select("id, organization_id").eq("id", str(note_id)).single().execute()
        
        if not note_check.data:
            raise HTTPException(status_code=404, detail="Note not found")
            
        note = note_check.data
        if note.get("organization_id") and str(note["organization_id"]) != str(current_user.organization_id):
            raise HTTPException(status_code=404, detail="Note not found")
            
        supabase.table("notes").delete().eq("id", str(note_id)).execute()
        
        logger.info(f"Note deleted: {note_id} by {current_user.id}")
        
        return {"status": "deleted", "note_id": str(note_id)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}")
@router.get("/user/{user_id}")
def get_user_notes(
    user_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get all notes for a specific user (for Track Queue page)
    
    IMPORTANT: Only returns notes that have been fully processed by AI.
    Notes with status 'draft' or 'processing' are NOT shown - they appear
    only AFTER the AI has analyzed them and generated the clarified content.
    
    This ensures users only see notes with proper AI-generated titles and content.
    
    Enforces organization boundaries.
    """
    try:
        # Query notes filtered by user_id AND organization_id
        # ONLY notes with status in (processed, review, approved, refused)
        # Excludes 'draft' and 'processing' - those are still being analyzed
        query = supabase.table("notes").select(
            """
            id,
            title_clarified,
            content_raw,
            content_clarified,
            status,
            created_at,
            processed_at,
            ai_relevance_score,
            cluster_id,
            clusters(id, title, pillar_id, note_count, pillars(id, name))
            """
        ).eq("user_id", user_id).eq("organization_id", str(current_user.organization_id)).in_(
            "status", ["processed", "review", "approved", "refused"]
        )
            
        response = query.order("created_at", desc=True).execute()
        
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
            
            # TITLE: Use AI-generated title_clarified as primary title
            # Fallback chain: title_clarified > truncated content_clarified > truncated content_raw
            title_clarified = note.get("title_clarified")
            clarified = note.get("content_clarified", "")
            raw_content = note.get("content_raw", "")
            
            if title_clarified:
                title = title_clarified
            elif clarified:
                title = clarified[:120] + "..." if len(clarified) > 120 else clarified
            else:
                title = raw_content[:100] + "..." if len(raw_content) > 100 else raw_content
            
            user_notes.append({
                "id": note["id"],
                "title": title,
                "content": clarified or raw_content,  # Use clarified content for display
                "category": pillar_info.get("name", "PENDING") if pillar_info else "PENDING",
                "status": status_display,
                "status_raw": status,
                "date": note.get("created_at", ""),
                "processed_date": note.get("processed_at"),
                "relevance_score": note.get("ai_relevance_score", 0),
                "cluster_id": note.get("cluster_id"),
                "cluster_title": cluster_info.get("title") if cluster_info else None,
                "cluster_note_count": cluster_info.get("note_count", 0) if cluster_info else 0,
            })
        
        logger.info(f"✅ Retrieved {len(user_notes)} notes for user {user_id}")
        
        return user_notes
        
    except Exception as e:
        logger.error(f"❌ Error fetching user notes: {e}")
        logger.exception(e)  # Full traceback
        raise HTTPException(status_code=500, detail=str(e))

