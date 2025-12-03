-- ===================================================
-- Migration: Secure Invitation System
-- Description: Create invitations table with TTL and secure tokens
-- ===================================================

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('BOARD', 'MEMBER')),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    
    -- Ensure unique pending invitation per email per org
    CONSTRAINT unique_pending_invite UNIQUE (email, organization_id, status)
);

-- Index for fast token lookup
CREATE INDEX idx_invitations_token ON invitations(token);

-- Index for cleaning up expired invitations
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);

-- RLS Policies (if enabled, but for now we rely on API logic)
-- ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
