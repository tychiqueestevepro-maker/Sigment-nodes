"""
Celery tasks for AI processing pipeline
"""
import json
from typing import Dict, List, Optional
from uuid import UUID
from loguru import logger

from app.workers.celery_app import celery_app
from app.services.supabase_client import supabase
from app.services.ai_service import ai_service
from app.services.event_logger import log_note_event
from app.models.note import UserContext


@celery_app.task(
    name="process_note", 
    bind=True, 
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={'max_retries': 5},
    rate_limit='100/m'
)
def process_note_task(self, note_id: str):
    """
    Complete AI processing pipeline for a single note (Multi-Tenant):
    1. Fetch note, user context, and organization_id
    2. Get pillars for THIS organization only
    3. AI analysis (clarification, pillar assignment from existing pillars, relevance score)
    4. Generate embedding
    5. Find or create cluster (within same organization)
    6. Update note and cluster
    7. Generate cluster snapshot
    """
    try:
        logger.info(f"Processing note: {note_id}")
        
        # ============================================
        # STEP 1: Fetch Note, User Context, and Organization
        # ============================================
        note_response = supabase.table("notes").select(
            "*, users!inner(job_title, department, seniority_level)"
        ).eq("id", note_id).single().execute()
        
        if not note_response.data:
            raise ValueError(f"Note {note_id} not found")
        
        note = note_response.data
        user = note["users"]
        organization_id = note["organization_id"]  # 🔒 MULTI-TENANT: Get org ID
        
        if not organization_id:
            raise ValueError(f"Note {note_id} has no organization_id")
        
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
        # STEP 2: Get Available Pillars (FILTERED BY ORGANIZATION)
        # ============================================
        pillars_response = supabase.table("pillars").select("*").eq(
            "organization_id", organization_id  # 🔒 MULTI-TENANT: Filter by org
        ).execute()
        
        available_pillars = pillars_response.data
        
        if not available_pillars or len(available_pillars) == 0:
            raise ValueError(f"No pillars found for organization {organization_id}")
        
        logger.info(f"Found {len(available_pillars)} pillars for organization {organization_id}")
        
        # ============================================
        # STEP 3: AI Analysis (STRICT: Only existing pillars)
        # ============================================
        analysis = ai_service.analyze_note(
            content=note["content_raw"],
            user_context=user_context,
            available_pillars=available_pillars
        )
        
        # Find pillar by ID (preferred) or name (fallback)
        pillar = None
        if analysis.get("pillar_id"):
            pillar = next((p for p in available_pillars if p["id"] == analysis["pillar_id"]), None)
        
        if not pillar and analysis.get("pillar_name") and analysis["pillar_name"] != "Uncategorized":
            pillar = next((p for p in available_pillars if p["name"] == analysis["pillar_name"]), None)
        
        # If no pillar found or score < 5/10, assign to "Uncategorized"
        if not pillar or (analysis.get("pillar_name") == "Uncategorized"):
            # Find "Uncategorized" pillar for this organization
            uncategorized_pillar = next((p for p in available_pillars if p["name"] == "Uncategorized"), None)
            
            if uncategorized_pillar:
                logger.info(f"Note {note_id} assigned to 'Uncategorized' pillar (score < 5/10 or no match)")
                pillar_id = uncategorized_pillar["id"]
            else:
                # Fallback: Create "Uncategorized" pillar if it doesn't exist
                logger.warning(f"'Uncategorized' pillar not found for organization {organization_id}, creating it...")
                uncategorized_response = supabase.table("pillars").insert({
                    "organization_id": organization_id,
                    "name": "Uncategorized",
                    "description": "Ideas that could not be categorized into existing pillars (relevance score < 5/10)",
                    "color": "#9CA3AF"
                }).execute()
                pillar_id = uncategorized_response.data[0]["id"]
        else:
            pillar_id = pillar["id"]
        
        # Log AI analysis completion
        log_note_event(
            note_id=note_id,
            event_type="ai_analysis",
            title="AI Analysis Complete",
            description=f"Relevance Score: {analysis['relevance_score']}/10 | Category: {analysis.get('pillar_name', 'Uncategorized')}"
        )
        
        # ============================================
        # STEP 4: Generate Embedding
        # ============================================
        embedding = ai_service.generate_embedding(analysis["clarified_content"])
        
        # ============================================
        # STEP 5: Find Similar Notes & Cluster (WITHIN SAME ORGANIZATION)
        # ============================================
        # All notes are clustered, including "Uncategorized" ones
        cluster_id = find_or_create_cluster(
            note_id=note_id,
            pillar_id=pillar_id,
            organization_id=organization_id,  # 🔒 MULTI-TENANT: Pass org ID
            embedding=embedding,
            clarified_content=analysis["clarified_content"]
        )
        
        # ============================================
        # STEP 6: Update Note
        # ============================================
        # Prepare team_capacity as JSON if available
        team_capacity = analysis.get("team_capacity")
        
        update_data = {
            "title_clarified": analysis.get("clarified_title"),  # AI-generated short title
            "content_clarified": analysis["clarified_content"],
            "embedding": embedding,
            "pillar_id": pillar_id,
            "cluster_id": cluster_id,
            "ai_relevance_score": analysis["relevance_score"],
            "ai_reasoning": analysis.get("reasoning"),  # Store AI reasoning
            "ai_team_capacity": json.dumps(team_capacity) if team_capacity else None,  # Store team capacity as JSON
            "status": "processed",
            "processed_at": "now()"
        }
        
        supabase.table("notes").update(update_data).eq("id", note_id).execute()
        
        # Log cluster fusion event
        cluster_response = supabase.table("clusters").select("title").eq("id", cluster_id).single().execute()
        cluster_title = cluster_response.data.get("title", "Unknown Cluster") if cluster_response.data else "Unknown Cluster"
        
        log_note_event(
            note_id=note_id,
            event_type="fusion",
            title="Cluster Assignment",
            description=f"Your idea has been grouped with similar ideas: '{cluster_title}'"
        )
        
        logger.info(f"✅ Note {note_id} processed successfully (org: {organization_id})")
        
        # ============================================
        # STEP 7: Generate Cluster Snapshot (Async)
        # ============================================
        generate_cluster_snapshot_task.delay(cluster_id)
        
        # ============================================
        # STEP 8: Publish Note to Social Feed (Async)
        # ============================================
        # La note traitée devient un post dans le feed social
        publish_note_to_feed_task.delay(note_id)
        
        return {"status": "success", "note_id": note_id, "cluster_id": cluster_id, "organization_id": organization_id}
        
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
    organization_id: str,  # 🔒 MULTI-TENANT: Organization ID
    embedding: List[float],
    clarified_content: str
) -> str:
    """
    Find similar notes and assign to existing cluster or create new one
    
    MULTI-TENANT: Only searches for similar notes within the SAME organization
    """
    # Find similar notes using pgvector (FILTERED BY ORGANIZATION)
    similar_notes = supabase.rpc(
        "find_similar_notes",
        {
            "query_embedding": embedding,
            "target_pillar_id": pillar_id,
            "p_organization_id": organization_id,  # 🔒 MULTI-TENANT: Pass org ID
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
    
    # Create new cluster (WITH ORGANIZATION_ID)
    logger.info(f"Creating new cluster for organization {organization_id}")
    
    cluster_response = supabase.table("clusters").insert({
        "pillar_id": pillar_id,
        "organization_id": organization_id,  # 🔒 MULTI-TENANT: Set org ID
        "title": clarified_content[:200] + "...",  # Temporary title
        "note_count": 0
    }).execute()
    
    return cluster_response.data[0]["id"]


@celery_app.task(
    name="generate_cluster_snapshot",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={'max_retries': 3},
    rate_limit='50/m'
)
def generate_cluster_snapshot_task(self, cluster_id: str):
    """
    Generate a new snapshot for a cluster (for time-lapse feature)
    MULTI-TENANT: Snapshots include organization_id
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
        organization_id = cluster["organization_id"]  # 🔒 MULTI-TENANT: Get org ID
        
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
        # STEP 6: Create Snapshot (WITH ORGANIZATION_ID)
        # ============================================
        supabase.table("cluster_snapshots").insert({
            "cluster_id": cluster_id,
            "organization_id": organization_id,  # 🔒 MULTI-TENANT: Set org ID
            "synthesis_text": synthesis,
            "metrics_json": metrics,
            "included_note_ids": [n["id"] for n in notes],
            "note_count": len(notes),
            "avg_relevance_score": avg_score
        }).execute()
        
        logger.info(f"✅ Snapshot created for cluster {cluster_id} (org: {organization_id})")
        
        return {"status": "success", "cluster_id": cluster_id, "organization_id": organization_id}
        
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


# ============================================
# TASK: Publish Note to Social Feed
# ============================================

@celery_app.task(
    name="publish_note_to_feed",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={'max_retries': 3},
    rate_limit='200/m'
)
def publish_note_to_feed_task(self, note_id: str):
    """
    Publie une note traitée dans le feed social
    
    Cette tâche est appelée automatiquement après le traitement complet d'une note.
    La note devient un "Post" de type "linked_idea" avec Cold Start Boost.
    
    Mapping:
    - user_id = note.user_id
    - organization_id = note.organization_id
    - content = note.content_clarified (version propre de l'IA)
    - created_at = NOW() (Reset l'horloge pour Cold Start Boost)
    - virality_score = 50.0 (Cold Start initial)
    """
    try:
        logger.info(f"📢 Publishing note {note_id} to social feed...")
        
        # ============================================
        # STEP 1: Fetch Note Data
        # ============================================
        note_response = supabase.table("notes").select(
            "*, pillars(name, color), clusters(title)"
        ).eq("id", note_id).single().execute()
        
        if not note_response.data:
            raise ValueError(f"Note {note_id} not found")
        
        note = note_response.data
        
        # Vérifier que la note est bien traitée
        if note.get("status") != "processed":
            logger.warning(f"⚠️ Note {note_id} is not processed yet (status: {note.get('status')})")
            return {"status": "skipped", "reason": "note_not_processed"}
        
        # Vérifier si déjà publié
        existing_post = supabase.table("posts").select("id").eq("note_id", note_id).execute()
        if existing_post.data and len(existing_post.data) > 0:
            logger.info(f"ℹ️ Note {note_id} already published as post {existing_post.data[0]['id']}")
            return {
                "status": "already_published",
                "post_id": existing_post.data[0]["id"]
            }
        
        # ============================================
        # STEP 2: Prepare Post Data
        # ============================================
        pillar_data = note.get("pillars") or {}
        cluster_data = note.get("clusters") or {}
        
        post_data = {
            "user_id": note["user_id"],
            "organization_id": note["organization_id"],
            "content": note.get("content_clarified") or note.get("content_raw"),
            "post_type": "linked_idea",
            "note_id": note["id"],
            "pillar_id": note.get("pillar_id"),
            "cluster_id": note.get("cluster_id"),
            "ai_relevance_score": note.get("ai_relevance_score"),
            "virality_score": 50.0,  # Cold Start Boost initial
            "virality_level": "local",
            "metadata": {
                "source": "ai_processing",
                "pillar_name": pillar_data.get("name"),
                "pillar_color": pillar_data.get("color"),
                "cluster_title": cluster_data.get("title"),
                "original_content": note.get("content_raw")
            }
        }
        
        # ============================================
        # STEP 3: Create Post
        # ============================================
        post_response = supabase.table("posts").insert(post_data).execute()
        
        if not post_response.data or len(post_response.data) == 0:
            raise Exception("Failed to create post")
        
        post_id = post_response.data[0]["id"]
        
        logger.info(f"✅ Note {note_id} published to feed as post {post_id}")
        
        # ============================================
        # STEP 4: Trigger Virality Score Calculation
        # ============================================
        # Import ici pour éviter circular dependency
        from app.workers.social_feed_tasks import calculate_virality_score_task
        
        # Calculer le score initial (avec Cold Start Boost)
        calculate_virality_score_task.delay(post_id)
        
        # ============================================
        # STEP 5: Auto-tag with Pillar Name (Optional)
        # ============================================
        if pillar_data.get("name"):
            try:
                # Créer ou récupérer le tag
                tag_name = pillar_data["name"].lower()
                
                # Chercher le tag existant
                tag_response = supabase.table("tags").select("id").eq(
                    "organization_id", note["organization_id"]
                ).eq("name", tag_name).execute()
                
                if tag_response.data and len(tag_response.data) > 0:
                    tag_id = tag_response.data[0]["id"]
                else:
                    # Créer le tag
                    new_tag = supabase.table("tags").insert({
                        "organization_id": note["organization_id"],
                        "name": tag_name,
                        "trend_score": 0
                    }).execute()
                    tag_id = new_tag.data[0]["id"]
                
                # Associer le tag au post
                supabase.table("post_tags").insert({
                    "post_id": post_id,
                    "tag_id": tag_id
                }).execute()
                
                logger.info(f"🏷️ Tagged post {post_id} with '{tag_name}'")
                
            except Exception as tag_error:
                logger.warning(f"⚠️ Failed to auto-tag post: {tag_error}")
        
        return {
            "status": "success",
            "note_id": note_id,
            "post_id": post_id,
            "pillar": pillar_data.get("name"),
            "cluster": cluster_data.get("title")
        }
        
    except Exception as e:
        logger.error(f"❌ Error publishing note {note_id} to feed: {e}")
        raise self.retry(exc=e, countdown=2 ** self.request.retries, max_retries=3)


# ============================================
# TASK: Publish Scheduled Posts (Cron)
# ============================================

@celery_app.task(name="publish_scheduled_posts")
def publish_scheduled_posts_task():
    """
    Periodic task to check for scheduled posts and publish them.
    Updates status to 'published' and created_at to scheduled_at.
    """
    try:
        from datetime import datetime
        logger.info("⏳ Checking for scheduled posts to publish...")
        
        now = datetime.utcnow().isoformat()
        
        # 1. Fetch posts ready to be published
        response = supabase.table("posts").select("id, scheduled_at").eq("status", "scheduled").lte("scheduled_at", now).execute()
        
        posts = response.data or []
        
        if not posts:
            return {"count": 0}
            
        count = 0
        from app.workers.social_feed_tasks import calculate_virality_score_task
        
        for post in posts:
            try:
                # 2. Update status AND created_at (to ensure it appears at the correct time in feed)
                supabase.table("posts").update({
                    "status": "published",
                    "created_at": post["scheduled_at"] # Sync created_at with scheduled time
                }).eq("id", post["id"]).execute()
                
                # 3. Trigger virality (Cold start)
                calculate_virality_score_task.delay(post["id"])
                
                logger.info(f"🚀 Published scheduled post {post['id']} (scheduled for {post['scheduled_at']})")
                count += 1
            except Exception as e:
                logger.error(f"Failed to publish post {post['id']}: {e}")
                
        return {"count": count}
        
    except Exception as e:
        logger.error(f"❌ Error in publish_scheduled_posts_task: {e}")
        raise
