-- ===================================================
-- Migration: Add display_order to pillars table
-- Description: Add display_order column to allow ordering pillars in the UI
-- Date: 2025-12-03
-- ===================================================

-- Add display_order column if it doesn't exist
ALTER TABLE pillars 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update existing pillars with a default order based on creation time
WITH ordered_pillars AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) as rn
    FROM pillars
)
UPDATE pillars
SET display_order = ordered_pillars.rn
FROM ordered_pillars
WHERE pillars.id = ordered_pillars.id;

RAISE NOTICE '✅ Added display_order column to pillars table';
