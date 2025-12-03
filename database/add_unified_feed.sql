-- ============================================
-- UNIFIED FEED - Anti-Bruit Polymorphique
-- Mélange Clusters et Notes triés par dernière activité
-- ============================================

-- ============================================
-- 1. Stored Function: Get Unified Feed
-- ============================================

CREATE OR REPLACE FUNCTION get_unified_feed(
    p_organization_id UUID,
    p_current_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    sort_date TIMESTAMP WITH TIME ZONE,
    data JSONB
) AS $$
BEGIN
    RETURN QUERY
    
    -- ============================================
    -- PARTIE A: CLUSTERS (Le "Gros" contenu)
    -- ============================================
    SELECT
        c.id,
        'CLUSTER'::TEXT as type,
        c.last_updated_at as sort_date,
        jsonb_build_object(
            'id', c.id,
            'title', c.title,
            'note_count', c.note_count,
            'velocity_score', c.velocity_score,
            'pillar_id', c.pillar_id,
            'pillar_name', p.name,
            'pillar_color', p.color,
            'created_at', c.created_at,
            'last_updated_at', c.last_updated_at,
            'preview_notes', (
                -- Aperçu des 3 dernières notes du cluster
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', n.id,
                        'content', COALESCE(n.content_clarified, n.content_raw),
                        'user_id', n.user_id,
                        'created_at', n.created_at
                    )
                )
                FROM (
                    SELECT id, content_clarified, content_raw, user_id, created_at
                    FROM notes
                    WHERE cluster_id = c.id
                    AND status = 'processed'
                    ORDER BY created_at DESC
                    LIMIT 3
                ) n
            )
        ) as data
    FROM clusters c
    LEFT JOIN pillars p ON c.pillar_id = p.id
    WHERE 
        c.organization_id = p_organization_id
        -- Filtre Anti-Bruit: Clusters actifs dans les dernières 48h
        AND c.last_updated_at > NOW() - INTERVAL '48 hours'
    
    UNION ALL
    
    -- ============================================
    -- PARTIE B: NOTES (Le contenu individuel)
    -- ============================================
    SELECT
        n.id,
        'NOTE'::TEXT as type,
        COALESCE(n.processed_at, n.created_at) as sort_date,
        jsonb_build_object(
            'id', n.id,
            'content', COALESCE(n.content_clarified, n.content_raw),
            'content_raw', n.content_raw,
            'content_clarified', n.content_clarified,
            'status', n.status,
            'cluster_id', n.cluster_id,
            'pillar_id', n.pillar_id,
            'pillar_name', p.name,
            'pillar_color', p.color,
            'ai_relevance_score', n.ai_relevance_score,
            'user_id', n.user_id,
            'is_mine', (n.user_id = p_current_user_id),
            'created_at', n.created_at,
            'processed_at', n.processed_at
        ) as data
    FROM notes n
    LEFT JOIN pillars p ON n.pillar_id = p.id
    WHERE 
        n.organization_id = p_organization_id
        -- Filtre Intelligent Anti-Bruit:
        AND (
            -- Cas 1: Notes orphelines (pas encore clustérisées)
            n.cluster_id IS NULL
            -- Cas 2: Exception "Mes Notes" (toujours visibles pour moi)
            OR n.user_id = p_current_user_id
        )

    UNION ALL

    -- ============================================
    -- PARTIE C: POSTS STANDARDS (Home Feed Posts)
    -- ============================================
    SELECT
        p.id,
        'POST'::TEXT as type,
        p.created_at as sort_date,
        jsonb_build_object(
            'id', p.id,
            'content', p.content,
            'post_type', p.post_type,
            'user_id', p.user_id,
            'user_info', (
                SELECT jsonb_build_object(
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email,
                    'avatar_url', u.avatar_url
                ) FROM users u WHERE u.id = p.user_id
            ),
            'likes_count', p.likes_count,
            'comments_count', p.comments_count,
            'created_at', p.created_at,
            'is_mine', (p.user_id = p_current_user_id)
        ) as data
    FROM posts p
    WHERE 
        p.organization_id = p_organization_id
        -- Exclure les posts qui sont en fait des notes (déjà gérés par la partie B)
        AND p.post_type != 'linked_idea'
        -- Time Decay (optionnel mais recommandé)
        AND p.created_at > NOW() - INTERVAL '30 days'
    
    -- ============================================
    -- TRI GLOBAL: Dernière Activité
    -- ============================================
    ORDER BY sort_date DESC
    LIMIT p_limit;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Index Optimization
-- ============================================

-- Note: Partial indexes avec NOW() ne sont pas supportés (fonctions non-IMMUTABLE)
-- Solution: Indexes normaux qui seront utilisés efficacement avec la clause WHERE

-- Index pour clusters actifs (tri par date)
CREATE INDEX IF NOT EXISTS idx_clusters_last_updated 
ON clusters(organization_id, last_updated_at DESC);

-- Index pour notes orphelines
CREATE INDEX IF NOT EXISTS idx_notes_orphan 
ON notes(organization_id, created_at DESC)
WHERE cluster_id IS NULL;

-- Index pour notes par user
CREATE INDEX IF NOT EXISTS idx_notes_user_date 
ON notes(user_id, created_at DESC);

-- ============================================
-- 3. Helper View: Feed Stats
-- ============================================

CREATE OR REPLACE VIEW v_feed_stats AS
SELECT 
    organization_id,
    COUNT(*) FILTER (WHERE cluster_id IS NULL) AS orphan_notes_count,
    COUNT(*) FILTER (WHERE cluster_id IS NOT NULL) AS clustered_notes_count,
    COUNT(DISTINCT cluster_id) AS active_clusters_count,
    MAX(created_at) AS last_note_at
FROM notes
WHERE status = 'processed'
GROUP BY organization_id;

-- ============================================
-- VERIFICATION
-- ============================================

-- Test de la fonction
-- SELECT * FROM get_unified_feed(
--     'org-uuid',
--     'user-uuid',
--     50
-- );

-- ============================================
-- COMPLETE
-- ============================================

COMMENT ON FUNCTION get_unified_feed IS 'Feed unifié polymorphique mélangeant Clusters et Notes triés par dernière activité (Anti-Bruit)';
COMMENT ON VIEW v_feed_stats IS 'Statistiques du feed par organisation (notes orphelines, clustérisées, clusters actifs)';
