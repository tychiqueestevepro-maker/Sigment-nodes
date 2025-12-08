-- ===================================================
-- Migration: Add last_read_at to idea_group_members
-- Description: Track when user last read group messages (for unread indicator)
-- ===================================================

-- Add last_read_at column to idea_group_members
ALTER TABLE idea_group_members
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Comment
COMMENT ON COLUMN idea_group_members.last_read_at IS 'Timestamp when user last read/opened the group messages (for unread indicator)';
