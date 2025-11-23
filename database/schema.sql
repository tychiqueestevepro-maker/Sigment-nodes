-- SIGMENT Database Schema
-- PostgreSQL with pgvector extension

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. USERS TABLE (The Context)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'admin', 'board')),
    
    -- AI Metadata for context-aware scoring
    job_title VARCHAR(255),
    department VARCHAR(255),
    seniority_level INTEGER CHECK (seniority_level BETWEEN 1 AND 5),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast user lookup
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 2. PILLARS TABLE (Strategic Folders)
-- ============================================
CREATE TABLE pillars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color for UI (e.g., '#3B82F6')
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default pillars
INSERT INTO pillars (name, description, color) VALUES
    ('ESG', 'Environmental, Social, and Governance initiatives', '#10B981'),
    ('Innovation', 'Product innovation and R&D ideas', '#6366F1'),
    ('Operations', 'Operational efficiency and process improvements', '#F59E0B'),
    ('Customer Experience', 'Customer satisfaction and service quality', '#EC4899'),
    ('Culture & HR', 'Employee experience and organizational culture', '#8B5CF6');

-- ============================================
-- 3. CLUSTERS TABLE (Dynamic Topics)
-- ============================================
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pillar_id UUID NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    
    -- Cluster metadata
    note_count INTEGER DEFAULT 0,
    avg_relevance_score FLOAT DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast cluster lookup
CREATE INDEX idx_clusters_pillar ON clusters(pillar_id);
CREATE INDEX idx_clusters_updated ON clusters(last_updated_at DESC);

-- ============================================
-- 4. NOTES TABLE (The Atom)
-- ============================================
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Content
    content_raw TEXT NOT NULL,
    content_clarified TEXT,
    
    -- AI Analysis
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    pillar_id UUID REFERENCES pillars(id) ON DELETE SET NULL,
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    ai_relevance_score FLOAT CHECK (ai_relevance_score BETWEEN 1 AND 10),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'processed', 'refused')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for fast queries
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_status ON notes(status);
CREATE INDEX idx_notes_pillar ON notes(pillar_id);
CREATE INDEX idx_notes_cluster ON notes(cluster_id);
CREATE INDEX idx_notes_created ON notes(created_at DESC);

-- Vector similarity search index (CRITICAL for performance)
CREATE INDEX idx_notes_embedding ON notes USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================
-- 5. CLUSTER SNAPSHOTS (Time-Lapse History)
-- ============================================
CREATE TABLE cluster_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    
    -- Snapshot content
    synthesis_text TEXT NOT NULL,
    metrics_json JSONB NOT NULL, -- {"IT": 10, "Sales": 2, "Avg_Weight": 8.5}
    included_note_ids UUID[] NOT NULL, -- Array of note UUIDs
    
    -- Snapshot metadata
    note_count INTEGER NOT NULL,
    avg_relevance_score FLOAT NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for time-lapse queries
CREATE INDEX idx_snapshots_cluster ON cluster_snapshots(cluster_id);
CREATE INDEX idx_snapshots_created ON cluster_snapshots(created_at DESC);
CREATE INDEX idx_snapshots_cluster_time ON cluster_snapshots(cluster_id, created_at DESC);

-- ============================================
-- 6. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to pillars
CREATE TRIGGER update_pillars_updated_at BEFORE UPDATE ON pillars
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update cluster metadata when notes change
CREATE OR REPLACE FUNCTION update_cluster_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Update cluster stats
    UPDATE clusters
    SET 
        note_count = (
            SELECT COUNT(*)
            FROM notes
            WHERE cluster_id = NEW.cluster_id AND status = 'processed'
        ),
        avg_relevance_score = (
            SELECT COALESCE(AVG(ai_relevance_score), 0)
            FROM notes
            WHERE cluster_id = NEW.cluster_id AND status = 'processed'
        ),
        last_updated_at = NOW()
    WHERE id = NEW.cluster_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update cluster when note is added/updated
CREATE TRIGGER update_cluster_on_note_change
AFTER INSERT OR UPDATE ON notes
FOR EACH ROW
WHEN (NEW.cluster_id IS NOT NULL AND NEW.status = 'processed')
EXECUTE FUNCTION update_cluster_metadata();

-- ============================================
-- 7. UTILITY FUNCTIONS
-- ============================================

-- Function to find similar notes using vector similarity
CREATE OR REPLACE FUNCTION find_similar_notes(
    query_embedding vector(1536),
    target_pillar_id UUID,
    similarity_threshold FLOAT DEFAULT 0.75,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    note_id UUID,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id AS note_id,
        1 - (n.embedding <=> query_embedding) AS similarity
    FROM notes n
    WHERE 
        n.pillar_id = target_pillar_id
        AND n.status = 'processed'
        AND n.embedding IS NOT NULL
        AND 1 - (n.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY n.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. SEED DATA (Optional - for testing)
-- ============================================

-- Create test users
INSERT INTO users (email, role, job_title, department, seniority_level) VALUES
    ('admin@sigment.com', 'admin', 'CEO', 'Executive', 5),
    ('john.doe@sigment.com', 'employee', 'Senior Developer', 'IT', 4),
    ('jane.smith@sigment.com', 'employee', 'HR Manager', 'Human Resources', 3),
    ('board@sigment.com', 'board', 'Board Member', 'Board', 5);

-- ============================================
-- COMPLETE
-- ============================================
COMMENT ON TABLE users IS 'User accounts with AI context metadata';
COMMENT ON TABLE pillars IS 'Strategic categories defined by the company';
COMMENT ON TABLE clusters IS 'Dynamic groups of related ideas';
COMMENT ON TABLE notes IS 'Individual idea submissions from employees';
COMMENT ON TABLE cluster_snapshots IS 'Historical snapshots for time-lapse feature';

