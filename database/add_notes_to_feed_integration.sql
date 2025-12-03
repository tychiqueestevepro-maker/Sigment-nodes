-- ============================================
-- NOTES TO FEED INTEGRATION - Migration
-- Connecte le système de Notes (AI Processing) au Social Feed
-- ============================================

-- ============================================
-- 1. Add note_id Column to posts Table
-- ============================================

-- Ajouter la colonne note_id pour faire le lien avec les notes
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS note_id UUID UNIQUE REFERENCES notes(id) ON DELETE SET NULL;

-- Index pour recherche rapide par note_id
CREATE INDEX IF NOT EXISTS idx_posts_note_id ON posts(note_id);

-- ============================================
-- 2. Update post_type to Include 'linked_idea'
-- ============================================

-- Modifier la contrainte CHECK pour accepter 'linked_idea'
ALTER TABLE posts 
DROP CONSTRAINT IF EXISTS posts_post_type_check;

ALTER TABLE posts 
ADD CONSTRAINT posts_post_type_check 
CHECK (post_type IN ('standard', 'announcement', 'poll', 'event', 'linked_idea'));

-- ============================================
-- 3. Add Metadata Fields for Linked Ideas
-- ============================================

-- Ajouter des colonnes optionnelles pour enrichir les posts liés aux notes
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES pillars(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_relevance_score FLOAT;

-- Indexes pour filtrage par pillar/cluster
CREATE INDEX IF NOT EXISTS idx_posts_pillar ON posts(pillar_id);
CREATE INDEX IF NOT EXISTS idx_posts_cluster ON posts(cluster_id);

-- ============================================
-- 4. Helper Function: Publish Note to Feed
-- ============================================

CREATE OR REPLACE FUNCTION publish_note_to_feed(p_note_id UUID)
RETURNS UUID AS $$
DECLARE
    v_post_id UUID;
    v_note RECORD;
BEGIN
    -- Fetch note data
    SELECT 
        n.id,
        n.user_id,
        n.organization_id,
        n.content_clarified,
        n.pillar_id,
        n.cluster_id,
        n.ai_relevance_score,
        p.color AS pillar_color,
        p.name AS pillar_name
    INTO v_note
    FROM notes n
    LEFT JOIN pillars p ON n.pillar_id = p.id
    WHERE n.id = p_note_id;
    
    -- Check if note exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Note % not found', p_note_id;
    END IF;
    
    -- Check if already published
    IF EXISTS (SELECT 1 FROM posts WHERE note_id = p_note_id) THEN
        RAISE NOTICE 'Note % already published to feed', p_note_id;
        SELECT id INTO v_post_id FROM posts WHERE note_id = p_note_id;
        RETURN v_post_id;
    END IF;
    
    -- Create post from note
    INSERT INTO posts (
        user_id,
        organization_id,
        content,
        post_type,
        note_id,
        pillar_id,
        cluster_id,
        ai_relevance_score,
        virality_score,
        virality_level,
        metadata,
        created_at,
        updated_at,
        last_engagement_at
    ) VALUES (
        v_note.user_id,
        v_note.organization_id,
        v_note.content_clarified,  -- Version propre de l'IA
        'linked_idea',
        v_note.id,
        v_note.pillar_id,
        v_note.cluster_id,
        v_note.ai_relevance_score,
        50.0,  -- Cold Start Boost initial
        'local',
        jsonb_build_object(
            'source', 'ai_processing',
            'pillar_name', v_note.pillar_name,
            'pillar_color', v_note.pillar_color
        ),
        NOW(),  -- CRUCIAL: Reset l'horloge pour Cold Start
        NOW(),
        NOW()
    )
    RETURNING id INTO v_post_id;
    
    RAISE NOTICE '✅ Note % published to feed as post %', p_note_id, v_post_id;
    
    RETURN v_post_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Trigger: Auto-publish on Note Processing
-- ============================================

-- Fonction trigger pour publication automatique
CREATE OR REPLACE FUNCTION auto_publish_processed_note()
RETURNS TRIGGER AS $$
BEGIN
    -- Publier uniquement si le status passe à 'processed'
    IF NEW.status = 'processed' AND (OLD.status IS NULL OR OLD.status != 'processed') THEN
        -- Appeler la fonction de publication
        PERFORM publish_note_to_feed(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger (optionnel - peut être géré par Celery)
-- Décommentez si vous voulez une publication automatique via trigger DB
-- CREATE TRIGGER trigger_auto_publish_note
-- AFTER UPDATE ON notes
-- FOR EACH ROW
-- WHEN (NEW.status = 'processed')
-- EXECUTE FUNCTION auto_publish_processed_note();

-- ============================================
-- 6. View: Feed with Note Context
-- ============================================

-- Vue pour faciliter l'affichage du feed avec contexte des notes
CREATE OR REPLACE VIEW v_feed_with_context AS
SELECT 
    p.id,
    p.user_id,
    p.organization_id,
    p.content,
    p.post_type,
    p.note_id,
    p.pillar_id,
    p.cluster_id,
    p.ai_relevance_score,
    p.virality_score,
    p.virality_level,
    p.likes_count,
    p.comments_count,
    p.shares_count,
    p.saves_count,
    p.created_at,
    p.metadata,
    -- Note context (si applicable)
    n.content_raw AS note_original_content,
    n.status AS note_status,
    -- Pillar context
    pl.name AS pillar_name,
    pl.color AS pillar_color,
    -- Cluster context
    c.title AS cluster_title,
    -- User context
    u.email AS user_email,
    u.first_name AS user_first_name,
    u.last_name AS user_last_name
FROM posts p
LEFT JOIN notes n ON p.note_id = n.id
LEFT JOIN pillars pl ON p.pillar_id = pl.id
LEFT JOIN clusters c ON p.cluster_id = c.id
LEFT JOIN users u ON p.user_id = u.id;

-- ============================================
-- VERIFICATION
-- ============================================

-- Vérifier la structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'posts' 
AND column_name IN ('note_id', 'pillar_id', 'cluster_id', 'ai_relevance_score')
ORDER BY ordinal_position;

-- ============================================
-- COMPLETE
-- ============================================

COMMENT ON COLUMN posts.note_id IS 'Lien vers la note source (si post créé depuis AI processing)';
COMMENT ON COLUMN posts.pillar_id IS 'Pilier stratégique (hérité de la note si applicable)';
COMMENT ON COLUMN posts.cluster_id IS 'Cluster d''idées similaires (hérité de la note si applicable)';
COMMENT ON FUNCTION publish_note_to_feed IS 'Publie une note traitée dans le feed social avec Cold Start Boost';
COMMENT ON VIEW v_feed_with_context IS 'Vue enrichie du feed avec contexte des notes, pillars et clusters';
