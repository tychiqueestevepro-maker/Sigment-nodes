"""
Pydantic models for Notes
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    """Note creation payload from frontend"""
    content_raw: str = Field(..., min_length=10, max_length=5000)
    user_id: UUID


class NoteSync(BaseModel):
    """Batch sync payload from offline-first frontend"""
    notes: List[NoteCreate]


class NoteResponse(BaseModel):
    """Note response model"""
    id: UUID
    user_id: UUID
    content_raw: str
    content_clarified: Optional[str] = None
    pillar_id: Optional[UUID] = None
    cluster_id: Optional[UUID] = None
    ai_relevance_score: Optional[float] = None
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None


class NoteUpdate(BaseModel):
    """Admin note update (for moderation)"""
    status: Optional[str] = None
    cluster_id: Optional[UUID] = None


class UserContext(BaseModel):
    """User context for AI scoring"""
    job_title: str
    department: str
    seniority_level: int

