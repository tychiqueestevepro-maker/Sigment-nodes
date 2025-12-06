-- Add scheduling support for posts
-- Run this in Supabase SQL Editor

-- Add scheduled_at column to posts
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- Add status column if not exists (draft, scheduled, published)
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';

-- Create index for efficient scheduled posts queries
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at 
ON posts(scheduled_at) 
WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_posts_status 
ON posts(status);

-- Comment
COMMENT ON COLUMN posts.scheduled_at IS 'Timestamp when the post should be published (NULL = immediate publish)';
COMMENT ON COLUMN posts.status IS 'Post status: draft, scheduled, published';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
