-- Add is_system_message flag to group messages
ALTER TABLE idea_group_messages
ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_idea_group_messages_system ON idea_group_messages(is_system_message) WHERE is_system_message = TRUE;
