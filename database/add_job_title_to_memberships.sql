-- ===================================================
-- Migration: Add job_title to memberships
-- Description: Add job title field to track user roles in organizations
-- ===================================================

-- Add job_title column to memberships table
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS job_title VARCHAR(100) DEFAULT 'Owner';

-- Add comment for documentation
COMMENT ON COLUMN memberships.job_title IS 'Job title of the user within the organization (e.g., CEO, Founder, CTO)';

-- Add index for potential filtering/grouping by job title
CREATE INDEX IF NOT EXISTS idx_memberships_job_title ON memberships(job_title);

-- ===================================================
-- Verification Query
-- ===================================================
-- Run this to verify the migration:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'memberships' AND column_name = 'job_title';
