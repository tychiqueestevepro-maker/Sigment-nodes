-- ===================================================
-- Migration: Update users table for authentication
-- Description: Add missing fields for authentication system
-- ===================================================

-- Add password field for authentication
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Add full_name field
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

-- Make email required and unique (should already be, but ensure it)
-- ALTER TABLE users ALTER COLUMN email SET NOT NULL; -- Already has NOT NULL

-- Update role check constraint to be optional for now
-- The original schema has role as required, but we can keep it
-- Default role will be set in the application

-- Add comment
COMMENT ON COLUMN users.password IS 'Hashed password for user authentication (TODO: implement bcrypt)';
COMMENT ON COLUMN users.full_name IS 'User full name for display';

-- ===================================================
-- IMPORTANT: This migration must be run BEFORE signup works!
-- ===================================================
