from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class MessageCreate(BaseModel):
    content: str

class ConversationStart(BaseModel):
    target_user_id: UUID

class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str
    is_read: bool
    created_at: datetime

class ParticipantInfo(BaseModel):
    id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    job_title: Optional[str] = None
    email: Optional[str] = None

class ConversationOut(BaseModel):
    id: UUID
    updated_at: datetime
    other_participant: Optional[ParticipantInfo] = None
    last_message: Optional[str] = None
