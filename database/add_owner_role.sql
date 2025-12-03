-- Migration: Add OWNER role to memberships constraint
-- Date: 2025-12-01
-- Description: Update the role check constraint to include 'OWNER' role

-- Drop the existing constraint
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;

-- Add the new constraint with OWNER role
ALTER TABLE memberships 
ADD CONSTRAINT memberships_role_check CHECK (role IN ('OWNER', 'BOARD', 'MEMBER'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'memberships'::regclass 
AND conname = 'memberships_role_check';
