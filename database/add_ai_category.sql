-- Add 'AI' to the app_category enum
-- This must be done before updating applications to use the AI category

ALTER TYPE app_category ADD VALUE IF NOT EXISTS 'AI';
