
-- Function to get unread conversations count for a user
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
    AND (
        cp.last_read_at IS NULL 
        OR 
        cp.last_read_at < c.updated_at
    );

    RETURN unread_count;
END;
$$;
