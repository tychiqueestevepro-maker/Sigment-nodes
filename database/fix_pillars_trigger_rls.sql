-- ===================================================
-- Fix: Allow triggers to bypass RLS when creating default pillars
-- Issue: RLS policies block trigger-created pillars because no org context is set
-- Solution: Make trigger functions SECURITY DEFINER to bypass RLS
-- ===================================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS auto_create_default_pillars ON organizations;

-- Recreate function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_default_pillars_for_org()
RETURNS TRIGGER 
SECURITY DEFINER  -- 🔑 Runs with function owner's privileges, bypasses RLS
SET search_path = public
AS $$
DECLARE
    default_pillars JSONB := '[
        {"name": "Product", "description": "Product development, features, and roadmap", "color": "#3B82F6"},
        {"name": "Marketing", "description": "Marketing campaigns, strategies, and brand", "color": "#EF4444"},
        {"name": "Operations", "description": "Business operations, processes, and efficiency", "color": "#10B981"},
        {"name": "Finance", "description": "Financial planning, budgets, and revenue", "color": "#F59E0B"},
        {"name": "People", "description": "Team, culture, hiring, and HR", "color": "#8B5CF6"},
        {"name": "Uncategorized", "description": "Ideas that could not be categorized into existing pillars (relevance score < 4/10)", "color": "#9CA3AF"}
    ]'::JSONB;
    pillar JSONB;
    pillar_order INTEGER := 0;
BEGIN
    -- Insert default pillars for the new organization
    FOR pillar IN SELECT * FROM jsonb_array_elements(default_pillars)
    LOOP
        pillar_order := pillar_order + 1;
        
        INSERT INTO pillars (organization_id, name, description, color)
        VALUES (
            NEW.id,
            pillar->>'name',
            pillar->>'description',
            pillar->>'color'
        );
        
        RAISE NOTICE 'Created pillar "%" for organization "%"', pillar->>'name', NEW.name;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER auto_create_default_pillars
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION create_default_pillars_for_org();

-- Trigger fixed successfully
