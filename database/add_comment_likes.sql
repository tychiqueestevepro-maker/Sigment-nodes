-- ============================================
-- Migration: Add Comment Likes Table
-- Version: 1.0.0
-- Date: 2025-12-05
-- ============================================

-- Table pour les likes sur les commentaires
CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un user ne peut liker un commentaire qu'une fois
    UNIQUE(comment_id, user_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);

-- ============================================
-- RLS (Row Level Security) - Désactivé car géré par le backend
-- ============================================
-- ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Policies commentées car nous utilisons le service role
-- CREATE POLICY "Users can view all comment likes"
--     ON comment_likes FOR SELECT
--     USING (true);
-- 
-- CREATE POLICY "Users can like comments"
--     ON comment_likes FOR INSERT
--     WITH CHECK (auth.uid() = user_id);
-- 
-- CREATE POLICY "Users can unlike their own likes"
--     ON comment_likes FOR DELETE
--     USING (auth.uid() = user_id);

-- ============================================
-- Vérification
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comment_likes') THEN
        RAISE NOTICE '✅ Table comment_likes créée avec succès!';
    ELSE
        RAISE EXCEPTION '❌ Échec de création de la table comment_likes';
    END IF;
END $$;
