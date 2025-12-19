"""
Pydantic models for Projects system
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


# --- Base Models ---

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"


class ProjectCreate(ProjectBase):
    member_ids: List[UUID] = []
    lead_id: Optional[UUID] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None



class SimpleProjectMember(BaseModel):
    """Simplified member model for project lists"""
    id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None


class Project(ProjectBase):
    id: UUID
    organization_id: UUID
    created_by: UUID
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Computed fields (from joins/aggregations)
    member_count: int = 0
    item_count: int = 0
    is_lead: bool = False
    has_unread: bool = False
    members: List[SimpleProjectMember] = []


# --- Member Models ---

class ProjectMemberBase(BaseModel):
    user_id: UUID
    role: str = "member"


class ProjectMemberCreate(BaseModel):
    user_id: UUID


class ProjectMember(ProjectMemberBase):
    id: UUID
    project_id: UUID
    joined_at: datetime
    last_read_at: Optional[datetime] = None
    
    # User info (from join)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None


# --- Message Models ---

class ProjectMessageReadReceipt(BaseModel):
    user_id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    read_at: datetime


class ProjectMessageBase(BaseModel):
    content: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None
    shared_note_id: Optional[UUID] = None
    shared_post_id: Optional[UUID] = None


class ProjectMessageCreate(ProjectMessageBase):
    pass


class ProjectMessage(ProjectMessageBase):
    id: UUID
    project_id: UUID
    sender_id: UUID
    sender_name: Optional[str] = None
    sender_avatar_url: Optional[str] = None
    created_at: datetime
    read_by: List[ProjectMessageReadReceipt] = []
    is_system_message: bool = False
    
    # Shared content (from joins)
    shared_note: Optional[dict] = None
    shared_post: Optional[dict] = None


# --- Item Models ---

class ProjectItemCreate(BaseModel):
    note_id: Optional[UUID] = None
    cluster_id: Optional[UUID] = None


class ProjectItem(BaseModel):
    id: UUID
    project_id: UUID
    note_id: Optional[UUID] = None
    cluster_id: Optional[UUID] = None
    added_by: UUID
    added_at: datetime
    
    # Item details (from joins)
    note: Optional[dict] = None
    cluster: Optional[dict] = None


# --- Response Models ---

class AddMemberRequest(BaseModel):
    user_id: UUID


class ProjectListResponse(BaseModel):
    projects: List[Project]
    total: int


class ProjectUnreadStatus(BaseModel):
    has_unread: bool
    unread_projects_count: int
