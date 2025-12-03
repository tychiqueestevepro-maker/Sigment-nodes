-- Function to create organization and owner atomically
-- This ensures that we don't have orphaned organizations or users without organizations

CREATE OR REPLACE FUNCTION create_organization_and_owner(
    p_user_id UUID,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
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
    -- 1. Insert into public.users (Required for foreign keys)
    -- We use ON CONFLICT DO NOTHING in case the user was already created by a trigger or previous attempt
    INSERT INTO users (id, email, role, job_title)
    VALUES (p_user_id, p_email, 'board', p_job_title)
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email, job_title = EXCLUDED.job_title;

    -- 2. Insert Organization
    INSERT INTO organizations (slug, name, description)
    VALUES (p_org_slug, p_org_name, p_org_name || '''s workspace')
    RETURNING id INTO v_org_id;

    -- 3. Insert Owner Membership
    INSERT INTO memberships (user_id, organization_id, role, job_title)
    VALUES (p_user_id, v_org_id, 'OWNER', p_job_title);

    -- 4. Return the created organization data
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
