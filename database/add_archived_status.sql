-- Migration: Add 'archived' status to notes table
-- Date: 2025-12-07
-- Description: Extends the status CHECK constraint to include archived state
-- Notes with 'archived' status will appear in the Archive page (Board/Owner only)

-- Step 1: Drop the existing CHECK constraint if it exists
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_status_check;

-- Step 2: Add new CHECK constraint with 'archived' status included
ALTER TABLE notes ADD CONSTRAINT notes_status_check 
    CHECK (status IN ('draft', 'processing', 'processed', 'refused', 'review', 'approved', 'archived'));

-- Step 3: Add index for archived notes queries (for performance)
CREATE INDEX IF NOT EXISTS idx_notes_archived 
ON notes(organization_id, status) 
WHERE status = 'archived';

-- Verify the constraint was created
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'notes'::regclass 
AND conname = 'notes_status_check';
