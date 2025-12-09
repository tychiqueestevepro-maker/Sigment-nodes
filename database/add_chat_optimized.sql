-- ============================================
-- CHAT PERFORMANCE OPTIMIZATION
-- Optimized RPC functions for conversations and messages
-- Goal: Reduce API latency from >500ms to <100ms
-- ============================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_conversations_optimized(UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_messages_optimized(UUID, UUID, INTEGER, INTEGER);

-- ============================================
-- FUNCTION 1: get_conversations_optimized
-- Replaces multiple Python queries with single SQL call
-- ============================================
CREATE OR REPLACE FUNCTION get_conversations_optimized(
    p_user_id UUID,
    p_organization_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    title TEXT,
    is_group BOOLEAN,
    has_unread BOOLEAN,
    last_message TEXT,
    other_participant JSONB,
    participants JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH user_conversations AS (
        -- Get conversations where user is participant and not deleted
        SELECT 
            cp.conversation_id,
            cp.last_read_at
        FROM conversation_participants cp
        WHERE cp.user_id = p_user_id
        AND cp.deleted_at IS NULL
    ),
    conversation_details AS (
        SELECT
            c.id,
            c.updated_at,
            c.title::TEXT AS title,
            c.is_group,
            uc.last_read_at,
            -- Calculate has_unread
            CASE 
                WHEN uc.last_read_at IS NULL THEN TRUE
                WHEN c.updated_at > uc.last_read_at THEN TRUE
                ELSE FALSE
            END AS has_unread,
            -- Get last message content (optimized subquery)
            (
                SELECT dm.content
                FROM direct_messages dm
                WHERE dm.conversation_id = c.id
                ORDER BY dm.created_at DESC
                LIMIT 1
            )::TEXT AS last_message,
            -- Get all active participants as JSONB array
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', u.id,
                        'first_name', u.first_name,
                        'last_name', u.last_name,
                        'job_title', u.job_title,
                        'email', u.email,
                        'avatar_url', u.avatar_url
                    ) ORDER BY u.first_name
                )
                FROM conversation_participants cp2
                JOIN users u ON cp2.user_id = u.id
                WHERE cp2.conversation_id = c.id
                AND cp2.deleted_at IS NULL
                AND cp2.user_id != p_user_id  -- Exclude current user
            ) AS participants
        FROM conversations c
        JOIN user_conversations uc ON c.id = uc.conversation_id
    )
    SELECT 
        cd.id,
        cd.updated_at,
        cd.title,
        cd.is_group,
        cd.has_unread,
        cd.last_message,
        -- Extract first participant as other_participant (for 1-1 chats)
        CASE 
            WHEN cd.participants IS NOT NULL AND jsonb_array_length(cd.participants) > 0 
            THEN cd.participants->0
            ELSE NULL
        END AS other_participant,
        COALESCE(cd.participants, '[]'::jsonb) AS participants
    FROM conversation_details cd
    ORDER BY cd.updated_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION 2: get_messages_optimized
-- Single query for messages with read receipts
-- ============================================
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
    attachment_url TEXT,
    attachment_type TEXT,
    attachment_name TEXT,
    shared_post JSONB,
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
        md.attachment_url,
        md.attachment_type,
        md.attachment_name,
        md.shared_post,
        COALESCE(md.read_by, '[]'::jsonb) AS read_by
    FROM messages_data md;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for faster conversation participant lookup
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_active
ON conversation_participants(user_id, conversation_id)
WHERE deleted_at IS NULL;

-- Index for faster message retrieval by conversation
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created
ON direct_messages(conversation_id, created_at DESC);

-- Index for faster last message lookup
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_latest
ON direct_messages(conversation_id, created_at DESC)
INCLUDE (content);

-- ============================================
-- PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION get_conversations_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_messages_optimized TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION get_conversations_optimized IS 
'Optimized conversation list fetch. Returns all user conversations with participants, 
last message preview, and unread status in a single query. Target: <50ms.';

COMMENT ON FUNCTION get_messages_optimized IS 
'Optimized message fetch with read receipts and shared post data in a single query. 
Target: <30ms.';
