
-- Enable RLS on pillars if not already enabled
ALTER TABLE pillars ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view pillars of their own organization
-- This allows any authenticated user to SELECT pillars if they are a member of the organization
CREATE POLICY "Users can view pillars of their own organization"
ON pillars FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM memberships 
    WHERE organization_id = pillars.organization_id
  )
);

-- Policy: Organization Owners can insert/update/delete pillars
CREATE POLICY "Owners can manage pillars"
ON pillars FOR ALL
USING (
  auth.uid() IN (
    SELECT user_id FROM memberships 
    WHERE organization_id = pillars.organization_id
    AND role = 'OWNER'
  )
);
