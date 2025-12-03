-- ============================================
-- TIME DECAY OPTIMIZATION - Migration
-- Ajoute la fenêtre de 30 jours pour le feed
-- ============================================

-- ============================================
-- 1. Update get_social_feed Function (30-Day Window)
-- ============================================

CREATE OR REPLACE FUNCTION get_social_feed(
    p_user_org_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_last_seen_score FLOAT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    organization_id UUID,
    content TEXT,
    media_urls TEXT[],
    post_type VARCHAR(20),
    likes_count INTEGER,
    comments_count INTEGER,
    shares_count INTEGER,
    saves_count INTEGER,
    virality_score FLOAT,
    virality_level VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE,
    hours_old FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.organization_id,
        p.content,
        p.media_urls,
        p.post_type,
        p.likes_count,
        p.comments_count,
        p.shares_count,
        p.saves_count,
        p.virality_score,
        p.virality_level,
        p.created_at,
        EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 AS hours_old
    FROM posts p
    WHERE 
        -- 🕐 TIME DECAY: 30-Day Window (Posts trop vieux sont exclus)
        p.created_at > NOW() - INTERVAL '30 days'
        -- "Local OR Viral" Logic
        AND (p.organization_id = p_user_org_id OR p.virality_level IN ('viral', 'national', 'global'))
        -- Cursor pagination: posts avec score inférieur au dernier vu
        AND (p_last_seen_score IS NULL OR p.virality_score < p_last_seen_score)
    ORDER BY p.virality_score DESC, p.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Update get_feed_by_tag Function (30-Day Window)
-- ============================================

CREATE OR REPLACE FUNCTION get_feed_by_tag(
    p_user_org_id UUID,
    p_tag_name VARCHAR(100),
    p_limit INTEGER DEFAULT 20,
    p_last_seen_score FLOAT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    organization_id UUID,
    content TEXT,
    media_urls TEXT[],
    post_type VARCHAR(20),
    likes_count INTEGER,
    comments_count INTEGER,
    shares_count INTEGER,
    saves_count INTEGER,
    virality_score FLOAT,
    virality_level VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE,
    hours_old FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.organization_id,
        p.content,
        p.media_urls,
        p.post_type,
        p.likes_count,
        p.comments_count,
        p.shares_count,
        p.saves_count,
        p.virality_score,
        p.virality_level,
        p.created_at,
        EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 AS hours_old
    FROM posts p
    INNER JOIN post_tags pt ON p.id = pt.post_id
    INNER JOIN tags t ON pt.tag_id = t.id
    WHERE 
        -- 🕐 TIME DECAY: 30-Day Window (Posts trop vieux sont exclus)
        p.created_at > NOW() - INTERVAL '30 days'
        -- Tag filter
        AND t.name = p_tag_name
        -- "Local OR Viral" Logic
        AND (p.organization_id = p_user_org_id OR p.virality_level IN ('viral', 'national', 'global'))
        -- Cursor pagination
        AND (p_last_seen_score IS NULL OR p.virality_score < p_last_seen_score)
    ORDER BY p.virality_score DESC, p.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Create Indexes for Time-Based Queries (Performance)
-- ============================================

-- Note: Partial indexes avec NOW() ne sont pas supportés (fonctions non-IMMUTABLE)
-- Solution: Indexes normaux qui seront utilisés efficacement avec la clause WHERE

-- Index sur created_at pour filtrage temporel
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON posts(created_at DESC);

-- Composite index optimisé pour les requêtes de feed
CREATE INDEX IF NOT EXISTS idx_posts_feed_time_optimized 
ON posts(organization_id, created_at DESC, virality_score DESC);

-- ============================================
-- 4. Helper Function: Clean Old Posts (Optional Maintenance)
-- ============================================

-- Function pour archiver ou nettoyer les posts très vieux (> 1 an)
-- Cette fonction peut être appelée périodiquement par un cron job
CREATE OR REPLACE FUNCTION archive_old_posts(p_age_days INTEGER DEFAULT 365)
RETURNS TABLE (
    archived_count INTEGER,
    message TEXT
) AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Compter les posts à archiver
    SELECT COUNT(*) INTO v_count
    FROM posts
    WHERE created_at < NOW() - MAKE_INTERVAL(days => p_age_days);
    
    -- Option 1: Marquer comme archivés (ajouter une colonne 'archived' si nécessaire)
    -- Option 2: Déplacer vers une table d'archive
    -- Option 3: Supprimer (attention: perte de données!)
    
    -- Pour l'instant, on retourne juste le comptage
    RETURN QUERY
    SELECT 
        v_count::INTEGER AS archived_count,
        format('Found %s posts older than %s days', v_count, p_age_days) AS message;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION
-- ============================================

-- Vérifier les posts dans la fenêtre de 30 jours
SELECT 
    COUNT(*) AS total_posts_last_30_days,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS posts_last_7_days,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') AS posts_last_24h
FROM posts;

-- ============================================
-- COMPLETE
-- ============================================

COMMENT ON FUNCTION get_social_feed IS 'Feed principal avec fenêtre de 30 jours pour Time Decay optimization';
COMMENT ON FUNCTION get_feed_by_tag IS 'Feed par tag avec fenêtre de 30 jours pour Time Decay optimization';
COMMENT ON FUNCTION archive_old_posts IS 'Helper function pour archiver/nettoyer les posts très anciens';
