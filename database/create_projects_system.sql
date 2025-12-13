-- ===================================================================
-- PROJECTS SYSTEM - Independent from idea_groups
-- ===================================================================
-- This creates a completely separate system for Projects
-- Similar to how Chat is separated from Groups
-- ===================================================================

-- 1. PROJECTS TABLE (main entity)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    
    CONSTRAINT projects_name_not_empty CHECK (char_length(name) > 0)
);

-- 2. PROJECT_MEMBERS TABLE (team members)
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    
    UNIQUE(project_id, user_id)
);

-- 3. PROJECT_MESSAGES TABLE (chat messages)
CREATE TABLE IF NOT EXISTS project_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    attachment_url TEXT,
    attachment_type TEXT,
    attachment_name TEXT,
    shared_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
    shared_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    is_system_message BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT project_messages_content_or_attachment CHECK (
        content IS NOT NULL OR 
        attachment_url IS NOT NULL OR 
        shared_note_id IS NOT NULL OR 
        shared_post_id IS NOT NULL
    )
);

-- 4. PROJECT_ITEMS TABLE (notes and clusters linked to project)
CREATE TABLE IF NOT EXISTS project_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(project_id, note_id),
    UNIQUE(project_id, cluster_id),
    CONSTRAINT project_items_note_or_cluster CHECK (
        (note_id IS NOT NULL AND cluster_id IS NULL) OR
        (note_id IS NULL AND cluster_id IS NOT NULL)
    )
);

-- ===================================================================
-- INDEXES for performance
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_last_read ON project_members(project_id, last_read_at);

CREATE INDEX IF NOT EXISTS idx_project_messages_project_id ON project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_created_at ON project_messages(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_messages_sender ON project_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_project_items_project_id ON project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_items_note_id ON project_items(note_id);
CREATE INDEX IF NOT EXISTS idx_project_items_cluster_id ON project_items(cluster_id);

-- ===================================================================
-- ROW LEVEL SECURITY (RLS)
-- ===================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;

-- Projects: Users can see projects in their organization
CREATE POLICY "Users can view projects in their org" ON projects
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can create projects in their org" ON projects
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Project creator can update" ON projects
    FOR UPDATE USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Project creator can delete" ON projects
    FOR DELETE USING (created_by = (SELECT auth.uid()));

-- Project Members: Users can see members of projects they're in
CREATE POLICY "Users can view members of their projects" ON project_members
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Project leads can manage members" ON project_members
    FOR ALL USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = (SELECT auth.uid()) AND role = 'lead'
        )
    );

-- Project Messages: Members can view and send messages
CREATE POLICY "Members can view project messages" ON project_messages
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Members can send messages" ON project_messages
    FOR INSERT WITH CHECK (
        sender_id = (SELECT auth.uid()) AND
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = (SELECT auth.uid())
        )
    );

-- Project Items: Members can view and add items
CREATE POLICY "Members can view project items" ON project_items
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Members can add items" ON project_items
    FOR INSERT WITH CHECK (
        added_by = (SELECT auth.uid()) AND
        project_id IN (
            SELECT project_id FROM project_members WHERE user_id = (SELECT auth.uid())
        )
    );

-- ===================================================================
-- MIGRATION: Copy existing projects from idea_groups
-- ===================================================================
-- This will be done in a separate migration script to ensure safety
-- DO NOT RUN THIS AUTOMATICALLY
CREATE OR REPLACE FUNCTION migrate_idea_groups_to_projects()
RETURNS void AS $$
BEGIN
    -- Insert projects
    INSERT INTO projects (id, organization_id, name, description, color, created_by, created_at)
    SELECT 
        id,
        organization_id,
        name,
        description,
        color,
        user_id as created_by,
        created_at
    FROM idea_groups
    WHERE is_project = TRUE
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert project members
    INSERT INTO project_members (project_id, user_id, role, joined_at, last_read_at)
    SELECT 
        igm.idea_group_id as project_id,
        igm.user_id,
        CASE WHEN ig.user_id = igm.user_id THEN 'lead' ELSE 'member' END as role,
        igm.joined_at,
        igm.last_read_at
    FROM idea_group_members igm
    INNER JOIN idea_groups ig ON igm.idea_group_id = ig.id
    WHERE ig.is_project = TRUE
    ON CONFLICT (project_id, user_id) DO NOTHING;
    
    -- Insert project messages
    INSERT INTO project_messages (id, project_id, sender_id, content, attachment_url, attachment_type, attachment_name, shared_note_id, shared_post_id, is_system_message, created_at)
    SELECT 
        igm.id,
        igm.idea_group_id as project_id,
        igm.sender_id,
        igm.content,
        igm.attachment_url,
        igm.attachment_type,
        igm.attachment_name,
        igm.shared_note_id,
        igm.shared_post_id,
        igm.is_system_message,
        igm.created_at
    FROM idea_group_messages igm
    INNER JOIN idea_groups ig ON igm.idea_group_id = ig.id
    WHERE ig.is_project = TRUE
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert project items (notes)
    INSERT INTO project_items (project_id, note_id, cluster_id, added_by, added_at)
    SELECT 
        igi.idea_group_id as project_id,
        igi.note_id,
        NULL as cluster_id,
        igi.added_by,
        igi.added_at
    FROM idea_group_items igi
    INNER JOIN idea_groups ig ON igi.idea_group_id = ig.id
    WHERE ig.is_project = TRUE AND igi.note_id IS NOT NULL
    ON CONFLICT (project_id, note_id) DO NOTHING;
    
    -- Insert project items (clusters)
    INSERT INTO project_items (project_id, note_id, cluster_id, added_by, added_at)
    SELECT 
        igi.idea_group_id as project_id,
        NULL as note_id,
        igi.cluster_id,
        igi.added_by,
        igi.added_at
    FROM idea_group_items igi
    INNER JOIN idea_groups ig ON igi.idea_group_id = ig.id
    WHERE ig.is_project = TRUE AND igi.cluster_id IS NOT NULL
    ON CONFLICT (project_id, cluster_id) DO NOTHING;
    
    RAISE NOTICE 'Migration completed successfully';
END;
$$ LANGUAGE plpgsql;

-- To execute migration: SELECT migrate_idea_groups_to_projects();
