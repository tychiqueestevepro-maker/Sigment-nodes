-- Add media_url column to post_comments table
-- Run this in Supabase SQL Editor

ALTER TABLE post_comments
ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN post_comments.media_url IS 'Optional image URL attached to the comment';
