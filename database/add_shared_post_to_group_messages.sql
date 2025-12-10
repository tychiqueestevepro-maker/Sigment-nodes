-- Add shared_post_id support to idea_group_messages
-- This allows sharing posts in Groups, just like sharing notes

-- 1. Add column to idea_group_messages
ALTER TABLE idea_group_messages
ADD COLUMN IF NOT EXISTS shared_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

-- 2. Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_group_messages_shared_post 
ON idea_group_messages(shared_post_id) 
WHERE shared_post_id IS NOT NULL;

-- 3. Add comment
COMMENT ON COLUMN idea_group_messages.shared_post_id IS 'Reference to a post being shared in this group message';
