-- Fix get_user_idea_groups_optimized to include is_project
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
                    'email', COALESCE(u.email, ''),
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
            ),
            'is_project', COALESCE(g.is_project, FALSE)
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
