-- Migration script to switch from IVFFlat to HNSW index for vector search
-- Run this script to apply the optimization to an existing database.

BEGIN;

-- 1. Drop the existing IVFFlat index
DROP INDEX IF EXISTS idx_notes_embedding;

-- 2. Create the new HNSW index
-- HNSW is better for high-recall and performance at scale (1B$ scale)
CREATE INDEX idx_notes_embedding ON notes USING hnsw (embedding vector_cosine_ops);

COMMIT;
