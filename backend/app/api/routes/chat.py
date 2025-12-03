from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Body
from loguru import logger

from app.services.supabase_client import supabase
from app.api.dependencies import CurrentUser, get_current_user
from app.models.chat import Conversation, ConversationCreate, MessageCreate, Message, ParticipantInfo

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
        # 1. Get conversations where current user is a participant
        # We need to join with conversation_participants to filter by user, 
        # but also fetch ALL participants to find the "other" one.
        
        # Supabase/PostgREST is a bit tricky with "conversations where I am a participant".
        # The RLS policy "Users can view conversations they are in" handles the filtering of the conversations table itself.
        # So `supabase.table("conversations").select("*")` will only return relevant conversations.
        
        # We fetch conversations and nested participants + user details
        response = supabase.table("conversations")\
            .select("id, updated_at, conversation_participants(user_id, users(id, first_name, last_name, job_title, email))")\
            .order("updated_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
            
        if not response.data:
            return []
            
        conversations_out = []
        for conv in response.data:
            other_participant = None
            participants = conv.get("conversation_participants", [])
            
            # Find the participant that is NOT the current user
            for p in participants:
                u = p.get("users")
                if u and str(u.get("id")) != str(current_user.id):
                    other_participant = ParticipantInfo(
                        id=u.get("id"),
                        first_name=u.get("first_name"),
                        last_name=u.get("last_name"),
                        job_title=u.get("job_title"),
                        email=u.get("email")
                    )
                    break
            
            conversations_out.append(Conversation(
                id=conv["id"],
                updated_at=conv["updated_at"],
                other_participant=other_participant
            ))
            
        return conversations_out

    except Exception as e:
        logger.error(f"Error fetching conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start", response_model=UUID)
async def start_conversation(
    payload: ConversationCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get or create a conversation with a target user.
    """
    try:
        # Call the RPC function
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


@router.get("/{conversation_id}/messages", response_model=List[Message])
async def get_messages(
    conversation_id: UUID,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get messages for a conversation.
    """
    try:
        response = supabase.table("direct_messages")\
            .select("*")\
            .eq("conversation_id", str(conversation_id))\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
            
        return response.data if response.data else []

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
        # Insert message
        response = supabase.table("direct_messages").insert({
            "conversation_id": str(conversation_id),
            "sender_id": str(current_user.id),
            "content": message.content
        }).execute()
        
        if not response.data:
             raise HTTPException(status_code=403, detail="Could not send message (check permissions)")
             
        return response.data[0]

    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
