-- Function to get unread conversations count for a user
-- Only counts conversations where the LAST message was sent by SOMEONE ELSE
-- and the user hasn't read it yet
DROP FUNCTION IF EXISTS get_unread_conversations_count(UUID, UUID);
CREATE OR REPLACE FUNCTION get_unread_conversations_count(
    p_user_id UUID,
    p_organization_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO unread_count
    FROM conversation_participants cp
    JOIN conversations c ON c.id = cp.conversation_id
    WHERE cp.user_id = p_user_id
    AND c.organization_id = p_organization_id
    AND cp.deleted_at IS NULL
    AND c.deleted_at IS NULL
    -- Check if there's a message from ANOTHER user that hasn't been read
    AND EXISTS (
        SELECT 1 
        FROM direct_messages dm
        WHERE dm.conversation_id = c.id
        AND dm.sender_id != p_user_id  -- Message from someone ELSE
        AND dm.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamp with time zone)
    );

    RETURN COALESCE(unread_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION get_unread_conversations_count TO authenticated;
