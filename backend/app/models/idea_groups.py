from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime

# --- Member Info ---

class GroupMemberInfo(BaseModel):
    id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    job_title: Optional[str] = None
    email: str
    avatar_url: Optional[str] = None
    role: str = "member"  # 'admin' or 'member' in the group
    added_at: Optional[datetime] = None

# --- Idea Group ---

class IdeaGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"

class IdeaGroupCreate(IdeaGroupBase):
    member_ids: List[UUID] = []

class IdeaGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    color: Optional[str] = None

class IdeaGroup(IdeaGroupBase):
    id: UUID
    organization_id: UUID
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    item_count: int = 0
    members: List[GroupMemberInfo] = []
    is_admin: bool = False  # Whether current user is admin of this group
    has_unread: bool = False  # Whether there are unread messages for current user

# --- Group Item (Linked Note/Cluster) ---

class GroupItemBase(BaseModel):
    note_id: Optional[UUID] = None
    cluster_id: Optional[UUID] = None

class GroupItemCreate(GroupItemBase):
    pass

class GroupItem(GroupItemBase):
    id: UUID
    idea_group_id: UUID
    added_by: UUID
    added_at: datetime
    # Enriched data
    title: Optional[str] = None
    summary: Optional[str] = None
    item_type: str = "note"  # 'note' or 'cluster'
    note_count: Optional[int] = None  # For clusters
    # Full review data
    category: Optional[str] = None
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    content_raw: Optional[str] = None
    relevance_score: Optional[float] = None
    created_date: Optional[datetime] = None
    collaborators: Optional[list] = None  # List of {name, avatar_url, quote, date}
    status: Optional[str] = None

# --- Group Message ---

class GroupMessageCreate(BaseModel):
    content: str = ""
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None

class GroupMessage(BaseModel):
    id: UUID
    idea_group_id: UUID
    sender_id: UUID
    sender_name: Optional[str] = None
    sender_avatar_url: Optional[str] = None
    content: str
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None
    created_at: datetime

# --- Response models ---

class AddMemberRequest(BaseModel):
    user_id: UUID

class IdeaGroupListResponse(BaseModel):
    groups: List[IdeaGroup]
    total: int
