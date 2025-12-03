-- ===================================================
-- Migration: Add Multi-Tenant Support
-- Description: Create organizations and memberships tables
-- ===================================================

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Index for fast slug lookup
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- 2. Memberships Table (User-Organization relationship)
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT memberships_role_check CHECK (role IN ('BOARD', 'MEMBER')),
    CONSTRAINT memberships_unique_user_org UNIQUE (user_id, organization_id)
);

-- Indexes for fast queries
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_org_id ON memberships(organization_id);
CREATE INDEX idx_memberships_role ON memberships(role);

-- 3. Add organization_id to notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Index for filtering notes by organization
CREATE INDEX IF NOT EXISTS idx_notes_organization_id ON notes(organization_id);

-- 4. Add organization_id to clusters table
ALTER TABLE clusters
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Index for filtering clusters by organization
CREATE INDEX IF NOT EXISTS idx_clusters_organization_id ON clusters(organization_id);

-- 5. Add organization_id to pillars table
ALTER TABLE pillars
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Index for filtering pillars by organization
CREATE INDEX IF NOT EXISTS idx_pillars_organization_id ON pillars(organization_id);

-- 6. Create default organization for existing data
INSERT INTO organizations (slug, name, description)
VALUES ('default-org', 'Default Organization', 'Initial organization for migrated data')
ON CONFLICT (slug) DO NOTHING;

-- 7. Auto-update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to organizations
CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to memberships
CREATE TRIGGER update_memberships_updated_at
    BEFORE UPDATE ON memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- Commentary
-- ===================================================
-- This migration:
-- 1. Creates organizations table with slug-based routing
-- 2. Creates memberships table for user-org-role relationships
-- 3. Adds organization_id to all main tables (notes, clusters, pillars)
-- 4. Creates a default organization for data migration
-- 5. Sets up indexes for performance with 300+ users per org
