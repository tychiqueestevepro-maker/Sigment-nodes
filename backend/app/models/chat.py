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

class Conversation(BaseModel):
    id: UUID
    updated_at: datetime
    other_participant: Optional[ParticipantInfo] = None

class ConversationCreate(BaseModel):
    target_user_id: UUID

class MessageCreate(BaseModel):
    content: str

class Message(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str
    created_at: datetime
    is_read: bool = False
