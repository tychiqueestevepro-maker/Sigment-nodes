-- Add chain_id to tool_connections table
-- Each chain represents a separate visual row of connected tools

-- Add chain_id column
ALTER TABLE tool_connections 
ADD COLUMN IF NOT EXISTS chain_id UUID DEFAULT gen_random_uuid();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tool_connections_chain_id ON tool_connections(chain_id);

-- Update existing connections: group connected tools into the same chain
-- This is a one-time migration to set chain_id for existing connections
DO $$
DECLARE
    conn RECORD;
    existing_chain_id UUID;
BEGIN
    FOR conn IN SELECT * FROM tool_connections WHERE chain_id IS NULL ORDER BY created_at
    LOOP
        -- Check if source or target is already part of a chain
        SELECT chain_id INTO existing_chain_id
        FROM tool_connections
        WHERE chain_id IS NOT NULL
          AND (source_tool_id = conn.source_tool_id 
               OR target_tool_id = conn.source_tool_id
               OR source_tool_id = conn.target_tool_id
               OR target_tool_id = conn.target_tool_id)
          AND project_id = conn.project_id
        LIMIT 1;
        
        IF existing_chain_id IS NOT NULL THEN
            UPDATE tool_connections SET chain_id = existing_chain_id WHERE id = conn.id;
        ELSE
            UPDATE tool_connections SET chain_id = gen_random_uuid() WHERE id = conn.id;
        END IF;
    END LOOP;
END $$;
