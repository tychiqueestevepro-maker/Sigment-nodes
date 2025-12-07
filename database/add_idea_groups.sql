-- ===================================================
-- Migration: Add Idea Groups System
-- Description: Groups for collaborative work on ideas
-- Only OWNER/BOARD can create groups and manage members
-- ===================================================

-- 1. Idea Groups Table
CREATE TABLE IF NOT EXISTS idea_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6366f1', -- Default indigo color
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_idea_groups_org ON idea_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_idea_groups_created_by ON idea_groups(created_by);

-- 2. Idea Group Members Table
-- role: 'admin' (can manage members) or 'member' (read/write ideas only)
CREATE TABLE IF NOT EXISTS idea_group_members (
    idea_group_id UUID NOT NULL REFERENCES idea_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (idea_group_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_idea_group_members_user ON idea_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_idea_group_members_group ON idea_group_members(idea_group_id);

-- 3. Idea Group Items Table (Ideas/Notes linked to groups)
CREATE TABLE IF NOT EXISTS idea_group_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_group_id UUID NOT NULL REFERENCES idea_groups(id) ON DELETE CASCADE,
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- At least one of note_id or cluster_id must be set
    CONSTRAINT check_item_type CHECK (note_id IS NOT NULL OR cluster_id IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_idea_group_items_group ON idea_group_items(idea_group_id);
CREATE INDEX IF NOT EXISTS idx_idea_group_items_note ON idea_group_items(note_id);
CREATE INDEX IF NOT EXISTS idx_idea_group_items_cluster ON idea_group_items(cluster_id);

-- 4. Idea Group Messages Table
CREATE TABLE IF NOT EXISTS idea_group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_group_id UUID NOT NULL REFERENCES idea_groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachment_url TEXT,
    attachment_type VARCHAR(100),
    attachment_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_idea_group_messages_group ON idea_group_messages(idea_group_id);
CREATE INDEX IF NOT EXISTS idx_idea_group_messages_sender ON idea_group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_idea_group_messages_created ON idea_group_messages(created_at DESC);

-- ===================================================
-- 5. Security (RLS)
-- ===================================================

ALTER TABLE idea_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_group_messages ENABLE ROW LEVEL SECURITY;

-- Idea Groups: Users can see groups they are members of
CREATE POLICY "Users can view groups they are members of" ON idea_groups
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = id
            AND igm.user_id = auth.uid()
        )
    );

-- Idea Groups: Creators can update their groups
CREATE POLICY "Admin can update groups" ON idea_groups
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = id
            AND igm.user_id = auth.uid()
            AND igm.role = 'admin'
        )
    );

-- Idea Groups: Creators can delete their groups
CREATE POLICY "Admin can delete groups" ON idea_groups
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = id
            AND igm.user_id = auth.uid()
            AND igm.role = 'admin'
        )
    );

-- Group Members: Users can view members of groups they're in
CREATE POLICY "Users can view members of their groups" ON idea_group_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id = auth.uid()
        )
    );

-- Group Members: Only admins can add/remove members
CREATE POLICY "Admins can manage members" ON idea_group_members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id = auth.uid()
            AND igm.role = 'admin'
        )
    );

-- Group Items: Members can view items in their groups
CREATE POLICY "Members can view group items" ON idea_group_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id = auth.uid()
        )
    );

-- Group Items: Members can add items
CREATE POLICY "Members can add items" ON idea_group_items
    FOR INSERT
    WITH CHECK (
        auth.uid() = added_by AND
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id = auth.uid()
        )
    );

-- Group Messages: Members can view messages in their groups
CREATE POLICY "Members can view group messages" ON idea_group_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id = auth.uid()
        )
    );

-- Group Messages: Members can send messages
CREATE POLICY "Members can send messages" ON idea_group_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id = auth.uid()
        )
    );

-- ===================================================
-- 6. Trigger to update group's updated_at on message
-- ===================================================

CREATE OR REPLACE FUNCTION update_idea_group_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE idea_groups
    SET updated_at = NOW()
    WHERE id = NEW.idea_group_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_group_on_msg ON idea_group_messages;
CREATE TRIGGER update_group_on_msg
AFTER INSERT ON idea_group_messages
FOR EACH ROW
EXECUTE FUNCTION update_idea_group_timestamp();

-- Also update on item add
DROP TRIGGER IF EXISTS update_group_on_item ON idea_group_items;
CREATE TRIGGER update_group_on_item
AFTER INSERT ON idea_group_items
FOR EACH ROW
EXECUTE FUNCTION update_idea_group_timestamp();

-- ===================================================
-- 7. RPC Function: Create Idea Group
-- Only OWNER/BOARD can create groups
-- ===================================================

CREATE OR REPLACE FUNCTION create_idea_group(
    p_organization_id UUID,
    p_name VARCHAR(255),
    p_description TEXT,
    p_color VARCHAR(20),
    p_member_ids UUID[],
    p_current_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group_id UUID;
    v_user_id UUID;
    v_user_role VARCHAR(20);
BEGIN
    -- 1. Verify current user is OWNER or BOARD
    SELECT role INTO v_user_role
    FROM memberships
    WHERE user_id = p_current_user_id
    AND organization_id = p_organization_id;
    
    IF v_user_role IS NULL OR v_user_role NOT IN ('OWNER', 'BOARD') THEN
        RAISE EXCEPTION 'Only OWNER or BOARD members can create idea groups';
    END IF;

    -- 2. Create the group
    INSERT INTO idea_groups (organization_id, name, description, color, created_by)
    VALUES (p_organization_id, p_name, COALESCE(p_description, ''), COALESCE(p_color, '#6366f1'), p_current_user_id)
    RETURNING id INTO v_group_id;

    -- 3. Add the creator as admin
    INSERT INTO idea_group_members (idea_group_id, user_id, role, added_by)
    VALUES (v_group_id, p_current_user_id, 'admin', p_current_user_id);

    -- 4. Add other members
    FOREACH v_user_id IN ARRAY p_member_ids
    LOOP
        -- Skip if it's the current user (already added as admin)
        IF v_user_id <> p_current_user_id THEN
            -- Check if user is OWNER/BOARD - they get admin role too
            SELECT role INTO v_user_role
            FROM memberships
            WHERE user_id = v_user_id
            AND organization_id = p_organization_id;
            
            INSERT INTO idea_group_members (idea_group_id, user_id, role, added_by)
            VALUES (
                v_group_id, 
                v_user_id, 
                CASE WHEN v_user_role IN ('OWNER', 'BOARD') THEN 'admin' ELSE 'member' END,
                p_current_user_id
            );
        END IF;
    END LOOP;

    RETURN v_group_id;
END;
$$;

-- ===================================================
-- 8. RPC Function: Add member to group
-- Only admins can add members
-- ===================================================

CREATE OR REPLACE FUNCTION add_idea_group_member(
    p_group_id UUID,
    p_user_id UUID,
    p_current_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_org_id UUID;
    v_new_member_role VARCHAR(20);
    v_new_member_org_role VARCHAR(20);
BEGIN
    -- 1. Check if current user is admin of this group
    SELECT EXISTS (
        SELECT 1 FROM idea_group_members
        WHERE idea_group_id = p_group_id
        AND user_id = p_current_user_id
        AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only group admins can add members';
    END IF;

    -- 2. Get organization ID
    SELECT organization_id INTO v_org_id
    FROM idea_groups
    WHERE id = p_group_id;

    -- 3. Verify new member is in the same organization
    SELECT role INTO v_new_member_org_role
    FROM memberships
    WHERE user_id = p_user_id
    AND organization_id = v_org_id;
    
    IF v_new_member_org_role IS NULL THEN
        RAISE EXCEPTION 'User is not a member of this organization';
    END IF;

    -- 4. Determine role (OWNER/BOARD get admin, others get member)
    v_new_member_role := CASE WHEN v_new_member_org_role IN ('OWNER', 'BOARD') THEN 'admin' ELSE 'member' END;

    -- 5. Add member (upsert in case they were previously removed)
    INSERT INTO idea_group_members (idea_group_id, user_id, role, added_by)
    VALUES (p_group_id, p_user_id, v_new_member_role, p_current_user_id)
    ON CONFLICT (idea_group_id, user_id) 
    DO UPDATE SET role = v_new_member_role, added_by = p_current_user_id, added_at = NOW();

    RETURN TRUE;
END;
$$;

-- ===================================================
-- 9. RPC Function: Remove member from group
-- Only admins can remove members
-- ===================================================

CREATE OR REPLACE FUNCTION remove_idea_group_member(
    p_group_id UUID,
    p_user_id UUID,
    p_current_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_target_is_creator BOOLEAN;
BEGIN
    -- 1. Check if current user is admin
    SELECT EXISTS (
        SELECT 1 FROM idea_group_members
        WHERE idea_group_id = p_group_id
        AND user_id = p_current_user_id
        AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only group admins can remove members';
    END IF;

    -- 2. Check if target is the creator (cannot remove creator)
    SELECT created_by = p_user_id INTO v_target_is_creator
    FROM idea_groups
    WHERE id = p_group_id;
    
    IF v_target_is_creator THEN
        RAISE EXCEPTION 'Cannot remove the group creator';
    END IF;

    -- 3. Remove member
    DELETE FROM idea_group_members
    WHERE idea_group_id = p_group_id
    AND user_id = p_user_id;

    RETURN TRUE;
END;
$$;
