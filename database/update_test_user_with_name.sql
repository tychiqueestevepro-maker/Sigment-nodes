-- Update test user with first and last name
-- Execute this in your Supabase SQL Editor after running add_user_names.sql

-- Update the specific test user that's being used
UPDATE users 
SET 
    first_name = 'John', 
    last_name = 'Doe'
WHERE id = 'f8a49ff4-2605-42a4-a920-ec989ac75b32';

-- Verify the update
SELECT 
    id, 
    email, 
    first_name, 
    last_name, 
    job_title, 
    department, 
    seniority_level,
    role
FROM users 
WHERE id = 'f8a49ff4-2605-42a4-a920-ec989ac75b32';

-- Expected result:
-- id: f8a49ff4-2605-42a4-a920-ec989ac75b32
-- email: test@sigment.com
-- first_name: John
-- last_name: Doe
-- job_title: Product Manager
-- department: Product
-- seniority_level: 4
-- role: employee

