-- Create tool_connections table for managing connections between tools in projects
CREATE TABLE IF NOT EXISTS tool_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_tool_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    target_tool_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    label TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate connections
    UNIQUE(project_id, source_tool_id, target_tool_id),
    
    -- Prevent self-connections
    CHECK (source_tool_id != target_tool_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tool_connections_project_id ON tool_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_tool_connections_source_tool_id ON tool_connections(source_tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_connections_target_tool_id ON tool_connections(target_tool_id);

-- Enable RLS
ALTER TABLE tool_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view connections for projects in their organization
CREATE POLICY tool_connections_select_policy ON tool_connections
    FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM projects 
            WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
        )
    );

-- RLS Policy: Users can create connections for projects in their organization
CREATE POLICY tool_connections_insert_policy ON tool_connections
    FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM projects 
            WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
        )
    );

-- RLS Policy: Users can update connections for projects in their organization
CREATE POLICY tool_connections_update_policy ON tool_connections
    FOR UPDATE
    USING (
        project_id IN (
            SELECT id FROM projects 
            WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
        )
    );

-- RLS Policy: Users can delete connections for projects in their organization
CREATE POLICY tool_connections_delete_policy ON tool_connections
    FOR DELETE
    USING (
        project_id IN (
            SELECT id FROM projects 
            WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
        )
    );
