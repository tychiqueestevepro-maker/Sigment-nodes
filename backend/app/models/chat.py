from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime

class ParticipantInfo(BaseModel):
    id: UUID
    first_name: Optional[str]
    last_name: Optional[str]
    job_title: Optional[str]
    email: str
    avatar_url: Optional[str] = None

class Conversation(BaseModel):
    id: UUID
    updated_at: datetime
    other_participant: Optional[ParticipantInfo] = None
    participants: List[ParticipantInfo] = []  # For groups: all participants except current user
    title: Optional[str] = None
    is_group: bool = False

class ConversationCreate(BaseModel):
    target_user_id: UUID

class GroupConversationCreate(BaseModel):
    title: str
    participant_ids: List[UUID]

class MessageCreate(BaseModel):
    content: Optional[str] = ""
    shared_post_id: Optional[UUID] = None

class Message(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: Optional[str] = ""
    shared_post_id: Optional[UUID] = None
    created_at: datetime
    is_read: bool = False

