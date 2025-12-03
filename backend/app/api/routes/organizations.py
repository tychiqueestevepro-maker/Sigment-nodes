"""
Organizations API endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from loguru import logger
from typing import List

from app.models.organization import Organization, OrganizationCreate, UserOrgAccess, MembershipWithOrg
from app.services.supabase_client import supabase

router = APIRouter()



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
async def get_user_org_access(org_slug: str, user_id: str):
    """
    Get user's access to a specific organization
    Returns organization details + user's role in that org
    
    Used by OrganizationLayout to:
    - Verify user belongs to the org
    - Load org context
    - Determine user's role
    """
    try:
        # 1. Get organization by slug
        org_response = supabase.table("organizations").select("*").eq("slug", org_slug).single().execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        organization = org_response.data
        
        # 2. Check user membership
        try:
            membership_response = supabase.table("memberships").select("*").eq(
                "user_id", user_id
            ).eq(
                "organization_id", organization["id"]
            ).single().execute()
        except Exception:
            # .single() raises exception if 0 rows found
            raise HTTPException(
                status_code=403, 
                detail="You are not a member of this organization"
            )
        
        if not membership_response.data:
            raise HTTPException(
                status_code=403, 
                detail="You are not a member of this organization"
            )
        
        membership = membership_response.data
        
        # 3. Build permissions based on role
        role = (membership.get("role") or "MEMBER").upper()
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
                        "status": "Active", 
                        "joined_at": m.get("created_at", ""),
                        "avatar_url": user.get("avatar_url")
                    })
            except Exception as e:
                print(f"Error processing member {m.get('id')}: {e}")
                # Continue to next member instead of crashing
                continue
                
        return result
    except Exception as e:
        print(f"Error in get_org_members: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        logger.error(f"Error fetching members: {e}")
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
