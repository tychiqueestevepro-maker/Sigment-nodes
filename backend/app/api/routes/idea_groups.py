"""
Idea Groups API Routes optimized for performance.
Uses synchronous route handlers to avoid blocking the event loop with sync DB calls.
Uses SQL RPCs for heavy data fetching to avoid N+1 queries.
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Body
from loguru import logger

from app.services.supabase_client import supabase
from app.api.dependencies import CurrentUser, get_current_user, require_board_or_owner
from app.models.idea_groups import (
    IdeaGroupCreate, IdeaGroupUpdate, AddMemberRequest, GroupMessageCreate,
    GroupItemCreate, IdeaGroup, GroupMemberInfo, GroupMessage, GroupItem
)

router = APIRouter(redirect_slashes=False)


# =====================================================
# GROUPS CRUD
# =====================================================

@router.get("", response_model=List[IdeaGroup])
def get_idea_groups(
    current_user: CurrentUser = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Get all idea groups the current user is a member of.
    Uses 'get_user_idea_groups_optimized' RPC for maximum performance.
    """
    # Optimized RPC attempt
    try:
        rpc_response = supabase.rpc(
            'get_user_idea_groups_optimized',
            {
                'p_user_id': str(current_user.id),
                'p_org_id': str(current_user.organization_id),
                'p_limit': limit,
                'p_offset': offset
            }
        ).execute()
        
        if rpc_response.data is not None:
            return rpc_response.data
            
    except Exception as rpc_error:
        logger.warning(f"⚠️ Groups RPC not available, using fallback: {rpc_error}")

    # Fallback to Python implementation
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
            
            # Get member count
            members_resp = supabase.table("idea_group_members")\
                .select("user_id, role, added_at, users!idea_group_members_user_id_fkey(id, first_name, last_name, job_title, email, avatar_url)")\
                .eq("idea_group_id", group_id)\
                .execute()
            
            members = []
            is_admin = False
            for m in (members_resp.data or []):
                user_data = m.get("users") or {}
                if not user_data.get("id"):
                    continue # Skip invalid members
                    
                try:
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
                    if str(user_data.get("id")) == str(current_user.id) and m.get("role") == "admin":
                        is_admin = True
                except Exception as mem_err:
                     logger.warning(f"Skipping invalid member: {mem_err}")
                     continue
            
            # Get item count
            items_resp = supabase.table("idea_group_items")\
                .select("id", count="exact")\
                .eq("idea_group_id", group_id)\
                .execute()
            
            item_count = items_resp.count if hasattr(items_resp, 'count') and items_resp.count else len(items_resp.data or [])
            
            # Unread check (simplified for fallback)
            has_unread = False
            try:
                # Check if last msg > last read
                membership = next((m for m in (members_resp.data or []) if str(m.get("user_id")) == str(current_user.id)), None)
                if membership:
                    last_read = membership.get("last_read_at")
                    # Get latest msg
                    last_msg = supabase.table("idea_group_messages")\
                        .select("created_at")\
                        .eq("idea_group_id", group_id)\
                        .order("created_at", desc=True)\
                        .limit(1)\
                        .execute()
                    
                    if last_msg.data:
                         msg_time = last_msg.data[0]["created_at"]
                         if not last_read or msg_time > last_read:
                             has_unread = True
            except:
                pass
            
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
        return []


@router.get("/containing", response_model=List[UUID])
def get_groups_containing_item(
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
def get_groups_unread_status(current_user: CurrentUser = Depends(get_current_user)):
    """
    Get count of groups with unread messages.
    A group is unread only if:
    - The last message was sent by someone OTHER than the current user
    - AND the user hasn't read it yet (last_read_at < last message time)
    """
    unread_count = 0
    user_id = str(current_user.id)
    
    try:
        # Try optimized RPC first
        try:
            rpc_response = supabase.rpc(
                'get_user_idea_groups_optimized',
                {
                    'p_user_id': user_id,
                    'p_org_id': str(current_user.organization_id),
                    'p_limit': 100, 
                    'p_offset': 0
                }
            ).execute()
            
            if rpc_response.data:
                for group in rpc_response.data:
                    if group.get('has_unread', False):
                        unread_count += 1
                        
            return {"has_unread": unread_count > 0, "unread_groups_count": unread_count}
        except Exception as rpc_err:
            logger.warning(f"Groups RPC not available: {rpc_err}")
        
        # Fallback: Count groups with unread in Python
        # Get user's group memberships
        memberships = supabase.table("idea_group_members")\
            .select("idea_group_id, last_read_at")\
            .eq("user_id", user_id)\
            .execute()
        
        if not memberships.data:
            return {"has_unread": False, "unread_groups_count": 0}
        
        for membership in memberships.data:
            group_id = membership.get("idea_group_id")
            last_read = membership.get("last_read_at")
            
            # Get the last message in this group that was NOT sent by current user
            last_msg_resp = supabase.table("idea_group_messages")\
                .select("created_at, sender_id")\
                .eq("idea_group_id", group_id)\
                .neq("sender_id", user_id)\
                .order("created_at", desc=True)\
                .limit(1)\
                .execute()
            
            if last_msg_resp.data and len(last_msg_resp.data) > 0:
                last_msg = last_msg_resp.data[0]
                msg_created = last_msg.get("created_at")
                
                # If never read OR last read before this message
                if not last_read or (msg_created and msg_created > last_read):
                    unread_count += 1
                    
        return {"has_unread": unread_count > 0, "unread_groups_count": unread_count}
        
    except Exception as e:
        logger.error(f"Error checking groups unread status: {e}")
        return {"has_unread": False, "unread_groups_count": 0}


@router.post("", response_model=UUID)
def create_idea_group(
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
def get_idea_group(
    group_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get a single idea group by ID.
    Reuses the logic but for a single item (not fully RPC optimized yet because getting single via RPC is overkill if lists work, 
    but for consistency we use standard fetch here as 'get_user_idea_groups_optimized' is for lists).
    However, we need consistent fields.
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
        
        # Get members
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
            is_admin=is_admin,
            has_unread=False # Detail view doesn't need unread flag usually, or we can fetch it
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching idea group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{group_id}", response_model=IdeaGroup)
def update_idea_group(
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
        return get_idea_group(group_id, current_user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating idea group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{group_id}", response_model=IdeaGroup)
def update_group(
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
def delete_idea_group(
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
def add_member(
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
def remove_member(
    group_id: UUID,
    user_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Remove a member from a group.
    Only admins can remove members.
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
def leave_group(
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
def get_group_items(
    group_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get all items (notes/clusters) in a group.
    Uses 'get_group_items_enriched' RPC for performance.
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
        
        # Try optimized RPC
        try:
            rpc_response = supabase.rpc(
                'get_group_items_enriched',
                { 'p_group_id': str(group_id) }
            ).execute()
            
            if rpc_response.data:
                return rpc_response.data
        except Exception as rpc_error:
            logger.warning(f"⚠️ Group Items RPC not available: {rpc_error}")
            
        # Fallback to standard fetching
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
            
            # Enrich with full note/cluster data (simplified for fallback)
            try:
                if item.get("note_id"):
                    note_resp = supabase.table("notes")\
                        .select("*, users(first_name, last_name, avatar_url), clusters(title), pillars(name)")\
                        .eq("id", item["note_id"])\
                        .single()\
                        .execute()
                    if note_resp.data:
                        note = note_resp.data
                        user_info = note.get("users", {}) or {}
                        cluster_info = note.get("clusters", {}) or {}
                        pillar_info = note.get("pillars", {}) or {}
                        
                        item_data.title = cluster_info.get("title") or note.get("title_clarified") or note.get("content_clarified", "")[:80]
                        item_data.summary = note.get("content_clarified") or note.get("content_raw", "")
                        item_data.content_raw = note.get("content_raw", "")
                        item_data.category = pillar_info.get("name", "Uncategorized")
                        item_data.author_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or "Unknown"
                        item_data.author_avatar = user_info.get("avatar_url")
                        item_data.relevance_score = note.get("ai_relevance_score")
                        item_data.created_date = note.get("created_at")
                        item_data.status = note.get("status")
                        
                        # Mock collaborators/count in fallback for speed
                        item_data.collaborators = [{
                            "name": item_data.author_name,
                            "avatar_url": item_data.author_avatar,
                            "quote": item_data.summary[:100],
                            "date": str(item_data.created_date)
                        }]
                        item_data.note_count = 1
                            
                elif item.get("cluster_id"):
                    cluster_resp = supabase.table("clusters")\
                        .select("title, note_count")\
                        .eq("id", item["cluster_id"])\
                        .single()\
                        .execute()
                    if cluster_resp.data:
                        item_data.title = cluster_resp.data.get("title")
                        item_data.note_count = cluster_resp.data.get("note_count")
            except Exception as e:
                logger.error(f"Error enriching item {item['id']}: {e}")
            
            items.append(item_data)
        
        return items

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching group items: {e}")
        return []


@router.post("/{group_id}/items", response_model=GroupItem)
def add_group_item(
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
        # Return basic item structure for now, frontend typically refreshes list
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
def remove_group_item(
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
def get_group_messages(
    group_id: UUID,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get messages for a group (OPTIMIZED).
    Uses single SQL RPC call for maximum performance.
    """
    try:
        # Try optimized RPC first
        try:
            rpc_response = supabase.rpc(
                'get_group_messages_optimized',
                {
                    'p_group_id': str(group_id),
                    'p_user_id': str(current_user.id),
                    'p_limit': limit,
                    'p_offset': offset
                }
            ).execute()
            
            if rpc_response.data is not None:
                # Pydantic will parse the JSON list directly
                return rpc_response.data
                
        except Exception as rpc_error:
            logger.warning(f"⚠️ Group Messages RPC not available: {rpc_error}")
            
        # Fallback to original logic
        
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
        
        # Get all group members with their last_read_at for read receipts
        members_last_read = supabase.table("idea_group_members")\
            .select("user_id, last_read_at, users!idea_group_members_user_id_fkey(first_name, last_name)")\
            .eq("idea_group_id", str(group_id))\
            .neq("user_id", str(current_user.id))\
            .execute()
        
        members_data = members_last_read.data or []
        
        messages = []
        for msg in (messages_resp.data or []):
            user_info = msg.get("users", {})
            sender_name = None
            if user_info:
                first = user_info.get("first_name", "")
                last = user_info.get("last_name", "")
                sender_name = f"{first} {last}".strip() or None
            
            # Calculate read_by (only for own messages)
            read_by = []
            if msg["sender_id"] == str(current_user.id):
                msg_time = msg["created_at"]
                for m in members_data:
                    if m.get("last_read_at") and m.get("last_read_at") >= msg_time:
                        u_info = m.get("users") or {}
                        read_by.append({
                            "user_id": m["user_id"],
                            "first_name": u_info.get("first_name"),
                            "last_name": u_info.get("last_name"),
                            "read_at": m["last_read_at"]
                        })
            
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
                created_at=msg["created_at"],
                read_by=read_by
            ))
        
        # Return in ascending order for display
        messages.reverse()
        return messages

    except Exception as e:
        logger.error(f"Error fetching group messages: {e}")
        return []


@router.post("/{group_id}/messages", response_model=GroupMessage)
def send_group_message(
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
        
        # Update sender's last_read_at
        supabase.table("idea_group_members")\
            .update({"last_read_at": datetime.now(timezone.utc).isoformat()})\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        # Get sender info (lightweight fetch)
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
            created_at=msg["created_at"],
            read_by=[]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending group message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{group_id}/mark-read")
def mark_group_as_read(
    group_id: UUID,
    payload: dict = Body(default={}),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Mark a group as read.
    Accepts optional 'last_message_created_at' in payload to set precise read time.
    Otherwise sets to current server time.
    """
    try:
        # Verify user is member
        membership = supabase.table("idea_group_members")\
            .select("idea_group_id")\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
            
        if not membership.data:
            raise HTTPException(status_code=403, detail="Not a member of this group")
        
        # Determine timestamp
        read_at = datetime.now(timezone.utc).isoformat()
        if payload and 'last_message_created_at' in payload:
            read_at = payload['last_message_created_at']

        # Update last_read_at
        supabase.table("idea_group_members")\
            .update({"last_read_at": read_at})\
            .eq("idea_group_id", str(group_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
            
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking group as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))
