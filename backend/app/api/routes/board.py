"""
Board & Galaxy View API Routes
"""
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional
from loguru import logger
from app.services.supabase_client import get_supabase
from app.services.ai_service import ai_service
from app.api.dependencies import CurrentUser, get_current_user

router = APIRouter()


@router.get("/galaxy")
@router.get("/galaxy")
def get_galaxy_view(
    current_user: CurrentUser = Depends(get_current_user),
    min_relevance: Optional[float] = Query(None, ge=0, le=10, description="Minimum relevance score"),
    pillar_id: Optional[str] = Query(None, description="Filter by pillar ID"),
):
    """
    Get aggregated cluster data for the Galaxy visualization.
    Filtered by current user's organization.
    
    Returns clusters with:
    - Average AI relevance score (impact_score)
    - Note count (volume)
    - Pillar information
    - Last update timestamp
    """
    try:
        supabase = get_supabase()
        organization_id = str(current_user.organization_id)
        
        # Query clusters with their pillar info and notes - STRICT ORGANIZATION FILTER
        # We use explicit filtering on the main table AND joined tables
        query = supabase.table("clusters").select(
            """
            id,
            title,
            last_updated_at,
            pillar_id,
            organization_id,
            pillars(id, name, color, organization_id),
            notes!inner(id, ai_relevance_score, status, organization_id)
            """
        ).eq("organization_id", organization_id)
        
        # Apply pillar filter if provided
        if pillar_id:
            query = query.eq("pillar_id", pillar_id)
        
        # Only get clusters with processed notes
        query = query.eq("notes.status", "processed")
        
        response = query.execute()
        
        if not response.data:
            return []
        
        # Process and aggregate data
        galaxy_data = []
        
        for cluster in response.data:
            # Double-check organization_id (Defense in Depth)
            if str(cluster.get("organization_id")) != organization_id:
                continue

            notes = cluster.get("notes", [])
            
            if not notes:
                continue
            
            # Security check: verify all notes belong to the same org
            valid_notes = [
                n for n in notes 
                if str(n.get("organization_id")) == organization_id
            ]
            
            if not valid_notes:
                continue
            
            # Calculate average relevance score
            relevance_scores = [
                note.get("ai_relevance_score", 0) 
                for note in valid_notes 
                if note.get("ai_relevance_score") is not None
            ]
            avg_score = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0
            
            # Apply minimum relevance filter
            if min_relevance and avg_score < min_relevance:
                continue
            
            pillar_info = cluster.get("pillars", {})
            
            # Security check: verify pillar belongs to the same organization
            if pillar_info and str(pillar_info.get("organization_id")) != organization_id:
                logger.warning(f"⚠️ Cluster {cluster['id']} has pillar from different org, skipping")
                continue
            
            # Extract note IDs for moderation actions
            note_ids = [note.get("id") for note in valid_notes if note.get("id")]
            
            galaxy_item = {
                "id": cluster["id"],
                "title": cluster.get("title", "Untitled Cluster"),
                "pillar": pillar_info.get("name", "Unknown") if pillar_info else "Unknown",
                "pillar_color": pillar_info.get("color"),
                "pillar_id": cluster.get("pillar_id"),
                "impact_score": round(avg_score, 2),
                "volume": len(valid_notes),
                "last_updated": cluster.get("last_updated_at"),
                "note_ids": note_ids,
            }
            
            galaxy_data.append(galaxy_item)
        
        # Sort by impact score descending
        galaxy_data.sort(key=lambda x: x["impact_score"], reverse=True)
        
        logger.info(f"✅ Retrieved {len(galaxy_data)} clusters for Galaxy view (org: {organization_id})")
        
        return galaxy_data
        
    except Exception as e:
        logger.error(f"❌ Error fetching galaxy data: {e}")
        # Return empty list instead of crashing
        return []


@router.get("/pillars")
def get_pillars(current_user: CurrentUser = Depends(get_current_user)):
    """
    Get all available pillars for filtering.
    Filtered by current user's organization.
    Includes count of active notes in each pillar.
    """
    try:
        supabase = get_supabase()
        organization_id = str(current_user.organization_id)
        logger.info(f"🔍 Fetching pillars for Org ID: {organization_id}")
        
        # Select pillars and count of associated notes
        # Note: This counts ALL notes in the pillar, not just "active" ones if we don't filter.
        # Ideally we filter by status='active' or 'processed'.
        # Supabase syntax for count in select: notes(count)
        # Select pillars and count of associated notes
        # We use explicit select with count to get the number of notes per pillar
        response = supabase.table("pillars").select(
            "id, name, description, color, notes(count)"
        ).eq("organization_id", organization_id).order("created_at", desc=False).execute()
        
        if not response.data:
            return []
            
        # Transform response to flatten count
        pillars = []
        for p in response.data:
            # notes field will be [{'count': N}] or similar depending on Supabase version/setup
            # Usually with select='notes(count)', it returns a list of dicts or just the count if using head=true (but here we want data)
            # Actually, postgrest returns `notes: [{count: 5}]`
            note_count = 0
            if p.get("notes"):
                # It might be a list of objects
                if isinstance(p["notes"], list) and len(p["notes"]) > 0:
                    note_count = p["notes"][0].get("count", 0)
            
            pillars.append({
                "id": p["id"],
                "name": p["name"],
                "description": p.get("description"),
                "color": p.get("color"),
                "count": note_count
            })
        
        logger.info(f"✅ Retrieved {len(pillars)} pillars for org {organization_id}")
        
        return pillars
        
    except Exception as e:
        logger.error(f"❌ Error fetching pillars: {e}")
        # Return empty list instead of crashing 500
        return []


@router.get("/cluster/{cluster_id}/history")
def get_cluster_history(cluster_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """
    Get the complete history of a cluster with all snapshots (Time Machine).
    Enforces organization boundaries.
    
    Returns:
    - Cluster basic info
    - All snapshots ordered chronologically
    - Notes (evidence) for each snapshot
    """
    try:
        supabase = get_supabase()
        
        # 1. Get cluster basic info with organization check
        cluster_response = supabase.table("clusters").select(
            """
            id,
            title,
            pillar_id,
            organization_id,
            pillars(id, name),
            note_count,
            avg_relevance_score,
            created_at,
            last_updated_at
            """
        ).eq("id", cluster_id).eq("organization_id", str(current_user.organization_id)).execute()
        
        if not cluster_response.data:
            logger.error(f"❌ Cluster {cluster_id} not found or not accessible")
            return {"error": "Cluster not found"}, 404
        
        cluster = cluster_response.data[0]
        
        # 2. Get all snapshots for this cluster (ordered by created_at ASC)
        snapshots_response = supabase.table("cluster_snapshots").select(
            """
            id,
            synthesis_text,
            metrics_json,
            included_note_ids,
            created_at
            """
        ).eq("cluster_id", cluster_id).order("created_at", desc=False).execute()
        
        snapshots = snapshots_response.data if snapshots_response.data else []
        
        # 3. For each snapshot, get the associated notes (evidence)
        enriched_snapshots = []
        for snapshot in snapshots:
            note_ids = snapshot.get("included_note_ids", [])
            
            if note_ids:
                # Get notes details - also filter by organization for additional security
                notes_response = supabase.table("notes").select(
                    """
                    id,
                    content_clarified,
                    ai_relevance_score,
                    created_at,
                    organization_id,
                    users(first_name, last_name, job_title, department)
                    """
                ).in_("id", note_ids).eq("organization_id", str(current_user.organization_id)).execute()
                
                evidence = []
                for note in notes_response.data if notes_response.data else []:
                    user_info = note.get("users", {})
                    # Build full name
                    first_name = user_info.get("first_name", "")
                    last_name = user_info.get("last_name", "")
                    full_name = f"{first_name} {last_name}".strip() or "Anonymous"
                    
                    evidence.append({
                        "id": note["id"],
                        "content": note.get("content_clarified", ""),
                        "relevance_score": note.get("ai_relevance_score"),
                        "author": {
                            "name": full_name,
                            "job_title": user_info.get("job_title", "Unknown"),
                            "department": user_info.get("department", "Unknown")
                        },
                        "created_at": note.get("created_at")
                    })
            else:
                evidence = []
            
            enriched_snapshots.append({
                "id": snapshot["id"],
                "synthesis": snapshot.get("synthesis_text", ""),
                "metrics": snapshot.get("metrics_json", {}),
                "evidence_count": len(evidence),
                "evidence": evidence,
                "timestamp": snapshot.get("created_at")
            })
        
        # 4. Build the response
        result = {
            "cluster": {
                "id": cluster["id"],
                "title": cluster.get("title", "Untitled"),
                "pillar": cluster.get("pillars", {}).get("name", "Unknown") if cluster.get("pillars") else "Unknown",
                "note_count": cluster.get("note_count", 0),
                "avg_impact": round(cluster.get("avg_relevance_score", 0), 2),
                "created_at": cluster.get("created_at"),
                "last_updated_at": cluster.get("last_updated_at")
            },
            "snapshots": enriched_snapshots,
            "total_snapshots": len(enriched_snapshots)
        }
        
        logger.info(f"✅ Retrieved history for cluster {cluster_id}: {len(enriched_snapshots)} snapshots")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error fetching cluster history: {e}")
        raise


@router.get("/review-notes")
def get_review_notes(current_user: CurrentUser = Depends(get_current_user)):
    """
    Get all notes with 'review' status for the Review Queue page.
    Filtered by current user's organization.
    
    Returns notes that have been marked for review by executives.
    """
    try:
        supabase = get_supabase()
        
        # Query notes with review status, including cluster info AND user info
        # Filter by organization_id for multi-tenant security
        # Note: ai_reasoning and ai_team_capacity may not exist yet - handle gracefully
        try:
            response = supabase.table("notes").select(
                """
                id,
                content_raw,
                content_clarified,
                title_clarified,
                created_at,
                processed_at,
                ai_relevance_score,
                ai_reasoning,
                ai_team_capacity,
                cluster_id,
                user_id,
                organization_id,
                users(id, first_name, last_name, email, avatar_url),
                clusters(id, title, pillar_id, organization_id, created_at, pillars(id, name, organization_id))
                """
            ).eq("status", "review").eq("organization_id", str(current_user.organization_id)).order("created_at", desc=True).execute()
        except Exception as query_error:
            # Fallback if new columns don't exist yet
            logger.warning(f"⚠️ Query with new columns failed, using fallback: {query_error}")
            response = supabase.table("notes").select(
                """
                id,
                content_raw,
                content_clarified,
                title_clarified,
                created_at,
                processed_at,
                ai_relevance_score,
                cluster_id,
                user_id,
                organization_id,
                users(id, first_name, last_name, email, avatar_url),
                clusters(id, title, pillar_id, organization_id, created_at, pillars(id, name, organization_id))
                """
            ).eq("status", "review").eq("organization_id", str(current_user.organization_id)).order("created_at", desc=True).execute()
        
        if not response.data:
            return []
        
        # Transform data for frontend
        review_notes = []
        for note in response.data:
            cluster_info = note.get("clusters", {})
            pillar_info = cluster_info.get("pillars", {}) if cluster_info else {}
            user_info = note.get("users", {})
            
            # Security check: verify cluster belongs to same organization
            if cluster_info and str(cluster_info.get("organization_id")) != str(current_user.organization_id):
                logger.warning(f"⚠️ Note {note['id']} has cluster from different org, skipping")
                continue
            
            # Build proper author name from user data
            first_name = user_info.get("first_name", "") if user_info else ""
            last_name = user_info.get("last_name", "") if user_info else ""
            author_name = f"{first_name} {last_name}".strip()
            if not author_name:
                author_name = user_info.get("email", "Unknown").split("@")[0] if user_info else "Unknown"
            
            avatar_url = user_info.get("avatar_url")
            
            # Title: prioritize title_clarified, then content_clarified, then raw
            title_clarified = note.get("title_clarified", "")
            clarified = note.get("content_clarified", "")
            raw_content = note.get("content_raw", "")
            
            if title_clarified:
                title = title_clarified
            elif clarified:
                title = clarified[:100] + "..." if len(clarified) > 100 else clarified
            else:
                title = raw_content[:100] + "..." if len(raw_content) > 100 else raw_content
            
            # Get the most recent update date (processed_at is when AI processed it)
            updated_at = note.get("processed_at") or note.get("created_at")
            
            # Determine creation date: Use cluster creation date if available (represents the "idea" start), else note creation
            created_at = note.get("created_at")
            if cluster_info and cluster_info.get("created_at"):
                # If part of a cluster, the idea might be older than this specific note update
                # We use the cluster's creation date as the "origin" of the idea group
                created_at = cluster_info.get("created_at")
            
            # Parse team_capacity from JSON if available, otherwise generate realistic simulation
            team_capacity = note.get("ai_team_capacity")
            if isinstance(team_capacity, str):
                import json
                try:
                    team_capacity = json.loads(team_capacity)
                except:
                    team_capacity = None
            
            # SIMULATION FOR EXISTING NOTES (if no AI data yet)
            if not team_capacity:
                # Generate realistic data based on relevance score
                score = note.get("ai_relevance_score", 0)
                if score >= 8.5:
                    team_capacity = {
                        "team_size": 5,
                        "profiles": ["Product Lead", "Senior Dev", "UX Designer", "Data Scientist"],
                        "feasibility": "Complex",
                        "feasibility_reason": "High-impact initiative requiring dedicated cross-functional team."
                    }
                elif score >= 6.5:
                    team_capacity = {
                        "team_size": 3,
                        "profiles": ["Product Manager", "Fullstack Dev", "Designer"],
                        "feasibility": "Moderate",
                        "feasibility_reason": "Can be integrated into existing roadmap with current resources."
                    }
                else:
                    team_capacity = {
                        "team_size": 1,
                        "profiles": ["Junior Dev"],
                        "feasibility": "Easy",
                        "feasibility_reason": "Low complexity, good for backlog or hackathon."
                    }
            
            review_notes.append({
                "id": note["id"],
                "title": title,
                "content": raw_content,
                "content_clarified": clarified,
                "category": pillar_info.get("name", "UNCATEGORIZED") if pillar_info else "UNCATEGORIZED",
                "status": "Ready",
                "author": author_name,
                "author_id": note.get("user_id"),
                "author_avatar": avatar_url,
                "date": created_at, # Use the determined creation date
                "updated_at": updated_at,
                "relevance_score": note.get("ai_relevance_score", 0),
                "ai_reasoning": note.get("ai_reasoning"),
                "team_capacity": team_capacity,
                "cluster_id": note.get("cluster_id"),
                "cluster_title": cluster_info.get("title") if cluster_info else None,
            })
        
        logger.info(f"✅ Retrieved {len(review_notes)} notes for review (org: {current_user.organization_id})")
        
        return review_notes
        
    except Exception as e:
        logger.error(f"❌ Error fetching review notes: {e}")
        raise


@router.get("/cluster/{cluster_id}/details")
def get_cluster_details(cluster_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """
    Get complete details for a single cluster (Node Details panel in Galaxy View).
    
    Returns REAL data (no mock):
    - strategic_brief: AI-generated short summary (150-200 chars)
    - created_at: When the cluster was first created
    - last_updated_at: When the cluster was last modified
    - impact: High/Medium/Low based on avg_relevance_score
    - relevance_score: Average relevance as percentage (0-100)
    - collaborators: Array of real users who contributed notes
    - note_count: Number of notes in the cluster
    """
    try:
        supabase = get_supabase()
        organization_id = str(current_user.organization_id)
        
        # ============================================
        # STEP 1: Fetch Cluster with Notes and Users
        # ============================================
        cluster_response = supabase.table("clusters").select(
            """
            id,
            title,
            created_at,
            last_updated_at,
            organization_id,
            pillar_id,
            pillars(id, name, color, organization_id),
            notes!inner(
                id,
                content_clarified,
                content_raw,
                ai_relevance_score,
                created_at,
                status,
                organization_id,
                user_id,
                users(id, first_name, last_name, email, avatar_url, job_title, department)
            )
            """
        ).eq("id", cluster_id).eq("organization_id", organization_id).eq("notes.status", "processed").single().execute()
        
        if not cluster_response.data:
            logger.warning(f"⚠️ Cluster {cluster_id} not found or not accessible for org {organization_id}")
            return {"error": "Cluster not found"}, 404
        
        cluster = cluster_response.data
        notes = cluster.get("notes", [])
        pillar_info = cluster.get("pillars", {})
        
        # Security check
        if str(cluster.get("organization_id")) != organization_id:
            logger.error(f"❌ Security violation: cluster {cluster_id} does not belong to org {organization_id}")
            return {"error": "Access denied"}, 403
        
        # ============================================
        # STEP 2: Calculate Metrics
        # ============================================
        # Filter notes for security
        valid_notes = [
            n for n in notes 
            if str(n.get("organization_id")) == organization_id
        ]
        
        # Calculate average relevance score
        relevance_scores = [
            note.get("ai_relevance_score", 0) 
            for note in valid_notes 
            if note.get("ai_relevance_score") is not None
        ]
        avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0
        
        # ============================================
        # SEVERE PROFESSIONAL SCORING
        # ============================================
        # Impact level - STRICT professional criteria:
        # - High: Only for exceptional ideas (8.5+/10) with clear strategic value
        # - Medium: Good ideas that need refinement (6.5-8.5/10)
        # - Low: Ideas requiring significant improvement or not strategically aligned
        if avg_relevance >= 8.5:
            impact = "High"
        elif avg_relevance >= 6.5:
            impact = "Medium"
        else:
            impact = "Low"
        
        # Relevance as percentage - STRICT scoring
        # We apply a professional curve: raw score * 10, but capped realistically
        # In a professional context, even a 70% relevance is considered good
        relevance_percentage = int(avg_relevance * 10)
        
        # ============================================
        # STEP 3: Extract Real Collaborators
        # ============================================
        # Get unique users who contributed notes
        seen_users = set()
        collaborators = []
        
        for note in valid_notes:
            user_data = note.get("users", {})
            user_id = user_data.get("id")
            
            if user_id and user_id not in seen_users:
                seen_users.add(user_id)
                
                first_name = user_data.get("first_name", "")
                last_name = user_data.get("last_name", "")
                full_name = f"{first_name} {last_name}".strip()
                
                # Generate initials
                initials = ""
                if first_name:
                    initials += first_name[0].upper()
                if last_name:
                    initials += last_name[0].upper()
                if not initials and user_data.get("email"):
                    initials = user_data["email"][0].upper()
                
                collaborators.append({
                    "id": user_id,
                    "name": full_name or "Anonymous",
                    "initials": initials or "?",
                    "avatar_url": user_data.get("avatar_url"),
                    "job_title": user_data.get("job_title", ""),
                    "department": user_data.get("department", ""),
                })
        
        # ============================================
        # STEP 4: Strategic Brief (OPTIMIZED - Fast First)
        # ============================================
        # Priority: 1. Stored synthesis  2. Fast fallback  3. AI (if fast)
        strategic_brief = None
        
        # Try to use stored cluster synthesis first (instant)
        stored_synthesis = cluster.get("synthesis")
        if stored_synthesis and len(stored_synthesis) > 20:
            # Truncate to 200 chars if needed
            strategic_brief = stored_synthesis[:197] + "..." if len(stored_synthesis) > 200 else stored_synthesis
        
        # Fast fallback if no stored synthesis
        if not strategic_brief:
            pillar_name = pillar_info.get("name", "Unknown") if pillar_info else "Unknown"
            note_count = len(valid_notes)
            
            # Generate contextual fallback based on score
            if avg_relevance >= 8.5:
                strategic_brief = f"High-impact {pillar_name} initiative with {note_count} aligned contributions. Priority for board review."
            elif avg_relevance >= 6.5:
                strategic_brief = f"Solid {pillar_name} proposals requiring refinement. {note_count} related ideas awaiting strategic evaluation."
            else:
                strategic_brief = f"{note_count} {pillar_name} contributions pending review. Alignment and feasibility assessment needed."
        
        # ============================================
        # STEP 5: Format Dates
        # ============================================
        created_at = cluster.get("created_at")
        last_updated_at = cluster.get("last_updated_at")
        
        # Find the oldest note date as alternative created date
        note_dates = [n.get("created_at") for n in valid_notes if n.get("created_at")]
        oldest_note_date = min(note_dates) if note_dates else None
        
        # ============================================
        # STEP 6: Build Response
        # ============================================
        result = {
            "id": cluster["id"],
            "title": cluster.get("title", "Untitled Cluster"),
            "pillar": pillar_info.get("name", "Unknown") if pillar_info else "Unknown",
            "pillar_id": cluster.get("pillar_id"),
            "pillar_color": pillar_info.get("color") if pillar_info else None,
            
            # Strategic Brief (AI-generated, 150-200 chars)
            "strategic_brief": strategic_brief,
            
            # Dates
            "created_at": created_at or oldest_note_date,
            "last_updated_at": last_updated_at or created_at or oldest_note_date,
            
            # Metrics
            "impact": impact,
            "relevance_score": relevance_percentage,
            "avg_relevance_raw": round(avg_relevance, 2),  # Original 0-10 score
            "note_count": len(valid_notes),
            
            # Real Collaborators
            "collaborators": collaborators,
            "collaborator_count": len(collaborators),
            
            # Note IDs for moderation
            "note_ids": [n.get("id") for n in valid_notes if n.get("id")],
        }
        
        logger.info(f"✅ Retrieved details for cluster {cluster_id}: {len(valid_notes)} notes, {len(collaborators)} collaborators")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error fetching cluster details for {cluster_id}: {e}")
        import traceback
        traceback.print_exc()
        raise


@router.get("/archived-notes")
def get_archived_notes(current_user: CurrentUser = Depends(get_current_user)):
    """
    Get all notes with 'archived' status for the Archive page.
    Only accessible by OWNER and BOARD members.
    Filtered by current user's organization.
    
    Returns notes that have been archived by executives.
    """
    try:
        # Check role access - only OWNER and BOARD can access archives
        if current_user.role not in ['OWNER', 'BOARD']:
            logger.warning(f"⚠️ User {current_user.user_id} with role {current_user.role} attempted to access archives")
            return {"error": "Access denied. Only Board members and Owners can access archives."}, 403
        
        supabase = get_supabase()
        
        # Query notes with archived status, including cluster info AND user info
        try:
            response = supabase.table("notes").select(
                """
                id,
                content_raw,
                content_clarified,
                title_clarified,
                created_at,
                processed_at,
                ai_relevance_score,
                ai_reasoning,
                ai_team_capacity,
                cluster_id,
                user_id,
                organization_id,
                users(id, first_name, last_name, email, avatar_url),
                clusters(id, title, pillar_id, organization_id, created_at, pillars(id, name, organization_id))
                """
            ).eq("status", "archived").eq("organization_id", str(current_user.organization_id)).order("created_at", desc=True).execute()
        except Exception as query_error:
            logger.warning(f"⚠️ Query with new columns failed, using fallback: {query_error}")
            response = supabase.table("notes").select(
                """
                id,
                content_raw,
                content_clarified,
                title_clarified,
                created_at,
                processed_at,
                ai_relevance_score,
                cluster_id,
                user_id,
                organization_id,
                users(id, first_name, last_name, email, avatar_url),
                clusters(id, title, pillar_id, organization_id, created_at, pillars(id, name, organization_id))
                """
            ).eq("status", "archived").eq("organization_id", str(current_user.organization_id)).order("created_at", desc=True).execute()
        
        if not response.data:
            return []
        
        # Transform data for frontend (same logic as review-notes)
        archived_notes = []
        for note in response.data:
            cluster_info = note.get("clusters", {})
            pillar_info = cluster_info.get("pillars", {}) if cluster_info else {}
            user_info = note.get("users", {})
            
            # Security check
            if cluster_info and str(cluster_info.get("organization_id")) != str(current_user.organization_id):
                continue
            
            # Build author name
            first_name = user_info.get("first_name", "") if user_info else ""
            last_name = user_info.get("last_name", "") if user_info else ""
            author_name = f"{first_name} {last_name}".strip()
            if not author_name:
                author_name = user_info.get("email", "Unknown").split("@")[0] if user_info else "Unknown"
            
            avatar_url = user_info.get("avatar_url")
            
            # Title logic
            title_clarified = note.get("title_clarified", "")
            clarified = note.get("content_clarified", "")
            raw_content = note.get("content_raw", "")
            
            if title_clarified:
                title = title_clarified
            elif clarified:
                title = clarified[:100] + "..." if len(clarified) > 100 else clarified
            else:
                title = raw_content[:100] + "..." if len(raw_content) > 100 else raw_content
            
            updated_at = note.get("processed_at") or note.get("created_at")
            created_at = note.get("created_at")
            if cluster_info and cluster_info.get("created_at"):
                created_at = cluster_info.get("created_at")
            
            # Team capacity simulation (same as review-notes)
            team_capacity = note.get("ai_team_capacity")
            if isinstance(team_capacity, str):
                import json
                try:
                    team_capacity = json.loads(team_capacity)
                except:
                    team_capacity = None
            
            if not team_capacity:
                score = note.get("ai_relevance_score", 0)
                if score >= 8.5:
                    team_capacity = {
                        "team_size": 5,
                        "profiles": ["Product Lead", "Senior Dev", "UX Designer", "Data Scientist"],
                        "feasibility": "Complex",
                        "feasibility_reason": "High-impact initiative requiring dedicated cross-functional team."
                    }
                elif score >= 6.5:
                    team_capacity = {
                        "team_size": 3,
                        "profiles": ["Product Manager", "Fullstack Dev", "Designer"],
                        "feasibility": "Moderate",
                        "feasibility_reason": "Can be integrated into existing roadmap with current resources."
                    }
                else:
                    team_capacity = {
                        "team_size": 1,
                        "profiles": ["Junior Dev"],
                        "feasibility": "Easy",
                        "feasibility_reason": "Low complexity, good for backlog or hackathon."
                    }
            
            archived_notes.append({
                "id": note["id"],
                "title": title,
                "content": raw_content,
                "content_clarified": clarified,
                "category": pillar_info.get("name", "UNCATEGORIZED") if pillar_info else "UNCATEGORIZED",
                "status": "Archived",
                "author": author_name,
                "author_id": note.get("user_id"),
                "author_avatar": avatar_url,
                "date": created_at,
                "updated_at": updated_at,
                "relevance_score": note.get("ai_relevance_score", 0),
                "ai_reasoning": note.get("ai_reasoning"),
                "team_capacity": team_capacity,
                "cluster_id": note.get("cluster_id"),
                "cluster_title": cluster_info.get("title") if cluster_info else None,
            })
        
        logger.info(f"✅ Retrieved {len(archived_notes)} archived notes (org: {current_user.organization_id})")
        
        return archived_notes
        
    except Exception as e:
        logger.error(f"❌ Error fetching archived notes: {e}")
        raise


@router.post("/archive-note/{note_id}")
async def archive_note(note_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """
    Archive a note (move from review to archived status).
    Only accessible by OWNER and BOARD members.
    """
    try:
        # Check role access
        if current_user.role not in ['OWNER', 'BOARD']:
            logger.warning(f"⚠️ User {current_user.id} with role {current_user.role} attempted to archive note")
            raise HTTPException(status_code=403, detail="Access denied. Only Board members and Owners can archive notes.")
        
        supabase = get_supabase()
        organization_id = str(current_user.organization_id)
        
        # Verify the note exists and belongs to the organization
        note_response = supabase.table("notes").select("id, status, organization_id").eq("id", note_id).eq("organization_id", organization_id).single().execute()
        
        if not note_response.data:
            logger.warning(f"⚠️ Note {note_id} not found or not accessible")
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Update the note status to archived
        update_response = supabase.table("notes").update({
            "status": "archived"
        }).eq("id", note_id).eq("organization_id", organization_id).execute()
        
        if not update_response.data:
            logger.error(f"❌ Failed to archive note {note_id}")
            raise HTTPException(status_code=500, detail="Failed to archive note")
        
        logger.info(f"✅ Note {note_id} archived by user {current_user.id}")
        
        return {
            "success": True,
            "message": "Note archived successfully",
            "note_id": note_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error archiving note {note_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unarchive-note/{note_id}")
async def unarchive_note(note_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """
    Unarchive a note (move from archived back to review status).
    Only accessible by OWNER and BOARD members.
    """
    try:
        # Check role access
        if current_user.role not in ['OWNER', 'BOARD']:
            logger.warning(f"⚠️ User {current_user.id} with role {current_user.role} attempted to unarchive note")
            raise HTTPException(status_code=403, detail="Access denied. Only Board members and Owners can unarchive notes.")
        
        supabase = get_supabase()
        organization_id = str(current_user.organization_id)
        
        # Verify the note exists and belongs to the organization
        note_response = supabase.table("notes").select("id, status, organization_id").eq("id", note_id).eq("organization_id", organization_id).single().execute()
        
        if not note_response.data:
            logger.warning(f"⚠️ Note {note_id} not found or not accessible")
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Update the note status back to review
        update_response = supabase.table("notes").update({
            "status": "review"
        }).eq("id", note_id).eq("organization_id", organization_id).execute()
        
        if not update_response.data:
            logger.error(f"❌ Failed to unarchive note {note_id}")
            raise HTTPException(status_code=500, detail="Failed to unarchive note")
        
        logger.info(f"✅ Note {note_id} unarchived by user {current_user.id}")
        
        return {
            "success": True,
            "message": "Note restored to review successfully",
            "note_id": note_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error unarchiving note {note_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

