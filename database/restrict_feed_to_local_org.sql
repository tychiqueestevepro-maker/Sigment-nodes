-- ============================================
-- RESTRICT FEED TO LOCAL ORG - Migration
-- Supprime la visibilité des posts viraux inter-organisations
-- ============================================

-- ============================================
-- 1. Update get_social_feed Function (Strict Isolation)
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
        
        -- 🔒 STRICT ISOLATION: Uniquement les posts de mon organisation
        AND p.organization_id = p_user_org_id
        
        -- Cursor pagination: posts avec score inférieur au dernier vu
        AND (p_last_seen_score IS NULL OR p.virality_score < p_last_seen_score)
    ORDER BY p.virality_score DESC, p.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Update get_feed_by_tag Function (Strict Isolation)
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
        
        -- 🔒 STRICT ISOLATION: Uniquement les posts de mon organisation
        AND p.organization_id = p_user_org_id
        
        -- Cursor pagination
        AND (p_last_seen_score IS NULL OR p.virality_score < p_last_seen_score)
    ORDER BY p.virality_score DESC, p.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMPLETE
-- ============================================

COMMENT ON FUNCTION get_social_feed IS 'Feed principal avec isolation stricte par organisation (pas de viralité cross-org)';
COMMENT ON FUNCTION get_feed_by_tag IS 'Feed par tag avec isolation stricte par organisation (pas de viralité cross-org)';
