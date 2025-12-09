-- RPC to get optimized list of idea groups for a user
DROP FUNCTION IF EXISTS get_user_idea_groups_optimized(UUID, UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_user_idea_groups_optimized(
    p_user_id UUID,
    p_org_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(t) INTO result
    FROM (
        SELECT 
            g.*,
            (SELECT count(*) FROM idea_group_members gm WHERE gm.idea_group_id = g.id) as member_count,
            (SELECT count(*) FROM idea_group_items gi WHERE gi.idea_group_id = g.id) as item_count,
            EXISTS(SELECT 1 FROM idea_group_members gm WHERE gm.idea_group_id = g.id AND gm.user_id = p_user_id AND gm.role = 'admin') as is_admin,
            (
                SELECT json_agg(json_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'avatar_url', u.avatar_url,
                    'email', u.email,
                    'role', gm.role,
                    'added_at', gm.added_at
                ))
                FROM idea_group_members gm
                JOIN users u ON u.id = gm.user_id
                WHERE gm.idea_group_id = g.id
            ) as members,
            (
                SELECT COUNT(*) > 0
                FROM idea_group_messages msg
                WHERE msg.idea_group_id = g.id
                AND msg.sender_id != p_user_id
                AND msg.created_at > COALESCE(
                    (SELECT last_read_at FROM idea_group_members WHERE idea_group_id = g.id AND user_id = p_user_id),
                    '1970-01-01'::timestamp with time zone
                )
            ) as has_unread,
            (
                SELECT msg.content
                FROM idea_group_messages msg
                WHERE msg.idea_group_id = g.id
                ORDER BY msg.created_at DESC
                LIMIT 1
            ) as last_message_preview
        FROM idea_groups g
        JOIN idea_group_members my_mem ON my_mem.idea_group_id = g.id
        WHERE my_mem.user_id = p_user_id
        AND g.organization_id = p_org_id
        ORDER BY g.updated_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- RPC to get enriched group items (FLATTENED for frontend compatibility)
DROP FUNCTION IF EXISTS get_group_items_enriched(UUID);
CREATE OR REPLACE FUNCTION get_group_items_enriched(
    p_group_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(t) INTO result
    FROM (
        SELECT 
            gi.id,
            gi.idea_group_id,
            gi.note_id,
            gi.cluster_id,
            gi.added_by,
            gi.added_at,
            CASE WHEN gi.note_id IS NOT NULL THEN 'note' ELSE 'cluster' END as item_type,
            
            -- FLATTENED note fields (for frontend)
            CASE WHEN gi.note_id IS NOT NULL THEN
                (SELECT COALESCE(c.title, n.title_clarified, substring(n.content_clarified from 1 for 80), 'Untitled')
                 FROM notes n LEFT JOIN clusters c ON c.id = n.cluster_id WHERE n.id = gi.note_id)
            ELSE 
                (SELECT COALESCE(c.title, 'Cluster') FROM clusters c WHERE c.id = gi.cluster_id)
            END as title,
            
            CASE WHEN gi.note_id IS NOT NULL THEN
                (SELECT COALESCE(n.content_clarified, n.content_raw) FROM notes n WHERE n.id = gi.note_id)
            ELSE
                (SELECT string_agg(n.content_clarified, ' ') FROM (SELECT content_clarified FROM notes WHERE cluster_id = gi.cluster_id ORDER BY created_at LIMIT 2) n)
            END as summary,
            
            CASE WHEN gi.note_id IS NOT NULL THEN
                (SELECT n.content_raw FROM notes n WHERE n.id = gi.note_id)
            ELSE NULL
            END as content_raw,
            
            CASE WHEN gi.note_id IS NOT NULL THEN
                (SELECT COALESCE(p.name, 'Uncategorized') FROM notes n LEFT JOIN pillars p ON p.id = n.pillar_id WHERE n.id = gi.note_id)
            ELSE 'Cluster'
            END as category,
            
            CASE WHEN gi.note_id IS NOT NULL THEN
                (SELECT trim(concat(u.first_name, ' ', u.last_name)) FROM notes n JOIN users u ON u.id = n.user_id WHERE n.id = gi.note_id)
            ELSE NULL
            END as author_name,
            
            CASE WHEN gi.note_id IS NOT NULL THEN
                (SELECT u.avatar_url FROM notes n JOIN users u ON u.id = n.user_id WHERE n.id = gi.note_id)
            ELSE NULL
            END as author_avatar,
            
            CASE WHEN gi.note_id IS NOT NULL THEN
                (SELECT n.ai_relevance_score FROM notes n WHERE n.id = gi.note_id)
            ELSE NULL
            END as relevance_score,
            
            CASE WHEN gi.note_id IS NOT NULL THEN
                (SELECT n.created_at FROM notes n WHERE n.id = gi.note_id)
            ELSE
                (SELECT MIN(n.created_at) FROM notes n WHERE n.cluster_id = gi.cluster_id)
            END as created_date,
            
            CASE WHEN gi.note_id IS NOT NULL THEN
                (SELECT n.status FROM notes n WHERE n.id = gi.note_id)
            ELSE NULL
            END as status,
            
            CASE WHEN gi.note_id IS NOT NULL THEN
                (
                    SELECT COALESCE(
                        (SELECT count(*) FROM notes sub_n WHERE sub_n.cluster_id = n.cluster_id),
                        1
                    )
                    FROM notes n WHERE n.id = gi.note_id
                )
            ELSE 
                (SELECT c.note_count FROM clusters c WHERE c.id = gi.cluster_id)
            END as note_count,
            
            -- Collaborators array
            CASE WHEN gi.note_id IS NOT NULL THEN
                (
                    SELECT COALESCE(
                        (SELECT json_agg(json_build_object(
                            'name', trim(concat(cu.first_name, ' ', cu.last_name)),
                            'avatar_url', cu.avatar_url,
                            'quote', substring(cn.content_raw from 1 for 150),
                            'date', cn.created_at
                        ))
                        FROM notes cn
                        JOIN users cu ON cu.id = cn.user_id
                        WHERE cn.cluster_id = n.cluster_id),
                        json_build_array(json_build_object(
                            'name', trim(concat(u.first_name, ' ', u.last_name)),
                            'avatar_url', u.avatar_url,
                            'quote', substring(n.content_raw from 1 for 150),
                            'date', n.created_at
                        ))
                    )
                    FROM notes n
                    LEFT JOIN users u ON u.id = n.user_id
                    WHERE n.id = gi.note_id
                )
            ELSE
                (
                    SELECT json_agg(json_build_object(
                        'name', trim(concat(cu.first_name, ' ', cu.last_name)),
                        'avatar_url', cu.avatar_url,
                        'quote', substring(cn.content_raw from 1 for 150),
                        'date', cn.created_at
                    ))
                    FROM notes cn
                    JOIN users cu ON cu.id = cn.user_id
                    WHERE cn.cluster_id = gi.cluster_id
                )
            END as collaborators

        FROM idea_group_items gi
        WHERE gi.idea_group_id = p_group_id
        ORDER BY gi.added_at DESC
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- RPC to get group messages optimized
DROP FUNCTION IF EXISTS get_group_messages_optimized(UUID, UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_group_messages_optimized(
    p_group_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(t) INTO result
    FROM (
        SELECT 
            m.id,
            m.idea_group_id,
            m.sender_id,
            m.content,
            m.attachment_url,
            m.attachment_type,
            m.attachment_name,
            m.created_at,
            trim(concat(u.first_name, ' ', u.last_name)) as sender_name,
            u.avatar_url as sender_avatar_url,
            
            CASE WHEN m.sender_id = p_user_id THEN
                (
                    SELECT COALESCE(json_agg(json_build_object(
                        'user_id', gm.user_id,
                        'first_name', ru.first_name,
                        'last_name', ru.last_name,
                        'read_at', gm.last_read_at
                    )), '[]'::json)
                    FROM idea_group_members gm
                    JOIN users ru ON ru.id = gm.user_id
                    WHERE gm.idea_group_id = p_group_id
                    AND gm.user_id != p_user_id 
                    AND gm.last_read_at >= m.created_at
                )
            ELSE
                '[]'::json
            END as read_by

        FROM idea_group_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.idea_group_id = p_group_id
        ORDER BY m.created_at ASC
        LIMIT p_limit
        OFFSET p_offset
    ) t;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;
