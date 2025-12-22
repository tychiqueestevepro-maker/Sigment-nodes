-- Migration: Update note_events event_type constraint
-- Description: Add 'archived' and 'approval' to the list of allowed event types
-- Date: 2025-12-20

-- Drop the old check constraint
ALTER TABLE note_events DROP CONSTRAINT IF EXISTS note_events_event_type_check;

-- Add the new check constraint with additional event types
ALTER TABLE note_events ADD CONSTRAINT note_events_event_type_check 
  CHECK (event_type IN ('submission', 'ai_analysis', 'fusion', 'reviewing', 'refusal', 'archived', 'approval'));

-- Update comment
COMMENT ON COLUMN note_events.event_type IS 'Type of event: submission, ai_analysis, fusion, reviewing, refusal, archived, approval';
