-- OPTIMIZED SOCIAL FEED RPCs
-- Returns fully enriched JSON to eliminate N+1 queries

DROP FUNCTION IF EXISTS get_social_feed_optimized;

CREATE OR REPLACE FUNCTION get_social_feed_optimized(
    p_user_org_id UUID,
    p_limit INT,
    p_last_seen_score FLOAT DEFAULT NULL,
    p_current_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(to_jsonb(t))
    INTO v_result
    FROM (
        SELECT
            p.id,
            p.user_id,
            p.organization_id,
            p.content,
            p.media_urls,
            p.post_type,
            p.status,
            p.scheduled_at,
            p.likes_count,
            p.comments_count,
            p.shares_count,
            p.saves_count,
            p.virality_score,
            p.virality_level,
            p.created_at,
            -- User Info
            jsonb_build_object(
                'id', u.id,
                'email', u.email,
                'first_name', u.first_name,
                'last_name', u.last_name,
                'avatar_url', u.avatar_url
            ) as user_info,
            -- Tags
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', t.id,
                            'name', t.name,
                            'trend_score', t.trend_score
                        )
                    )
                    FROM post_tags pt
                    JOIN tags t ON t.id = pt.tag_id
                    WHERE pt.post_id = p.id
                ),
                '[]'::jsonb
            ) as tags,
            -- Is Liked
            CASE WHEN p_current_user_id IS NOT NULL THEN
                EXISTS (
                    SELECT 1 FROM post_likes pl
                    WHERE pl.post_id = p.id AND pl.user_id = p_current_user_id
                )
            ELSE FALSE END as is_liked,
            -- Is Saved
            CASE WHEN p_current_user_id IS NOT NULL THEN
                EXISTS (
                    SELECT 1 FROM post_saves ps
                    WHERE ps.post_id = p.id AND ps.user_id = p_current_user_id
                )
            ELSE FALSE END as is_saved,
            -- Poll Data (simplified structure for list view)
            (
                SELECT to_jsonb(pl_row) FROM (
                     SELECT
                        pl.id,
                        pl.question,
                        pl.allow_multiple,
                        pl.expires_at,
                         COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id', po.id,
                                        'text', po.option_text,
                                        'votes_count', po.votes_count,
                                        'percentage', 0, 
                                        'is_voted', CASE WHEN p_current_user_id IS NOT NULL THEN EXISTS(SELECT 1 FROM poll_votes pv WHERE pv.option_id = po.id AND pv.user_id = p_current_user_id) ELSE FALSE END
                                    ) ORDER BY po.display_order
                                )
                                FROM poll_options po
                                WHERE po.poll_id = pl.id
                            ),
                            '[]'::jsonb
                        ) as options
                     FROM polls pl
                     WHERE pl.post_id = p.id
                     LIMIT 1
                ) pl_row
            ) as poll

        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE
            p.status = 'published'
            AND (
                p.organization_id = p_user_org_id -- Local
                OR
                p.virality_level IN ('viral', 'national', 'global') -- Viral
            )
            AND (
                p_last_seen_score IS NULL
                OR
                (p.virality_score < p_last_seen_score)
                OR
                (p.virality_score = p_last_seen_score AND p.created_at < (SELECT created_at FROM posts WHERE virality_score = p_last_seen_score LIMIT 1))
            )
        ORDER BY p.virality_score DESC, p.created_at DESC
        LIMIT p_limit
    ) t;

    RETURN COALESCE(v_result, '[]');
END;
$$;


DROP FUNCTION IF EXISTS get_feed_by_tag_optimized;

CREATE OR REPLACE FUNCTION get_feed_by_tag_optimized(
    p_user_org_id UUID,
    p_tag_name TEXT,
    p_limit INT,
    p_last_seen_score FLOAT DEFAULT NULL,
    p_current_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(to_jsonb(t))
    INTO v_result
    FROM (
        SELECT
            p.id,
            p.user_id,
            p.organization_id,
            p.content,
            p.media_urls,
            p.post_type,
            p.status,
            p.scheduled_at,
            p.likes_count,
            p.comments_count,
            p.shares_count,
            p.saves_count,
            p.virality_score,
            p.virality_level,
            p.created_at,
             -- User Info
            jsonb_build_object(
                'id', u.id,
                'email', u.email,
                'first_name', u.first_name,
                'last_name', u.last_name,
                'avatar_url', u.avatar_url
            ) as user_info,
            -- Tags
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', t.id,
                            'name', t.name,
                            'trend_score', t.trend_score
                        )
                    )
                    FROM post_tags pt
                    JOIN tags t ON t.id = pt.tag_id
                    WHERE pt.post_id = p.id
                ),
                '[]'::jsonb
            ) as tags,
            -- Is Liked
            CASE WHEN p_current_user_id IS NOT NULL THEN
                EXISTS (
                    SELECT 1 FROM post_likes pl
                    WHERE pl.post_id = p.id AND pl.user_id = p_current_user_id
                )
            ELSE FALSE END as is_liked,
            -- Is Saved
             CASE WHEN p_current_user_id IS NOT NULL THEN
                EXISTS (
                    SELECT 1 FROM post_saves ps
                    WHERE ps.post_id = p.id AND ps.user_id = p_current_user_id
                )
            ELSE FALSE END as is_saved,
             -- Poll Data
            (
                SELECT to_jsonb(pl_row) FROM (
                     SELECT
                        pl.id,
                        pl.question,
                        pl.allow_multiple,
                        pl.expires_at,
                         COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id', po.id,
                                        'text', po.option_text,
                                        'votes_count', po.votes_count,
                                        'percentage', 0,
                                        'is_voted', CASE WHEN p_current_user_id IS NOT NULL THEN EXISTS(SELECT 1 FROM poll_votes pv WHERE pv.option_id = po.id AND pv.user_id = p_current_user_id) ELSE FALSE END
                                    ) ORDER BY po.display_order
                                )
                                FROM poll_options po
                                WHERE po.poll_id = pl.id
                            ),
                            '[]'::jsonb
                        ) as options
                     FROM polls pl
                     WHERE pl.post_id = p.id
                     LIMIT 1
                ) pl_row
            ) as poll

        FROM posts p
        JOIN users u ON u.id = p.user_id
        JOIN post_tags pt_filter ON pt_filter.post_id = p.id
        JOIN tags t_filter ON t_filter.id = pt_filter.tag_id
        WHERE
            p.status = 'published'
            AND LOWER(t_filter.name) = LOWER(p_tag_name)
            AND (
                p.organization_id = p_user_org_id
                OR
                p.virality_level IN ('viral', 'national', 'global')
            )
             AND (
                p_last_seen_score IS NULL
                OR
                (p.virality_score < p_last_seen_score)
                OR
                (p.virality_score = p_last_seen_score AND p.created_at < (SELECT created_at FROM posts WHERE virality_score = p_last_seen_score LIMIT 1))
            )
        ORDER BY p.virality_score DESC, p.created_at DESC
        LIMIT p_limit
    ) t;

    RETURN COALESCE(v_result, '[]');
END;
$$;


DROP FUNCTION IF EXISTS get_comments_with_replies;

CREATE OR REPLACE FUNCTION get_comments_with_replies(
    p_post_id UUID,
    p_current_user_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(to_jsonb(c))
    INTO v_result
    FROM (
        SELECT
            cm.id,
            cm.post_id,
            cm.user_id,
            cm.content,
            cm.media_url,
            cm.parent_comment_id,
            cm.created_at,
            cm.updated_at,
            (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = cm.id) as likes_count,
            -- User Info
            jsonb_build_object(
                'id', u.id,
                'first_name', u.first_name,
                'last_name', u.last_name,
                'avatar_url', u.avatar_url
            ) as user_info,
            -- Is Liked
            CASE WHEN p_current_user_id IS NOT NULL THEN
                EXISTS (
                    SELECT 1 FROM comment_likes cl
                    WHERE cl.comment_id = cm.id AND cl.user_id = p_current_user_id
                )
            ELSE FALSE END as is_liked,
            -- Poll Data (if any, simplifying for comments)
            cm.poll_data,
            -- Replies
            COALESCE(
                (
                    SELECT jsonb_agg(to_jsonb(r))
                    FROM (
                        SELECT
                            rep.id,
                            rep.post_id,
                            rep.user_id,
                            rep.content,
                            rep.media_url,
                            rep.parent_comment_id,
                            rep.created_at,
                            rep.updated_at,
                            (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = rep.id) as likes_count,
                             jsonb_build_object(
                                'id', ru.id,
                                'first_name', ru.first_name,
                                'last_name', ru.last_name,
                                'avatar_url', ru.avatar_url
                            ) as user_info,
                            CASE WHEN p_current_user_id IS NOT NULL THEN
                                EXISTS (
                                    SELECT 1 FROM comment_likes cl2
                                    WHERE cl2.comment_id = rep.id AND cl2.user_id = p_current_user_id
                                )
                            ELSE FALSE END as is_liked,
                            rep.poll_data,
                            0 as replies_count
                        FROM post_comments rep
                        JOIN users ru ON ru.id = rep.user_id
                        WHERE rep.parent_comment_id = cm.id
                        ORDER BY rep.created_at ASC
                    ) r
                ),
                '[]'::jsonb
            ) as replies,
            (SELECT COUNT(*) FROM post_comments WHERE parent_comment_id = cm.id) as replies_count

        FROM post_comments cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.post_id = p_post_id AND cm.parent_comment_id IS NULL
        ORDER BY cm.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) c;

    RETURN COALESCE(v_result, '[]');
END;
$$;


DROP FUNCTION IF EXISTS get_comment_replies_optimized;

CREATE OR REPLACE FUNCTION get_comment_replies_optimized(
    p_comment_id UUID,
    p_current_user_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(to_jsonb(r))
    INTO v_result
    FROM (
        SELECT
            rep.id,
            rep.post_id,
            rep.user_id,
            rep.content,
            rep.media_url,
            rep.parent_comment_id,
            rep.created_at,
            rep.updated_at,
            (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = rep.id) as likes_count,
            rep.poll_data,
             jsonb_build_object(
                'id', ru.id,
                'first_name', ru.first_name,
                'last_name', ru.last_name,
                'avatar_url', ru.avatar_url
            ) as user_info,
            CASE WHEN p_current_user_id IS NOT NULL THEN
                EXISTS (
                    SELECT 1 FROM comment_likes cl2
                    WHERE cl2.comment_id = rep.id AND cl2.user_id = p_current_user_id
                )
            ELSE FALSE END as is_liked,
            0 as replies_count,
            '[]'::jsonb as replies
        FROM post_comments rep
        JOIN users ru ON ru.id = rep.user_id
        WHERE rep.parent_comment_id = p_comment_id
        ORDER BY rep.created_at ASC
        LIMIT p_limit
        OFFSET p_offset
    ) r;

    RETURN COALESCE(v_result, '[]');
END;
$$;
