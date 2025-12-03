-- ===================================================
-- Migration: Create Default Pillars for All Organizations
-- Description: Create 6 default pillars (5 base + Uncategorized) for each organization
-- Date: 2025-12-02
-- ===================================================

-- ============================================
-- STEP 1: Define default pillars template
-- ============================================

DO $$
DECLARE
    org_record RECORD;
    pillar_record RECORD;
    created_count INTEGER := 0;
    skipped_count INTEGER := 0;
    
    -- Default pillars template
    default_pillars CONSTANT JSON := '[
        {"name": "ESG", "description": "Environmental, Social, and Governance initiatives", "color": "#10B981"},
        {"name": "Innovation", "description": "Product innovation and R&D ideas", "color": "#6366F1"},
        {"name": "Operations", "description": "Operational efficiency and process improvements", "color": "#F59E0B"},
        {"name": "Customer Experience", "description": "Customer satisfaction and service quality", "color": "#EC4899"},
        {"name": "Culture & HR", "description": "Employee experience and organizational culture", "color": "#8B5CF6"},
        {"name": "Uncategorized", "description": "Ideas that could not be categorized into existing pillars (relevance score < 4/10)", "color": "#9CA3AF"}
    ]'::JSON;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Creating Default Pillars for All Organizations';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Loop through all organizations
    FOR org_record IN SELECT id, slug, name FROM organizations ORDER BY slug
    LOOP
        RAISE NOTICE 'Processing organization: % (%)', org_record.name, org_record.slug;
        
        -- Loop through default pillars
        FOR pillar_record IN 
            SELECT 
                value->>'name' AS name,
                value->>'description' AS description,
                value->>'color' AS color
            FROM json_array_elements(default_pillars)
        LOOP
            -- Check if pillar already exists for this organization
            IF NOT EXISTS (
                SELECT 1 FROM pillars 
                WHERE organization_id = org_record.id 
                AND name = pillar_record.name
            ) THEN
                -- Create pillar
                INSERT INTO pillars (organization_id, name, description, color)
                VALUES (
                    org_record.id,
                    pillar_record.name,
                    pillar_record.description,
                    pillar_record.color
                );
                
                created_count := created_count + 1;
                RAISE NOTICE '  ✅ Created pillar: %', pillar_record.name;
            ELSE
                skipped_count := skipped_count + 1;
                RAISE NOTICE '  ⏭️  Skipped pillar: % (already exists)', pillar_record.name;
            END IF;
        END LOOP;
        
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Pillars created: %', created_count;
    RAISE NOTICE 'Pillars skipped: %', skipped_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 2: Create trigger for new organizations
-- ============================================

CREATE OR REPLACE FUNCTION create_default_pillars_for_new_org()
RETURNS TRIGGER AS $$
DECLARE
    default_pillars CONSTANT JSON := '[
        {"name": "ESG", "description": "Environmental, Social, and Governance initiatives", "color": "#10B981"},
        {"name": "Innovation", "description": "Product innovation and R&D ideas", "color": "#6366F1"},
        {"name": "Operations", "description": "Operational efficiency and process improvements", "color": "#F59E0B"},
        {"name": "Customer Experience", "description": "Customer satisfaction and service quality", "color": "#EC4899"},
        {"name": "Culture & HR", "description": "Employee experience and organizational culture", "color": "#8B5CF6"},
        {"name": "Uncategorized", "description": "Ideas that could not be categorized into existing pillars (relevance score < 4/10)", "color": "#9CA3AF"}
    ]'::JSON;
    pillar_record RECORD;
BEGIN
    -- Create all 6 default pillars for the new organization
    FOR pillar_record IN 
        SELECT 
            value->>'name' AS name,
            value->>'description' AS description,
            value->>'color' AS color
        FROM json_array_elements(default_pillars)
    LOOP
        INSERT INTO pillars (organization_id, name, description, color)
        VALUES (
            NEW.id,
            pillar_record.name,
            pillar_record.description,
            pillar_record.color
        );
    END LOOP;
    
    RAISE NOTICE 'Auto-created 6 default pillars for new organization: %', NEW.name;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS auto_create_default_pillars ON organizations;

-- Create trigger
CREATE TRIGGER auto_create_default_pillars
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION create_default_pillars_for_new_org();

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Trigger created: auto_create_default_pillars';
    RAISE NOTICE '   New organizations will automatically get 6 default pillars';
END $$;

-- ============================================
-- STEP 3: Verification
-- ============================================

DO $$
DECLARE
    org_count INTEGER;
    total_pillars INTEGER;
    expected_pillars INTEGER;
    org_with_all_pillars INTEGER;
BEGIN
    -- Count organizations
    SELECT COUNT(*) INTO org_count FROM organizations;
    
    -- Count total pillars
    SELECT COUNT(*) INTO total_pillars FROM pillars;
    
    -- Expected pillars (6 per org)
    expected_pillars := org_count * 6;
    
    -- Count organizations with all 6 pillars
    SELECT COUNT(*) INTO org_with_all_pillars
    FROM (
        SELECT organization_id, COUNT(*) AS pillar_count
        FROM pillars
        GROUP BY organization_id
        HAVING COUNT(*) >= 6
    ) AS org_pillars;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total organizations: %', org_count;
    RAISE NOTICE 'Total pillars: %', total_pillars;
    RAISE NOTICE 'Expected pillars: % (6 per org)', expected_pillars;
    RAISE NOTICE 'Organizations with all 6 pillars: %', org_with_all_pillars;
    RAISE NOTICE '';
    
    IF org_with_all_pillars = org_count THEN
        RAISE NOTICE '✅ All organizations have at least 6 pillars';
    ELSE
        RAISE WARNING '⚠️  % organizations are missing pillars', (org_count - org_with_all_pillars);
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 4: Display pillars by organization
-- ============================================

SELECT 
    o.slug AS organization,
    o.name AS org_name,
    COUNT(p.id) AS pillar_count,
    STRING_AGG(p.name, ', ' ORDER BY 
        CASE p.name
            WHEN 'ESG' THEN 1
            WHEN 'Innovation' THEN 2
            WHEN 'Operations' THEN 3
            WHEN 'Customer Experience' THEN 4
            WHEN 'Culture & HR' THEN 5
            WHEN 'Uncategorized' THEN 6
            ELSE 99
        END
    ) AS pillars
FROM organizations o
LEFT JOIN pillars p ON p.organization_id = o.id
GROUP BY o.id, o.slug, o.name
ORDER BY o.slug;
