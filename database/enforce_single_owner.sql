-- ===================================================
-- Migration: Enforce Single Owner Rule
-- Description: Add unique partial index to ensure only one OWNER per organization
-- ===================================================

-- Create unique index that only applies when role is 'OWNER'
-- This prevents inserting/updating a second row with role='OWNER' for the same organization_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_owner_per_org 
ON memberships(organization_id) 
WHERE role = 'OWNER';

-- Verification query
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'memberships' AND indexname = 'idx_single_owner_per_org';
