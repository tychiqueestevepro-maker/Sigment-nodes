-- ===================================================
-- Migration: Add Direct Messages (1-to-1)
-- Description: Adds conversations, participants, and messages tables with RLS and security triggers.
-- ===================================================

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for organization filtering
CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(organization_id);

-- 2. Conversation Participants Table
CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- Indexes for participants
CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation ON conversation_participants(conversation_id);

-- 3. Direct Messages Table
CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON direct_messages(created_at DESC);

-- ===================================================
-- 4. Security (RLS)
-- ===================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Policies

-- Conversations: Users can see conversations they are participants in.
CREATE POLICY "Users can view conversations they are in" ON conversations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = id
            AND cp.user_id = auth.uid()
        )
    );

-- Participants: Users can see participants of conversations they are in.
CREATE POLICY "Users can view participants of their conversations" ON conversation_participants
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = conversation_id
            AND cp.user_id = auth.uid()
        )
    );

-- Messages: Users can see messages in conversations they are in.
CREATE POLICY "Users can view messages in their conversations" ON direct_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = conversation_id
            AND cp.user_id = auth.uid()
        )
    );

-- Messages: Users can send messages in conversations they are in.
CREATE POLICY "Users can send messages in their conversations" ON direct_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = conversation_id
            AND cp.user_id = auth.uid()
        )
    );

-- ===================================================
-- 5. Triggers & Functions
-- ===================================================

-- Trigger Function: Ensure participants belong to the conversation's organization
CREATE OR REPLACE FUNCTION check_conversation_participants_org()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_user_org_id UUID;
BEGIN
    -- Get the conversation's organization
    SELECT organization_id INTO v_org_id
    FROM conversations
    WHERE id = NEW.conversation_id;

    -- Get the user's organization membership
    SELECT organization_id INTO v_user_org_id
    FROM memberships
    WHERE user_id = NEW.user_id AND organization_id = v_org_id;

    IF v_user_org_id IS NULL THEN
        RAISE EXCEPTION 'User % is not a member of organization %', NEW.user_id, v_org_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger
DROP TRIGGER IF EXISTS ensure_participant_in_org ON conversation_participants;
CREATE TRIGGER ensure_participant_in_org
BEFORE INSERT ON conversation_participants
FOR EACH ROW
EXECUTE FUNCTION check_conversation_participants_org();


-- Trigger Function: Update conversation updated_at on new message
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger
DROP TRIGGER IF EXISTS update_conv_on_msg ON direct_messages;
CREATE TRIGGER update_conv_on_msg
AFTER INSERT ON direct_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();


-- RPC Function: Get or Create Conversation
-- Checks if a conversation exists between current user and target user in the org.
-- If yes, returns it. If no, creates it (verifying target user membership).
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_organization_id UUID,
    p_target_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_user_id UUID := auth.uid();
    v_conversation_id UUID;
    v_target_is_member BOOLEAN;
BEGIN
    -- 1. Security Check: Ensure target user is in the organization
    SELECT EXISTS (
        SELECT 1 FROM memberships
        WHERE user_id = p_target_user_id AND organization_id = p_organization_id
    ) INTO v_target_is_member;

    IF NOT v_target_is_member THEN
        RAISE EXCEPTION 'Target user is not a member of this organization';
    END IF;

    -- 2. Check if conversation already exists
    -- We look for a conversation in this org where both users are participants
    SELECT c.id INTO v_conversation_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.organization_id = p_organization_id
    AND cp1.user_id = v_current_user_id
    AND cp2.user_id = p_target_user_id;

    IF v_conversation_id IS NOT NULL THEN
        RETURN v_conversation_id;
    END IF;

    -- 3. Create new conversation
    INSERT INTO conversations (organization_id)
    VALUES (p_organization_id)
    RETURNING id INTO v_conversation_id;

    -- 4. Add participants
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES 
        (v_conversation_id, v_current_user_id),
        (v_conversation_id, p_target_user_id);

    RETURN v_conversation_id;
END;
$$;
