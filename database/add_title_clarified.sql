-- Migration: Add title_clarified field to notes table
-- This field will store the AI-generated title for each note

-- Add the column
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS title_clarified VARCHAR(255);

-- Add comment
COMMENT ON COLUMN notes.title_clarified IS 'AI-generated short title for the note (max 10 words)';

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title_clarified);

-- Verification
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'notes' AND column_name = 'title_clarified';
