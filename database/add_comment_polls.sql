-- Add poll support to comments
-- Run this in Supabase SQL Editor

-- Add poll_data column to store JSON poll data in comments
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS poll_data JSONB DEFAULT NULL;

-- Comment
COMMENT ON COLUMN post_comments.poll_data IS 'JSON data for quick polls in comments: {question, options: [{text, votes}], color, voter_ids: []}';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
