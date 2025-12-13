-- Update get_group_messages_optimized to include is_system_message
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

    -- 2. Fetch messages with sender info, shared notes, shared posts, and computed read receipts
    WITH group_participants AS (
        SELECT 
            m.user_id,
            m.last_read_at,
            u.first_name,
            u.last_name
        FROM idea_group_members m
        JOIN users u ON m.user_id = u.id
        WHERE m.idea_group_id = p_group_id
        AND m.user_id != p_user_id
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
            m.shared_post_id,
            m.created_at,
            m.is_system_message,
            -- Sender Info
            u.first_name,
            u.last_name,
            u.avatar_url,
            -- Sender Full Name
            TRIM(CONCAT(u.first_name, ' ', u.last_name)) as sender_name,
            -- Shared Note Info
            n.id as note_id,
            n.title_clarified as note_title,
            n.content_clarified as note_content_clarified,
            n.content_raw as note_content_raw,
            n.status as note_status,
            pil.name as pillar_name,
            pil.color as pillar_color,
            -- Shared Post Info
            pst.id as post_id,
            pst.content as post_content,
            pst.media_urls as post_media_urls,
            pst.post_type as post_type,
            pst.likes_count as post_likes_count,
            pst.comments_count as post_comments_count,
            pst.has_poll as post_has_poll,
            pst.created_at as post_created_at,
            post_author.first_name as post_author_first_name,
            post_author.last_name as post_author_last_name,
            post_author.avatar_url as post_author_avatar
        FROM idea_group_messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN notes n ON m.shared_note_id = n.id
        LEFT JOIN pillars pil ON n.pillar_id = pil.id
        LEFT JOIN posts pst ON m.shared_post_id = pst.id
        LEFT JOIN users post_author ON pst.user_id = post_author.id
        WHERE m.idea_group_id = p_group_id
        ORDER BY m.created_at ASC
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
            'shared_post_id', m.shared_post_id,
            'shared_post', CASE 
                WHEN m.shared_post_id IS NOT NULL THEN
                    jsonb_build_object(
                        'id', m.post_id,
                        'content', m.post_content,
                        'media_urls', m.post_media_urls,
                        'post_type', m.post_type,
                        'likes_count', COALESCE(m.post_likes_count, 0),
                        'comments_count', COALESCE(m.post_comments_count, 0),
                        'user_info', jsonb_build_object(
                            'first_name', m.post_author_first_name,
                            'last_name', m.post_author_last_name,
                            'avatar_url', m.post_author_avatar
                        )
                    )
                ELSE NULL
            END,
            'created_at', m.created_at,
            'sender_name', m.sender_name,
            'sender_avatar_url', m.avatar_url,
            'is_system_message', COALESCE(m.is_system_message, FALSE),
            'read_by', CASE 
                WHEN m.sender_id = p_user_id THEN (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'user_id', gp.user_id,
                            'first_name', gp.first_name,
                            'last_name', gp.last_name,
                            'read_at', gp.last_read_at
                        )
                    ), '[]'::jsonb)
                    FROM group_participants gp
                    WHERE gp.last_read_at >= m.created_at
                )
                ELSE '[]'::jsonb
            END
        )
    ) INTO v_messages
    FROM messages m;

    RETURN COALESCE(v_messages, '[]'::jsonb);
END;
$$;
