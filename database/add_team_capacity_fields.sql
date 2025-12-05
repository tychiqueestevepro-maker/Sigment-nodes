-- ============================================
-- Add AI Team Capacity fields to notes table
-- These store the AI-generated team composition suggestions
-- ============================================

-- Add ai_reasoning column (AI's explanation for the score)
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

-- Add ai_team_capacity column (JSON with team composition)
-- Structure: {"team_size": 3, "profiles": ["PM", "Dev"], "feasibility": "Moderate", "feasibility_reason": "..."}
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS ai_team_capacity JSONB;

-- Add index for quick filtering by feasibility
CREATE INDEX IF NOT EXISTS idx_notes_team_capacity ON notes USING gin (ai_team_capacity);

-- Comment for documentation
COMMENT ON COLUMN notes.ai_reasoning IS 'AI explanation for the relevance score';
COMMENT ON COLUMN notes.ai_team_capacity IS 'AI-suggested team composition: {"team_size": int, "profiles": [], "feasibility": string, "feasibility_reason": string}';
