-- ===================================================
-- Data Migration: Setup Default Organization
-- Description: Create default org and migrate existing data
-- ===================================================

-- 1. Create default organization
INSERT INTO organizations (slug, name, description)
VALUES (
    'sigment-default',
    'SIGMENT',
    'Default organization for existing users'
)
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- Store the org ID for later use
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    -- Get the default org ID
    SELECT id INTO default_org_id
    FROM organizations
    WHERE slug = 'sigment-default';

    -- 2. Migrate existing notes to default org
    UPDATE notes
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;

    -- 3. Migrate existing clusters to default org
    UPDATE clusters
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;

    -- 4. Migrate existing pillars to default org
    UPDATE pillars
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;

    -- 5. Create memberships for all users who have notes
    INSERT INTO memberships (user_id, organization_id, role)
    SELECT DISTINCT 
        user_id,
        default_org_id,
        'MEMBER' -- Default role, Board members can be promoted later
    FROM notes
    WHERE user_id IS NOT NULL
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    -- 6. Summary
    RAISE NOTICE '✅ Migration completed:';
    RAISE NOTICE '   - Organization: % (ID: %)', 'sigment-default', default_org_id;
    RAISE NOTICE '   - Notes migrated: %', (SELECT COUNT(*) FROM notes WHERE organization_id = default_org_id);
    RAISE NOTICE '   - Clusters migrated: %', (SELECT COUNT(*) FROM clusters WHERE organization_id = default_org_id);
    RAISE NOTICE '   - Pillars migrated: %', (SELECT COUNT(*) FROM pillars WHERE organization_id = default_org_id);
    RAISE NOTICE '   - Memberships created: %', (SELECT COUNT(*) FROM memberships WHERE organization_id = default_org_id);
END $$;
