"""
Idea Groups API Routes
Only OWNER/BOARD can create and manage groups
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Body
from loguru import logger

from app.services.supabase_client import supabase
from app.api.dependencies import CurrentUser, get_current_user, require_board_or_owner
from app.models.idea_groups import (
    IdeaGroupCreate, IdeaGroupUpdate, AddMemberRequest, GroupMessageCreate,
    GroupItemCreate, IdeaGroup, GroupMemberInfo, GroupMessage, GroupItem
)

router = APIRouter()


# =====================================================
# GROUPS CRUD
# =====================================================

@router.get("/", response_model=List[IdeaGroup])
async def get_idea_groups(
    current_user: CurrentUser = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Get all idea groups the current user is a member of.
    Sorted by updated_at descending.
    """
    try:
        # Get groups where user is a member
        response = supabase.table("idea_group_members")\
            .select("idea_group_id")\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        if not response.data:
            return []
        
        group_ids = [item["idea_group_id"] for item in response.data]
        
        # Fetch full group details
        groups_response = supabase.table("idea_groups")\
            .select("*")\
            .in_("id", group_ids)\
            .eq("organization_id", str(current_user.organization_id))\
            .order("updated_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        if not groups_response.data:
            return []
        
        groups_out = []
        for group in groups_response.data:
            group_id = group["id"]
            
            # Get member count - specify explicit FK relation
            members_resp = supabase.table("idea_group_members")\
                .select("user_id, role, added_at, users!idea_group_members_user_id_fkey(id, first_name, last_name, job_title, email, avatar_url)")\
                .eq("idea_group_id", group_id)\
                .execute()
            
            members = []
            is_admin = False
            for m in (members_resp.data or []):
                user_data = m.get("users", {})
                member_info = GroupMemberInfo(
                    id=user_data.get("id"),
                    first_name=user_data.get("first_name"),
                    last_name=user_data.get("last_name"),
                    job_title=user_data.get("job_title"),
                    email=user_data.get("email", ""),
                    avatar_url=user_data.get("avatar_url"),
                    role=m.get("role", "member"),
                    added_at=m.get("added_at")
                )
                members.append(member_info)
                # Check if current user is admin
                if str(user_data.get("id")) == str(current_user.id) and m.get("role") == "admin":
                    is_admin = True
            
            # Get item count
            items_resp = supabase.table("idea_group_items")\
                .select("id", count="exact")\
                .eq("idea_group_id", group_id)\
                .execute()
            
            item_count = items_resp.count if hasattr(items_resp, 'count') and items_resp.count else len(items_resp.data or [])
            
            # Calculate has_unread for this group (with fallback if column doesn't exist)
            has_unread = False
            try:
                # Get user's last_read_at for this group
                membership_resp = supabase.table("idea_group_members")\
                    .select("last_read_at")\
                    .eq("idea_group_id", group_id)\
                    .eq("user_id", str(current_user.id))\
                    .limit(1)\
                    .execute()
                
                if membership_resp.data and len(membership_resp.data) > 0:
                    last_read_at = membership_resp.data[0].get("last_read_at")
                    
                    # Get the last message in this group that was NOT sent by current user
                    last_msg_resp = supabase.table("idea_group_messages")\
                        .select("created_at, sender_id")\
                        .eq("idea_group_id", group_id)\
                        .neq("sender_id", str(current_user.id))\
                        .order("created_at", desc=True)\
                        .limit(1)\
                        .execute()
                    
                    if last_msg_resp.data and len(last_msg_resp.data) > 0:
                        last_msg = last_msg_resp.data[0]
                        msg_created_at = last_msg["created_at"]
                        
                        if last_read_at is None:
                            # Never read - has unread
                            has_unread = True
                        elif msg_created_at > last_read_at:
                            # Message created after last read
                            has_unread = True
            except Exception as e:
                # If last_read_at column doesn't exist or other error, just skip
                logger.debug(f"Could not calculate has_unread for group {group_id}: {e}")
            
            groups_out.append(IdeaGroup(
                id=group["id"],
                organization_id=group["organization_id"],
                name=group["name"],
                description=group.get("description"),
                color=group.get("color", "#6366f1"),
                created_by=group["created_by"],
                created_at=group["created_at"],
                updated_at=group["updated_at"],
                member_count=len(members),
                item_count=item_count,
                members=members,
                is_admin=is_admin,
                has_unread=has_unread
            ))
        
        return groups_out

    except Exception as e:
        logger.error(f"Error fetching idea groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/containing", response_model=List[UUID])
async def get_groups_containing_item(
    note_id: Optional[UUID] = None,
    cluster_id: Optional[UUID] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get list of group IDs that contain the specified item.
    """
    try:
        if not note_id and not cluster_id:
            return []
            
        query = supabase.table("idea_group_items").select("idea_group_id")
        
        if note_id:
            query = query.eq("note_id", str(note_id))
        if cluster_id:
            query = query.eq("cluster_id", str(cluster_id))
            
        response = query.execute()
        
        if not response.data:
            return []
            
        return [item["idea_group_id"] for item in response.data]
    except Exception as e:
        logger.error(f"Error fetching containing groups: {e}")
        return []


@router.get("/unread-status")
async def get_groups_unread_status(current_user: CurrentUser = Depends(get_current_user)):
    """
    Check if the user has any unread messages across all their groups.
    """
    try:
        # Get user's group memberships with last_read_at, joining with groups to get updated_at
        response = supabase.table("idea_group_members")\
            .select("idea_group_id, last_read_at, idea_groups!inner(updated_at)")\
            .eq("user_id", str(current_user.id))\
            .execute()
            
        if not response.data:
            return {"has_unread": False}
            
        for item in response.data:
            last_read_at = item.get("last_read_at")
            group = item.get("idea_groups")
            
            if not group:
                continue
                
            updated_at = group.get("updated_at")
            
            if not updated_at:
                continue
            
            if last_read_at is None:
                # Never read - check if there are any messages
                msg_check = supabase.table("idea_group_messages")\
                    .select("id")\
                    .eq("idea_group_id", item["idea_group_id"])\
                    .limit(1)\
                    .execute()
                if msg_check.data:
                    return {"has_unread": True}
            elif updated_at > last_read_at:
                return {"has_unread": True}
                
        return {"has_unread": False}
    except Exception as e:
        logger.error(f"Error checking groups unread status: {e}")
        return {"has_unread": False}


@router.post("/", response_model=UUID)
async def create_idea_group(
    payload: IdeaGroupCreate,
    current_user: CurrentUser = Depends(require_board_or_owner)
):
    """
    Create a new idea group.
    Only OWNER/BOARD can create groups.
    """
    try:
        # Convert member IDs to strings
        member_ids_str = [str(uid) for uid in payload.member_ids]
        
        # Call RPC function
        response = supabase.rpc(
            "create_idea_group",
            {
                "p_organization_id": str(current_user.organization_id),
                "p_name": payload.name,
                "p_description": payload.description or "",
                "p_color": payload.color or "#6366f1",
                "p_member_ids": member_ids_str,
                "p_current_user_id": str(current_user.id)
            }
        ).execute()

        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create idea group")
        
        return response.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating idea group: {e}")
        if "Only OWNER or BOARD" in str(e):
            raise HTTPException(status_code=403, detail="Only OWNER or BOARD members can create idea groups")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{group_id}", response_model=IdeaGroup)
async def get_idea_group(
    group_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get a single idea group by ID.
    """
    try:
        # Verify user is a member
        member_check = supabase.table("idea_group_members")\
            .select("role")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        
        is_admin = member_check.data[0].get("role") == "admin"
        
        # Fetch group
        group_resp = supabase.table("idea_groups")\
            .select("*")\
            .eq("id", str(group_id))\
            .single()\
            .execute()
        
        if not group_resp.data:
            raise HTTPException(status_code=404, detail="Group not found")
        
        group = group_resp.data
        
        # Get members - specify explicit FK relation
        members_resp = supabase.table("idea_group_members")\
            .select("user_id, role, added_at, users!idea_group_members_user_id_fkey(id, first_name, last_name, job_title, email, avatar_url)")\
            .eq("idea_group_id", str(group_id))\
            .execute()
        
        members = []
        for m in (members_resp.data or []):
            user_data = m.get("users", {})
            members.append(GroupMemberInfo(
                id=user_data.get("id"),
                first_name=user_data.get("first_name"),
                last_name=user_data.get("last_name"),
                job_title=user_data.get("job_title"),
                email=user_data.get("email", ""),
                avatar_url=user_data.get("avatar_url"),
                role=m.get("role", "member"),
                added_at=m.get("added_at")
            ))
        
        # Get item count
        items_resp = supabase.table("idea_group_items")\
            .select("id", count="exact")\
            .eq("idea_group_id", str(group_id))\
            .execute()
        
        item_count = items_resp.count if hasattr(items_resp, 'count') and items_resp.count else len(items_resp.data or [])
        
        return IdeaGroup(
            id=group["id"],
            organization_id=group["organization_id"],
            name=group["name"],
            description=group.get("description"),
            color=group.get("color", "#6366f1"),
            created_by=group["created_by"],
            created_at=group["created_at"],
            updated_at=group["updated_at"],
            member_count=len(members),
            item_count=item_count,
            members=members,
            is_admin=is_admin
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching idea group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{group_id}", response_model=IdeaGroup)
async def update_idea_group(
    group_id: UUID,
    payload: IdeaGroupUpdate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Update an idea group.
    Only admins can update.
    """
    try:
        # Verify user is admin
        member_check = supabase.table("idea_group_members")\
            .select("role")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .eq("role", "admin")\
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="Only group admins can update the group")
        
        # Build update data
        update_data = {"updated_at": "now()"}
        if payload.name is not None:
            update_data["name"] = payload.name
        if payload.description is not None:
            update_data["description"] = payload.description
        if payload.color is not None:
            update_data["color"] = payload.color
        
        # Update
        supabase.table("idea_groups")\
            .update(update_data)\
            .eq("id", str(group_id))\
            .execute()
        
        # Return updated group
        return await get_idea_group(group_id, current_user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating idea group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from datetime import datetime, timezone

@router.put("/{group_id}", response_model=IdeaGroup)
async def update_group(
    group_id: UUID,
    payload: IdeaGroupUpdate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Update group details (name, color, description).
    Only the creator/owner can update.
    """
    try:
        # Verify ownership
        group = supabase.table("idea_groups").select("created_by").eq("id", str(group_id)).single().execute()
        if not group.data:
            raise HTTPException(status_code=404, detail="Group not found")
            
        if group_id and group.data["created_by"] != str(current_user.id):
             raise HTTPException(status_code=403, detail="Only the group creator can update it")

        update_data = {}
        if payload.name is not None:
            update_data["name"] = payload.name
        if payload.description is not None:
            update_data["description"] = payload.description
        if payload.color is not None:
             update_data["color"] = payload.color
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = supabase.table("idea_groups")\
            .update(update_data)\
            .eq("id", str(group_id))\
            .execute()
            
        if not response.data:
             raise HTTPException(status_code=500, detail="Failed to update group")
             
        updated_grp = response.data[0]
        # Return basic info
        return IdeaGroup(
             id=updated_grp["id"],
             organization_id=updated_grp["organization_id"],
             name=updated_grp["name"],
             description=updated_grp["description"],
             color=updated_grp["color"],
             created_by=updated_grp["created_by"],
             created_at=updated_grp["created_at"],
             updated_at=updated_grp["updated_at"],
             member_count=0, 
             item_count=0, 
             members=[], 
             is_admin=True
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{group_id}")
async def delete_idea_group(
    group_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Delete an idea group.
    Only admins can delete.
    """
    try:
        # Verify user is admin
        member_check = supabase.table("idea_group_members")\
            .select("role")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .eq("role", "admin")\
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="Only group admins can delete the group")
        
        # Delete group (cascade will delete members, items, messages)
        supabase.table("idea_groups")\
            .delete()\
            .eq("id", str(group_id))\
            .execute()
        
        return {"success": True, "message": "Group deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting idea group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# MEMBERS MANAGEMENT
# =====================================================

@router.post("/{group_id}/members")
async def add_member(
    group_id: UUID,
    request: AddMemberRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Add a member to a group.
    Only admins can add members.
    """
    try:
        # Call RPC
        response = supabase.rpc(
            "add_idea_group_member",
            {
                "p_group_id": str(group_id),
                "p_user_id": str(request.user_id),
                "p_current_user_id": str(current_user.id)
            }
        ).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to add member")
        
        return {"success": True, "message": "Member added"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding member: {e}")
        if "Only group admins" in str(e):
            raise HTTPException(status_code=403, detail="Only group admins can add members")
        if "not a member of this organization" in str(e):
            raise HTTPException(status_code=400, detail="User is not in your organization")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Remove a member from a group.
    Only admins can remove members.
    Cannot remove the creator.
    """
    try:
        # Call RPC
        response = supabase.rpc(
            "remove_idea_group_member",
            {
                "p_group_id": str(group_id),
                "p_user_id": str(user_id),
                "p_current_user_id": str(current_user.id)
            }
        ).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to remove member")
        
        return {"success": True, "message": "Member removed"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing member: {e}")
        if "Only group admins" in str(e):
            raise HTTPException(status_code=403, detail="Only group admins can remove members")
        if "Cannot remove the group creator" in str(e):
            raise HTTPException(status_code=400, detail="Cannot remove the group creator")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{group_id}/leave")
async def leave_group(
    group_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Leave a group.
    The creator cannot leave (must delete instead).
    """
    try:
        # Check if user is the creator
        group_resp = supabase.table("idea_groups")\
            .select("created_by")\
            .eq("id", str(group_id))\
            .single()\
            .execute()
        
        if not group_resp.data:
            raise HTTPException(status_code=404, detail="Group not found")
        
        if str(group_resp.data["created_by"]) == str(current_user.id):
            raise HTTPException(status_code=400, detail="Creator cannot leave. Delete the group instead.")
        
        # Remove self from group
        supabase.table("idea_group_members")\
            .delete()\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        return {"success": True, "message": "Left the group"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error leaving group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# ITEMS (IDEAS/NOTES) MANAGEMENT
# =====================================================

@router.get("/{group_id}/items", response_model=List[GroupItem])
async def get_group_items(
    group_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get all items (notes/clusters) in a group.
    """
    try:
        # Verify membership
        member_check = supabase.table("idea_group_members")\
            .select("user_id")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        
        # Get items
        items_resp = supabase.table("idea_group_items")\
            .select("*")\
            .eq("idea_group_id", str(group_id))\
            .order("added_at", desc=True)\
            .execute()
        
        items = []
        for item in (items_resp.data or []):
            item_data = GroupItem(
                id=item["id"],
                idea_group_id=item["idea_group_id"],
                note_id=item.get("note_id"),
                cluster_id=item.get("cluster_id"),
                added_by=item["added_by"],
                added_at=item["added_at"],
                item_type="note" if item.get("note_id") else "cluster"
            )
            
            # Enrich with full note/cluster data
            if item.get("note_id"):
                # Get full note data with cluster and pillar info
                note_resp = supabase.table("notes")\
                    .select("*, users!notes_user_id_fkey(first_name, last_name, avatar_url), clusters(title), pillars(name)")\
                    .eq("id", item["note_id"])\
                    .single()\
                    .execute()
                if note_resp.data:
                    note = note_resp.data
                    user_info = note.get("users", {}) or {}
                    cluster_info = note.get("clusters", {}) or {}
                    pillar_info = note.get("pillars", {}) or {}
                    
                    # Build title: prefer cluster title, then title_clarified  
                    item_data.title = cluster_info.get("title") or note.get("title_clarified") or note.get("content_clarified", "")[:80]
                    item_data.summary = note.get("content_clarified") or note.get("content_raw", "")
                    item_data.content_raw = note.get("content_raw", "")
                    item_data.category = pillar_info.get("name", "Uncategorized")
                    item_data.author_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or "Unknown"
                    item_data.author_avatar = user_info.get("avatar_url")
                    item_data.relevance_score = note.get("ai_relevance_score")
                    item_data.created_date = note.get("created_at")
                    item_data.status = note.get("status")
                    
                    # Get collaborators from cluster notes if cluster exists
                    cluster_id = note.get("cluster_id")
                    if cluster_id:
                        # Get all notes in the same cluster as collaborators
                        cluster_notes_resp = supabase.table("notes")\
                            .select("content_raw, created_at, users!notes_user_id_fkey(first_name, last_name, avatar_url)")\
                            .eq("cluster_id", cluster_id)\
                            .order("created_at")\
                            .execute()
                        
                        collaborators = []
                        for cn in (cluster_notes_resp.data or []):
                            cn_user = cn.get("users", {}) or {}
                            collaborators.append({
                                "name": f"{cn_user.get('first_name', '')} {cn_user.get('last_name', '')}".strip() or "Unknown",
                                "avatar_url": cn_user.get("avatar_url"),
                                "quote": cn.get("content_raw", "")[:150] + "..." if len(cn.get("content_raw", "")) > 150 else cn.get("content_raw", ""),
                                "date": cn.get("created_at")
                            })
                        item_data.collaborators = collaborators
                        item_data.note_count = len(collaborators)
                    else:
                        # Single note - author is the only contributor
                        item_data.collaborators = [{
                            "name": item_data.author_name,
                            "avatar_url": item_data.author_avatar,
                            "quote": item_data.content_raw[:150] + "..." if len(item_data.content_raw or "") > 150 else item_data.content_raw,
                            "date": str(item_data.created_date) if item_data.created_date else None
                        }]
                        item_data.note_count = 1
                        
            elif item.get("cluster_id"):
                cluster_resp = supabase.table("clusters")\
                    .select("title, note_count")\
                    .eq("id", item["cluster_id"])\
                    .single()\
                    .execute()
                if cluster_resp.data:
                    item_data.title = cluster_resp.data.get("title") or f"Cluster ({cluster_resp.data.get('note_count', 0)} notes)"
                    item_data.note_count = cluster_resp.data.get("note_count")
                    
                    # Get cluster notes as collaborators and use first note's content_clarified as summary
                    cluster_notes_resp = supabase.table("notes")\
                        .select("content_raw, content_clarified, created_at, users!notes_user_id_fkey(first_name, last_name, avatar_url)")\
                        .eq("cluster_id", item["cluster_id"])\
                        .order("created_at")\
                        .execute()
                    
                    collaborators = []
                    summaries = []
                    for cn in (cluster_notes_resp.data or []):
                        cn_user = cn.get("users", {}) or {}
                        collaborators.append({
                            "name": f"{cn_user.get('first_name', '')} {cn_user.get('last_name', '')}".strip() or "Unknown",
                            "avatar_url": cn_user.get("avatar_url"),
                            "quote": cn.get("content_raw", "")[:150] + "..." if len(cn.get("content_raw", "")) > 150 else cn.get("content_raw", ""),
                            "date": cn.get("created_at")
                        })
                        if cn.get("content_clarified"):
                            summaries.append(cn.get("content_clarified"))
                    item_data.collaborators = collaborators
                    # Use combined clarified content as summary
                    item_data.summary = " ".join(summaries[:2]) if summaries else ""
            
            items.append(item_data)
        
        return items

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching group items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{group_id}/items", response_model=GroupItem)
async def add_group_item(
    group_id: UUID,
    payload: GroupItemCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Add an item (note or cluster) to a group.
    """
    try:
        # Verify membership
        member_check = supabase.table("idea_group_members")\
            .select("user_id")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        
        # Validate that at least one ID is provided
        if not payload.note_id and not payload.cluster_id:
            raise HTTPException(status_code=400, detail="Must provide note_id or cluster_id")
        
        # Insert item
        insert_data = {
            "idea_group_id": str(group_id),
            "added_by": str(current_user.id)
        }
        if payload.note_id:
            insert_data["note_id"] = str(payload.note_id)
        if payload.cluster_id:
            insert_data["cluster_id"] = str(payload.cluster_id)
        
        response = supabase.table("idea_group_items")\
            .insert(insert_data)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to add item")
        
        item = response.data[0]
        return GroupItem(
            id=item["id"],
            idea_group_id=item["idea_group_id"],
            note_id=item.get("note_id"),
            cluster_id=item.get("cluster_id"),
            added_by=item["added_by"],
            added_at=item["added_at"],
            item_type="note" if item.get("note_id") else "cluster"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding group item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{group_id}/items/{item_id}")
async def remove_group_item(
    group_id: UUID,
    item_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Remove an item from a group.
    """
    try:
        # Verify membership
        member_check = supabase.table("idea_group_members")\
            .select("user_id")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        
        # Delete item
        supabase.table("idea_group_items")\
            .delete()\
            .eq("id", str(item_id))\
            .eq("idea_group_id", str(group_id))\
            .execute()
        
        return {"success": True, "message": "Item removed"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing group item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# MESSAGES
# =====================================================

@router.get("/{group_id}/messages", response_model=List[GroupMessage])
async def get_group_messages(
    group_id: UUID,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get messages for a group.
    """
    try:
        # Verify membership
        member_check = supabase.table("idea_group_members")\
            .select("user_id")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        
        # Get messages with sender info
        messages_resp = supabase.table("idea_group_messages")\
            .select("*, users(first_name, last_name, avatar_url)")\
            .eq("idea_group_id", str(group_id))\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        messages = []
        for msg in (messages_resp.data or []):
            user_info = msg.get("users", {})
            sender_name = None
            if user_info:
                first = user_info.get("first_name", "")
                last = user_info.get("last_name", "")
                sender_name = f"{first} {last}".strip() or None
            
            messages.append(GroupMessage(
                id=msg["id"],
                idea_group_id=msg["idea_group_id"],
                sender_id=msg["sender_id"],
                sender_name=sender_name,
                sender_avatar_url=user_info.get("avatar_url") if user_info else None,
                content=msg["content"],
                attachment_url=msg.get("attachment_url"),
                attachment_type=msg.get("attachment_type"),
                attachment_name=msg.get("attachment_name"),
                created_at=msg["created_at"]
            ))
        
        # Return in ascending order for display
        messages.reverse()
        return messages

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching group messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{group_id}/messages", response_model=GroupMessage)
async def send_group_message(
    group_id: UUID,
    payload: GroupMessageCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Send a message to a group.
    """
    try:
        # Verify membership
        member_check = supabase.table("idea_group_members")\
            .select("user_id")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        if not member_check.data:
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        
        # Build message data
        message_data = {
            "idea_group_id": str(group_id),
            "sender_id": str(current_user.id),
            "content": payload.content or ""
        }
        
        if payload.attachment_url:
            message_data["attachment_url"] = payload.attachment_url
            message_data["attachment_type"] = payload.attachment_type
            message_data["attachment_name"] = payload.attachment_name
        
        # Insert message
        response = supabase.table("idea_group_messages")\
            .insert(message_data)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to send message")
        
        msg = response.data[0]
        
        # Get sender info
        user_resp = supabase.table("users")\
            .select("first_name, last_name, avatar_url")\
            .eq("id", str(current_user.id))\
            .single()\
            .execute()
        
        user_info = user_resp.data or {}
        sender_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or None
        
        return GroupMessage(
            id=msg["id"],
            idea_group_id=msg["idea_group_id"],
            sender_id=msg["sender_id"],
            sender_name=sender_name,
            sender_avatar_url=user_info.get("avatar_url"),
            content=msg["content"],
            attachment_url=msg.get("attachment_url"),
            attachment_type=msg.get("attachment_type"),
            attachment_name=msg.get("attachment_name"),
            created_at=msg["created_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending group message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{group_id}/mark-read")
async def mark_group_as_read(
    group_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Mark a group as read (update last_read_at for current user).
    """
    try:
        from datetime import datetime, timezone
        
        # Verify user is member of this group
        membership = supabase.table("idea_group_members")\
            .select("idea_group_id")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
            
        if not membership.data:
            raise HTTPException(status_code=403, detail="Not a member of this group")
        
        # Update last_read_at
        supabase.table("idea_group_members")\
            .update({"last_read_at": datetime.now(timezone.utc).isoformat()})\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
            
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking group as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))
