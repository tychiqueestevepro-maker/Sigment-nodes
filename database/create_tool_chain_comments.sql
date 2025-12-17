-- Table for comments on tool chain nodes
-- Each comment is associated with a specific app instance in a chain

CREATE TABLE IF NOT EXISTS tool_chain_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- The chain and app this comment is about
    chain_id UUID NOT NULL,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Comment content
    content TEXT NOT NULL,
    
    -- Who wrote the comment
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tool_chain_comments_chain_app 
    ON tool_chain_comments(chain_id, application_id);
    
CREATE INDEX IF NOT EXISTS idx_tool_chain_comments_project 
    ON tool_chain_comments(project_id);

-- RLS Policies
ALTER TABLE tool_chain_comments ENABLE ROW LEVEL SECURITY;

-- Simple policies - allow authenticated users to manage comments in projects
CREATE POLICY "Authenticated users can read comments" ON tool_chain_comments
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create comments" ON tool_chain_comments
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own comments" ON tool_chain_comments
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));
