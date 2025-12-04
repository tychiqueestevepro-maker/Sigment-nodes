-- Migration: Add Group Chat Support

-- 1. Add columns to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;

-- 2. RPC Function to create a group conversation
CREATE OR REPLACE FUNCTION create_group_conversation(
    p_organization_id UUID,
    p_title VARCHAR(255),
    p_participant_ids UUID[],
    p_current_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conversation_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. Create the conversation
    INSERT INTO conversations (organization_id, title, is_group)
    VALUES (p_organization_id, p_title, TRUE)
    RETURNING id INTO v_conversation_id;

    -- 2. Add the creator (current user)
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, p_current_user_id);

    -- 3. Add other participants
    FOREACH v_user_id IN ARRAY p_participant_ids
    LOOP
        -- Verify user is in the organization (optional but good practice, though trigger handles it too)
        -- We rely on the trigger 'ensure_participant_in_org' to fail if user is not in org
        
        -- Skip if it's the current user (already added)
        IF v_user_id <> p_current_user_id THEN
            INSERT INTO conversation_participants (conversation_id, user_id)
            VALUES (v_conversation_id, v_user_id);
        END IF;
    END LOOP;

    RETURN v_conversation_id;
END;
$$;
