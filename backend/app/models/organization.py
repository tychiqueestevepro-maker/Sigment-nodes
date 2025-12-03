"""
Organization models for multi-tenant support
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class OrganizationSettings(BaseModel):
    """
    Flexible settings for an organization
    Allows extra fields for rapid iteration
    """
    primary_color: str = "#000000"
    notifications_enabled: bool = True
    
    model_config = {"extra": "allow"}

class Organization(BaseModel):
    """Organization/Company entity"""
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    settings: OrganizationSettings = Field(default_factory=OrganizationSettings)
    created_at: datetime
    updated_at: datetime

class OrganizationCreate(BaseModel):
    """Schema for creating an organization"""
    slug: str = Field(..., pattern=r'^[a-z0-9-]+$')
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = None

class Membership(BaseModel):
    """User membership in an organization"""
    id: str
    user_id: str
    organization_id: str
    role: Literal['OWNER', 'BOARD', 'MEMBER']
    job_title: Optional[str] = "Owner"
    joined_at: datetime
    updated_at: datetime

class MembershipWithOrg(BaseModel):
    """Membership with organization details"""
    organization: Organization
    role: Literal['OWNER', 'BOARD', 'MEMBER']
    job_title: Optional[str] = "Owner"
    joined_at: datetime

class UserOrgAccess(BaseModel):
    """Response for checking user access to an organization"""
    organization: Organization
    role: Literal['OWNER', 'BOARD', 'MEMBER']
    permissions: list[str] = Field(default_factory=list)
