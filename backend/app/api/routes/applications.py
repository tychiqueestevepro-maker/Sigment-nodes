"""
Applications/Tools API Routes
Handles application library and project tools management
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from app.services.supabase_client import get_supabase
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/applications", tags=["applications"])


# ==================== PYDANTIC MODELS ====================

class ApplicationBase(BaseModel):
    name: str
    url: str
    description: Optional[str] = None
    category: str


class ApplicationCreate(ApplicationBase):
    pass


class Application(ApplicationBase):
    id: str
    logo_url: Optional[str] = None
    status: str
    organization_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ProjectToolCreate(BaseModel):
    application_id: str
    status: str = "active"  # 'active' or 'planned'
    note: Optional[str] = None


class ProjectTool(BaseModel):
    id: str
    project_id: str
    application_id: str
    status: str
    note: Optional[str]
    added_at: datetime
    added_by: Optional[dict] = None
    application: Optional[Application] = None


class ToolConnectionCreate(BaseModel):
    source_application_id: str
    target_application_id: str
    label: Optional[str] = None
    is_active: bool = True


class ToolConnection(BaseModel):
    id: str
    source_tool_id: str
    target_tool_id: str
    label: Optional[str]
    is_active: bool
    source_application: Optional[Application] = None
    target_application: Optional[Application] = None


# ==================== HELPER FUNCTIONS ====================

def get_logo_url(url: str) -> str:
    """Generate Google Favicon URL from domain - 100% reliable, no rate limits"""
    if not url:
        return None
    # Remove protocol and www
    domain = url.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"


# ==================== APPLICATION LIBRARY ROUTES ====================

@router.get("/library", response_model=List[Application])
async def get_application_library(
    search: Optional[str] = Query(None, description="Search term"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user = Depends(get_current_user)
):
    """
    Get all applications visible to the current organization.
    Returns both certified (global) apps and community (org-specific) apps.
    """
    supabase = get_supabase()
    org_id = current_user.organization_id
    
    # Build query: Get global apps (org_id IS NULL) OR org-specific apps
    query = supabase.table("applications").select("*")
    
    # Filter: Global OR same organization
    query = query.or_(f"organization_id.is.null,organization_id.eq.{org_id}")
    
    if search:
        query = query.ilike("name", f"%{search}%")
    
    if category:
        query = query.eq("category", category)
    
    query = query.order("status", desc=True).order("name")
    
    result = query.execute()
    
    # Add logo URLs
    apps = []
    for app in result.data:
        app["logo_url"] = app.get("logo_url") or get_logo_url(app.get("url"))
        apps.append(app)
    
    return apps


@router.get("/categories")
async def get_categories(current_user = Depends(get_current_user)):
    """Get list of available categories"""
    return {
        "categories": [
            "Software Engineering",
            "Cloud & Infrastructure",
            "Data & Analytics",
            "Product & UX",
            "Automation & AI",
            "Sales",
            "Marketing",
            "Collaboration",
            "Project & Operations"
        ]
    }


@router.post("/", response_model=Application)
async def create_application(
    app_data: ApplicationCreate,
    current_user = Depends(get_current_user)
):
    """
    Create a new community application (org-specific).
    Certified apps are only created by admins (seed data).
    """
    supabase = get_supabase()
    org_id = current_user.organization_id
    
    # Check if app with same URL already exists in this org or globally
    existing = supabase.table("applications").select("id").or_(
        f"organization_id.is.null,organization_id.eq.{org_id}"
    ).eq("url", app_data.url).execute()
    
    if existing.data:
        raise HTTPException(status_code=400, detail="An application with this URL already exists")
    
    new_app = {
        "name": app_data.name,
        "url": app_data.url,
        "description": app_data.description,
        "category": app_data.category,
        "status": "COMMUNITY",
        "organization_id": str(org_id),
        "created_by_user_id": str(current_user.id)
    }
    
    result = supabase.table("applications").insert(new_app).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create application")
    
    app = result.data[0]
    app["logo_url"] = get_logo_url(app.get("url"))
    
    return app


@router.delete("/{application_id}")
async def delete_application(
    application_id: str,
    current_user = Depends(get_current_user)
):
    """
    Delete a community application.
    Only community (non-certified) apps can be deleted.
    Any member of the organization can delete community apps.
    """
    supabase = get_supabase()
    org_id = current_user.organization_id
    
    # Get the application
    app_result = supabase.table("applications").select("*").eq("id", application_id).single().execute()
    
    if not app_result.data:
        raise HTTPException(status_code=404, detail="Application not found")
    
    app = app_result.data
    
    # Check if certified - cannot delete certified apps
    if app.get("status") == "CERTIFIED":
        raise HTTPException(status_code=403, detail="Cannot delete certified applications")
    
    # Check if it belongs to the organization
    if app.get("organization_id") != str(org_id):
        raise HTTPException(status_code=403, detail="You can only delete applications from your organization")
    
    # Delete the application
    supabase.table("applications").delete().eq("id", application_id).execute()
    
    return {"success": True, "message": "Application deleted successfully"}


# ==================== PROJECT TOOLS ROUTES ====================

@router.get("/projects/{project_id}/tools", response_model=List[ProjectTool])
async def get_project_tools(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """Get all tools associated with a project"""
    supabase = get_supabase()
    
    # Verify user has access to project
    project = supabase.table("projects").select("id, organization_id").eq("id", project_id).single().execute()
    
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.data["organization_id"] != str(current_user.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get project tools with application details
    result = supabase.table("project_tools").select(
        "*, applications(*), users!added_by_user_id(id, first_name, last_name, avatar_url)"
    ).eq("project_id", project_id).order("added_at", desc=True).execute()
    
    tools = []
    for tool in result.data:
        app_data = tool.get("applications", {})
        user_data = tool.get("users")
        
        tools.append({
            "id": tool["id"],
            "project_id": tool["project_id"],
            "application_id": tool["application_id"],
            "status": tool["status"],
            "note": tool.get("note"),
            "added_at": tool["added_at"],
            "added_by": {
                "id": user_data["id"],
                "first_name": user_data.get("first_name"),
                "last_name": user_data.get("last_name"),
                "avatar_url": user_data.get("avatar_url")
            } if user_data else None,
            "application": {
                **app_data,
                "logo_url": app_data.get("logo_url") or get_logo_url(app_data.get("url"))
            } if app_data else None
        })
    
    return tools


@router.post("/projects/{project_id}/tools", response_model=ProjectTool)
async def add_tool_to_project(
    project_id: str,
    tool_data: ProjectToolCreate,
    current_user = Depends(get_current_user)
):
    """Add a tool to a project"""
    supabase = get_supabase()
    
    # Verify user has access to project
    project = supabase.table("projects").select("id, organization_id").eq("id", project_id).single().execute()
    
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.data["organization_id"] != str(current_user.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if tool already exists in project
    existing = supabase.table("project_tools").select("id").eq(
        "project_id", project_id
    ).eq("application_id", tool_data.application_id).execute()
    
    if existing.data:
        raise HTTPException(status_code=400, detail="This tool is already in the project")
    
    new_tool = {
        "project_id": project_id,
        "application_id": tool_data.application_id,
        "status": tool_data.status,
        "note": tool_data.note,
        "added_by_user_id": str(current_user.id)
    }
    
    result = supabase.table("project_tools").insert(new_tool).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add tool to project")
    
    # Fetch full details
    tool = result.data[0]
    
    # Get application details
    app_result = supabase.table("applications").select("*").eq("id", tool["application_id"]).single().execute()
    
    # Get user details for added_by
    user_result = supabase.table("users").select("id, first_name, last_name, avatar_url").eq("id", str(current_user.id)).single().execute()
    user_data = user_result.data if user_result.data else {"id": str(current_user.id), "first_name": None, "last_name": None, "avatar_url": None}
    
    return {
        "id": tool["id"],
        "project_id": tool["project_id"],
        "application_id": tool["application_id"],
        "status": tool["status"],
        "note": tool.get("note"),
        "added_at": tool["added_at"],
        "added_by": {
            "id": user_data.get("id"),
            "first_name": user_data.get("first_name"),
            "last_name": user_data.get("last_name"),
            "avatar_url": user_data.get("avatar_url")
        },
        "application": {
            **app_result.data,
            "logo_url": get_logo_url(app_result.data.get("url"))
        } if app_result.data else None
    }


@router.delete("/projects/{project_id}/tools/{tool_id}")
async def remove_tool_from_project(
    project_id: str,
    tool_id: str,
    current_user = Depends(get_current_user)
):
    """Remove a tool from a project"""
    supabase = get_supabase()
    
    # Verify user has access to project
    project = supabase.table("projects").select("id, organization_id").eq("id", project_id).single().execute()
    
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.data["organization_id"] != str(current_user.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = supabase.table("project_tools").delete().eq("id", tool_id).eq("project_id", project_id).execute()
    
    return {"success": True, "message": "Tool removed from project"}


@router.patch("/projects/{project_id}/tools/{tool_id}")
async def update_project_tool(
    project_id: str,
    tool_id: str,
    status: Optional[str] = None,
    note: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Update a project tool's status or note"""
    supabase = get_supabase()
    
    # Verify user has access to project
    project = supabase.table("projects").select("id, organization_id").eq("id", project_id).single().execute()
    
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.data["organization_id"] != str(current_user.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {}
    if status:
        update_data["status"] = status
    if note is not None:
        update_data["note"] = note
    
    if update_data:
        result = supabase.table("project_tools").update(update_data).eq("id", tool_id).eq("project_id", project_id).execute()
    
    return {"success": True}


# ==================== TOOL CONNECTIONS ROUTES ====================

@router.get("/projects/{project_id}/connections", response_model=List[ToolConnection])
async def get_tool_connections(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """Get all tool connections for a project"""
    supabase = get_supabase()
    
    # Verify user has access to project
    project = supabase.table("projects").select("id, organization_id").eq("id", project_id).single().execute()
    
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.data["organization_id"] != str(current_user.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = supabase.table("tool_connections").select(
        "*, source:applications!source_tool_id(*), target:applications!target_tool_id(*)"
    ).eq("project_id", project_id).execute()
    
    connections = []
    for conn in result.data:
        source = conn.get("source", {})
        target = conn.get("target", {})
        
        connections.append({
            "id": conn["id"],
            "source_tool_id": conn["source_tool_id"],
            "target_tool_id": conn["target_tool_id"],
            "label": conn.get("label"),
            "is_active": conn.get("is_active", True),
            "source_application": {
                **source,
                "logo_url": source.get("logo_url") or get_logo_url(source.get("url"))
            } if source else None,
            "target_application": {
                **target,
                "logo_url": target.get("logo_url") or get_logo_url(target.get("url"))
            } if target else None
        })
    
    return connections


@router.post("/projects/{project_id}/connections", response_model=ToolConnection)
async def create_tool_connection(
    project_id: str,
    conn_data: ToolConnectionCreate,
    current_user = Depends(get_current_user)
):
    """Create a connection between two tools in a project"""
    supabase = get_supabase()
    
    # Verify user has access to project
    project = supabase.table("projects").select("id, organization_id").eq("id", project_id).single().execute()
    
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.data["organization_id"] != str(current_user.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    new_conn = {
        "project_id": project_id,
        "source_tool_id": conn_data.source_application_id,
        "target_tool_id": conn_data.target_application_id,
        "label": conn_data.label,
        "is_active": conn_data.is_active,
        "created_by_user_id": str(current_user.id)
    }
    
    result = supabase.table("tool_connections").insert(new_conn).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create connection")
    
    conn = result.data[0]
    
    return {
        "id": conn["id"],
        "source_tool_id": conn["source_tool_id"],
        "target_tool_id": conn["target_tool_id"],
        "label": conn.get("label"),
        "is_active": conn.get("is_active", True),
        "source_application": None,
        "target_application": None
    }




class UpdateConnectionRequest(BaseModel):
    is_active: Optional[bool] = None
    label: Optional[str] = None


@router.patch("/projects/{project_id}/connections/{connection_id}")
async def update_tool_connection(
    project_id: str,
    connection_id: str,
    request: UpdateConnectionRequest,
    current_user = Depends(get_current_user)
):
    """Update a tool connection's status or label"""
    supabase = get_supabase()
    
    # Verify user has access to project
    project = supabase.table("projects").select("id, organization_id").eq("id", project_id).single().execute()
    
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.data["organization_id"] != str(current_user.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {}
    if request.is_active is not None:
        update_data["is_active"] = request.is_active
    if request.label is not None:
        update_data["label"] = request.label
    
    if update_data:
        result = supabase.table("tool_connections").update(update_data).eq("id", connection_id).eq("project_id", project_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        return {"success": True, "connection": result.data[0]}
    
    return {"success": True}



@router.delete("/projects/{project_id}/connections/{connection_id}")
async def delete_tool_connection(
    project_id: str,
    connection_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a tool connection"""
    supabase = get_supabase()
    
    # Verify user has access to project
    project = supabase.table("projects").select("id, organization_id").eq("id", project_id).single().execute()
    
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.data["organization_id"] != str(current_user.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    supabase.table("tool_connections").delete().eq("id", connection_id).eq("project_id", project_id).execute()
    
    return {"success": True}
