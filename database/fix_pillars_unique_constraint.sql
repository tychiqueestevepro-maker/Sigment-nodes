-- ===================================================
-- Fix: Remove UNIQUE constraint on pillars.name
-- Description: Allow multiple pillars with same name across different organizations
-- Date: 2025-12-02
-- ===================================================

-- ============================================
-- STEP 1: Drop the UNIQUE constraint on name
-- ============================================

-- Check if constraint exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pillars_name_key'
    ) THEN
        ALTER TABLE pillars DROP CONSTRAINT pillars_name_key;
        RAISE NOTICE '✅ Dropped UNIQUE constraint on pillars.name';
    ELSE
        RAISE NOTICE '⚠️  Constraint pillars_name_key does not exist';
    END IF;
END $$;

-- ============================================
-- STEP 2: Verify the constraint was dropped
-- ============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pillars_name_key'
    ) THEN
        RAISE EXCEPTION '❌ Failed to drop constraint pillars_name_key';
    ELSE
        RAISE NOTICE '✅ Constraint successfully removed';
    END IF;
END $$;

-- ============================================
-- STEP 3: Verify idx_pillars_org_name exists (from multi-tenant migration)
-- ============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_pillars_org_name'
    ) THEN
        RAISE NOTICE '✅ UNIQUE index idx_pillars_org_name exists (organization_id, name)';
    ELSE
        RAISE WARNING '⚠️  Index idx_pillars_org_name does not exist, creating it...';
        
        -- Create UNIQUE index on (organization_id, name)
        CREATE UNIQUE INDEX idx_pillars_org_name ON pillars(organization_id, name);
        
        RAISE NOTICE '✅ Created UNIQUE index idx_pillars_org_name';
    END IF;
END $$;

-- ============================================
-- STEP 4: Summary
-- ============================================

DO $$
DECLARE
    unique_names_count INTEGER;
    total_pillars_count INTEGER;
BEGIN
    -- Count unique pillar names
    SELECT COUNT(DISTINCT name) INTO unique_names_count FROM pillars;
    
    -- Count total pillars
    SELECT COUNT(*) INTO total_pillars_count FROM pillars;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total pillars: %', total_pillars_count;
    RAISE NOTICE 'Unique pillar names: %', unique_names_count;
    RAISE NOTICE '';
    RAISE NOTICE 'You can now have multiple pillars with the same name';
    RAISE NOTICE 'across different organizations.';
    RAISE NOTICE '';
    RAISE NOTICE 'Constraint: UNIQUE(organization_id, name)';
    RAISE NOTICE '========================================';
END $$;
