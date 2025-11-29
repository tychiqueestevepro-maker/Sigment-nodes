-- Migration: Add note_events table for event logging
-- Description: Creates a new table to track all lifecycle events for notes
-- Date: 2025-11-29

-- Create note_events table
CREATE TABLE IF NOT EXISTS note_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('submission', 'ai_analysis', 'fusion', 'reviewing', 'refusal')),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying by note_id and chronological ordering
CREATE INDEX IF NOT EXISTS idx_note_events_note_id_created_at ON note_events (note_id, created_at);

-- Add comment to table
COMMENT ON TABLE note_events IS 'Stores all lifecycle events for notes to provide feedback loop to users';

-- Add comments to columns
COMMENT ON COLUMN note_events.event_type IS 'Type of event: submission, ai_analysis, fusion, reviewing, refusal';
COMMENT ON COLUMN note_events.title IS 'User-friendly title for the event';
COMMENT ON COLUMN note_events.description IS 'Detailed description of what happened';
