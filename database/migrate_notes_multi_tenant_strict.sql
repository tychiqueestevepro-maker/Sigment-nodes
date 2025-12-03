-- ===================================================
-- Migration: Multi-Tenant Strict for Notes & Clustering
-- Description: Enforce organization_id isolation on all tables
-- Date: 2025-12-02
-- Author: Database Architecture Team
-- ===================================================

-- ============================================
-- STEP 1: Add organization_id to missing tables
-- ============================================

-- 1.1 Add organization_id to note_events
ALTER TABLE note_events 
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 1.2 Add organization_id to cluster_snapshots
ALTER TABLE cluster_snapshots
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- ============================================
-- STEP 2: Populate organization_id from parent tables
-- ============================================

-- 2.1 Populate note_events.organization_id from notes
UPDATE note_events ne
SET organization_id = n.organization_id
FROM notes n
WHERE ne.note_id = n.id
AND ne.organization_id IS NULL;

-- 2.2 Populate cluster_snapshots.organization_id from clusters
UPDATE cluster_snapshots cs
SET organization_id = c.organization_id
FROM clusters c
WHERE cs.cluster_id = c.id
AND cs.organization_id IS NULL;

-- ============================================
-- STEP 3: Make organization_id NOT NULL (STRICT MODE)
-- ============================================

-- 3.1 pillars (already has organization_id from previous migration)
ALTER TABLE pillars
ALTER COLUMN organization_id SET NOT NULL;

-- 3.2 notes (already has organization_id from previous migration)
ALTER TABLE notes
ALTER COLUMN organization_id SET NOT NULL;

-- 3.3 clusters (already has organization_id from previous migration)
ALTER TABLE clusters
ALTER COLUMN organization_id SET NOT NULL;

-- 3.4 note_events
ALTER TABLE note_events
ALTER COLUMN organization_id SET NOT NULL;

-- 3.5 cluster_snapshots
ALTER TABLE cluster_snapshots
ALTER COLUMN organization_id SET NOT NULL;

-- ============================================
-- STEP 4: Add Foreign Key Constraints
-- ============================================

-- 4.1 note_events → organizations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_note_events_organization'
    ) THEN
        ALTER TABLE note_events
        ADD CONSTRAINT fk_note_events_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4.2 cluster_snapshots → organizations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cluster_snapshots_organization'
    ) THEN
        ALTER TABLE cluster_snapshots
        ADD CONSTRAINT fk_cluster_snapshots_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- STEP 5: Create Indexes for Performance
-- ============================================

-- 5.1 Index on note_events.organization_id
CREATE INDEX IF NOT EXISTS idx_note_events_organization_id 
ON note_events(organization_id);

-- 5.2 Index on cluster_snapshots.organization_id
CREATE INDEX IF NOT EXISTS idx_cluster_snapshots_organization_id 
ON cluster_snapshots(organization_id);

-- 5.3 Composite index for note_events (organization + note)
CREATE INDEX IF NOT EXISTS idx_note_events_org_note 
ON note_events(organization_id, note_id);

-- 5.4 Composite index for cluster_snapshots (organization + cluster)
CREATE INDEX IF NOT EXISTS idx_cluster_snapshots_org_cluster 
ON cluster_snapshots(organization_id, cluster_id);

-- 5.5 Composite index for notes (organization + status) - CRITICAL for queries
CREATE INDEX IF NOT EXISTS idx_notes_org_status 
ON notes(organization_id, status);

-- 5.6 Composite index for notes (organization + user) - CRITICAL for user queries
CREATE INDEX IF NOT EXISTS idx_notes_org_user 
ON notes(organization_id, user_id);

-- 5.7 Composite index for clusters (organization + pillar)
CREATE INDEX IF NOT EXISTS idx_clusters_org_pillar 
ON clusters(organization_id, pillar_id);

-- 5.8 Composite index for pillars (organization + name) - UNIQUE constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_pillars_org_name 
ON pillars(organization_id, name);

-- ============================================
-- STEP 6: Update find_similar_notes Function (SECURITY CRITICAL)
-- ============================================

-- Drop old function
DROP FUNCTION IF EXISTS find_similar_notes(vector, UUID, FLOAT, INTEGER);

-- Create new function with organization_id parameter
CREATE OR REPLACE FUNCTION find_similar_notes(
    query_embedding vector(1536),
    target_pillar_id UUID,
    p_organization_id UUID,  -- 🔒 NEW: Organization isolation
    similarity_threshold FLOAT DEFAULT 0.75,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    note_id UUID,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id AS note_id,
        1 - (n.embedding <=> query_embedding) AS similarity
    FROM notes n
    WHERE 
        n.organization_id = p_organization_id  -- 🔒 SECURITY: Organization isolation
        AND n.pillar_id = target_pillar_id
        AND n.status = 'processed'
        AND n.embedding IS NOT NULL
        AND 1 - (n.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY n.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION find_similar_notes IS 'Find similar notes within the same organization using vector similarity (Multi-Tenant Strict)';

-- ============================================
-- STEP 7: Update update_cluster_metadata Trigger (SECURITY)
-- ============================================

-- Drop old trigger
DROP TRIGGER IF EXISTS update_cluster_on_note_change ON notes;

-- Recreate function with organization_id check
CREATE OR REPLACE FUNCTION update_cluster_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Update cluster stats (only for notes in the same organization)
    UPDATE clusters
    SET 
        note_count = (
            SELECT COUNT(*)
            FROM notes
            WHERE cluster_id = NEW.cluster_id 
            AND organization_id = NEW.organization_id  -- 🔒 SECURITY
            AND status = 'processed'
        ),
        avg_relevance_score = (
            SELECT COALESCE(AVG(ai_relevance_score), 0)
            FROM notes
            WHERE cluster_id = NEW.cluster_id 
            AND organization_id = NEW.organization_id  -- 🔒 SECURITY
            AND status = 'processed'
        ),
        last_updated_at = NOW()
    WHERE id = NEW.cluster_id
    AND organization_id = NEW.organization_id;  -- 🔒 SECURITY
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER update_cluster_on_note_change
AFTER INSERT OR UPDATE ON notes
FOR EACH ROW
WHEN (NEW.cluster_id IS NOT NULL AND NEW.status = 'processed')
EXECUTE FUNCTION update_cluster_metadata();

-- ============================================
-- STEP 8: Add Row Level Security Policies (Optional but Recommended)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policy for pillars (users can only see pillars from their organization)
DROP POLICY IF EXISTS pillars_isolation_policy ON pillars;
CREATE POLICY pillars_isolation_policy ON pillars
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- Create policy for notes
DROP POLICY IF EXISTS notes_isolation_policy ON notes;
CREATE POLICY notes_isolation_policy ON notes
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- Create policy for clusters
DROP POLICY IF EXISTS clusters_isolation_policy ON clusters;
CREATE POLICY clusters_isolation_policy ON clusters
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- Create policy for note_events
DROP POLICY IF EXISTS note_events_isolation_policy ON note_events;
CREATE POLICY note_events_isolation_policy ON note_events
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- Create policy for cluster_snapshots
DROP POLICY IF EXISTS cluster_snapshots_isolation_policy ON cluster_snapshots;
CREATE POLICY cluster_snapshots_isolation_policy ON cluster_snapshots
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- ============================================
-- STEP 9: Add Validation Triggers (replaces CHECK constraints)
-- ============================================

-- 9.1 Function to validate notes cross-org references
CREATE OR REPLACE FUNCTION validate_note_cross_org()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate cluster_id belongs to same organization
    IF NEW.cluster_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM clusters c 
            WHERE c.id = NEW.cluster_id 
            AND c.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Cluster % does not belong to organization %', 
                NEW.cluster_id, NEW.organization_id;
        END IF;
    END IF;
    
    -- Validate pillar_id belongs to same organization
    IF NEW.pillar_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM pillars p 
            WHERE p.id = NEW.pillar_id 
            AND p.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Pillar % does not belong to organization %', 
                NEW.pillar_id, NEW.organization_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9.2 Trigger for notes validation
DROP TRIGGER IF EXISTS validate_note_cross_org_trigger ON notes;

CREATE TRIGGER validate_note_cross_org_trigger
BEFORE INSERT OR UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION validate_note_cross_org();

-- 9.3 Function to validate clusters cross-org references
CREATE OR REPLACE FUNCTION validate_cluster_cross_org()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate pillar_id belongs to same organization
    IF NOT EXISTS (
        SELECT 1 FROM pillars p 
        WHERE p.id = NEW.pillar_id 
        AND p.organization_id = NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'Pillar % does not belong to organization %', 
            NEW.pillar_id, NEW.organization_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9.4 Trigger for clusters validation
DROP TRIGGER IF EXISTS validate_cluster_cross_org_trigger ON clusters;

CREATE TRIGGER validate_cluster_cross_org_trigger
BEFORE INSERT OR UPDATE ON clusters
FOR EACH ROW
EXECUTE FUNCTION validate_cluster_cross_org();

-- ============================================
-- STEP 10: Update Comments
-- ============================================

COMMENT ON COLUMN pillars.organization_id IS 'Organization ID (Multi-Tenant Strict) - NOT NULL';
COMMENT ON COLUMN notes.organization_id IS 'Organization ID (Multi-Tenant Strict) - NOT NULL';
COMMENT ON COLUMN clusters.organization_id IS 'Organization ID (Multi-Tenant Strict) - NOT NULL';
COMMENT ON COLUMN note_events.organization_id IS 'Organization ID (Multi-Tenant Strict) - NOT NULL';
COMMENT ON COLUMN cluster_snapshots.organization_id IS 'Organization ID (Multi-Tenant Strict) - NOT NULL';

-- ============================================
-- STEP 11: Create Helper Function for Organization Context
-- ============================================

-- Function to set current organization context (for RLS)
CREATE OR REPLACE FUNCTION set_organization_context(org_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_organization_id', org_id::TEXT, false);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_organization_context IS 'Set current organization context for Row Level Security';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify all tables have organization_id NOT NULL
DO $$
DECLARE
    missing_tables TEXT[];
BEGIN
    SELECT ARRAY_AGG(table_name)
    INTO missing_tables
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name IN ('pillars', 'notes', 'clusters', 'note_events', 'cluster_snapshots')
    AND column_name = 'organization_id'
    AND is_nullable = 'YES';
    
    IF missing_tables IS NOT NULL THEN
        RAISE EXCEPTION 'Tables with nullable organization_id: %', missing_tables;
    ELSE
        RAISE NOTICE '✅ All tables have organization_id NOT NULL';
    END IF;
END $$;

-- Verify indexes exist
DO $$
DECLARE
    missing_indexes TEXT[];
BEGIN
    SELECT ARRAY_AGG(expected_index)
    INTO missing_indexes
    FROM (
        VALUES 
            ('idx_note_events_organization_id'),
            ('idx_cluster_snapshots_organization_id'),
            ('idx_notes_org_status'),
            ('idx_notes_org_user'),
            ('idx_clusters_org_pillar'),
            ('idx_pillars_org_name')
    ) AS expected(expected_index)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = expected_index
    );
    
    IF missing_indexes IS NOT NULL THEN
        RAISE WARNING 'Missing indexes: %', missing_indexes;
    ELSE
        RAISE NOTICE '✅ All required indexes exist';
    END IF;
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Multi-Tenant Strict Migration Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables updated:';
    RAISE NOTICE '  - pillars (organization_id NOT NULL)';
    RAISE NOTICE '  - notes (organization_id NOT NULL)';
    RAISE NOTICE '  - clusters (organization_id NOT NULL)';
    RAISE NOTICE '  - note_events (organization_id NOT NULL)';
    RAISE NOTICE '  - cluster_snapshots (organization_id NOT NULL)';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions updated:';
    RAISE NOTICE '  - find_similar_notes (with p_organization_id)';
    RAISE NOTICE '  - update_cluster_metadata (with org checks)';
    RAISE NOTICE '';
    RAISE NOTICE 'Security:';
    RAISE NOTICE '  - Row Level Security enabled';
    RAISE NOTICE '  - Cross-org constraints added';
    RAISE NOTICE '  - Composite indexes created';
    RAISE NOTICE '========================================';
END $$;
