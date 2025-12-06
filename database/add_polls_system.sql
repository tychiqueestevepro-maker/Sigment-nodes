-- Create tables for Poll system
-- Run this in Supabase SQL Editor

-- Polls table
CREATE TABLE IF NOT EXISTS polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    allow_multiple BOOLEAN DEFAULT FALSE,
    color TEXT DEFAULT '#374151',
    expires_at TIMESTAMPTZ DEFAULT NULL,
    total_votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_poll_per_post UNIQUE (post_id)
);

-- Poll options table
CREATE TABLE IF NOT EXISTS poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    votes_count INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poll votes table
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate votes on same option
    CONSTRAINT unique_vote_per_option UNIQUE (poll_option_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON poll_votes(poll_option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_polls_post_id ON polls(post_id);

-- RLS Policies

-- Enable RLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls: Anyone in org can view, only post author can create
DROP POLICY IF EXISTS "Users can view polls in their org" ON polls;
CREATE POLICY "Users can view polls in their org" ON polls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM posts p
            JOIN memberships m ON m.organization_id = p.organization_id
            WHERE p.id = polls.post_id AND m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create polls" ON polls;
CREATE POLICY "Users can create polls" ON polls
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid()
        )
    );

-- Poll Options: Same as polls
DROP POLICY IF EXISTS "Users can view poll options" ON poll_options;
CREATE POLICY "Users can view poll options" ON poll_options
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM polls pl
            JOIN posts p ON p.id = pl.post_id
            JOIN memberships m ON m.organization_id = p.organization_id
            WHERE pl.id = poll_options.poll_id AND m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create poll options" ON poll_options;
CREATE POLICY "Users can create poll options" ON poll_options
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM polls pl
            JOIN posts p ON p.id = pl.post_id
            WHERE pl.id = poll_id AND p.user_id = auth.uid()
        )
    );

-- Poll Votes: Users can vote and see votes
DROP POLICY IF EXISTS "Users can view poll votes" ON poll_votes;
CREATE POLICY "Users can view poll votes" ON poll_votes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can vote" ON poll_votes;
CREATE POLICY "Users can vote" ON poll_votes
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove their votes" ON poll_votes;
CREATE POLICY "Users can remove their votes" ON poll_votes
    FOR DELETE USING (user_id = auth.uid());

-- Function to update votes count on poll_options
CREATE OR REPLACE FUNCTION update_poll_option_votes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE poll_options SET votes_count = votes_count + 1 WHERE id = NEW.poll_option_id;
        UPDATE polls SET total_votes = total_votes + 1 WHERE id = (SELECT poll_id FROM poll_options WHERE id = NEW.poll_option_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE poll_options SET votes_count = votes_count - 1 WHERE id = OLD.poll_option_id;
        UPDATE polls SET total_votes = total_votes - 1 WHERE id = (SELECT poll_id FROM poll_options WHERE id = OLD.poll_option_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for vote count updates
DROP TRIGGER IF EXISTS trigger_update_poll_votes ON poll_votes;
CREATE TRIGGER trigger_update_poll_votes
    AFTER INSERT OR DELETE ON poll_votes
    FOR EACH ROW EXECUTE FUNCTION update_poll_option_votes_count();

-- Add poll_id to posts table for easy reference
ALTER TABLE posts ADD COLUMN IF NOT EXISTS has_poll BOOLEAN DEFAULT FALSE;

COMMENT ON TABLE polls IS 'Polls attached to posts';
COMMENT ON TABLE poll_options IS 'Options for each poll';
COMMENT ON TABLE poll_votes IS 'User votes on poll options';

-- Refresh PostgREST schema cache (IMPORTANT - run this after any schema change)
NOTIFY pgrst, 'reload schema';

-- If the color column doesn't exist (for existing tables), add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'polls' AND column_name = 'color'
    ) THEN
        ALTER TABLE polls ADD COLUMN color TEXT DEFAULT '#374151';
    END IF;
END $$;

