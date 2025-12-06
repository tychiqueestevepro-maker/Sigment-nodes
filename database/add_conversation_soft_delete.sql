-- Add soft delete for conversation participants
-- This allows users to "delete" a conversation without affecting the other participant

-- Add deleted_at column to conversation_participants
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add messages_visible_from column - when restored, only show messages after this date
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS messages_visible_from TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add last_read_at column - tracks when user last read the conversation (for unread indicator)
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_conversation_participants_deleted_at 
ON conversation_participants(deleted_at);

-- Comments
COMMENT ON COLUMN conversation_participants.deleted_at IS 'Soft delete timestamp - if not null, user has deleted this conversation from their view';
COMMENT ON COLUMN conversation_participants.messages_visible_from IS 'Only show messages created after this timestamp (set when conversation is restored after deletion)';
COMMENT ON COLUMN conversation_participants.last_read_at IS 'Timestamp when user last read/opened the conversation (for unread indicator)';
