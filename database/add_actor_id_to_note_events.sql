-- Migration: Add actor_id column to note_events
-- Description: Add actor_id to track who triggered the event
-- Date: 2025-12-20

-- Add actor_id column
ALTER TABLE note_events ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id);

-- Add index for efficient querying by actor
CREATE INDEX IF NOT EXISTS idx_note_events_actor_id ON note_events (actor_id);

-- Update comment
COMMENT ON COLUMN note_events.actor_id IS 'User who triggered this event';
