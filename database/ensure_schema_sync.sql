-- ===================================================
-- Schema Synchronization Script
-- Description: Ensures database schema matches application code
-- Run this in Supabase SQL Editor
-- ===================================================

-- 1. Update Memberships Role Constraint
-- Ensure 'OWNER' is allowed in role column
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check 
    CHECK (role IN ('OWNER', 'BOARD', 'MEMBER'));

-- 2. Ensure job_title column exists
-- Add job_title if it doesn't exist, with default value
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'memberships' AND column_name = 'job_title') THEN
        ALTER TABLE memberships 
        ADD COLUMN job_title VARCHAR(100) DEFAULT 'Owner';
        
        COMMENT ON COLUMN memberships.job_title IS 'Job title of the user within the organization';
        CREATE INDEX idx_memberships_job_title ON memberships(job_title);
    END IF;
END $$;

-- 3. Verification
SELECT 
    conname as constraint_name, 
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'memberships'::regclass 
AND conname = 'memberships_role_check';

SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'memberships' AND column_name = 'job_title';
