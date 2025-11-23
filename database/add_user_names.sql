-- Add first_name and last_name to users table
-- Execute this in your Supabase SQL Editor

-- 1. Add the new columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- 2. Update existing users with names
-- Test user
UPDATE users 
SET first_name = 'John', 
    last_name = 'Doe'
WHERE id = 'f8a49ff4-2605-42a4-a920-ec989ac75b32';

-- 3. Update other test users if they exist
UPDATE users 
SET first_name = 'Admin', 
    last_name = 'User'
WHERE email = 'admin@sigment.com';

UPDATE users 
SET first_name = 'Jane', 
    last_name = 'Smith'
WHERE email = 'jane.smith@sigment.com';

UPDATE users 
SET first_name = 'Board', 
    last_name = 'Member'
WHERE email = 'board@sigment.com';

-- 4. Verify the changes
SELECT id, email, first_name, last_name, job_title, department 
FROM users 
ORDER BY email;

-- 5. (Optional) Make columns NOT NULL for future users
-- Uncomment if you want to enforce names for all new users
-- ALTER TABLE users 
-- ALTER COLUMN first_name SET NOT NULL,
-- ALTER COLUMN last_name SET NOT NULL;

