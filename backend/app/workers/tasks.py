"""
Celery tasks for AI processing pipeline
"""
from typing import Dict, List, Optional
from uuid import UUID
from loguru import logger

from app.workers.celery_app import celery_app
from app.services.supabase_client import supabase
from app.services.ai_service import ai_service
from app.services.event_logger import log_note_event
from app.models.note import UserContext


@celery_app.task(name="process_note", bind=True, max_retries=3)
def process_note_task(self, note_id: str):
    """
    Complete AI processing pipeline for a single note:
    1. Fetch note and user context
    2. AI analysis (clarification, pillar, relevance score)
    3. Generate embedding
    4. Find or create cluster
    5. Update note and cluster
    6. Generate cluster snapshot
    """
    try:
        logger.info(f"Processing note: {note_id}")
        
        # ============================================
        # STEP 1: Fetch Note and User Context
        # ============================================
        note_response = supabase.table("notes").select(
            "*, users!inner(job_title, department, seniority_level)"
        ).eq("id", note_id).single().execute()
        
        if not note_response.data:
            raise ValueError(f"Note {note_id} not found")
        
        note = note_response.data
        user = note["users"]
        
        user_context = UserContext(
            job_title=user["job_title"],
            department=user["department"],
            seniority_level=user["seniority_level"]
        )
        
        # Update status to processing
        supabase.table("notes").update({"status": "processing"}).eq("id", note_id).execute()
        
        # Log submission event
        log_note_event(
            note_id=note_id,
            event_type="submission",
            title="Note Submitted",
            description="Your idea has been received and is being processed by our AI system"
        )
        
        # ============================================
        # STEP 2: Get Available Pillars
        # ============================================
        pillars_response = supabase.table("pillars").select("*").execute()
        available_pillars = pillars_response.data
        
        # ============================================
        # STEP 3: AI Analysis
        # ============================================
        analysis = ai_service.analyze_note(
            content=note["content_raw"],
            user_context=user_context,
            available_pillars=available_pillars
        )
        
        # Find pillar ID by name
        pillar = next((p for p in available_pillars if p["name"] == analysis["pillar_name"]), None)
        if not pillar:
            raise ValueError(f"Pillar not found: {analysis['pillar_name']}")
        
        # Log AI analysis completion
        log_note_event(
            note_id=note_id,
            event_type="ai_analysis",
            title="AI Analysis Complete",
            description=f"Relevance Score: {analysis['relevance_score']}/10 | Category: {analysis['pillar_name']}"
        )
        
        # ============================================
        # STEP 4: Generate Embedding
        # ============================================
        embedding = ai_service.generate_embedding(analysis["clarified_content"])
        
        # ============================================
        # STEP 5: Find Similar Notes & Cluster
        # ============================================
        cluster_id = find_or_create_cluster(
            note_id=note_id,
            pillar_id=pillar["id"],
            embedding=embedding,
            clarified_content=analysis["clarified_content"]
        )
        
        # ============================================
        # STEP 6: Update Note
        # ============================================
        supabase.table("notes").update({
            "content_clarified": analysis["clarified_content"],
            "embedding": embedding,
            "pillar_id": pillar["id"],
            "cluster_id": cluster_id,
            "ai_relevance_score": analysis["relevance_score"],
            "status": "processed",
            "processed_at": "now()"
        }).eq("id", note_id).execute()
        
        # Log cluster fusion event
        # Get cluster title for the event description
        cluster_response = supabase.table("clusters").select("title").eq("id", cluster_id).single().execute()
        cluster_title = cluster_response.data.get("title", "Unknown Cluster") if cluster_response.data else "Unknown Cluster"
        
        log_note_event(
            note_id=note_id,
            event_type="fusion",
            title="Cluster Assignment",
            description=f"Your idea has been grouped with similar ideas: '{cluster_title}'"
        )
        
        logger.info(f"✅ Note {note_id} processed successfully")
        
        # ============================================
        # STEP 7: Generate Cluster Snapshot (Async)
        # ============================================
        generate_cluster_snapshot_task.delay(cluster_id)
        
        return {"status": "success", "note_id": note_id, "cluster_id": cluster_id}
        
    except Exception as e:
        logger.error(f"❌ Error processing note {note_id}: {e}")
        
        # Update note status to error
        supabase.table("notes").update({
            "status": "draft",
            "metadata": {"error": str(e)}
        }).eq("id", note_id).execute()
        
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=2 ** self.request.retries)


def find_or_create_cluster(
    note_id: str,
    pillar_id: str,
    embedding: List[float],
    clarified_content: str
) -> str:
    """
    Find similar notes and assign to existing cluster or create new one
    """
    # Find similar notes using pgvector
    similar_notes = supabase.rpc(
        "find_similar_notes",
        {
            "query_embedding": embedding,
            "target_pillar_id": pillar_id,
            "similarity_threshold": 0.75,
            "max_results": 10
        }
    ).execute()
    
    if similar_notes.data and len(similar_notes.data) > 0:
        # Get cluster_id from most similar note
        similar_note_id = similar_notes.data[0]["note_id"]
        
        note_response = supabase.table("notes").select("cluster_id").eq(
            "id", similar_note_id
        ).single().execute()
        
        if note_response.data and note_response.data["cluster_id"]:
            logger.info(f"Adding note to existing cluster: {note_response.data['cluster_id']}")
            return note_response.data["cluster_id"]
    
    # Create new cluster
    logger.info("Creating new cluster")
    
    cluster_response = supabase.table("clusters").insert({
        "pillar_id": pillar_id,
        "title": clarified_content[:200] + "...",  # Temporary title
        "note_count": 0
    }).execute()
    
    return cluster_response.data[0]["id"]


@celery_app.task(name="generate_cluster_snapshot")
def generate_cluster_snapshot_task(cluster_id: str):
    """
    Generate a new snapshot for a cluster (for time-lapse feature)
    """
    try:
        logger.info(f"Generating snapshot for cluster: {cluster_id}")
        
        # ============================================
        # STEP 1: Fetch Cluster and All Notes
        # ============================================
        cluster_response = supabase.table("clusters").select(
            "*, pillars(name), notes!inner(*, users(department, job_title))"
        ).eq("id", cluster_id).eq("notes.status", "processed").single().execute()
        
        if not cluster_response.data:
            raise ValueError(f"Cluster {cluster_id} not found")
        
        cluster = cluster_response.data
        notes = cluster["notes"]
        
        if len(notes) == 0:
            logger.warning(f"No notes in cluster {cluster_id}, skipping snapshot")
            return
        
        # ============================================
        # STEP 2: Generate New Cluster Title (if needed)
        # ============================================
        if cluster["title"].endswith("...") or cluster["note_count"] != len(notes):
            new_title = ai_service.generate_cluster_title([
                {"content_clarified": n["content_clarified"]} for n in notes
            ])
            
            supabase.table("clusters").update({"title": new_title}).eq("id", cluster_id).execute()
        
        # ============================================
        # STEP 3: Prepare Notes for Synthesis
        # ============================================
        notes_for_synthesis = [
            {
                "content_clarified": n["content_clarified"],
                "ai_relevance_score": n["ai_relevance_score"],
                "user_department": n["users"]["department"],
                "user_job_title": n["users"]["job_title"]
            }
            for n in notes
        ]
        
        # ============================================
        # STEP 4: Generate Synthesis
        # ============================================
        synthesis = ai_service.generate_cluster_synthesis(
            notes=notes_for_synthesis,
            cluster_title=cluster["title"],
            pillar_name=cluster["pillars"]["name"]
        )
        
        # ============================================
        # STEP 5: Calculate Metrics
        # ============================================
        dept_counts = {}
        for note in notes:
            dept = note["users"]["department"]
            dept_counts[dept] = dept_counts.get(dept, 0) + 1
        
        avg_score = sum(n["ai_relevance_score"] for n in notes) / len(notes)
        
        metrics = {
            **dept_counts,
            "Avg_Weight": round(avg_score, 2)
        }
        
        # ============================================
        # STEP 6: Create Snapshot
        # ============================================
        supabase.table("cluster_snapshots").insert({
            "cluster_id": cluster_id,
            "synthesis_text": synthesis,
            "metrics_json": metrics,
            "included_note_ids": [n["id"] for n in notes],
            "note_count": len(notes),
            "avg_relevance_score": avg_score
        }).execute()
        
        logger.info(f"✅ Snapshot created for cluster {cluster_id}")
        
        return {"status": "success", "cluster_id": cluster_id}
        
    except Exception as e:
        logger.error(f"❌ Error generating snapshot for cluster {cluster_id}: {e}")
        raise


@celery_app.task(name="reprocess_cluster_on_moderation")
def reprocess_cluster_on_moderation_task(note_id: str, cluster_id: str):
    """
    Reprocess cluster when a note is moderated (refused)
    This triggers a new snapshot without the refused note
    """
    try:
        logger.info(f"Reprocessing cluster {cluster_id} after moderation of note {note_id}")
        
        # Simply trigger a new snapshot (the query will exclude refused notes)
        generate_cluster_snapshot_task.delay(cluster_id)
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"❌ Error reprocessing cluster {cluster_id}: {e}")
        raise

