-- ============================================
-- Add shared_note_id to idea_group_messages table
-- Run this in Supabase SQL Editor
-- ============================================

-- Add shared_note_id column to idea_group_messages table
ALTER TABLE idea_group_messages
ADD COLUMN IF NOT EXISTS shared_note_id UUID REFERENCES notes(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_idea_group_messages_shared_note_id 
ON idea_group_messages(shared_note_id) 
WHERE shared_note_id IS NOT NULL;
