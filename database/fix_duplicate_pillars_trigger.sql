-- ===================================================
-- Fix: Disable duplicate Uncategorized pillar trigger
-- Issue: Both auto_create_uncategorized_pillar and auto_create_default_pillars
--        create "Uncategorized", causing unique constraint violations
-- Solution: Drop the older trigger since auto_create_default_pillars is more complete
-- ===================================================

-- Drop the duplicate trigger
DROP TRIGGER IF EXISTS auto_create_uncategorized_pillar ON organizations;

-- Drop the function
DROP FUNCTION IF EXISTS create_default_uncategorized_pillar();

-- Verification
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname LIKE '%pillar%'
  AND tgrelid::regclass::text = 'organizations';
