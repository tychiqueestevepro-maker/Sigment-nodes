-- Function to create organization and owner atomically
-- This ensures that we don't have orphaned organizations or users without organizations

CREATE OR REPLACE FUNCTION create_organization_and_owner(
    p_user_id UUID,
    p_org_slug TEXT,
    p_org_name TEXT,
    p_job_title TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id UUID;
    v_org_data JSONB;
BEGIN
    -- 1. Insert Organization
    INSERT INTO organizations (slug, name, description)
    VALUES (p_org_slug, p_org_name, p_org_name || '''s workspace')
    RETURNING id INTO v_org_id;

    -- 2. Insert Owner Membership
    INSERT INTO memberships (user_id, organization_id, role, job_title)
    VALUES (p_user_id, v_org_id, 'OWNER', p_job_title);

    -- 3. Return the created organization data
    SELECT jsonb_build_object(
        'id', id,
        'slug', slug,
        'name', name,
        'created_at', created_at
    ) INTO v_org_data
    FROM organizations
    WHERE id = v_org_id;

    RETURN v_org_data;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Organization slug already taken';
    WHEN OTHERS THEN
        RAISE;
END;
$$;
