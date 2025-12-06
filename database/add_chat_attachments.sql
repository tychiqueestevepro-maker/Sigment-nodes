-- Add attachment support to direct_messages
-- Run this in the Supabase SQL Editor

-- Add attachment_url column to direct_messages
ALTER TABLE direct_messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Create index for messages with attachments
CREATE INDEX IF NOT EXISTS idx_messages_attachment ON direct_messages(attachment_url) WHERE attachment_url IS NOT NULL;

-- Add comments
COMMENT ON COLUMN direct_messages.attachment_url IS 'URL of the attached file stored in Supabase Storage';
COMMENT ON COLUMN direct_messages.attachment_type IS 'MIME type of the attached file (image/png, application/pdf, etc.)';
COMMENT ON COLUMN direct_messages.attachment_name IS 'Original filename of the attached file';

-- =====================================================
-- STORAGE BUCKET SETUP
-- =====================================================

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments', 
    'chat-attachments', 
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- STORAGE RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat attachments" ON storage.objects;

-- Allow authenticated users to upload files to chat-attachments bucket
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Allow anyone to view/download chat attachments (public bucket)
CREATE POLICY "Anyone can view chat attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');

-- Allow users to delete their own attachments (folder structure: user_id/filename)
CREATE POLICY "Users can delete their own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

