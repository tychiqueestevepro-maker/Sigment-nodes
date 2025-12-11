-- Add location column to organizations table
-- Run this in Supabase SQL Editor

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Optional: Add an index for searching by location
CREATE INDEX IF NOT EXISTS idx_organizations_location ON organizations(location);
