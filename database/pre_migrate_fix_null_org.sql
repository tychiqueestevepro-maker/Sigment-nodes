-- ===================================================
-- Pre-Migration: Fix NULL organization_id values
-- Description: Populate NULL organization_id before strict migration
-- Date: 2025-12-02
-- ===================================================

-- ============================================
-- STEP 1: Vérifier l'existence de la table organizations
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
        RAISE EXCEPTION 'Table organizations n''existe pas. Exécutez d''abord add_multi_tenant_support.sql';
    END IF;
    RAISE NOTICE '✅ Table organizations existe';
END $$;

-- ============================================
-- STEP 2: Créer une organisation par défaut si elle n'existe pas
-- ============================================

INSERT INTO organizations (slug, name, description)
VALUES ('default-org', 'Default Organization', 'Organization par défaut pour la migration')
ON CONFLICT (slug) DO NOTHING;


-- ============================================
-- STEP 3: Compter les lignes avec organization_id NULL
-- ============================================


DO $$
DECLARE
    null_pillars INTEGER;
    null_notes INTEGER;
    null_clusters INTEGER;
    null_note_events INTEGER;
    null_cluster_snapshots INTEGER;
    default_org_id UUID;
BEGIN
    -- Récupérer l'ID de l'org par défaut
    SELECT id INTO default_org_id FROM organizations WHERE slug = 'default-org';
    
    -- Compter les NULL
    SELECT COUNT(*) INTO null_pillars FROM pillars WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_notes FROM notes WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_clusters FROM clusters WHERE organization_id IS NULL;
    
    -- Tables qui peuvent ne pas avoir la colonne encore
    BEGIN
        SELECT COUNT(*) INTO null_note_events FROM note_events WHERE organization_id IS NULL;
    EXCEPTION WHEN undefined_column THEN
        null_note_events := 0;
    END;
    
    BEGIN
        SELECT COUNT(*) INTO null_cluster_snapshots FROM cluster_snapshots WHERE organization_id IS NULL;
    EXCEPTION WHEN undefined_column THEN
        null_cluster_snapshots := 0;
    END;
    
    -- Afficher les résultats
    RAISE NOTICE 'Lignes avec organization_id NULL:';
    RAISE NOTICE '  - pillars: %', null_pillars;
    RAISE NOTICE '  - notes: %', null_notes;
    RAISE NOTICE '  - clusters: %', null_clusters;
    RAISE NOTICE '  - note_events: %', null_note_events;
    RAISE NOTICE '  - cluster_snapshots: %', null_cluster_snapshots;
    RAISE NOTICE '';
    RAISE NOTICE 'Organisation par défaut: % (%)', default_org_id, 'default-org';
END $$;

-- ============================================
-- STEP 4: Remplir organization_id pour pillars
-- ============================================


UPDATE pillars
SET organization_id = (SELECT id FROM organizations WHERE slug = 'default-org')
WHERE organization_id IS NULL;


-- ============================================
-- STEP 5: Remplir organization_id pour notes
-- ============================================


UPDATE notes
SET organization_id = (SELECT id FROM organizations WHERE slug = 'default-org')
WHERE organization_id IS NULL;


-- ============================================
-- STEP 6: Remplir organization_id pour clusters
-- ============================================


UPDATE clusters
SET organization_id = (SELECT id FROM organizations WHERE slug = 'default-org')
WHERE organization_id IS NULL;


-- ============================================
-- STEP 7: Remplir organization_id pour note_events (si la colonne existe)
-- ============================================


DO $$
BEGIN
    -- Vérifier si la colonne existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'note_events' AND column_name = 'organization_id'
    ) THEN
        -- Remplir depuis la table notes
        UPDATE note_events ne
        SET organization_id = n.organization_id
        FROM notes n
        WHERE ne.note_id = n.id
        AND ne.organization_id IS NULL;
        
        RAISE NOTICE '✅ note_events mis à jour';
    ELSE
        RAISE NOTICE '⚠️  Colonne organization_id n''existe pas encore dans note_events (sera créée par la migration)';
    END IF;
END $$;

-- ============================================
-- STEP 8: Remplir organization_id pour cluster_snapshots (si la colonne existe)
-- ============================================


DO $$
BEGIN
    -- Vérifier si la colonne existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cluster_snapshots' AND column_name = 'organization_id'
    ) THEN
        -- Remplir depuis la table clusters
        UPDATE cluster_snapshots cs
        SET organization_id = c.organization_id
        FROM clusters c
        WHERE cs.cluster_id = c.id
        AND cs.organization_id IS NULL;
        
        RAISE NOTICE '✅ cluster_snapshots mis à jour';
    ELSE
        RAISE NOTICE '⚠️  Colonne organization_id n''existe pas encore dans cluster_snapshots (sera créée par la migration)';
    END IF;
END $$;

-- ============================================
-- STEP 9: Vérification finale
-- ============================================


DO $$
DECLARE
    null_pillars INTEGER;
    null_notes INTEGER;
    null_clusters INTEGER;
    all_ok BOOLEAN := true;
BEGIN
    -- Compter les NULL restants
    SELECT COUNT(*) INTO null_pillars FROM pillars WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_notes FROM notes WHERE organization_id IS NULL;
    SELECT COUNT(*) INTO null_clusters FROM clusters WHERE organization_id IS NULL;
    
    -- Vérifier
    IF null_pillars > 0 THEN
        RAISE WARNING '❌ Il reste % pillars avec organization_id NULL', null_pillars;
        all_ok := false;
    END IF;
    
    IF null_notes > 0 THEN
        RAISE WARNING '❌ Il reste % notes avec organization_id NULL', null_notes;
        all_ok := false;
    END IF;
    
    IF null_clusters > 0 THEN
        RAISE WARNING '❌ Il reste % clusters avec organization_id NULL', null_clusters;
        all_ok := false;
    END IF;
    
    IF all_ok THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ ✅ ✅ PRÉ-MIGRATION RÉUSSIE ✅ ✅ ✅';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE 'Toutes les lignes ont maintenant un organization_id.';
        RAISE NOTICE 'Vous pouvez maintenant exécuter migrate_notes_multi_tenant_strict.sql';
        RAISE NOTICE '';
    ELSE
        RAISE EXCEPTION 'Pré-migration échouée. Vérifiez les warnings ci-dessus.';
    END IF;
END $$;

-- ============================================
-- STEP 10: Afficher un résumé
-- ============================================


SELECT 
    o.slug AS organization_slug,
    o.name AS organization_name,
    COUNT(DISTINCT p.id) AS pillars_count,
    COUNT(DISTINCT n.id) AS notes_count,
    COUNT(DISTINCT c.id) AS clusters_count
FROM organizations o
LEFT JOIN pillars p ON p.organization_id = o.id
LEFT JOIN notes n ON n.organization_id = o.id
LEFT JOIN clusters c ON c.organization_id = o.id
GROUP BY o.id, o.slug, o.name
ORDER BY o.slug;

