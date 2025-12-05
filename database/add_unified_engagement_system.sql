-- ============================================
-- UNIFIED ENGAGEMENT SYSTEM
-- Ajoute les likes, commentaires et saves pour Notes et Clusters
-- Compatible avec l'algorithme de feed unifié
-- Date: 2025-12-05
-- ============================================

-- ============================================
-- 1. AJOUTER COLONNES D'ENGAGEMENT AUX NOTES
-- ============================================
ALTER TABLE notes ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS saves_count INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS virality_score FLOAT DEFAULT 0;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================
-- 2. AJOUTER COLONNES D'ENGAGEMENT AUX CLUSTERS
-- ============================================
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS saves_count INTEGER DEFAULT 0;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS virality_score FLOAT DEFAULT 0;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================
-- 3. TABLE LIKES POUR LES NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS note_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_note_likes_note ON note_likes(note_id);
CREATE INDEX IF NOT EXISTS idx_note_likes_user ON note_likes(user_id);

-- ============================================
-- 4. TABLE LIKES POUR LES CLUSTERS
-- ============================================
CREATE TABLE IF NOT EXISTS cluster_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cluster_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_likes_cluster ON cluster_likes(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_likes_user ON cluster_likes(user_id);

-- ============================================
-- 5. TABLE COMMENTAIRES POUR LES NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS note_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES note_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_comments_note ON note_comments(note_id);
CREATE INDEX IF NOT EXISTS idx_note_comments_user ON note_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_note_comments_parent ON note_comments(parent_comment_id);

-- ============================================
-- 6. TABLE COMMENTAIRES POUR LES CLUSTERS
-- ============================================
CREATE TABLE IF NOT EXISTS cluster_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES cluster_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cluster_comments_cluster ON cluster_comments(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_comments_user ON cluster_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_cluster_comments_parent ON cluster_comments(parent_comment_id);

-- ============================================
-- 7. TABLE LIKES SUR LES COMMENTAIRES DE POSTS (Simple)
-- ============================================
-- Supprimer l'ancienne table si elle existe avec mauvaise structure
DROP TABLE IF EXISTS comment_likes CASCADE;

CREATE TABLE comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);

-- ============================================
-- 8. TABLE LIKES SUR LES COMMENTAIRES DE NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS note_comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES note_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_note_comment_likes_comment ON note_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_note_comment_likes_user ON note_comment_likes(user_id);

-- ============================================
-- 9. TABLE LIKES SUR LES COMMENTAIRES DE CLUSTERS
-- ============================================
CREATE TABLE IF NOT EXISTS cluster_comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES cluster_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_comment_likes_comment ON cluster_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_cluster_comment_likes_user ON cluster_comment_likes(user_id);

-- ============================================
-- 10. TABLE SAVES POUR LES NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS note_saves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_note_saves_note ON note_saves(note_id);
CREATE INDEX IF NOT EXISTS idx_note_saves_user ON note_saves(user_id);

-- ============================================
-- 11. TABLE SAVES POUR LES CLUSTERS
-- ============================================
CREATE TABLE IF NOT EXISTS cluster_saves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cluster_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_saves_cluster ON cluster_saves(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_saves_user ON cluster_saves(user_id);

-- ============================================
-- 12. TRIGGERS POUR NOTES
-- ============================================

-- Trigger function pour notes
CREATE OR REPLACE FUNCTION update_note_engagement_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'note_likes' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE notes SET 
                likes_count = likes_count + 1,
                last_engagement_at = NOW()
            WHERE id = NEW.note_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE notes SET 
                likes_count = GREATEST(0, likes_count - 1),
                last_engagement_at = NOW()
            WHERE id = OLD.note_id;
        END IF;
    END IF;
    
    IF TG_TABLE_NAME = 'note_comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE notes SET 
                comments_count = comments_count + 1,
                last_engagement_at = NOW()
            WHERE id = NEW.note_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE notes SET 
                comments_count = GREATEST(0, comments_count - 1),
                last_engagement_at = NOW()
            WHERE id = OLD.note_id;
        END IF;
    END IF;
    
    IF TG_TABLE_NAME = 'note_saves' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE notes SET 
                saves_count = saves_count + 1,
                last_engagement_at = NOW()
            WHERE id = NEW.note_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE notes SET 
                saves_count = GREATEST(0, saves_count - 1),
                last_engagement_at = NOW()
            WHERE id = OLD.note_id;
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers pour notes
DROP TRIGGER IF EXISTS update_note_likes_count ON note_likes;
CREATE TRIGGER update_note_likes_count
AFTER INSERT OR DELETE ON note_likes
FOR EACH ROW EXECUTE FUNCTION update_note_engagement_counts();

DROP TRIGGER IF EXISTS update_note_comments_count ON note_comments;
CREATE TRIGGER update_note_comments_count
AFTER INSERT OR DELETE ON note_comments
FOR EACH ROW EXECUTE FUNCTION update_note_engagement_counts();

DROP TRIGGER IF EXISTS update_note_saves_count ON note_saves;
CREATE TRIGGER update_note_saves_count
AFTER INSERT OR DELETE ON note_saves
FOR EACH ROW EXECUTE FUNCTION update_note_engagement_counts();

-- ============================================
-- 13. TRIGGERS POUR CLUSTERS
-- ============================================

-- Trigger function pour clusters
CREATE OR REPLACE FUNCTION update_cluster_engagement_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'cluster_likes' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE clusters SET 
                likes_count = likes_count + 1,
                last_engagement_at = NOW()
            WHERE id = NEW.cluster_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE clusters SET 
                likes_count = GREATEST(0, likes_count - 1),
                last_engagement_at = NOW()
            WHERE id = OLD.cluster_id;
        END IF;
    END IF;
    
    IF TG_TABLE_NAME = 'cluster_comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE clusters SET 
                comments_count = comments_count + 1,
                last_engagement_at = NOW()
            WHERE id = NEW.cluster_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE clusters SET 
                comments_count = GREATEST(0, comments_count - 1),
                last_engagement_at = NOW()
            WHERE id = OLD.cluster_id;
        END IF;
    END IF;
    
    IF TG_TABLE_NAME = 'cluster_saves' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE clusters SET 
                saves_count = saves_count + 1,
                last_engagement_at = NOW()
            WHERE id = NEW.cluster_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE clusters SET 
                saves_count = GREATEST(0, saves_count - 1),
                last_engagement_at = NOW()
            WHERE id = OLD.cluster_id;
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers pour clusters
DROP TRIGGER IF EXISTS update_cluster_likes_count ON cluster_likes;
CREATE TRIGGER update_cluster_likes_count
AFTER INSERT OR DELETE ON cluster_likes
FOR EACH ROW EXECUTE FUNCTION update_cluster_engagement_counts();

DROP TRIGGER IF EXISTS update_cluster_comments_count ON cluster_comments;
CREATE TRIGGER update_cluster_comments_count
AFTER INSERT OR DELETE ON cluster_comments
FOR EACH ROW EXECUTE FUNCTION update_cluster_engagement_counts();

DROP TRIGGER IF EXISTS update_cluster_saves_count ON cluster_saves;
CREATE TRIGGER update_cluster_saves_count
AFTER INSERT OR DELETE ON cluster_saves
FOR EACH ROW EXECUTE FUNCTION update_cluster_engagement_counts();

-- ============================================
-- 14. VÉRIFICATION
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration unified engagement terminée avec succès!';
END $$;
