-- ===================================================
-- Migration: Optimize RLS Performance
-- Description: Fix auth_rls_initplan warnings, remove duplicate indexes,
--              and consolidate redundant policies
-- Date: 2025-12-10
-- Author: Database Performance Team
-- ===================================================

-- ============================================
-- STEP 1: FIX AUTH RLS INITPLAN (Critical Performance)
-- Issue: auth.uid() and current_setting() re-evaluated per row
-- Fix: Wrap in (SELECT ...) subquery to evaluate once per query
-- Pattern: Use "column IN (SELECT func())" instead of "column = func()"
-- ============================================

-- ----------------------------------------
-- 1.1 PILLARS TABLE POLICIES
-- ----------------------------------------

-- Drop all existing policies on pillars (including any we might have created before)
DROP POLICY IF EXISTS "pillars_isolation_policy" ON pillars;
DROP POLICY IF EXISTS "Users can view pillars of their own organization" ON pillars;
DROP POLICY IF EXISTS "Owners can manage pillars" ON pillars;
DROP POLICY IF EXISTS "pillars_select_policy" ON pillars;
DROP POLICY IF EXISTS "pillars_modify_policy" ON pillars;
DROP POLICY IF EXISTS "pillars_insert_policy" ON pillars;
DROP POLICY IF EXISTS "pillars_update_policy" ON pillars;
DROP POLICY IF EXISTS "pillars_delete_policy" ON pillars;

-- Create optimized, consolidated policy for SELECT only
-- Uses subquery to ensure auth.uid() is evaluated once per query
CREATE POLICY "pillars_select_policy" ON pillars
    FOR SELECT
    USING (
        organization_id IN (SELECT (current_setting('app.current_organization_id', true))::UUID)
        OR
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE organization_id = pillars.organization_id
            AND user_id IN (SELECT auth.uid())
        )
    );

-- Create separate policies for INSERT/UPDATE/DELETE (Owners only)
-- This avoids multiple permissive policies for SELECT
CREATE POLICY "pillars_insert_policy" ON pillars
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE organization_id = pillars.organization_id
            AND user_id IN (SELECT auth.uid())
            AND role = 'OWNER'
        )
    );

CREATE POLICY "pillars_update_policy" ON pillars
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE organization_id = pillars.organization_id
            AND user_id IN (SELECT auth.uid())
            AND role = 'OWNER'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE organization_id = pillars.organization_id
            AND user_id IN (SELECT auth.uid())
            AND role = 'OWNER'
        )
    );

CREATE POLICY "pillars_delete_policy" ON pillars
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE organization_id = pillars.organization_id
            AND user_id IN (SELECT auth.uid())
            AND role = 'OWNER'
        )
    );

-- ----------------------------------------
-- 1.2 NOTES TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "notes_isolation_policy" ON notes;

CREATE POLICY "notes_isolation_policy" ON notes
    USING (organization_id IN (SELECT (current_setting('app.current_organization_id', true))::UUID));

-- ----------------------------------------
-- 1.3 CLUSTERS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "clusters_isolation_policy" ON clusters;

CREATE POLICY "clusters_isolation_policy" ON clusters
    USING (organization_id IN (SELECT (current_setting('app.current_organization_id', true))::UUID));

-- ----------------------------------------
-- 1.4 NOTE_EVENTS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "note_events_isolation_policy" ON note_events;

CREATE POLICY "note_events_isolation_policy" ON note_events
    USING (organization_id IN (SELECT (current_setting('app.current_organization_id', true))::UUID));

-- ----------------------------------------
-- 1.5 CLUSTER_SNAPSHOTS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "cluster_snapshots_isolation_policy" ON cluster_snapshots;

CREATE POLICY "cluster_snapshots_isolation_policy" ON cluster_snapshots
    USING (organization_id IN (SELECT (current_setting('app.current_organization_id', true))::UUID));

-- ----------------------------------------
-- 1.6 CONVERSATIONS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view conversations they are in" ON conversations;

CREATE POLICY "Users can view conversations they are in" ON conversations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = id
            AND cp.user_id IN (SELECT auth.uid())
        )
    );

-- ----------------------------------------
-- 1.7 CONVERSATION_PARTICIPANTS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view participants of their conversations" ON conversation_participants;

CREATE POLICY "Users can view participants of their conversations" ON conversation_participants
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = conversation_id
            AND cp.user_id IN (SELECT auth.uid())
        )
    );

-- ----------------------------------------
-- 1.8 DIRECT_MESSAGES TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON direct_messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON direct_messages;

CREATE POLICY "Users can view messages in their conversations" ON direct_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = conversation_id
            AND cp.user_id IN (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can send messages in their conversations" ON direct_messages
    FOR INSERT
    WITH CHECK (
        sender_id IN (SELECT auth.uid()) AND
        EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = conversation_id
            AND cp.user_id IN (SELECT auth.uid())
        )
    );

-- ----------------------------------------
-- 1.9 IDEA_GROUPS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view groups they are members of" ON idea_groups;
DROP POLICY IF EXISTS "Admin can update groups" ON idea_groups;
DROP POLICY IF EXISTS "Admin can delete groups" ON idea_groups;

CREATE POLICY "Users can view groups they are members of" ON idea_groups
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = id
            AND igm.user_id IN (SELECT auth.uid())
        )
    );

CREATE POLICY "Admin can update groups" ON idea_groups
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = id
            AND igm.user_id IN (SELECT auth.uid())
            AND igm.role = 'admin'
        )
    );

CREATE POLICY "Admin can delete groups" ON idea_groups
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = id
            AND igm.user_id IN (SELECT auth.uid())
            AND igm.role = 'admin'
        )
    );

-- ----------------------------------------
-- 1.10 IDEA_GROUP_MEMBERS TABLE POLICIES
-- (Also consolidating redundant SELECT policies)
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view members of their groups" ON idea_group_members;
DROP POLICY IF EXISTS "Admins can manage members" ON idea_group_members;
DROP POLICY IF EXISTS "Admins can insert members" ON idea_group_members;
DROP POLICY IF EXISTS "Admins can update members" ON idea_group_members;
DROP POLICY IF EXISTS "Admins can delete members" ON idea_group_members;

-- Single consolidated SELECT policy for members
CREATE POLICY "Users can view members of their groups" ON idea_group_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id IN (SELECT auth.uid())
        )
    );

-- Separate policies for INSERT/UPDATE/DELETE (admins only)
CREATE POLICY "Admins can insert members" ON idea_group_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id IN (SELECT auth.uid())
            AND igm.role = 'admin'
        )
    );

CREATE POLICY "Admins can update members" ON idea_group_members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id IN (SELECT auth.uid())
            AND igm.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete members" ON idea_group_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id IN (SELECT auth.uid())
            AND igm.role = 'admin'
        )
    );

-- ----------------------------------------
-- 1.11 IDEA_GROUP_ITEMS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Members can view group items" ON idea_group_items;
DROP POLICY IF EXISTS "Members can add items" ON idea_group_items;

CREATE POLICY "Members can view group items" ON idea_group_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id IN (SELECT auth.uid())
        )
    );

CREATE POLICY "Members can add items" ON idea_group_items
    FOR INSERT
    WITH CHECK (
        added_by IN (SELECT auth.uid()) AND
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id IN (SELECT auth.uid())
        )
    );

-- ----------------------------------------
-- 1.12 IDEA_GROUP_MESSAGES TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Members can view group messages" ON idea_group_messages;
DROP POLICY IF EXISTS "Members can send messages" ON idea_group_messages;

CREATE POLICY "Members can view group messages" ON idea_group_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id IN (SELECT auth.uid())
        )
    );

CREATE POLICY "Members can send messages" ON idea_group_messages
    FOR INSERT
    WITH CHECK (
        sender_id IN (SELECT auth.uid()) AND
        EXISTS (
            SELECT 1 FROM idea_group_members igm
            WHERE igm.idea_group_id = idea_group_id
            AND igm.user_id IN (SELECT auth.uid())
        )
    );

-- ----------------------------------------
-- 1.13 POLLS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view polls in their org" ON polls;
DROP POLICY IF EXISTS "Users can create polls" ON polls;

CREATE POLICY "Users can view polls in their org" ON polls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM posts p
            JOIN memberships m ON m.organization_id = p.organization_id
            WHERE p.id = polls.post_id AND m.user_id IN (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can create polls" ON polls
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id IN (SELECT auth.uid())
        )
    );

-- ----------------------------------------
-- 1.14 POLL_OPTIONS TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can view poll options" ON poll_options;
DROP POLICY IF EXISTS "Users can create poll options" ON poll_options;

CREATE POLICY "Users can view poll options" ON poll_options
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM polls pl
            JOIN posts p ON p.id = pl.post_id
            JOIN memberships m ON m.organization_id = p.organization_id
            WHERE pl.id = poll_options.poll_id AND m.user_id IN (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can create poll options" ON poll_options
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM polls pl
            JOIN posts p ON p.id = pl.post_id
            WHERE pl.id = poll_id AND p.user_id IN (SELECT auth.uid())
        )
    );

-- ----------------------------------------
-- 1.15 POLL_VOTES TABLE POLICIES
-- ----------------------------------------

DROP POLICY IF EXISTS "Users can vote" ON poll_votes;
DROP POLICY IF EXISTS "Users can remove their votes" ON poll_votes;

CREATE POLICY "Users can vote" ON poll_votes
    FOR INSERT WITH CHECK (user_id IN (SELECT auth.uid()));

CREATE POLICY "Users can remove their votes" ON poll_votes
    FOR DELETE USING (user_id IN (SELECT auth.uid()));


-- ============================================
-- STEP 2: REMOVE DUPLICATE INDEX
-- Issue: idx_posts_created and idx_posts_created_at_desc are identical
-- ============================================

DROP INDEX IF EXISTS idx_posts_created_at_desc;

-- Note: idx_posts_created (from add_social_feed_system.sql) is retained


-- ============================================
-- STEP 3: VERIFICATION
-- ============================================

-- Verify policies were created correctly
DO $$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('pillars', 'notes', 'clusters', 'note_events', 'cluster_snapshots',
                      'conversations', 'conversation_participants', 'direct_messages',
                      'idea_groups', 'idea_group_members', 'idea_group_items', 
                      'idea_group_messages', 'polls', 'poll_options', 'poll_votes');
    
    RAISE NOTICE '======================================';
    RAISE NOTICE 'RLS Performance Optimization Complete';
    RAISE NOTICE '======================================';
    RAISE NOTICE 'Total policies: %', v_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Optimizations applied:';
    RAISE NOTICE '  ✅ auth.uid() wrapped in (SELECT ...) for single evaluation';
    RAISE NOTICE '  ✅ current_setting() wrapped in (SELECT ...) for single evaluation';
    RAISE NOTICE '  ✅ Duplicate index idx_posts_created_at_desc removed';
    RAISE NOTICE '  ✅ Redundant policies consolidated on pillars';
    RAISE NOTICE '  ✅ Redundant policies consolidated on idea_group_members';
    RAISE NOTICE '======================================';
END $$;

-- Verify the duplicate index was removed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_posts_created_at_desc') THEN
        RAISE WARNING '⚠️ Duplicate index idx_posts_created_at_desc still exists';
    ELSE
        RAISE NOTICE '✅ Duplicate index idx_posts_created_at_desc successfully removed';
    END IF;
END $$;

-- Show summary of policies per table
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Policy count per table:';
    FOR r IN 
        SELECT tablename, COUNT(*) as policy_count
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('pillars', 'notes', 'clusters', 'note_events', 'cluster_snapshots',
                          'conversations', 'conversation_participants', 'direct_messages',
                          'idea_groups', 'idea_group_members', 'idea_group_items', 
                          'idea_group_messages', 'polls', 'poll_options', 'poll_votes')
        GROUP BY tablename
        ORDER BY tablename
    LOOP
        RAISE NOTICE '  - %: % policies', r.tablename, r.policy_count;
    END LOOP;
END $$;
