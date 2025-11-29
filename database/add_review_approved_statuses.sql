-- Migration: Add 'review' and 'approved' statuses to notes table
-- Date: 2025-11-29
-- Description: Extends the status CHECK constraint to include review and approved states

-- This migration is for TEXT columns with CHECK constraints (not ENUM types)

-- Step 1: Drop the existing CHECK constraint if it exists
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_status_check;

-- Step 2: Add new CHECK constraint with all valid statuses
ALTER TABLE notes ADD CONSTRAINT notes_status_check 
    CHECK (status IN ('draft', 'processing', 'processed', 'refused', 'review', 'approved'));

-- Verify the constraint was created
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'notes'::regclass 
AND conname = 'notes_status_check';
