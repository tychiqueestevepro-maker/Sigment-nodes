"""
Organizations API endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from loguru import logger
from typing import List

from app.models.organization import Organization, OrganizationCreate, UserOrgAccess, MembershipWithOrg
from app.services.supabase_client import supabase

router = APIRouter()



from app.api.dependencies import CurrentUser, get_current_user

@router.get("/{org_slug}/public")
async def get_public_organization(org_slug: str):
    """
    Get public organization details by slug (ID, name, logo)
    No authentication required. Used for context resolution.
    """
    try:
        response = supabase.table("organizations").select("id, name, slug, logo_url").eq("slug", org_slug).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
            
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching public org details: {e}")
        raise HTTPException(status_code=404, detail="Organization not found")

@router.get("/{org_slug}/me", response_model=UserOrgAccess)
async def get_user_org_access(
    org_slug: str, 
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get user's access to a specific organization
    Returns organization details + user's role in that org
    
    Uses JWT (current_user) to identify the user.
    """
    try:
        # 1. Get organization by slug
        org_response = supabase.table("organizations").select("*").eq("slug", org_slug).single().execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        organization = org_response.data
        
        # 2. Build permissions based on role (Role is already in current_user)
        role = current_user.role.upper()
        permissions = []
        if role == "OWNER":
            permissions = [
                "view_galaxy",
                "review_notes",
                "manage_pillars",
                "view_analytics",
                "moderate_content",
                "manage_organization",
                "manage_members",
                "manage_billing"
            ]
        elif role == "BOARD":
            permissions = [
                "view_galaxy",
                "review_notes",
                "manage_pillars",
                "view_analytics",
                "moderate_content"
            ]
        else:  # MEMBER
            permissions = [
                "create_notes",
                "view_own_notes",
                "track_progress"
            ]
        
        return {
            "organization": organization,
            "role": role,
            "permissions": permissions
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking org access: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{org_slug}/details")
async def get_organization_details(org_slug: str):
    """
    Get full organization details including member count
    """
    try:
        # Get organization
        org_response = supabase.table("organizations").select("*").eq("slug", org_slug).single().execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org = org_response.data
        
        # Get member count
        members_response = supabase.table("memberships").select("id", count="exact").eq("organization_id", org["id"]).execute()
        member_count = members_response.count if members_response.count else 0
        
        return {
            "id": org["id"],
            "name": org.get("name", ""),
            "slug": org.get("slug", ""),
            "description": org.get("description", ""),
            "location": org.get("location", ""),
            "logo_url": org.get("logo_url"),
            "created_at": org.get("created_at", ""),
            "member_count": member_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching organization details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from pydantic import BaseModel
from typing import Optional

class UpdateOrganizationRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None


@router.patch("/{org_slug}")
async def update_organization(org_slug: str, request: UpdateOrganizationRequest):
    """
    Update organization details (Owner only)
    """
    try:
        # Get organization
        org_response = supabase.table("organizations").select("id").eq("slug", org_slug).single().execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_id = org_response.data["id"]
        
        # Build update data (only non-None fields)
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.location is not None:
            update_data["location"] = request.location
        
        if not update_data:
            return {"success": True, "message": "No changes to apply"}
        
        # Update organization
        supabase.table("organizations").update(update_data).eq("id", org_id).execute()
        
        logger.info(f"Updated organization {org_slug}: {update_data.keys()}")
        return {"success": True, "message": "Organization updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating organization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from fastapi import UploadFile, File
import uuid
from datetime import datetime

@router.post("/{org_slug}/logo")
async def upload_organization_logo(org_slug: str, file: UploadFile = File(...)):
    """
    Upload organization logo (Owner only)
    """
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Validate file size (max 10MB)
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 10MB")
        
        # Get organization
        org_response = supabase.table("organizations").select("id").eq("slug", org_slug).single().execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_id = org_response.data["id"]
        
        # Generate unique filename
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"org-logos/{org_id}/{uuid.uuid4()}.{file_ext}"
        
        # Upload to Supabase Storage
        try:
            upload_response = supabase.storage.from_("avatars").upload(
                filename,
                contents,
                {
                    "content-type": file.content_type,
                    "upsert": "true"
                }
            )
            
            # Get public URL
            public_url = supabase.storage.from_("avatars").get_public_url(filename)
            
            # Update organization with new logo URL
            supabase.table("organizations").update({"logo_url": public_url}).eq("id", org_id).execute()
            
            logger.info(f"Uploaded logo for organization {org_slug}")
            return {"success": True, "logo_url": public_url}
            
        except Exception as storage_error:
            logger.error(f"Storage error: {storage_error}")
            raise HTTPException(status_code=500, detail="Failed to upload image to storage")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading logo: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/{org_slug}/members")
async def get_org_members(org_slug: str):
    """
    Get all members of an organization
    """
    try:
        # 1. Get organization ID
        org_response = supabase.table("organizations").select("id").eq("slug", org_slug).single().execute()
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_id = org_response.data["id"]

        # 2. Get memberships with user details
        # Note: Supabase join syntax might vary, here we do a manual join or use select with foreign key
        # Assuming foreign key relationship: memberships.user_id -> users.id
        
        # Fetch memberships
        members_response = supabase.table("memberships").select("*").eq("organization_id", org_id).execute()
        memberships = members_response.data
        
        # Fetch users details for these memberships
        user_ids = [m["user_id"] for m in memberships]
        if not user_ids:
            return []
            
        users_response = supabase.table("users").select("*").in_("id", user_ids).execute()
        users_map = {u["id"]: u for u in users_response.data}
        
        # Combine data
        result = []
        for m in memberships:
            try:
                user = users_map.get(m["user_id"])
                if user:
                    # Safely get fields that might be null
                    first_name = user.get('first_name') or ''
                    last_name = user.get('last_name') or ''
                    name = f"{first_name} {last_name}".strip()
                    if not name:
                        name = user.get('email', '').split('@')[0]

                    result.append({
                        "id": user["id"],
                        "name": name,
                        "email": user.get("email", ""),
                        "role": m.get("role", "MEMBER"), # Default to MEMBER if missing
                        "job_title": m.get("job_title", ""), # Fixed: job_title is in membership
                        "seniority_level": user.get("seniority_level", ""), # Seniority level from users table
                        "status": user.get("status", "active"), # Get real status from users table
                        "joined_at": m.get("joined_at", ""),
                        "avatar_url": user.get("avatar_url")
                    })
            except Exception as e:
                print(f"Error processing member {m.get('id')}: {e}")
                # Continue to next member instead of crashing
                continue
        
        # Sort by role: OWNER first, then BOARD, then MEMBER
        role_order = {"OWNER": 0, "BOARD": 1, "MEMBER": 2}
        result.sort(key=lambda x: role_order.get(x.get("role", "MEMBER"), 2))
                
        return result
    except Exception as e:
        logger.error(f"Error in get_org_members: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def get_user_organizations(user_id: str) -> List[MembershipWithOrg]:
    """
    Get all organizations a user belongs to
    Used for organization switcher / navigation
    """
    try:
        # Query memberships with organization details
        response = supabase.table("memberships").select(
            """
            role,
            job_title,
            joined_at,
            updated_at,
            organizations(*)
            """
        ).eq("user_id", user_id).order("joined_at", desc=True).execute()
        
        if not response.data:
            return []
        
        # Transform to include organization details
        user_orgs = []
        for membership in response.data:
            org_data = membership.get("organizations", {})
            user_orgs.append({
                "organization": org_data,
                "role": membership["role"],
                "job_title": membership.get("job_title", "Owner"),
                "joined_at": membership["joined_at"]
            })
        

        return user_orgs
        
    except Exception as e:
        logger.error(f"Error fetching user organizations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=Organization)
async def create_organization(
    org: OrganizationCreate, 
    creator_user_id: str,
    job_title: str = "Owner"
):
    """
    Create a new organization
    Creator is automatically added as BOARD member with specified job_title
    """
    try:
        # 1. Create organization
        org_response = supabase.table("organizations").insert({
            "slug": org.slug,
            "name": org.name,
            "description": org.description,
            "logo_url": org.logo_url
        }).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=400, detail="Failed to create organization")
        
        new_org = org_response.data[0]
        
        # 2. Add creator as BOARD member with job title
        supabase.table("memberships").insert({
            "user_id": creator_user_id,
            "organization_id": new_org["id"],
            "role": "BOARD",
            "job_title": job_title
        }).execute()
        

        return new_org
        
    except Exception as e:
        logger.error(f"Error creating organization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= MEMBER ACTIONS =============

from pydantic import BaseModel

class UpdateMemberRoleRequest(BaseModel):
    user_id: str
    new_role: str  # "BOARD" or "MEMBER"

class UpdateMemberTitleRequest(BaseModel):
    user_id: str
    job_title: str

class MemberActionRequest(BaseModel):
    user_id: str


@router.patch("/{org_slug}/members/role")
async def update_member_role(org_slug: str, request: UpdateMemberRoleRequest):
    """
    Promote or Demote a member's role
    - OWNER can change BOARD <-> MEMBER
    """
    try:
        # Get organization ID
        org_response = supabase.table("organizations").select("id").eq("slug", org_slug).single().execute()
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_id = org_response.data["id"]
        
        # Validate new_role
        if request.new_role.upper() not in ["BOARD", "MEMBER"]:
            raise HTTPException(status_code=400, detail="Invalid role. Must be BOARD or MEMBER")
        
        # Update the membership
        update_response = supabase.table("memberships").update({
            "role": request.new_role.upper()
        }).eq("organization_id", org_id).eq("user_id", request.user_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        logger.info(f"Updated role for user {request.user_id} to {request.new_role} in org {org_slug}")
        return {"success": True, "message": f"Role updated to {request.new_role}"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating member role: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{org_slug}/members/title")
async def update_member_title(org_slug: str, request: UpdateMemberTitleRequest):
    """
    Update a member's job title
    """
    try:
        # Get organization ID
        org_response = supabase.table("organizations").select("id").eq("slug", org_slug).single().execute()
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_id = org_response.data["id"]
        
        # Update the membership job_title
        update_response = supabase.table("memberships").update({
            "job_title": request.job_title
        }).eq("organization_id", org_id).eq("user_id", request.user_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        logger.info(f"Updated job_title for user {request.user_id} to '{request.job_title}' in org {org_slug}")
        return {"success": True, "message": f"Job title updated to '{request.job_title}'"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating member title: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{org_slug}/members/suspend")
async def suspend_member(org_slug: str, request: MemberActionRequest):
    """
    Suspend a member's account (sets status to 'suspended')
    """
    try:
        # Get organization ID
        org_response = supabase.table("organizations").select("id").eq("slug", org_slug).single().execute()
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_id = org_response.data["id"]
        
        # Check if member exists and is not OWNER
        member_response = supabase.table("memberships").select("role").eq("organization_id", org_id).eq("user_id", request.user_id).single().execute()
        
        if not member_response.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        if member_response.data["role"] == "OWNER":
            raise HTTPException(status_code=403, detail="Cannot suspend the owner")
        
        # Update user status in users table
        update_response = supabase.table("users").update({
            "status": "suspended"
        }).eq("id", request.user_id).execute()
        
        logger.info(f"Suspended user {request.user_id} in org {org_slug}")
        return {"success": True, "message": "Member account suspended"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error suspending member: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{org_slug}/members/reactivate")
async def reactivate_member(org_slug: str, request: MemberActionRequest):
    """
    Reactivate a suspended member's account (sets status back to 'active')
    """
    try:
        # Get organization ID
        org_response = supabase.table("organizations").select("id").eq("slug", org_slug).single().execute()
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_id = org_response.data["id"]
        
        # Check if member exists
        member_response = supabase.table("memberships").select("role").eq("organization_id", org_id).eq("user_id", request.user_id).single().execute()
        
        if not member_response.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Update user status in users table
        update_response = supabase.table("users").update({
            "status": "active"
        }).eq("id", request.user_id).execute()
        
        logger.info(f"Reactivated user {request.user_id} in org {org_slug}")
        return {"success": True, "message": "Member account reactivated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reactivating member: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{org_slug}/members/{user_id}")
async def remove_member(org_slug: str, user_id: str):
    """
    Remove a member from the organization
    """
    try:
        # Get organization ID
        org_response = supabase.table("organizations").select("id").eq("slug", org_slug).single().execute()
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_id = org_response.data["id"]
        
        # Check if member exists and is not OWNER
        member_response = supabase.table("memberships").select("role").eq("organization_id", org_id).eq("user_id", user_id).single().execute()
        
        if not member_response.data:
            raise HTTPException(status_code=404, detail="Member not found")
        
        if member_response.data["role"] == "OWNER":
            raise HTTPException(status_code=403, detail="Cannot remove the owner")
        
        # Delete the membership
        delete_response = supabase.table("memberships").delete().eq("organization_id", org_id).eq("user_id", user_id).execute()
        
        logger.info(f"Removed user {user_id} from org {org_slug}")
        return {"success": True, "message": "Member removed from organization"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing member: {e}")
        raise HTTPException(status_code=500, detail=str(e))
