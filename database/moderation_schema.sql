-- Run this in your Supabase SQL Editor

ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_deactivated BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN memberships.is_muted IS 'If true, the member cannot post or comment';
COMMENT ON COLUMN memberships.is_deactivated IS 'If true, the member cannot access the organization';
