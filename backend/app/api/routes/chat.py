from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Body
from loguru import logger

from app.services.supabase_client import supabase
from app.api.dependencies import CurrentUser, get_current_user
from app.models.chat import Conversation, ConversationCreate, GroupConversationCreate, MessageCreate, Message, ParticipantInfo

router = APIRouter()

@router.get("/", response_model=List[Conversation])
async def get_conversations(
    current_user: CurrentUser = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Get all conversations for the current user.
    Sorted by updated_at descending.
    Includes details of the OTHER participant.
    """
    try:
        # 1. Get IDs of conversations where current user is a participant (not deleted)
        # Also get last_read_at for unread indicator
        user_convs = supabase.table("conversation_participants")\
            .select("conversation_id, last_read_at")\
            .eq("user_id", str(current_user.id))\
            .is_("deleted_at", "null")\
            .execute()
            
        if not user_convs.data:
            return []
        
        # Create a map of conversation_id -> last_read_at
        last_read_map = {item["conversation_id"]: item.get("last_read_at") for item in user_convs.data}
        my_conversation_ids = list(last_read_map.keys())

        # 2. Fetch full conversation details for these IDs
        # Include deleted_at to filter out members who have left
        response = supabase.table("conversations")\
            .select("id, updated_at, title, is_group, conversation_participants(user_id, deleted_at, users(id, first_name, last_name, job_title, email, avatar_url))")\
            .in_("id", my_conversation_ids)\
            .order("updated_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
            
        if not response.data:
            return []
            
        conversations_out = []
        for conv in response.data:
            other_participant = None
            all_participants = []
            participants = conv.get("conversation_participants", [])
            
            # Collect all participants except current user and those who have left (deleted_at not null)
            for p in participants:
                # Skip participants who have left the group
                if p.get("deleted_at") is not None:
                    continue
                    
                u = p.get("users")
                if u and str(u.get("id")) != str(current_user.id):
                    participant_info = ParticipantInfo(
                        id=u.get("id"),
                        first_name=u.get("first_name"),
                        last_name=u.get("last_name"),
                        job_title=u.get("job_title"),
                        email=u.get("email"),
                        avatar_url=u.get("avatar_url")
                    )
                    all_participants.append(participant_info)
                    # Keep first one as other_participant for 1-on-1 chats
                    if other_participant is None:
                        other_participant = participant_info
            
            # Calculate has_unread based on last_read_at vs updated_at
            conv_id = conv["id"]
            last_read_at = last_read_map.get(conv_id)
            updated_at = conv["updated_at"]
            has_unread = False
            if last_read_at is None:
                # Never read - has unread if there are any messages
                has_unread = True
            elif updated_at and last_read_at:
                has_unread = updated_at > last_read_at
            
            conversations_out.append(Conversation(
                id=conv["id"],
                updated_at=conv["updated_at"],
                other_participant=other_participant,
                participants=all_participants,
                title=conv.get("title"),
                is_group=conv.get("is_group", False),
                has_unread=has_unread
            ))
            
        return conversations_out

    except Exception as e:
        logger.error(f"Error fetching conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/unread-status")
async def get_unread_status(current_user: CurrentUser = Depends(get_current_user)):
    """
    Check if the user has any unread messages across all conversations.
    """
    try:
        # Get user's conversations and last_read_at, joining with conversations to get updated_at
        response = supabase.table("conversation_participants")\
            .select("conversation_id, last_read_at, conversations!inner(updated_at)")\
            .eq("user_id", str(current_user.id))\
            .is_("deleted_at", "null")\
            .execute()
            
        if not response.data:
            return {"has_unread": False}
            
        for item in response.data:
            last_read_at = item.get("last_read_at")
            conversation = item.get("conversations")
            
            if not conversation:
                continue
                
            updated_at = conversation.get("updated_at")
            
            if not updated_at:
                continue
            
            if last_read_at is None:
                return {"has_unread": True}
            
            if updated_at > last_read_at:
                return {"has_unread": True}
                
        return {"has_unread": False}
    except Exception as e:
        logger.error(f"Error checking unread status: {e}")
        return {"has_unread": False}


@router.post("/start", response_model=UUID)
async def start_conversation(
    payload: ConversationCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get or create a conversation with a target user.
    If a soft-deleted conversation exists, restore it.
    """
    try:
        # First, check if there's a soft-deleted conversation to restore
        # Find conversations where both users are participants
        user_convs = supabase.table("conversation_participants")\
            .select("conversation_id")\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        if user_convs.data:
            conv_ids = [c["conversation_id"] for c in user_convs.data]
            
            # Check if target user is in any of these conversations (1-1 only)
            for conv_id in conv_ids:
                # Get conversation to check if it's 1-1
                conv = supabase.table("conversations")\
                    .select("id, is_group")\
                    .eq("id", conv_id)\
                    .eq("is_group", False)\
                    .execute()
                
                if conv.data:
                    # Check if target user is participant
                    target_in_conv = supabase.table("conversation_participants")\
                        .select("conversation_id, deleted_at")\
                        .eq("conversation_id", conv_id)\
                        .eq("user_id", str(payload.target_user_id))\
                        .execute()
                    
                    if target_in_conv.data:
                        # Found existing conversation! Check if current user's entry is deleted
                        my_entry = supabase.table("conversation_participants")\
                            .select("conversation_id, deleted_at")\
                            .eq("conversation_id", conv_id)\
                            .eq("user_id", str(current_user.id))\
                            .execute()
                        
                        if my_entry.data and my_entry.data[0].get("deleted_at"):
                            from datetime import datetime
                            now = datetime.utcnow().isoformat()
                            # Restore the soft-deleted conversation
                            # Set messages_visible_from to now so old messages are hidden
                            supabase.table("conversation_participants")\
                                .update({
                                    "deleted_at": None,
                                    "messages_visible_from": now
                                })\
                                .eq("conversation_id", conv_id)\
                                .eq("user_id", str(current_user.id))\
                                .execute()
                            logger.info(f"Restored soft-deleted conversation {conv_id}, messages visible from {now}")
                            return conv_id
        
        # Call the RPC function for new conversation
        response = supabase.rpc(
            "get_or_create_conversation",
            {
                "p_organization_id": str(current_user.organization_id),
                "p_target_user_id": str(payload.target_user_id),
                "p_current_user_id": str(current_user.id)
            }
        ).execute()

        if not response.data:
             raise HTTPException(status_code=500, detail="Failed to get or create conversation")
        
        return response.data

    except Exception as e:
        logger.error(f"Error starting conversation: {e}")
        if "Target user is not a member" in str(e):
             raise HTTPException(status_code=400, detail="Target user is not in your organization")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/group", response_model=UUID)
async def create_group_conversation(
    payload: GroupConversationCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Create a new group conversation.
    """
    try:
        # Convert UUIDs to strings
        participant_ids_str = [str(uid) for uid in payload.participant_ids]
        
        # Call the RPC function
        response = supabase.rpc(
            "create_group_conversation",
            {
                "p_organization_id": str(current_user.organization_id),
                "p_title": payload.title,
                "p_participant_ids": participant_ids_str,
                "p_current_user_id": str(current_user.id)
            }
        ).execute()

        if not response.data:
             raise HTTPException(status_code=500, detail="Failed to create group conversation")
        
        return response.data

    except Exception as e:
        logger.error(f"Error creating group conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: UUID,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get messages for a conversation, with shared post data if applicable.
    Filters messages based on user's messages_visible_from timestamp.
    """
    try:
        # First, get the user's participant record to check messages_visible_from
        participant = supabase.table("conversation_participants")\
            .select("messages_visible_from")\
            .eq("conversation_id", str(conversation_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        messages_visible_from = None
        if participant.data and participant.data[0].get("messages_visible_from"):
            messages_visible_from = participant.data[0]["messages_visible_from"]
        
        # Build query
        query = supabase.table("direct_messages")\
            .select("*")\
            .eq("conversation_id", str(conversation_id))
        
        # Filter by messages_visible_from if set
        if messages_visible_from:
            query = query.gte("created_at", messages_visible_from)
        
        response = query\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        if not response.data:
            return []
            
        messages = response.data
        
        # Collect shared post IDs
        shared_post_ids = [
            msg["shared_post_id"] for msg in messages 
            if msg.get("shared_post_id")
        ]
        
        # Fetch shared posts if any
        shared_posts_map = {}
        if shared_post_ids:
            try:
                posts_resp = supabase.table("posts").select(
                    "id, content, media_urls, post_type, likes_count, comments_count, user_id, users(first_name, last_name, avatar_url)"
                ).in_("id", shared_post_ids).execute()
                
                for post in (posts_resp.data or []):
                    user_info = post.get("users") or {}
                    shared_posts_map[post["id"]] = {
                        "id": post["id"],
                        "content": post.get("content", ""),
                        "media_urls": post.get("media_urls"),
                        "post_type": post.get("post_type", "standard"),
                        "likes_count": post.get("likes_count", 0),
                        "comments_count": post.get("comments_count", 0),
                        "user_info": {
                            "first_name": user_info.get("first_name"),
                            "last_name": user_info.get("last_name"),
                            "avatar_url": user_info.get("avatar_url"),
                        },
                        "poll": None
                    }
                
                # Fetch polls for poll-type posts
                poll_post_ids = [
                    post["id"] for post in (posts_resp.data or []) 
                    if post.get("post_type") == "poll"
                ]
                
                if poll_post_ids:
                    polls_resp = supabase.table("polls").select(
                        "id, post_id, question, allow_multiple, poll_options(id, option_text, display_order)"
                    ).in_("post_id", poll_post_ids).execute()
                    
                    for poll in (polls_resp.data or []):
                        post_id = poll.get("post_id")
                        if post_id and post_id in shared_posts_map:
                            options = poll.get("poll_options") or []
                            options.sort(key=lambda x: x.get("display_order", 0))
                            shared_posts_map[post_id]["poll"] = {
                                "question": poll.get("question", ""),
                                "options": [{"text": opt.get("option_text", "")} for opt in options]
                            }
                            
            except Exception as post_error:
                logger.warning(f"Failed to fetch shared posts: {post_error}")
        
        # Get all other participants to check read receipts
        other_participants = supabase.table("conversation_participants")\
            .select("user_id, last_read_at, users(first_name, last_name)")\
            .eq("conversation_id", str(conversation_id))\
            .neq("user_id", str(current_user.id))\
            .execute()
        
        participants_data = other_participants.data or []

        # Enrich messages with shared post data AND read receipts
        enriched_messages = []
        for msg in messages:
            enriched = {**msg}
            
            # Enrich Shared Post
            if msg.get("shared_post_id") and msg["shared_post_id"] in shared_posts_map:
                enriched["shared_post"] = shared_posts_map[msg["shared_post_id"]]
            
            # Calculate Read Receipts (only for own messages)
            read_by = []
            if msg["sender_id"] == str(current_user.id):
                msg_time = msg["created_at"]
                for p in participants_data:
                    # Check if participant read this message (last_read_at >= created_at)
                    if p.get("last_read_at") and p.get("last_read_at") >= msg_time:
                        u_info = p.get("users") or {}
                        read_by.append({
                            "user_id": p["user_id"],
                            "first_name": u_info.get("first_name"),
                            "last_name": u_info.get("last_name"),
                            "read_at": p["last_read_at"]
                        })
            
            enriched["read_by"] = read_by
            enriched_messages.append(enriched)
            
        return enriched_messages

    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{conversation_id}/messages", response_model=Message)
async def send_message(
    conversation_id: UUID,
    message: MessageCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Send a message to a conversation.
    """
    try:
        # Build message payload
        message_data = {
            "conversation_id": str(conversation_id),
            "sender_id": str(current_user.id),
            "content": message.content or ""
        }
        
        # Add shared post reference if provided
        if message.shared_post_id:
            message_data["shared_post_id"] = str(message.shared_post_id)
        
        # Add attachment info if provided
        if message.attachment_url:
            message_data["attachment_url"] = message.attachment_url
            message_data["attachment_type"] = message.attachment_type
            message_data["attachment_name"] = message.attachment_name

        # Insert message
        response = supabase.table("direct_messages").insert(message_data).execute()
        
        if not response.data:
             raise HTTPException(status_code=403, detail="Could not send message (check permissions)")
             
        return response.data[0]

    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{conversation_id}/read")
async def mark_conversation_as_read(
    conversation_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Mark a conversation as read by updating last_read_at.
    """
    from datetime import datetime
    
    try:
        supabase.table("conversation_participants")\
            .update({"last_read_at": datetime.utcnow().isoformat()})\
            .eq("conversation_id", str(conversation_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Error marking conversation as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{conversation_id}/members")
async def add_member_to_group(
    conversation_id: UUID,
    member_id: UUID = Body(..., embed=True),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Add a member to a group conversation.
    Only works for group conversations.
    If member previously left (deleted_at set), restore them.
    """
    from datetime import datetime
    
    try:
        # 1. Verify conversation exists and is a group
        conv_response = supabase.table("conversations")\
            .select("id, is_group")\
            .eq("id", str(conversation_id))\
            .single()\
            .execute()
        
        if not conv_response.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if not conv_response.data.get("is_group"):
            raise HTTPException(status_code=400, detail="Can only add members to group conversations")
        
        # 2. Verify current user is a participant (has permission to add)
        participant_check = supabase.table("conversation_participants")\
            .select("user_id, deleted_at")\
            .eq("conversation_id", str(conversation_id))\
            .eq("user_id", str(current_user.id))\
            .is_("deleted_at", "null")\
            .execute()
        
        if not participant_check.data:
            raise HTTPException(status_code=403, detail="You are not a member of this conversation")
        
        # 3. Check if member exists in the conversation (including those who left)
        existing_check = supabase.table("conversation_participants")\
            .select("user_id, deleted_at")\
            .eq("conversation_id", str(conversation_id))\
            .eq("user_id", str(member_id))\
            .execute()
        
        if existing_check.data:
            # Member exists - check if they left (deleted_at not null)
            if existing_check.data[0].get("deleted_at") is not None:
                # Restore the member with messages_visible_from = now
                now = datetime.utcnow().isoformat()
                supabase.table("conversation_participants")\
                    .update({
                        "deleted_at": None,
                        "messages_visible_from": now
                    })\
                    .eq("conversation_id", str(conversation_id))\
                    .eq("user_id", str(member_id))\
                    .execute()
                logger.info(f"Restored member {member_id} to group {conversation_id}")
            else:
                # Member is already active
                raise HTTPException(status_code=400, detail="User is already a member of this group")
        else:
            # 4. Add the new member
            response = supabase.table("conversation_participants").insert({
                "conversation_id": str(conversation_id),
                "user_id": str(member_id)
            }).execute()
            
            if not response.data:
                raise HTTPException(status_code=500, detail="Failed to add member")
        
        # 5. Update conversation's updated_at
        supabase.table("conversations")\
            .update({"updated_at": "now()"})\
            .eq("id", str(conversation_id))\
            .execute()
        
        return {"success": True, "message": "Member added successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding member to group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{conversation_id}")
async def rename_group(
    conversation_id: UUID,
    title: str = Body(..., embed=True),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Rename a group conversation.
    Only works for group conversations.
    """
    try:
        # 1. Verify conversation exists and is a group
        conv_response = supabase.table("conversations")\
            .select("id, is_group")\
            .eq("id", str(conversation_id))\
            .single()\
            .execute()
        
        if not conv_response.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if not conv_response.data.get("is_group"):
            raise HTTPException(status_code=400, detail="Can only rename group conversations")
        
        # 2. Verify current user is a participant
        participant_check = supabase.table("conversation_participants")\
            .select("user_id")\
            .eq("conversation_id", str(conversation_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
        
        if not participant_check.data:
            raise HTTPException(status_code=403, detail="You are not a member of this conversation")
        
        # 3. Update the title
        response = supabase.table("conversations")\
            .update({"title": title, "updated_at": "now()"})\
            .eq("id", str(conversation_id))\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to rename group")
        
        return {"success": True, "title": title}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error renaming group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_chat_attachment(
    file: str = Body(...),  # base64 encoded
    filename: str = Body(...),
    content_type: str = Body(...),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Upload a file attachment for chat messages.
    Returns the public URL of the uploaded file.
    """
    import uuid as uuid_module
    from datetime import datetime
    import base64
    
    try:
        # Decode base64 file
        file_bytes = base64.b64decode(file)
        
        # Generate unique filename
        ext = filename.split('.')[-1] if '.' in filename else ''
        unique_filename = f"{current_user.id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid_module.uuid4().hex[:8]}.{ext}"
        
        # Upload to Supabase Storage
        response = supabase.storage.from_("chat-attachments").upload(
            path=unique_filename,
            file=file_bytes,
            file_options={"content-type": content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_("chat-attachments").get_public_url(unique_filename)
        
        return {
            "url": public_url,
            "filename": filename,
            "content_type": content_type
        }

    except Exception as e:
        logger.error(f"Error uploading chat attachment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Soft delete a conversation for the current user.
    This marks the user's participation as deleted.
    The other participant can still see the conversation.
    """
    from datetime import datetime
    
    try:
        # Check if user is a participant
        participant = supabase.table("conversation_participants")\
            .select("conversation_id")\
            .eq("conversation_id", str(conversation_id))\
            .eq("user_id", str(current_user.id))\
            .is_("deleted_at", "null")\
            .execute()
            
        if not participant.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Soft delete: set deleted_at timestamp
        supabase.table("conversation_participants")\
            .update({"deleted_at": datetime.utcnow().isoformat()})\
            .eq("conversation_id", str(conversation_id))\
            .eq("user_id", str(current_user.id))\
            .execute()
            
        logger.info(f"User {current_user.id} soft-deleted conversation {conversation_id}")
        
        return {"message": "Conversation deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
