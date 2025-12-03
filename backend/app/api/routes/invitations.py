from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Literal
from datetime import datetime, timedelta
import secrets
import uuid
from app.services.supabase_client import supabase

router = APIRouter()

class InvitationRequest(BaseModel):
    emails: list[EmailStr]
    role: Literal['BOARD', 'MEMBER']
    organization_id: str
    invited_by: str # User ID of the inviter

class InvitationResponse(BaseModel):
    success_count: int
    failed_emails: list[dict] # {email: str, error: str}
    invitation_links: list[dict] # {email: link}

@router.post("/invitations", response_model=InvitationResponse)
async def create_invitations(
    request: InvitationRequest,
):
    # 1. Verify requester is OWNER or BOARD in this organization
    try:
        # Check membership in the specific organization
        membership_response = supabase.table("memberships").select("role").eq(
            "user_id", request.invited_by
        ).eq(
            "organization_id", request.organization_id
        ).single().execute()
        
        if not membership_response.data:
            raise HTTPException(status_code=403, detail="Inviter is not a member of this organization")
            
        inviter_role = membership_response.data.get("role")
        # Handle potential None or mixed case
        if not inviter_role:
             raise HTTPException(status_code=403, detail="Inviter has no role")
             
        inviter_role = inviter_role.upper()
        
        # Strictly allow only OWNER and BOARD as per system design
        if inviter_role not in ['OWNER', 'BOARD']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"Insufficient permissions. Role '{inviter_role}' is not allowed to invite users."
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error verifying permissions: {e}")
        raise HTTPException(status_code=500, detail="Error verifying permissions")
    
    success_count = 0
    failed_emails = []
    invitation_links = []
    
    # Base URL for links
    base_url = "http://localhost:3000" 

    for email in request.emails:
        try:
            # 2. Validation Checks
            
            # A. Check if already a member
            # First get user_id by email
            user_response = supabase.table("users").select("id").eq("email", email).execute()
            if user_response.data and len(user_response.data) > 0:
                user_id = user_response.data[0]["id"]
                # Check membership
                member_check = supabase.table("memberships").select("id").eq("user_id", user_id).eq("organization_id", request.organization_id).execute()
                if member_check.data and len(member_check.data) > 0:
                    raise HTTPException(status_code=400, detail="Already a member")

            # B. Check for existing pending invitations
            # We need to handle the unique constraint "unique_pending_invite"
            # Logic: 
            # - If pending invite exists and is < 2 hours old: Block (already invited).
            # - If pending invite exists and is > 2 hours old: Delete it (expired) and allow new one.
            
            pending_invite = supabase.table("invitations").select("id", "created_at").eq("email", email).eq("organization_id", request.organization_id).eq("status", "pending").execute()
            
            if pending_invite.data and len(pending_invite.data) > 0:
                invite_record = pending_invite.data[0]
                last_invite_time_str = invite_record["created_at"].replace('Z', '+00:00')
                last_invite_time = datetime.fromisoformat(last_invite_time_str)
                
                # Ensure timezone awareness compatibility
                now = datetime.utcnow()
                if last_invite_time.tzinfo:
                    now = datetime.now(last_invite_time.tzinfo)
                
                time_since_invite = now - last_invite_time
                
                if time_since_invite < timedelta(hours=2):
                    # Still valid (< 2h)
                    raise HTTPException(status_code=400, detail=f"Invite pending (expires in {int(120 - time_since_invite.total_seconds()/60)}m)")
                else:
                    # Expired (> 2h)
                    # Delete the old invitation to clear the unique constraint
                    supabase.table("invitations").delete().eq("id", invite_record["id"]).execute()

            # 3. Generate secure token
            token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=2)

            # 3. Store in DB
            data = {
                "email": email,
                "role": request.role,
                "token": token,
                "expires_at": expires_at.isoformat(),
                "organization_id": request.organization_id,
                "invited_by": request.invited_by,
                "status": "pending"
            }
            
            supabase.table("invitations").insert(data).execute()
            
            # 4. Construct Link
            link = f"{base_url}/join?token={token}"
            invitation_links.append({"email": email, "link": link})
            success_count += 1
            
        except Exception as e:
            error_msg = str(e)
            if isinstance(e, HTTPException):
                error_msg = e.detail
            else:
                # Try to parse Supabase error dictionary if it's a stringified dict or object
                try:
                    import ast
                    # If e is a postgrest.exceptions.APIError, it might have .message or .details
                    if hasattr(e, 'message'):
                         error_msg = e.message
                    elif hasattr(e, 'details'):
                         error_msg = e.details
                    # If it's a string representation of a dict (common in some python clients)
                    elif "{" in str(e) and "}" in str(e):
                        error_dict = ast.literal_eval(str(e))
                        if isinstance(error_dict, dict):
                            error_msg = error_dict.get('message') or error_dict.get('error') or str(e)
                except:
                    pass # Fallback to str(e) if parsing fails
            
            print(f"Error creating invitation for {email}: {error_msg}")
            failed_emails.append({"email": email, "error": error_msg})
    
    return InvitationResponse(
        success_count=success_count,
        failed_emails=failed_emails,
        invitation_links=invitation_links
    )

@router.get("/invitations")
async def get_invitations(organization_id: str):
    try:
        # Verify permissions (optional but recommended, for now just fetch)
        # In a real app, we should check if the requester is a member of the org
        
        response = supabase.table("invitations").select("*").eq("organization_id", organization_id).execute()
        invitations = response.data
        
        if not invitations:
            return []
            
        # Fetch inviter details
        inviter_ids = list(set([inv["invited_by"] for inv in invitations if inv.get("invited_by")]))
        
        if inviter_ids:
            users_response = supabase.table("users").select("id, first_name, last_name, email").in_("id", inviter_ids).execute()
            users_map = {u["id"]: u for u in users_response.data}
            
            # Enrich invitations
            for inv in invitations:
                inviter = users_map.get(inv.get("invited_by"))
                if inviter:
                    first_name = inviter.get('first_name') or ''
                    last_name = inviter.get('last_name') or ''
                    name = f"{first_name} {last_name}".strip()
                    if not name:
                        name = inviter.get('email', '').split('@')[0]
                    
                    inv["inviter_name"] = name
                    inv["inviter_email"] = inviter.get("email")
                else:
                    inv["inviter_name"] = "Unknown"
                    inv["inviter_email"] = ""
        
        return invitations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/invitations/{token}")
async def validate_invitation(token: str):
    """
    Validate invitation token and return details
    """
    try:
        # 1. Get invitation (use execute() instead of single() to avoid crash on empty)
        response = supabase.table("invitations").select("*").eq("token", token).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Invitation not found")
            
        invitation = response.data[0]
        
        # 2. Check expiry
        # Handle 'Z' which might not be supported in older python fromisoformat
        expires_at_str = invitation["expires_at"].replace('Z', '+00:00')
        expires_at = datetime.fromisoformat(expires_at_str)
        
        # Ensure we compare timezone-aware with timezone-aware, or naive with naive
        now = datetime.utcnow()
        if expires_at.tzinfo:
            now = datetime.now(expires_at.tzinfo)
            
        if expires_at < now:
            raise HTTPException(status_code=400, detail="Invitation expired")
            
        # 3. Check status
        if invitation["status"] != "pending":
            raise HTTPException(status_code=400, detail="Invitation already used")
            
        # 4. Get organization details
        org_response = supabase.table("organizations").select("name, slug").eq("id", invitation["organization_id"]).execute()
        
        if not org_response.data or len(org_response.data) == 0:
             # Should not happen if DB integrity is good, but handle it
             org_name = "Unknown Organization"
        else:
             org_name = org_response.data[0]["name"]
        
        return {
            "valid": True,
            "email": invitation["email"],
            "role": invitation["role"],
            "organization_name": org_name,
            "organization_id": invitation["organization_id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error validating invitation: {e}")
        # Return a generic 400 or 404 depending on context, or 500 if it's truly unexpected
        # But user asked to avoid 500 crash.
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")

class AcceptInvitationRequest(BaseModel):
    token: str
    first_name: str
    last_name: str
    password: str
    job_title: str
    department: str
    seniority: str # junior, intermediate, senior, lead, executive

@router.post("/invitations/accept")
async def accept_invitation(data: AcceptInvitationRequest):
    """
    Accept invitation and create user account
    """
    try:
        # 1. Validate token again (use execute() instead of single())
        invite_response = supabase.table("invitations").select("*").eq("token", data.token).execute()
        
        if not invite_response.data or len(invite_response.data) == 0:
            raise HTTPException(status_code=404, detail="Invalid token")
            
        invitation = invite_response.data[0]
        
        if invitation["status"] != "pending":
            raise HTTPException(status_code=400, detail="Invitation already used")
            
        # Handle 'Z' and timezone comparison
        expires_at_str = invitation["expires_at"].replace('Z', '+00:00')
        expires_at = datetime.fromisoformat(expires_at_str)
        
        now = datetime.utcnow()
        if expires_at.tzinfo:
            now = datetime.now(expires_at.tzinfo)
            
        if expires_at < now:
            raise HTTPException(status_code=400, detail="Invitation expired")

        # 2. Map seniority to integer
        seniority_map = {
            "junior": 1,
            "intermediate": 2,
            "senior": 3,
            "lead": 4,
            "executive": 5
        }
        seniority_level = seniority_map.get(data.seniority.lower(), 1)

        # 3. Create User
        user_id = str(uuid.uuid4())
        user_data = {
            "id": user_id,
            "email": invitation["email"],
            "password": data.password, # TODO: Hash password
            "first_name": data.first_name,
            "last_name": data.last_name,
            "role": "employee", # Default system role, org role is in membership
            "job_title": data.job_title,
            "department": data.department,
            "seniority_level": seniority_level
        }
        
        user_response = supabase.table("users").insert(user_data).execute()
        if not user_response.data:
            raise HTTPException(status_code=500, detail="Failed to create user")
            
        # 4. Create Membership
        membership_data = {
            "user_id": user_id,
            "organization_id": invitation["organization_id"],
            "role": invitation["role"],
            "job_title": data.job_title
        }
        supabase.table("memberships").insert(membership_data).execute()
        
        # 5. Update Invitation Status
        supabase.table("invitations").update({"status": "accepted"}).eq("id", invitation["id"]).execute()
        
        return {"success": True, "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error accepting invitation: {e}")
        raise HTTPException(status_code=400, detail=f"Acceptance failed: {str(e)}")
