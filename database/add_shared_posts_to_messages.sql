-- ===================================================
-- Migration: Add Shared Post Support to Messages
-- Description: Allows messages to include a reference to a shared post
-- ===================================================

-- Add shared_post_id column to direct_messages
ALTER TABLE direct_messages 
ADD COLUMN IF NOT EXISTS shared_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

-- Index for faster lookup of messages with shared posts
CREATE INDEX IF NOT EXISTS idx_messages_shared_post ON direct_messages(shared_post_id) WHERE shared_post_id IS NOT NULL;

-- Allow content to be empty if a post is shared
-- (We'll handle this validation in the backend)

COMMENT ON COLUMN direct_messages.shared_post_id IS 'Reference to a post being shared in this message';
