"""
API routes for Projects system (independent from idea_groups)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from loguru import logger

from app.models.projects import (
    Project, ProjectCreate, ProjectUpdate,
    ProjectMember, ProjectMemberCreate,
    ProjectMessage, ProjectMessageCreate,
    ProjectItem, ProjectItemCreate,
    AddMemberRequest, ProjectUnreadStatus
)
from app.api.dependencies import get_current_user, CurrentUser
from app.services.supabase_client import supabase

router = APIRouter()


# ===================================================================
# PROJECTS - CRUD
# ===================================================================

@router.get("", response_model=List[Project])
def get_user_projects(
    limit: int = Query(100, le=100),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get all projects the user is a member of"""
    try:
        user_id = str(current_user.id)
        
        # Get projects where user is a member
        response = supabase.table("project_members")\
            .select("""
                project_id,
                role,
                last_read_at,
                projects!inner(
                    id, name, description, color, status, created_by, created_at, updated_at
                )
            """)\
            .eq("user_id", user_id)\
            .limit(limit)\
            .offset(offset)\
            .execute()
        
        if not response.data:
            return []
        
        # Format response
        # Helper function for parallel execution
        def fetch_project_details(item):
            try:
                project_data = item.get("projects", {})
                pid = project_data["id"]
                
                # Get member count
                m_count = supabase.table("project_members")\
                    .select("id", count="exact")\
                    .eq("project_id", pid)\
                    .execute().count or 0
                
                # Get item count
                i_count = supabase.table("project_items")\
                    .select("id", count="exact")\
                    .eq("project_id", pid)\
                    .execute().count or 0
                
                # Check specifics from membership
                is_lead = item.get("role") == "lead"
                last_read = item.get("last_read_at")
                
                # Check for unread
                has_unread = False
                last_msg_resp = supabase.table("project_messages")\
                    .select("created_at")\
                    .eq("project_id", pid)\
                    .neq("sender_id", user_id)\
                    .order("created_at", desc=True)\
                    .limit(1)\
                    .execute()
                
                if last_msg_resp.data:
                    msg_created = last_msg_resp.data[0].get("created_at")
                    if not last_read or (msg_created and msg_created > last_read):
                        has_unread = True
                
                # Fetch members with user details for avatars
                members_resp = supabase.table("project_members")\
                    .select("id, user_id, project_id, users(first_name, last_name, avatar_url)")\
                    .eq("project_id", pid)\
                    .limit(3)\
                    .execute()
                
                members = []
                if members_resp.data:
                    for m in members_resp.data:
                        user_data = m.get("users", {})
                        members.append({
                            "id": m.get("id"),
                            "user_id": m.get("user_id"),
                            "project_id": m.get("project_id"),
                            "first_name": user_data.get("first_name"),
                            "last_name": user_data.get("last_name"),
                            "avatar_url": user_data.get("avatar_url")
                        })
                
                return Project(
                    **project_data,
                    member_count=m_count,
                    item_count=i_count,
                    is_lead=is_lead,
                    has_unread=has_unread,
                    organization_id=current_user.organization_id,
                    members=members
                )
            except Exception as e:
                logger.error(f"Error processing project {item.get('project_id')}: {e}")
                return None

        # Execute sequentially for stability (parallel execution was causing [Errno 35] issues)
        projects_list = []
        for item in response.data:
            res = fetch_project_details(item)
            if res:
                projects_list.append(res)
        
        # Sort by updated_at
        projects_list.sort(key=lambda x: x.updated_at, reverse=True)
        
        return projects_list
        
    except Exception as e:
        logger.error(f"Error fetching projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Project)
def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Create a new project"""
    try:
        # Create project
        project_resp = supabase.table("projects").insert({
            "organization_id": str(current_user.organization_id),
            "name": payload.name,
            "description": payload.description or "",
            "color": payload.color or "#6366f1",
            "created_by": str(current_user.id),
            "status": "active"
        }).execute()
        
        if not project_resp.data:
            raise HTTPException(status_code=500, detail="Failed to create project")
        
        project_id = project_resp.data[0]["id"]
        
        # Determine lead
        lead_id = payload.lead_id or current_user.id
        
        # Add lead
        supabase.table("project_members").insert({
            "project_id": str(project_id),
            "user_id": str(lead_id),
            "role": "lead"
        }).execute()
        
        # Add other members
        all_member_ids = set(payload.member_ids)
        all_member_ids.add(current_user.id) # Creator is always a member
        
        # Members to add as regular members (everyone except the lead)
        members_to_add = [mid for mid in all_member_ids if str(mid) != str(lead_id)]
        
        if members_to_add:
            members_data = [
                {
                    "project_id": str(project_id),
                    "user_id": str(member_id),
                    "role": "member"
                }
                for member_id in members_to_add
            ]
            supabase.table("project_members").insert(members_data).execute()
        
        # Create welcome message
        try:
            # Get project lead info
            lead_user = supabase.table("users").select("first_name, last_name, email").eq("id", str(lead_id)).single().execute()
            lead_name = f"{lead_user.data.get('first_name', '')} {lead_user.data.get('last_name', '')}".strip() or lead_user.data.get('email', 'Unknown')
            
            # Get team members info
            member_details = []
            if payload.member_ids:
                members_resp = supabase.table("users").select("first_name, last_name, email").in_("id", [str(mid) for mid in payload.member_ids]).execute()
                for member in (members_resp.data or []):
                    member_name = f"{member.get('first_name', '')} {member.get('last_name', '')}".strip() or member.get('email', 'Unknown')
                    member_details.append(member_name)
            
            # Build welcome message
            welcome_msg = f"{payload.name}\n\n"
            welcome_msg += "Project launched successfully!\n\n"
            welcome_msg += "This team has been created automatically by SIGMENT.\n\n"
            welcome_msg += f"Project Lead: {lead_name}\n"
            
            if member_details:
                welcome_msg += "Team Members:\n"
                for member in member_details:
                    welcome_msg += f"• {member}\n"
            else:
                welcome_msg += "Team Members: No additional members yet"
            
            supabase.table("project_messages").insert({
                "project_id": str(project_id),
                "sender_id": str(current_user.id),
                "content": welcome_msg,
                "is_system_message": True
            }).execute()
        except Exception as e:
            logger.error(f"Failed to post welcome message: {e}")
        
        # Fetch the complete project to return
        project_data = supabase.table("projects").select("*").eq("id", str(project_id)).single().execute()
        member_count = supabase.table("project_members").select("id", count="exact").eq("project_id", str(project_id)).execute().count or 0
        
        return Project(
            **project_data.data,
            member_count=member_count,
            item_count=0,
            is_lead=True,  # Creator is always lead
            has_unread=False
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# UNREAD STATUS
@router.get("/unread-status", response_model=ProjectUnreadStatus)
def get_unread_status(current_user: CurrentUser = Depends(get_current_user)):
    unread_count = 0
    user_id = str(current_user.id)
    try:
        memberships = supabase.table("project_members").select("project_id, last_read_at").eq("user_id", user_id).execute()
        if not memberships.data:
            return ProjectUnreadStatus(has_unread=False, unread_projects_count=0)
        for membership in memberships.data:
            project_id = membership.get("project_id")
            last_read = membership.get("last_read_at")
            last_msg_resp = supabase.table("project_messages").select("created_at").eq("project_id", project_id).neq("sender_id", user_id).order("created_at", desc=True).limit(1).execute()
            if last_msg_resp.data:
                msg_created = last_msg_resp.data[0].get("created_at")
                if not last_read or (msg_created and msg_created > last_read):
                    unread_count += 1
        return ProjectUnreadStatus(has_unread=unread_count > 0, unread_projects_count=unread_count)
    except Exception as e:
        logger.error(f"Error: {e}")
        return ProjectUnreadStatus(has_unread=False, unread_projects_count=0)


@router.get("/{project_id}", response_model=Project)
def get_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get project details"""
    try:
        member_check = supabase.table("project_members").select("role").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member")
        
        project_resp = supabase.table("projects").select("*").eq("id", str(project_id)).single().execute()
        if not project_resp.data:
            raise HTTPException(status_code=404, detail="Not found")
        
        member_count = supabase.table("project_members").select("id", count="exact").eq("project_id", str(project_id)).execute().count or 0
        item_count = supabase.table("project_items").select("id", count="exact").eq("project_id", str(project_id)).execute().count or 0
        
        return Project(**project_resp.data, member_count=member_count, item_count=item_count, is_lead=member_check.data[0].get("role")=="lead", has_unread=False)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{project_id}")
def update_project(project_id: UUID, payload: ProjectUpdate, current_user: CurrentUser = Depends(get_current_user)):
    """Update project (lead only)"""
    try:
        member_check = supabase.table("project_members").select("role").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data or member_check.data[0].get("role") != "lead":
            raise HTTPException(status_code=403, detail="Lead only")
        
        update_data = {}
        if payload.name: update_data["name"] = payload.name
        if payload.description is not None: update_data["description"] = payload.description
        if payload.color: update_data["color"] = payload.color
        if payload.status: update_data["status"] = payload.status
        if not update_data: return {"message": "No changes"}
        
        update_data["updated_at"] = "NOW()"
        supabase.table("projects").update(update_data).eq("id", str(project_id)).execute()
        return {"message": "Updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}")
def delete_project(project_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    """Delete project (lead only)"""
    try:
        member_check = supabase.table("project_members").select("role").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data or member_check.data[0].get("role") != "lead":
            raise HTTPException(status_code=403, detail="Lead only")
        supabase.table("projects").delete().eq("id", str(project_id)).execute()
        return {"message": "Deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# MEMBERS
@router.get("/{project_id}/members", response_model=List[ProjectMember])
def get_members(project_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    try:
        member_check = supabase.table("project_members").select("user_id").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member")
        
        response = supabase.table("project_members").select("*, users(first_name, last_name, email, avatar_url)").eq("project_id", str(project_id)).execute()
        members = []
        for item in (response.data or []):
            u = item.get("users", {})
            members.append(ProjectMember(id=item["id"], project_id=item["project_id"], user_id=item["user_id"], role=item["role"], joined_at=item["joined_at"], last_read_at=item.get("last_read_at"), first_name=u.get("first_name"), last_name=u.get("last_name"), email=u.get("email"), avatar_url=u.get("avatar_url")))
        return members
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/members")
def add_member(project_id: UUID, payload: AddMemberRequest, current_user: CurrentUser = Depends(get_current_user)):
    try:
        member_check = supabase.table("project_members").select("role").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data or member_check.data[0].get("role") != "lead":
            raise HTTPException(status_code=403, detail="Lead only")
        supabase.table("project_members").insert({"project_id": str(project_id), "user_id": str(payload.user_id), "role": "member"}).execute()
        return {"message": "Added"}
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(status_code=400, detail="Already member")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}/members/{user_id}")
def remove_member(project_id: UUID, user_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    try:
        member_check = supabase.table("project_members").select("role").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data or member_check.data[0].get("role") != "lead":
            raise HTTPException(status_code=403, detail="Lead only")
        if str(user_id) == str(current_user.id):
            raise HTTPException(status_code=400, detail="Cannot remove lead")
        supabase.table("project_members").delete().eq("project_id", str(project_id)).eq("user_id", str(user_id)).execute()
        return {"message": "Removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# MESSAGES
@router.get("/{project_id}/messages", response_model=List[ProjectMessage])
def get_messages(project_id: UUID, limit: int = 50, offset: int = 0, current_user: CurrentUser = Depends(get_current_user)):
    try:
        member_check = supabase.table("project_members").select("user_id").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member")
        
        messages_resp = supabase.table("project_messages").select("*, users(first_name, last_name, avatar_url)").eq("project_id", str(project_id)).order("created_at", desc=True).range(offset, offset+limit-1).execute()
        members_last_read = supabase.table("project_members").select("user_id, last_read_at, users!project_members_user_id_fkey(first_name, last_name)").eq("project_id", str(project_id)).neq("user_id", str(current_user.id)).execute()
        members_data = members_last_read.data or []
        
        # Get all shared note IDs for enrichment
        note_ids = [msg.get("shared_note_id") for msg in (messages_resp.data or []) if msg.get("shared_note_id")]
        notes_map = {}
        if note_ids:
            try:
                notes_resp = supabase.table("notes")\
                    .select("id, content_raw, content_clarified, title_clarified, status, pillar_id, pillars(name, color)")\
                    .in_("id", note_ids)\
                    .execute()
                if notes_resp.data:
                    for n in notes_resp.data:
                        pillar = n.get("pillars") or {}
                        notes_map[str(n["id"])] = {
                            "id": n["id"],
                            "title": n.get("title_clarified") or (n.get("content_clarified") or "")[:60] or (n.get("content_raw") or "")[:60],
                            "content": n.get("content_clarified") or n.get("content_raw"),
                            "status": n.get("status"),
                            "pillar_name": pillar.get("name"),
                            "pillar_color": pillar.get("color")
                        }
            except Exception as note_err:
                logger.warning(f"Could not enrich notes: {note_err}")
        
        # Get all shared post IDs for enrichment
        post_ids = [msg.get("shared_post_id") for msg in (messages_resp.data or []) if msg.get("shared_post_id")]
        posts_map = {}
        if post_ids:
            try:
                posts_resp = supabase.table("posts")\
                    .select("id, content, media_urls, post_type, has_poll, likes_count, comments_count, user_id, created_at, users(first_name, last_name, avatar_url)")\
                    .in_("id", post_ids)\
                    .execute()
                
                # Fetch polls for these posts if any are poll type
                polls_map = {}
                poll_post_ids = [p["id"] for p in (posts_resp.data or []) if p.get("post_type") == "poll"]
                if poll_post_ids:
                    try:
                        polls_resp = supabase.table("polls").select("*, poll_options(*)").in_("post_id", poll_post_ids).execute()
                        for pl in (polls_resp.data or []):
                            raw_options = pl.get("poll_options") or []
                            raw_options.sort(key=lambda x: x.get("display_order", 0))
                            options = [{"id": opt["id"], "text": opt.get("option_text", "")} for opt in raw_options]
                            polls_map[pl["post_id"]] = {
                                "question": pl.get("question"),
                                "options": options
                            }
                    except Exception as poll_err:
                        logger.warning(f"Could not fetch polls: {poll_err}")
                
                if posts_resp.data:
                    for p in posts_resp.data:
                        author = p.get("users") or {}
                        post_data = {
                            "id": p["id"],
                            "content": p.get("content"),
                            "media_urls": p.get("media_urls"),
                            "post_type": p.get("post_type"),
                            "likes_count": p.get("likes_count", 0),
                            "comments_count": p.get("comments_count", 0),
                            "user_info": {
                                "first_name": author.get("first_name"),
                                "last_name": author.get("last_name"),
                                "avatar_url": author.get("avatar_url")
                            }
                        }
                        # Add poll data if it's a poll
                        if p.get("post_type") == "poll" and p["id"] in polls_map:
                            post_data["poll"] = polls_map[p["id"]]
                        posts_map[str(p["id"])] = post_data
            except Exception as post_err:
                logger.warning(f"Could not enrich posts: {post_err}")
        
        messages = []
        for msg in (messages_resp.data or []):
            u = msg.get("users", {})
            sender_name = f"{u.get('first_name','')} {u.get('last_name','')}".strip() or None if u else None
            read_by = []
            if msg["sender_id"] == str(current_user.id):
                msg_time = msg["created_at"]
                for m in members_data:
                    if m.get("last_read_at") and m.get("last_read_at") >= msg_time:
                        mu = m.get("users") or {}
                        read_by.append({"user_id": m["user_id"], "first_name": mu.get("first_name"), "last_name": mu.get("last_name"), "read_at": m["last_read_at"]})
            
            # Get shared note if present
            shared_note = None
            if msg.get("shared_note_id"):
                shared_note = notes_map.get(str(msg["shared_note_id"]))
            
            # Get shared post if present
            shared_post = None
            if msg.get("shared_post_id"):
                shared_post = posts_map.get(str(msg["shared_post_id"]))
            
            messages.append(ProjectMessage(
                id=msg["id"], 
                project_id=msg["project_id"], 
                sender_id=msg["sender_id"], 
                sender_name=sender_name, 
                sender_avatar_url=u.get("avatar_url") if u else None, 
                content=msg["content"], 
                attachment_url=msg.get("attachment_url"), 
                attachment_type=msg.get("attachment_type"), 
                attachment_name=msg.get("attachment_name"), 
                shared_note_id=msg.get("shared_note_id"), 
                shared_note=shared_note,
                shared_post_id=msg.get("shared_post_id"), 
                shared_post=shared_post,
                created_at=msg["created_at"], 
                read_by=read_by, 
                is_system_message=msg.get("is_system_message", False)
            ))
        messages.reverse()
        return messages
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error: {e}")
        return []


@router.post("/{project_id}/messages")
def send_message(project_id: UUID, payload: ProjectMessageCreate, current_user: CurrentUser = Depends(get_current_user)):
    try:
        member_check = supabase.table("project_members").select("user_id").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member")
        
        message_data = {"project_id": str(project_id), "sender_id": str(current_user.id), "content": payload.content, "attachment_url": payload.attachment_url, "attachment_type": payload.attachment_type, "attachment_name": payload.attachment_name, "shared_note_id": str(payload.shared_note_id) if payload.shared_note_id else None, "shared_post_id": str(payload.shared_post_id) if payload.shared_post_id else None}
        supabase.table("project_messages").insert(message_data).execute()
        return {"message": "Sent"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{project_id}/read")
def mark_read(project_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    try:
        supabase.table("project_members").update({"last_read_at": "NOW()"}).eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        return {"message": "Marked read"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/mark-read")
def mark_read_post(project_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    """Mark project as read - POST version for frontend compatibility"""
    try:
        supabase.table("project_members").update({"last_read_at": "NOW()"}).eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        return {"message": "Marked read"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ITEMS
@router.get("/{project_id}/items", response_model=List[ProjectItem])
def get_items(project_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    try:
        member_check = supabase.table("project_members").select("user_id").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member")
        response = supabase.table("project_items").select("*").eq("project_id", str(project_id)).order("added_at", desc=True).execute()
        return response.data or []
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/items")
def add_item(project_id: UUID, payload: ProjectItemCreate, current_user: CurrentUser = Depends(get_current_user)):
    try:
        member_check = supabase.table("project_members").select("user_id").eq("project_id", str(project_id)).eq("user_id", str(current_user.id)).execute()
        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member")
        item_data = {"project_id": str(project_id), "added_by": str(current_user.id), "note_id": str(payload.note_id) if payload.note_id else None, "cluster_id": str(payload.cluster_id) if payload.cluster_id else None}
        supabase.table("project_items").insert(item_data).execute()
        return {"message": "Added"}
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(status_code=400, detail="Already in project")
        raise HTTPException(status_code=500, detail=str(e))





# ===================================================================
# PROJECTS - INTEGRATIONS
# ===================================================================

class CreateChannelRequest(BaseModel):
    projectName: str
    projectLeadEmail: str
    teamEmails: List[str]

@router.post("/create-channel")
async def create_slack_channel(
    request: CreateChannelRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Create a Slack channel for a project.
    """
    try:
        from app.services.slack_service import slack_service
        
        result = await slack_service.create_project_channel(
            project_name=request.projectName,
            project_lead_email=request.projectLeadEmail,
            team_emails=request.teamEmails,
            user_id=str(current_user.id)
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
            
        return result

    except Exception as e:
        logger.error(f"Error creating Slack channel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-teams-channel")
async def create_teams_channel(
    request: CreateChannelRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Create a Microsoft Teams team for a project.
    """
    try:
        from app.services.teams_service import teams_service
        
        result = await teams_service.create_project_team(
            project_name=request.projectName,
            project_lead_email=request.projectLeadEmail,
            team_emails=request.teamEmails,
            user_id=str(current_user.id)
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
            
        return result

    except Exception as e:
        logger.error(f"Error creating Teams channel: {e}")
        raise HTTPException(status_code=500, detail=str(e))
