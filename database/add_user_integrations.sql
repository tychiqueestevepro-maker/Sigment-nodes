-- Migration: Add user_integrations table for OAuth tokens
-- Description: Store OAuth access tokens for Slack and Teams integrations per user

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_integrations table
CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('slack', 'teams')),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    scope TEXT,
    team_id VARCHAR(255), -- Slack workspace ID or Teams tenant ID
    user_platform_id VARCHAR(255), -- User ID on the platform (Slack user ID or Microsoft user ID)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one integration per user per platform
    UNIQUE(user_id, platform)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_platform ON user_integrations(platform);
CREATE INDEX IF NOT EXISTS idx_user_integrations_expires_at ON user_integrations(expires_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_integrations_updated_at
    BEFORE UPDATE ON user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_integrations_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own integrations
CREATE POLICY user_integrations_select_own ON user_integrations
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own integrations
CREATE POLICY user_integrations_insert_own ON user_integrations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own integrations
CREATE POLICY user_integrations_update_own ON user_integrations
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own integrations
CREATE POLICY user_integrations_delete_own ON user_integrations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create helper function to check if user has integration
CREATE OR REPLACE FUNCTION user_has_integration(p_user_id UUID, p_platform VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM user_integrations 
        WHERE user_id = p_user_id 
        AND platform = p_platform
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get user's integration token
CREATE OR REPLACE FUNCTION get_user_integration_token(p_user_id UUID, p_platform VARCHAR)
RETURNS TABLE (
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    team_id VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ui.access_token,
        ui.refresh_token,
        ui.expires_at,
        ui.team_id
    FROM user_integrations ui
    WHERE ui.user_id = p_user_id 
    AND ui.platform = p_platform
    AND (ui.expires_at IS NULL OR ui.expires_at > NOW())
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_integrations TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_integration TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_integration_token TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE user_integrations IS 'Stores OAuth access tokens for third-party integrations (Slack, Teams) per user';
COMMENT ON COLUMN user_integrations.platform IS 'Platform name: slack or teams';
COMMENT ON COLUMN user_integrations.access_token IS 'OAuth access token (encrypted in production)';
COMMENT ON COLUMN user_integrations.refresh_token IS 'OAuth refresh token for token renewal';
COMMENT ON COLUMN user_integrations.expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN user_integrations.team_id IS 'Platform-specific team/workspace ID';
COMMENT ON COLUMN user_integrations.user_platform_id IS 'User ID on the external platform';
COMMENT ON FUNCTION user_has_integration IS 'Check if user has a valid integration for a platform';
COMMENT ON FUNCTION get_user_integration_token IS 'Retrieve user integration token data for a platform';
