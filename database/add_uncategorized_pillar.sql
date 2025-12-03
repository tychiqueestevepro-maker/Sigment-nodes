-- ===================================================
-- Migration: Add "Uncategorized" Pillar to All Organizations
-- Description: Create a default "Uncategorized" pillar for notes with score < 4/10
-- Date: 2025-12-02
-- ===================================================

-- ============================================
-- STEP 1: Create "Uncategorized" pillar for each organization
-- ============================================

DO $$
DECLARE
    org_record RECORD;
    uncategorized_count INTEGER := 0;
BEGIN
    -- Loop through all organizations
    FOR org_record IN SELECT id, slug, name FROM organizations
    LOOP
        -- Check if "Uncategorized" pillar already exists for this org
        IF NOT EXISTS (
            SELECT 1 FROM pillars 
            WHERE organization_id = org_record.id 
            AND name = 'Uncategorized'
        ) THEN
            -- Create "Uncategorized" pillar
            INSERT INTO pillars (organization_id, name, description, color)
            VALUES (
                org_record.id,
                'Uncategorized',
                'Ideas that could not be categorized into existing pillars (relevance score < 4/10)',
                '#9CA3AF'  -- Gray color
            );
            
            uncategorized_count := uncategorized_count + 1;
            RAISE NOTICE 'Created "Uncategorized" pillar for organization: % (%)', org_record.name, org_record.slug;
        ELSE
            RAISE NOTICE 'Organization % already has "Uncategorized" pillar', org_record.name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created % "Uncategorized" pillars', uncategorized_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 2: Create trigger to auto-create "Uncategorized" for new organizations
-- ============================================

CREATE OR REPLACE FUNCTION create_default_uncategorized_pillar()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically create "Uncategorized" pillar when a new organization is created
    INSERT INTO pillars (organization_id, name, description, color)
    VALUES (
        NEW.id,
        'Uncategorized',
        'Ideas that could not be categorized into existing pillars (relevance score < 4/10)',
        '#9CA3AF'
    );
    
    RAISE NOTICE 'Auto-created "Uncategorized" pillar for new organization: %', NEW.name;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS auto_create_uncategorized_pillar ON organizations;

-- Create trigger
CREATE TRIGGER auto_create_uncategorized_pillar
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION create_default_uncategorized_pillar();

-- ============================================
-- STEP 3: Verification
-- ============================================

DO $$
DECLARE
    org_count INTEGER;
    uncategorized_count INTEGER;
BEGIN
    -- Count organizations
    SELECT COUNT(*) INTO org_count FROM organizations;
    
    -- Count "Uncategorized" pillars
    SELECT COUNT(*) INTO uncategorized_count 
    FROM pillars 
    WHERE name = 'Uncategorized';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total organizations: %', org_count;
    RAISE NOTICE 'Total "Uncategorized" pillars: %', uncategorized_count;
    
    IF org_count = uncategorized_count THEN
        RAISE NOTICE '✅ All organizations have "Uncategorized" pillar';
    ELSE
        RAISE WARNING '⚠️  Mismatch: % orgs but % "Uncategorized" pillars', org_count, uncategorized_count;
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 4: Display all "Uncategorized" pillars
-- ============================================

SELECT 
    o.slug AS organization_slug,
    o.name AS organization_name,
    p.id AS pillar_id,
    p.name AS pillar_name,
    p.color AS pillar_color,
    p.created_at
FROM organizations o
JOIN pillars p ON p.organization_id = o.id
WHERE p.name = 'Uncategorized'
ORDER BY o.slug;
