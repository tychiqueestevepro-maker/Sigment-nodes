-- OPTIMIZED GROUP CHAT FUNCTIONS (v3 - ADD SHARED_NOTE SUPPORT)
-- Replace slow Python loops with fast SQL RPCs

-- 1. Get Group Messages (Single Query with Shared Note Support)
-- Drop first to allow return type change
DROP FUNCTION IF EXISTS get_group_messages_optimized(UUID, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_group_messages_optimized(
    p_group_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_member BOOLEAN;
    v_messages JSONB;
BEGIN
    -- 1. Verify membership
    SELECT EXISTS (
        SELECT 1 FROM idea_group_members
        WHERE idea_group_id = p_group_id AND user_id = p_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
        RAISE EXCEPTION 'Access Denied: User is not a member of this group';
    END IF;

    -- 2. Fetch messages with sender info, shared notes, and computed read receipts
    WITH group_participants AS (
        -- Get all members of the group to check read status against
        SELECT 
            m.user_id,
            m.last_read_at,
            u.first_name,
            u.last_name
        FROM idea_group_members m
        JOIN users u ON m.user_id = u.id
        WHERE m.idea_group_id = p_group_id
        AND m.user_id != p_user_id -- Don't count self
    ),
    messages AS (
        SELECT 
            m.id,
            m.idea_group_id,
            m.sender_id,
            m.content,
            m.attachment_url,
            m.attachment_type,
            m.attachment_name,
            m.shared_note_id,
            m.created_at,
            m.updated_at,
            -- Sender Info
            u.first_name,
            u.last_name,
            u.avatar_url,
            -- Sender Full Name
            TRIM(CONCAT(u.first_name, ' ', u.last_name)) as sender_name,
            -- Shared Note Info (join with notes table)
            n.id as note_id,
            n.title_clarified as note_title,
            n.content_clarified as note_content_clarified,
            n.content_raw as note_content_raw,
            n.status as note_status,
            p.name as pillar_name,
            p.color as pillar_color
        FROM idea_group_messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN notes n ON m.shared_note_id = n.id
        LEFT JOIN pillars p ON n.pillar_id = p.id
        WHERE m.idea_group_id = p_group_id
        ORDER BY m.created_at DESC
        LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m.id,
            'idea_group_id', m.idea_group_id,
            'sender_id', m.sender_id,
            'content', m.content,
            'attachment_url', m.attachment_url,
            'attachment_type', m.attachment_type,
            'attachment_name', m.attachment_name,
            'shared_note_id', m.shared_note_id,
            -- Shared Note embedded data (same format as Chat)
            'shared_note', CASE 
                WHEN m.shared_note_id IS NOT NULL THEN
                    jsonb_build_object(
                        'id', m.note_id,
                        'title', COALESCE(m.note_title, LEFT(COALESCE(m.note_content_clarified, m.note_content_raw, ''), 60)),
                        'content', COALESCE(m.note_content_clarified, m.note_content_raw),
                        'content_clarified', m.note_content_clarified,
                        'content_raw', m.note_content_raw,
                        'status', m.note_status,
                        'pillar_name', m.pillar_name,
                        'pillar_color', m.pillar_color
                    )
                ELSE NULL
            END,
            'created_at', m.created_at,
            'sender_name', m.sender_name,
            'sender_avatar_url', m.avatar_url,
            -- Calculate read_by only if current user is sender
            'read_by', CASE 
                WHEN m.sender_id = p_user_id THEN (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'user_id', p.user_id,
                            'first_name', p.first_name,
                            'last_name', p.last_name,
                            'read_at', p.last_read_at
                        )
                    ), '[]'::jsonb)
                    FROM group_participants p
                    WHERE p.last_read_at >= m.created_at
                )
                ELSE '[]'::jsonb
            END
        )
    ) INTO v_messages
    FROM messages m;

    RETURN COALESCE(v_messages, '[]'::jsonb);
END;
$$;


-- 2. Get User Groups (Single Query - Replaces complex get_idea_groups loop)
-- Drop first to allow return type change
DROP FUNCTION IF EXISTS get_user_idea_groups_optimized(UUID, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_user_idea_groups_optimized(
    p_user_id UUID,
    p_org_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_groups JSONB;
BEGIN
    WITH user_groups AS (
        SELECT idea_group_id, role, last_read_at
        FROM idea_group_members
        WHERE user_id = p_user_id
    ),
    group_stats AS (
        -- Pre-calculate counts and last message info
        SELECT 
            g.id,
            g.updated_at as group_updated_at,
            COUNT(DISTINCT m.user_id) as member_count,
            COUNT(DISTINCT i.id) as item_count,
            MAX(msg.created_at) as last_msg_at,
            -- Get sender of last message
            (SELECT sender_id FROM idea_group_messages WHERE idea_group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_msg_sender
        FROM idea_groups g
        LEFT JOIN idea_group_members m ON g.id = m.idea_group_id
        LEFT JOIN idea_group_items i ON g.id = i.idea_group_id
        LEFT JOIN idea_group_messages msg ON g.id = msg.idea_group_id
        WHERE g.organization_id = p_org_id
        GROUP BY g.id, g.updated_at
    ),
    group_members_json AS (
        -- Aggregate members for each group
        SELECT 
            m.idea_group_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', COALESCE(u.email, ''), -- FIX: Ensure never null
                    'job_title', u.job_title,
                    'avatar_url', u.avatar_url,
                    'role', m.role,
                    'added_at', m.added_at
                )
            ) as members_list
        FROM idea_group_members m
        JOIN users u ON m.user_id = u.id
        GROUP BY m.idea_group_id
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', g.id,
            'organization_id', g.organization_id,
            'name', g.name,
            'description', g.description,
            'color', g.color,
            'created_by', g.created_by,
            'created_at', g.created_at,
            'updated_at', g.updated_at,
            'member_count', COALESCE(gs.member_count, 0),
            'item_count', COALESCE(gs.item_count, 0),
            'members', COALESCE(gmj.members_list, '[]'::jsonb),
            'is_admin', (ug.role = 'admin' OR g.created_by = p_user_id),
            'has_unread', (
                -- Unread logic: Last msg exists AND (user never read OR last msg newer than read)
                -- AND last msg was NOT sent by user
                gs.last_msg_at IS NOT NULL 
                AND gs.last_msg_sender != p_user_id
                AND (ug.last_read_at IS NULL OR gs.last_msg_at > ug.last_read_at)
            )
        )
        ORDER BY gs.group_updated_at DESC
    ) INTO v_groups
    FROM idea_groups g
    JOIN user_groups ug ON g.id = ug.idea_group_id
    JOIN group_stats gs ON g.id = gs.id
    LEFT JOIN group_members_json gmj ON g.id = gmj.idea_group_id
    WHERE g.organization_id = p_org_id
    LIMIT p_limit OFFSET p_offset;

    RETURN COALESCE(v_groups, '[]'::jsonb);
END;
$$;
