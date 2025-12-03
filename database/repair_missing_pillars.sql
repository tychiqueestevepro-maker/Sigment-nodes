-- ===================================================
-- Repair Script: Create missing default pillars for existing organizations
-- Description: Inserts default pillars for any organization that has 0 pillars
-- Date: 2025-12-03
-- ===================================================

DO $$
DECLARE
    org_record RECORD;
    default_pillars JSONB := '[
        {"name": "Product", "description": "Product development, features, and roadmap", "color": "#3B82F6"},
        {"name": "Marketing", "description": "Marketing campaigns, strategies, and brand", "color": "#EF4444"},
        {"name": "Operations", "description": "Business operations, processes, and efficiency", "color": "#10B981"},
        {"name": "Finance", "description": "Financial planning, budgets, and revenue", "color": "#F59E0B"},
        {"name": "People", "description": "Team, culture, hiring, and HR", "color": "#8B5CF6"},
        {"name": "Uncategorized", "description": "Ideas that could not be categorized into existing pillars (relevance score < 4/10)", "color": "#9CA3AF"}
    ]'::JSONB;
    pillar JSONB;
    pillars_created INTEGER := 0;
BEGIN
    -- Loop through organizations that have NO pillars
    FOR org_record IN 
        SELECT o.id, o.name 
        FROM organizations o
        LEFT JOIN pillars p ON o.id = p.organization_id
        GROUP BY o.id, o.name
        HAVING COUNT(p.id) = 0
    LOOP
        RAISE NOTICE 'Fixing missing pillars for organization: %', org_record.name;
        
        -- Insert default pillars
        FOR pillar IN SELECT * FROM jsonb_array_elements(default_pillars)
        LOOP
            INSERT INTO pillars (organization_id, name, description, color)
            VALUES (
                org_record.id,
                pillar->>'name',
                pillar->>'description',
                pillar->>'color'
            );
            pillars_created := pillars_created + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Repair complete. Created % pillars.', pillars_created;
    RAISE NOTICE '========================================';
END $$;
