-- Avatar Support Migration
-- This script adds avatar support with Supabase Storage
-- Execute this in your Supabase SQL Editor

-- ============================================
-- 1. ADD AVATAR URL COLUMN (if not exists)
-- ============================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN users.avatar_url IS 'URL to user profile picture stored in Supabase Storage';

-- ============================================
-- 2. CREATE STORAGE BUCKET FOR AVATARS
-- ============================================
-- Note: This must be done via Supabase Dashboard or API
-- Go to Storage > Create Bucket > Name: "avatars" > Public: Yes

-- SQL to insert bucket (if you have access to storage.buckets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars', 
    true,  -- Public bucket for avatar URLs
    2097152, -- 2MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- ============================================
-- 3. STORAGE RLS POLICIES
-- ============================================

-- Policy: Anyone can view/download avatars (public read)
CREATE POLICY "Public Avatar Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Policy: Authenticated users can upload their own avatar
CREATE POLICY "Users can upload own avatar" ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own avatar
CREATE POLICY "Users can update own avatar" ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own avatar
CREATE POLICY "Users can delete own avatar" ON storage.objects
FOR DELETE
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 4. VERIFY SETUP
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'avatar_url';

-- Check bucket exists
SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';
