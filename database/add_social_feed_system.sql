-- ============================================
-- SOCIAL FEED SYSTEM - Migration Script
-- Ajoute les tables pour le feed social multi-tenant
-- ============================================

-- ============================================
-- 1. POSTS TABLE (Le cœur du Feed Social)
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL,
    media_urls TEXT[], -- Array of media URLs (images, videos)
    
    -- Post Type
    post_type VARCHAR(20) DEFAULT 'standard' CHECK (post_type IN ('standard', 'announcement', 'poll', 'event')),
    
    -- Engagement Metrics
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    
    -- Viral Score (Calculé par le Worker Celery)
    virality_score FLOAT DEFAULT 0,
    virality_level VARCHAR(20) DEFAULT 'local' CHECK (virality_level IN ('local', 'trending', 'viral', 'national', 'global')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_engagement_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for Performance
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_organization ON posts(organization_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_virality_score ON posts(virality_score DESC);
CREATE INDEX idx_posts_virality_level ON posts(virality_level);
CREATE INDEX idx_posts_org_viral ON posts(organization_id, virality_score DESC);

-- Multi-column index for feed queries (CRITICAL for performance)
CREATE INDEX idx_posts_feed_query ON posts(organization_id, virality_score DESC, created_at DESC);

-- ============================================
-- 2. TAGS TABLE (Catégorisation & Tendances)
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    trend_score FLOAT DEFAULT 0, -- Calculé par l'engagement des posts avec ce tag
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: Un tag par nom par organisation
    CONSTRAINT unique_tag_per_org UNIQUE (organization_id, name)
);

-- Indexes for Performance
CREATE INDEX idx_tags_name ON tags(name); -- Pour recherche rapide
CREATE INDEX idx_tags_organization ON tags(organization_id);
CREATE INDEX idx_tags_trend_score ON tags(trend_score DESC);
CREATE INDEX idx_tags_org_trend ON tags(organization_id, trend_score DESC);

-- ============================================
-- 3. POST_TAGS TABLE (Many-to-Many Relation)
-- ============================================
CREATE TABLE IF NOT EXISTS post_tags (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Primary key composite
    PRIMARY KEY (post_id, tag_id)
);

-- Indexes for Performance
CREATE INDEX idx_post_tags_post ON post_tags(post_id);
CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);

-- ============================================
-- 4. POST_LIKES TABLE (Engagement Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Un user ne peut liker qu'une fois un post
    CONSTRAINT unique_like_per_user_post UNIQUE (post_id, user_id)
);

CREATE INDEX idx_post_likes_post ON post_likes(post_id);
CREATE INDEX idx_post_likes_user ON post_likes(user_id);

-- ============================================
-- 5. POST_SAVES TABLE (Bookmarks)
-- ============================================
CREATE TABLE IF NOT EXISTS post_saves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Un user ne peut sauvegarder qu'une fois un post
    CONSTRAINT unique_save_per_user_post UNIQUE (post_id, user_id)
);

CREATE INDEX idx_post_saves_post ON post_saves(post_id);
CREATE INDEX idx_post_saves_user ON post_saves(user_id);

-- ============================================
-- 6. POST_COMMENTS TABLE (Commentaires)
-- ============================================
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE, -- Pour les réponses
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_post_comments_user ON post_comments(user_id);
CREATE INDEX idx_post_comments_parent ON post_comments(parent_comment_id);

-- ============================================
-- 7. TRIGGERS - Auto-update engagement counts
-- ============================================

-- Function to update post engagement counts
CREATE OR REPLACE FUNCTION update_post_engagement_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update likes count
    IF TG_TABLE_NAME = 'post_likes' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE posts SET 
                likes_count = likes_count + 1,
                last_engagement_at = NOW()
            WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE posts SET 
                likes_count = GREATEST(0, likes_count - 1),
                last_engagement_at = NOW()
            WHERE id = OLD.post_id;
        END IF;
    END IF;
    
    -- Update saves count
    IF TG_TABLE_NAME = 'post_saves' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE posts SET 
                saves_count = saves_count + 1,
                last_engagement_at = NOW()
            WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE posts SET 
                saves_count = GREATEST(0, saves_count - 1),
                last_engagement_at = NOW()
            WHERE id = OLD.post_id;
        END IF;
    END IF;
    
    -- Update comments count
    IF TG_TABLE_NAME = 'post_comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE posts SET 
                comments_count = comments_count + 1,
                last_engagement_at = NOW()
            WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE posts SET 
                comments_count = GREATEST(0, comments_count - 1),
                last_engagement_at = NOW()
            WHERE id = OLD.post_id;
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER trigger_update_likes_count
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_engagement_counts();

CREATE TRIGGER trigger_update_saves_count
AFTER INSERT OR DELETE ON post_saves
FOR EACH ROW EXECUTE FUNCTION update_post_engagement_counts();

CREATE TRIGGER trigger_update_comments_count
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW EXECUTE FUNCTION update_post_engagement_counts();

-- ============================================
-- 8. STORED FUNCTIONS - Feed Query Optimization
-- ============================================

-- Function to get social feed with cursor pagination
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
        -- "Local OR Viral" Logic
        (p.organization_id = p_user_org_id OR p.virality_level IN ('viral', 'national', 'global'))
        -- Cursor pagination: posts avec score inférieur au dernier vu
        AND (p_last_seen_score IS NULL OR p.virality_score < p_last_seen_score)
    ORDER BY p.virality_score DESC, p.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get feed by tag
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
        t.name = p_tag_name
        -- "Local OR Viral" Logic
        AND (p.organization_id = p_user_org_id OR p.virality_level IN ('viral', 'national', 'global'))
        -- Cursor pagination
        AND (p_last_seen_score IS NULL OR p.virality_score < p_last_seen_score)
    ORDER BY p.virality_score DESC, p.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMPLETE
-- ============================================
COMMENT ON TABLE posts IS 'Posts du feed social multi-tenant avec métriques d''engagement';
COMMENT ON TABLE tags IS 'Tags pour catégorisation avec trend_score';
COMMENT ON TABLE post_tags IS 'Relation many-to-many entre posts et tags';
COMMENT ON TABLE post_likes IS 'Likes sur les posts';
COMMENT ON TABLE post_saves IS 'Bookmarks/Saves sur les posts';
COMMENT ON TABLE post_comments IS 'Commentaires sur les posts';
