-- ============================================
-- UNIFIED FEED OPTIMIZED - High-Performance RPC Function
-- Replaces Python-based filtering with single SQL query
-- Target: Reduce API response time from >1000ms to <100ms
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_unified_feed_optimized(UUID, UUID, INTEGER, INTEGER);

-- ============================================
-- MAIN FUNCTION: get_unified_feed_optimized
-- ============================================
CREATE OR REPLACE FUNCTION get_unified_feed_optimized(
    p_organization_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    item_type TEXT,
    id UUID,
    -- Common fields
    sort_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    likes_count INTEGER,
    comments_count INTEGER,
    is_liked BOOLEAN,
    is_mine BOOLEAN,
    -- Cluster-specific fields
    title TEXT,
    note_count INTEGER,
    velocity_score FLOAT,
    last_updated_at TIMESTAMP WITH TIME ZONE,
    preview_notes JSONB,
    -- Note-specific fields
    content TEXT,
    content_raw TEXT,
    content_clarified TEXT,
    title_clarified TEXT,
    status TEXT,
    cluster_id UUID,
    ai_relevance_score FLOAT,
    processed_at TIMESTAMP WITH TIME ZONE,
    user_id UUID,
    -- Post-specific fields
    post_type TEXT,
    media_urls TEXT[],
    has_poll BOOLEAN,
    saves_count INTEGER,
    shares_count INTEGER,
    virality_score FLOAT,
    is_saved BOOLEAN,
    user_info JSONB,
    -- Pillar info (shared)
    pillar_id UUID,
    pillar_name TEXT,
    pillar_color TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH feed_items AS (
        -- ============================================
        -- PART A: CLUSTERS (Active in last 48h, 2+ notes)
        -- ============================================
        SELECT
            'CLUSTER'::TEXT AS item_type,
            c.id,
            c.last_updated_at AS sort_date,
            c.created_at,
            c.likes_count,
            c.comments_count,
            EXISTS(
                SELECT 1 FROM cluster_likes cl 
                WHERE cl.cluster_id = c.id AND cl.user_id = p_user_id
            ) AS is_liked,
            FALSE AS is_mine,  -- Clusters don't have a direct owner
            -- Cluster-specific (cast to TEXT for UNION compatibility)
            c.title::TEXT AS title,
            c.note_count,
            c.velocity_score,
            c.last_updated_at,
            (
                SELECT jsonb_agg(note_preview ORDER BY note_preview->>'created_at' DESC)
                FROM (
                    SELECT jsonb_build_object(
                        'id', n.id,
                        'content', COALESCE(n.content_clarified, n.content_raw),
                        'user_id', n.user_id,
                        'created_at', n.created_at
                    ) AS note_preview
                    FROM notes n
                    WHERE n.cluster_id = c.id
                    AND n.status IN ('processed', 'review', 'approved', 'refused', 'archived')
                    ORDER BY n.created_at DESC
                    LIMIT 3
                ) sub
            ) AS preview_notes,
            -- Note-specific (NULL for clusters)
            NULL::TEXT AS content,
            NULL::TEXT AS content_raw,
            NULL::TEXT AS content_clarified,
            NULL::TEXT AS title_clarified,
            NULL::TEXT AS status,
            NULL::UUID AS cluster_id_ref,
            NULL::FLOAT AS ai_relevance_score,
            NULL::TIMESTAMP WITH TIME ZONE AS processed_at,
            NULL::UUID AS user_id,
            -- Post-specific (NULL for clusters)
            NULL::TEXT AS post_type,
            NULL::TEXT[] AS media_urls,
            FALSE AS has_poll,
            0 AS saves_count,
            0 AS shares_count,
            0.0::FLOAT AS virality_score,
            FALSE AS is_saved,
            NULL::JSONB AS user_info,
            -- Pillar info
            c.pillar_id,
            p.name::TEXT AS pillar_name,
            p.color::TEXT AS pillar_color,
            -- For algorithmic ranking
            c.velocity_score AS ranking_base_score
        FROM clusters c
        LEFT JOIN pillars p ON c.pillar_id = p.id
        WHERE 
            c.organization_id = p_organization_id
            AND c.last_updated_at > NOW() - INTERVAL '48 hours'
            AND c.note_count >= 2

        UNION ALL

        -- ============================================
        -- PART B: NOTES (Orphan OR Mine OR from small clusters)
        -- ============================================
        SELECT
            'NOTE'::TEXT AS item_type,
            n.id,
            COALESCE(n.processed_at, n.created_at) AS sort_date,
            n.created_at,
            n.likes_count,
            n.comments_count,
            EXISTS(
                SELECT 1 FROM note_likes nl 
                WHERE nl.note_id = n.id AND nl.user_id = p_user_id
            ) AS is_liked,
            (n.user_id = p_user_id) AS is_mine,
            -- Cluster-specific (NULL for notes)
            NULL::TEXT AS title,
            NULL::INTEGER AS note_count,
            NULL::FLOAT AS velocity_score,
            NULL::TIMESTAMP WITH TIME ZONE AS last_updated_at,
            NULL::JSONB AS preview_notes,
            -- Note-specific (cast to TEXT for UNION compatibility)
            COALESCE(n.content_clarified, n.content_raw)::TEXT AS content,
            n.content_raw::TEXT AS content_raw,
            n.content_clarified::TEXT AS content_clarified,
            n.title_clarified::TEXT AS title_clarified,
            n.status::TEXT AS status,
            n.cluster_id AS cluster_id_ref,
            n.ai_relevance_score,
            n.processed_at,
            n.user_id,
            -- Post-specific (NULL for notes)
            NULL::TEXT AS post_type,
            NULL::TEXT[] AS media_urls,
            FALSE AS has_poll,
            0 AS saves_count,
            0 AS shares_count,
            0.0::FLOAT AS virality_score,
            FALSE AS is_saved,
            NULL::JSONB AS user_info,
            -- Pillar info
            n.pillar_id,
            p.name::TEXT AS pillar_name,
            p.color::TEXT AS pillar_color,
            -- For algorithmic ranking (ai_relevance_score is 0-10, normalize to 0-100)
            COALESCE(n.ai_relevance_score * 10, 0.0) AS ranking_base_score
        FROM notes n
        LEFT JOIN pillars p ON n.pillar_id = p.id
        LEFT JOIN clusters c_check ON n.cluster_id = c_check.id
        WHERE 
            n.organization_id = p_organization_id
            AND n.status IN ('processed', 'review', 'approved', 'refused', 'archived')
            AND (
                -- Orphan notes (no cluster)
                n.cluster_id IS NULL
                -- OR My notes (always visible to me)
                OR n.user_id = p_user_id
                -- OR Notes from small clusters (<2 notes) that get "exploded" into individual notes
                OR (c_check.id IS NOT NULL AND c_check.note_count < 2)
            )

        UNION ALL

        -- ============================================
        -- PART C: POSTS (Standard posts, not linked_idea, last 30 days)
        -- ============================================
        SELECT
            'POST'::TEXT AS item_type,
            pt.id,
            pt.created_at AS sort_date,
            pt.created_at,
            pt.likes_count,
            pt.comments_count,
            EXISTS(
                SELECT 1 FROM post_likes pl 
                WHERE pl.post_id = pt.id AND pl.user_id = p_user_id
            ) AS is_liked,
            (pt.user_id = p_user_id) AS is_mine,
            -- Cluster-specific (NULL for posts)
            NULL::TEXT AS title,
            NULL::INTEGER AS note_count,
            NULL::FLOAT AS velocity_score,
            NULL::TIMESTAMP WITH TIME ZONE AS last_updated_at,
            NULL::JSONB AS preview_notes,
            -- Note-specific (NULL for posts, cast to TEXT for UNION compatibility)
            pt.content::TEXT AS content,
            NULL::TEXT AS content_raw,
            NULL::TEXT AS content_clarified,
            NULL::TEXT AS title_clarified,
            NULL::TEXT AS status,
            NULL::UUID AS cluster_id_ref,
            NULL::FLOAT AS ai_relevance_score,
            NULL::TIMESTAMP WITH TIME ZONE AS processed_at,
            pt.user_id,
            -- Post-specific (cast to TEXT for UNION compatibility)
            pt.post_type::TEXT AS post_type,
            pt.media_urls,
            COALESCE(pt.metadata->>'has_poll' = 'true', FALSE) AS has_poll,
            COALESCE(pt.saves_count, 0) AS saves_count,
            COALESCE(pt.shares_count, 0) AS shares_count,
            COALESCE(pt.virality_score, 0.0) AS virality_score,
            EXISTS(
                SELECT 1 FROM post_saves ps 
                WHERE ps.post_id = pt.id AND ps.user_id = p_user_id
            ) AS is_saved,
            (
                SELECT jsonb_build_object(
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email,
                    'avatar_url', u.avatar_url
                ) FROM users u WHERE u.id = pt.user_id
            ) AS user_info,
            -- Pillar info (NULL for posts)
            NULL::UUID AS pillar_id,
            NULL::TEXT AS pillar_name,
            NULL::TEXT AS pillar_color,
            -- For algorithmic ranking (virality_score capped at 100)
            LEAST(COALESCE(pt.virality_score, 0.0), 100.0) AS ranking_base_score
        FROM posts pt
        WHERE 
            pt.organization_id = p_organization_id
            AND pt.post_type != 'linked_idea'
            AND COALESCE(pt.status, 'active') != 'scheduled'
            AND pt.created_at > NOW() - INTERVAL '30 days'
    ),
    ranked_items AS (
        SELECT 
            fi.*,
            -- Algorithmic ranking: base_score + freshness_boost
            (
                fi.ranking_base_score +
                CASE 
                    WHEN fi.sort_date > NOW() - INTERVAL '1 hour' THEN 30
                    WHEN fi.sort_date > NOW() - INTERVAL '6 hours' THEN 25
                    WHEN fi.sort_date > NOW() - INTERVAL '12 hours' THEN 20
                    WHEN fi.sort_date > NOW() - INTERVAL '24 hours' THEN 15
                    WHEN fi.sort_date > NOW() - INTERVAL '48 hours' THEN 10
                    ELSE 0
                END
            ) AS total_score
        FROM feed_items fi
    )
    SELECT 
        ri.item_type,
        ri.id,
        ri.sort_date,
        ri.created_at,
        ri.likes_count,
        ri.comments_count,
        ri.is_liked,
        ri.is_mine,
        ri.title,
        ri.note_count,
        ri.velocity_score,
        ri.last_updated_at,
        ri.preview_notes,
        ri.content,
        ri.content_raw,
        ri.content_clarified,
        ri.title_clarified,
        ri.status,
        ri.cluster_id_ref AS cluster_id,
        ri.ai_relevance_score,
        ri.processed_at,
        ri.user_id,
        ri.post_type,
        ri.media_urls,
        ri.has_poll,
        ri.saves_count,
        ri.shares_count,
        ri.virality_score,
        ri.is_saved,
        ri.user_info,
        ri.pillar_id,
        ri.pillar_name,
        ri.pillar_color
    FROM ranked_items ri
    ORDER BY ri.total_score DESC, ri.sort_date DESC
    LIMIT p_limit
    OFFSET p_offset;
    
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- ADDITIONAL INDEXES FOR OPTIMIZATION
-- ============================================

-- Composite index for clusters (organization + recent + 2+ notes)
CREATE INDEX IF NOT EXISTS idx_clusters_feed_optimized 
ON clusters(organization_id, last_updated_at DESC) 
WHERE note_count >= 2;

-- Composite index for notes feed query
CREATE INDEX IF NOT EXISTS idx_notes_feed_optimized 
ON notes(organization_id, status, created_at DESC);

-- Composite index for posts feed query
CREATE INDEX IF NOT EXISTS idx_posts_feed_optimized 
ON posts(organization_id, post_type, created_at DESC) 
WHERE status IS DISTINCT FROM 'scheduled';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Allow the anon and authenticated roles to execute this function
GRANT EXECUTE ON FUNCTION get_unified_feed_optimized TO anon;
GRANT EXECUTE ON FUNCTION get_unified_feed_optimized TO authenticated;

-- ============================================
-- COMMENT
-- ============================================
COMMENT ON FUNCTION get_unified_feed_optimized IS 
'Optimized unified feed RPC function. Combines Clusters (2+ notes, 48h active), 
Notes (orphan/mine/small-cluster), and Posts (standard, 30 days) with algorithmic 
ranking based on velocity/relevance/virality scores + freshness boost.
Target: <100ms response time.';

-- ============================================
-- VERIFICATION
-- ============================================
-- Test the function (uncomment to run manually):
-- SELECT * FROM get_unified_feed_optimized(
--     'your-org-uuid'::UUID,
--     'your-user-uuid'::UUID,
--     50,
--     0
-- );
