-- Remove the unique constraint on source_tool_id + target_tool_id
-- to allow the same connection to exist in different chains

-- First, find and drop any unique constraint on source/target combination
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find constraints on tool_connections that involve source_tool_id and target_tool_id
    FOR constraint_name IN 
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'tool_connections'
        AND con.contype = 'u' -- unique constraint
    LOOP
        EXECUTE 'ALTER TABLE tool_connections DROP CONSTRAINT IF EXISTS ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Now add a new unique constraint that includes chain_id
-- This allows the same source->target in different chains, but not in the same chain
ALTER TABLE tool_connections 
DROP CONSTRAINT IF EXISTS tool_connections_unique_per_chain;

ALTER TABLE tool_connections 
ADD CONSTRAINT tool_connections_unique_per_chain 
UNIQUE (source_tool_id, target_tool_id, chain_id);
