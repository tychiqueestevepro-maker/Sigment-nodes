-- ============================================
-- Update get_messages_optimized to include shared_note_id and shared_note
-- Run this in Supabase SQL Editor
-- ============================================

DROP FUNCTION IF EXISTS get_messages_optimized(UUID, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_messages_optimized(
    p_conversation_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    conversation_id UUID,
    sender_id UUID,
    content TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    shared_post_id UUID,
    shared_note_id UUID,
    attachment_url TEXT,
    attachment_type TEXT,
    attachment_name TEXT,
    shared_post JSONB,
    shared_note JSONB,
    read_by JSONB
) AS $$
DECLARE
    v_messages_visible_from TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get messages_visible_from for this user
    SELECT cp.messages_visible_from INTO v_messages_visible_from
    FROM conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
    AND cp.user_id = p_user_id;

    RETURN QUERY
    WITH participant_reads AS (
        -- Get read status of all other participants
        SELECT 
            cp.user_id,
            cp.last_read_at,
            u.first_name,
            u.last_name
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = p_conversation_id
        AND cp.user_id != p_user_id
        AND cp.deleted_at IS NULL
    ),
    messages_data AS (
        SELECT
            dm.id,
            dm.conversation_id,
            dm.sender_id,
            dm.content::TEXT AS content,
            dm.is_read,
            dm.created_at,
            dm.shared_post_id,
            dm.shared_note_id,
            dm.attachment_url::TEXT AS attachment_url,
            dm.attachment_type::TEXT AS attachment_type,
            dm.attachment_name::TEXT AS attachment_name,
            -- Get shared post data if exists
            CASE 
                WHEN dm.shared_post_id IS NOT NULL THEN (
                    SELECT jsonb_build_object(
                        'id', p.id,
                        'content', p.content,
                        'media_urls', p.media_urls,
                        'post_type', p.post_type,
                        'likes_count', p.likes_count,
                        'comments_count', p.comments_count,
                        'user_info', jsonb_build_object(
                            'first_name', u.first_name,
                            'last_name', u.last_name,
                            'avatar_url', u.avatar_url
                        )
                    )
                    FROM posts p
                    LEFT JOIN users u ON p.user_id = u.id
                    WHERE p.id = dm.shared_post_id
                )
                ELSE NULL
            END AS shared_post,
            -- Get shared note data if exists
            CASE 
                WHEN dm.shared_note_id IS NOT NULL THEN (
                    SELECT jsonb_build_object(
                        'id', n.id,
                        'title', COALESCE(n.title_clarified, LEFT(n.content_clarified, 60), LEFT(n.content_raw, 60)),
                        'content', COALESCE(n.content_clarified, n.content_raw),
                        'status', n.status,
                        'pillar_name', pil.name,
                        'pillar_color', pil.color
                    )
                    FROM notes n
                    LEFT JOIN pillars pil ON n.pillar_id = pil.id
                    WHERE n.id = dm.shared_note_id
                )
                ELSE NULL
            END AS shared_note,
            -- Calculate read_by for sender's own messages
            CASE 
                WHEN dm.sender_id = p_user_id THEN (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'user_id', pr.user_id,
                            'first_name', pr.first_name,
                            'last_name', pr.last_name,
                            'read_at', pr.last_read_at
                        )
                    )
                    FROM participant_reads pr
                    WHERE pr.last_read_at >= dm.created_at
                )
                ELSE '[]'::jsonb
            END AS read_by
        FROM direct_messages dm
        WHERE dm.conversation_id = p_conversation_id
        AND (v_messages_visible_from IS NULL OR dm.created_at >= v_messages_visible_from)
        ORDER BY dm.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    )
    SELECT 
        md.id,
        md.conversation_id,
        md.sender_id,
        md.content,
        md.is_read,
        md.created_at,
        md.shared_post_id,
        md.shared_note_id,
        md.attachment_url,
        md.attachment_type,
        md.attachment_name,
        md.shared_post,
        md.shared_note,
        COALESCE(md.read_by, '[]'::jsonb) AS read_by
    FROM messages_data md;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_messages_optimized TO authenticated;
