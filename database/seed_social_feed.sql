-- ============================================
-- SEED DATA - Social Feed System
-- Données de test pour démontrer le système
-- ============================================

-- Note: Remplacez les UUIDs par des valeurs réelles de votre base de données
-- ou utilisez ce script comme template

-- ============================================
-- 1. Create Sample Posts (Various Ages)
-- ============================================

-- Note: Ce script utilise les users et organizations EXISTANTS dans votre DB
-- Il sélectionne automatiquement les premiers disponibles

DO $$
DECLARE
    first_user_id UUID;
    second_user_id UUID;
    third_user_id UUID;
    first_org_id UUID;
    second_org_id UUID;
BEGIN
    -- Get existing users (first 3 available)
    SELECT id INTO first_user_id FROM users ORDER BY created_at LIMIT 1;
    SELECT id INTO second_user_id FROM users ORDER BY created_at OFFSET 1 LIMIT 1;
    SELECT id INTO third_user_id FROM users ORDER BY created_at OFFSET 2 LIMIT 1;
    
    -- Fallback: use first user if not enough users
    IF second_user_id IS NULL THEN
        second_user_id := first_user_id;
    END IF;
    IF third_user_id IS NULL THEN
        third_user_id := first_user_id;
    END IF;
    
    -- Get existing organizations (first 2 available)
    SELECT id INTO first_org_id FROM organizations ORDER BY created_at LIMIT 1;
    SELECT id INTO second_org_id FROM organizations ORDER BY created_at OFFSET 1 LIMIT 1;
    
    -- Fallback: use first org if only one exists
    IF second_org_id IS NULL THEN
        second_org_id := first_org_id;
    END IF;
    
    -- Check if we have required data
    IF first_user_id IS NULL OR first_org_id IS NULL THEN
        RAISE EXCEPTION 'No users or organizations found in database. Please create at least one user and one organization first.';
    END IF;
    
    -- Post 1: Brand new (will get Cold Start Boost of 50 points)
    INSERT INTO posts (user_id, organization_id, content, post_type, virality_score, virality_level) 
    VALUES (
        first_user_id,
        first_org_id,
        '🚀 Exciting news! We just launched our new AI-powered feature. Check it out!',
        'announcement',
        50.0,
        'local'
    );
    
    -- Post 2: 1 hour old with some engagement
    INSERT INTO posts (
        user_id, 
        organization_id, 
        content, 
        post_type, 
        likes_count, 
        comments_count, 
        saves_count,
        virality_score, 
        virality_level,
        created_at
    ) VALUES (
        first_user_id,
        first_org_id,
        '💡 Great discussion in today''s team meeting about improving our processes. What are your thoughts?',
        'standard',
        15,
        3,
        2,
        126.0,  -- (15*1 + 3*3 + 2*10 + 50 boost) * 1.0
        'trending',
        NOW() - INTERVAL '1 hour'
    );
    
    -- Post 3: 3 hours old (no Cold Start Boost)
    INSERT INTO posts (
        user_id, 
        organization_id, 
        content, 
        post_type, 
        likes_count, 
        comments_count,
        virality_score, 
        virality_level,
        created_at
    ) VALUES (
        second_user_id,
        first_org_id,
        '📊 Check out our latest quarterly results. Impressive growth!',
        'standard',
        8,
        2,
        14.0,  -- (8*1 + 2*3) * 1.0 (no boost, > 2h)
        'local',
        NOW() - INTERVAL '3 hours'
    );
    
    -- Post 4: Viral post from another organization (or same if only one org)
    INSERT INTO posts (
        user_id, 
        organization_id, 
        content, 
        post_type, 
        likes_count, 
        comments_count,
        shares_count,
        saves_count,
        virality_score, 
        virality_level,
        created_at
    ) VALUES (
        third_user_id,
        second_org_id,  -- Different org (or same if only one exists)
        '🔥 This innovation is going to change everything! Must see!',
        'standard',
        250,
        45,
        30,
        50,
        1065.0,  -- ((250*1 + 45*3 + 30*5 + 50*10) * 1.5) = Trending level
        'viral',
        NOW() - INTERVAL '5 hours'
    );
    
    RAISE NOTICE '✅ Successfully created 4 sample posts using existing users and organizations';
END $$;

-- ============================================
-- 2. Create Sample Tags
-- ============================================

INSERT INTO tags (organization_id, name, trend_score) VALUES
(
    (SELECT id FROM organizations LIMIT 1),
    'innovation',
    125.5
),
(
    (SELECT id FROM organizations LIMIT 1),
    'ai',
    98.3
),
(
    (SELECT id FROM organizations LIMIT 1),
    'team',
    45.7
),
(
    (SELECT id FROM organizations LIMIT 1),
    'growth',
    67.2
),
(
    (SELECT id FROM organizations LIMIT 1),
    'culture',
    34.1
);

-- ============================================
-- 3. Associate Tags with Posts
-- ============================================

-- Get post IDs (adjust as needed)
DO $$
DECLARE
    post1_id UUID;
    post2_id UUID;
    post3_id UUID;
    post4_id UUID;
    tag_innovation_id UUID;
    tag_ai_id UUID;
    tag_team_id UUID;
    tag_growth_id UUID;
BEGIN
    -- Get post IDs (latest 4 posts)
    SELECT id INTO post1_id FROM posts ORDER BY created_at DESC OFFSET 0 LIMIT 1;
    SELECT id INTO post2_id FROM posts ORDER BY created_at DESC OFFSET 1 LIMIT 1;
    SELECT id INTO post3_id FROM posts ORDER BY created_at DESC OFFSET 2 LIMIT 1;
    SELECT id INTO post4_id FROM posts ORDER BY created_at DESC OFFSET 3 LIMIT 1;
    
    -- Get tag IDs
    SELECT id INTO tag_innovation_id FROM tags WHERE name = 'innovation' LIMIT 1;
    SELECT id INTO tag_ai_id FROM tags WHERE name = 'ai' LIMIT 1;
    SELECT id INTO tag_team_id FROM tags WHERE name = 'team' LIMIT 1;
    SELECT id INTO tag_growth_id FROM tags WHERE name = 'growth' LIMIT 1;
    
    -- Associate tags
    INSERT INTO post_tags (post_id, tag_id) VALUES
    (post1_id, tag_innovation_id),
    (post1_id, tag_ai_id),
    (post2_id, tag_team_id),
    (post3_id, tag_growth_id),
    (post4_id, tag_innovation_id);
END $$;

-- ============================================
-- 4. Add Sample Likes/Saves
-- ============================================

-- Add likes to Post 2 (from multiple users)
DO $$
DECLARE
    post2_id UUID;
    user_ids UUID[];
    user_id UUID;
BEGIN
    -- Get Post 2 ID
    SELECT id INTO post2_id FROM posts ORDER BY created_at DESC OFFSET 1 LIMIT 1;
    
    -- Get some user IDs
    SELECT ARRAY_AGG(id) INTO user_ids FROM users LIMIT 3;
    
    -- Add likes
    FOREACH user_id IN ARRAY user_ids
    LOOP
        INSERT INTO post_likes (post_id, user_id) 
        VALUES (post2_id, user_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ============================================
-- 5. Add Sample Comments
-- ============================================

DO $$
DECLARE
    post2_id UUID;
    commenter_id UUID;
BEGIN
    SELECT id INTO post2_id FROM posts ORDER BY created_at DESC OFFSET 1 LIMIT 1;
    SELECT id INTO commenter_id FROM users ORDER BY created_at LIMIT 1;  -- Use first available user
    
    IF post2_id IS NOT NULL AND commenter_id IS NOT NULL THEN
        INSERT INTO post_comments (post_id, user_id, content) VALUES
        (post2_id, commenter_id, 'Great point! I totally agree with this approach.'),
        (post2_id, commenter_id, '👍 This is exactly what we needed!');
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check posts ordered by virality score
SELECT 
    content,
    virality_score,
    virality_level,
    likes_count,
    comments_count,
    saves_count,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 AS hours_old
FROM posts
ORDER BY virality_score DESC, created_at DESC
LIMIT 10;

-- Check tags ordered by trend score
SELECT 
    name,
    trend_score,
    (SELECT COUNT(*) FROM post_tags WHERE tag_id = tags.id) AS post_count
FROM tags
ORDER BY trend_score DESC
LIMIT 10;

-- Check Cold Start effect
SELECT 
    content,
    virality_score,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 AS hours_old,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 < 2 
        THEN 'HAS COLD START BOOST 🚀'
        ELSE 'No boost (> 2h)'
    END AS boost_status
FROM posts
ORDER BY created_at DESC
LIMIT 5;
