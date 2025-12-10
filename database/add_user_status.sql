-- Add status column to users table for account suspension
-- Run this in Supabase SQL Editor

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' NOT NULL;

-- Add check constraint for valid status values
ALTER TABLE users 
ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'suspended', 'pending'));

-- Update existing users to have 'active' status
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
