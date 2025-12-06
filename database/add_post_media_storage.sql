-- Create storage bucket for post media
-- Run this in Supabase SQL Editor

-- Insert the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'post-media',
    'post-media',
    true,  -- Public bucket so images can be viewed by anyone
    10485760,  -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create RLS policies for the bucket
-- Drop existing policies first to avoid conflicts

DROP POLICY IF EXISTS "Users can upload post media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post media" ON storage.objects;

-- Allow authenticated users to upload files to their org/user folder
CREATE POLICY "Users can upload post media"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'post-media' 
    AND auth.role() = 'authenticated'
);

-- Allow anyone to view post media (public bucket)
CREATE POLICY "Anyone can view post media"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-media');

-- Allow users to delete their own media
CREATE POLICY "Users can delete their own post media"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'post-media' 
    AND auth.uid()::text = (storage.foldername(name))[2]
);
