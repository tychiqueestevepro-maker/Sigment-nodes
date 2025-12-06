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
    has_unread: bool = False

class ConversationCreate(BaseModel):
    target_user_id: UUID

class GroupConversationCreate(BaseModel):
    title: str
    participant_ids: List[UUID]

class MessageCreate(BaseModel):
    content: Optional[str] = ""
    shared_post_id: Optional[UUID] = None
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None

class ReadReceipt(BaseModel):
    user_id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    read_at: datetime

class Message(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: Optional[str] = ""
    shared_post_id: Optional[UUID] = None
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None
    created_at: datetime
    is_read: bool = False
    read_by: List[ReadReceipt] = []

