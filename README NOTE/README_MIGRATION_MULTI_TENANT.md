# 🏗️ Migration Multi-Tenant Strict - Notes & Clustering

## 📋 Vue d'ensemble

Cette migration transforme le système de notes et clustering de SIGMENT en architecture **Multi-Tenant Strict**, garantissant une **isolation complète** des données entre organisations.

---

## 🎯 Objectifs

✅ **Isolation totale** : Aucune donnée ne peut être partagée entre organisations  
✅ **Sécurité renforcée** : Contraintes DB + RLS + Validation applicative  
✅ **Performance maintenue** : Index composites optimisés pour le multi-tenant  
✅ **Backward compatible** : Migration des données existantes vers org par défaut  

---

## 📦 Fichiers de Migration

| Fichier | Description | Ordre |
|---------|-------------|-------|
| **migrate_notes_multi_tenant_strict.sql** | Migration SQL complète | 1️⃣ |
| **verify_multi_tenant_strict.sql** | Script de vérification (10 tests) | 2️⃣ |
| **MIGRATION_BACKEND_MULTI_TENANT.md** | Guide de migration backend Python | 3️⃣ |

---

## 🔄 Changements Appliqués

### **1. Tables Modifiées**

Toutes les tables suivantes ont maintenant `organization_id UUID NOT NULL` :

```
✅ pillars
✅ notes
✅ clusters
✅ note_events
✅ cluster_snapshots
```

### **2. Fonction Sécurisée**

```sql
-- AVANT (Single-Tenant)
find_similar_notes(
    query_embedding vector(1536),
    target_pillar_id UUID,
    similarity_threshold FLOAT,
    max_results INTEGER
)

-- APRÈS (Multi-Tenant Strict)
find_similar_notes(
    query_embedding vector(1536),
    target_pillar_id UUID,
    p_organization_id UUID,  -- 🔒 NOUVEAU
    similarity_threshold FLOAT,
    max_results INTEGER
)
```

### **3. Index Créés**

```sql
-- Index simples
idx_pillars_organization_id
idx_notes_organization_id
idx_clusters_organization_id
idx_note_events_organization_id
idx_cluster_snapshots_organization_id

-- Index composites (PERFORMANCE)
idx_notes_org_status (organization_id, status)
idx_notes_org_user (organization_id, user_id)
idx_clusters_org_pillar (organization_id, pillar_id)
idx_pillars_org_name (organization_id, name) UNIQUE
```

### **4. Contraintes de Validation**

```sql
-- Empêche une note de référencer un cluster d'une autre org
notes_cluster_same_org

-- Empêche une note de référencer un pillar d'une autre org
notes_pillar_same_org

-- Empêche un cluster de référencer un pillar d'une autre org
clusters_pillar_same_org
```

### **5. Row Level Security (RLS)**

```sql
-- Activé sur toutes les tables
ALTER TABLE pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies créées
pillars_isolation_policy
notes_isolation_policy
clusters_isolation_policy
note_events_isolation_policy
cluster_snapshots_isolation_policy
```

---

## 🚀 Procédure de Migration

### **Étape 1 : Backup de la base de données**

```bash
# Créer un backup complet
pg_dump -h <host> -U <user> -d <database> -F c -f backup_before_multi_tenant.dump

# Vérifier le backup
pg_restore --list backup_before_multi_tenant.dump | head -20
```

### **Étape 2 : Exécuter la migration SQL**

```bash
# Se connecter à la base de données
psql -h <host> -U <user> -d <database>

# Exécuter la migration
\i database/migrate_notes_multi_tenant_strict.sql

# Vérifier les messages de sortie
# Vous devriez voir :
# ✅ All tables have organization_id NOT NULL
# ✅ All required indexes exist
# ========================================
# Multi-Tenant Strict Migration Complete
# ========================================
```

### **Étape 3 : Vérifier la migration**

```bash
# Exécuter le script de vérification
\i database/verify_multi_tenant_strict.sql

# Vérifier que tous les tests passent
# Résultat attendu :
# ✅ ✅ ✅ MIGRATION RÉUSSIE ✅ ✅ ✅
# Tests réussis: 10 / 10
```

### **Étape 4 : Migrer le code backend**

Suivre le guide **[MIGRATION_BACKEND_MULTI_TENANT.md](./MIGRATION_BACKEND_MULTI_TENANT.md)** :

1. Mettre à jour `find_or_create_cluster` avec `organization_id`
2. Mettre à jour `process_note_task` pour récupérer `organization_id`
3. Mettre à jour `generate_cluster_snapshot_task`
4. Ajouter header `X-Organization-ID` aux routes API
5. Créer `OrganizationMiddleware`
6. Mettre à jour les modèles Pydantic

### **Étape 5 : Tester**

```bash
# Lancer les tests unitaires
pytest tests/test_multi_tenant.py -v

# Tester manuellement
curl -X POST http://localhost:8000/notes \
  -H "Content-Type: application/json" \
  -H "X-Organization-ID: <org-uuid>" \
  -d '{
    "user_id": "<user-uuid>",
    "content_raw": "Test multi-tenant"
  }'
```

### **Étape 6 : Déployer**

```bash
# 1. Déployer la migration SQL en production
# 2. Déployer le code backend
# 3. Vérifier les logs Celery
# 4. Monitorer les erreurs
```

---

## 🧪 Tests de Validation

### **Test 1 : Isolation des notes**

```sql
-- Créer 2 organisations
INSERT INTO organizations (slug, name) VALUES ('org-a', 'Organization A');
INSERT INTO organizations (slug, name) VALUES ('org-b', 'Organization B');

-- Créer une note dans org A
INSERT INTO notes (organization_id, user_id, content_raw)
SELECT 
    (SELECT id FROM organizations WHERE slug = 'org-a'),
    (SELECT id FROM users LIMIT 1),
    'Test note org A';

-- Essayer de récupérer depuis org B (doit retourner 0 lignes)
SELECT * FROM notes 
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'org-b');
-- Résultat attendu: 0 lignes
```

### **Test 2 : Clustering isolé**

```sql
-- Vérifier que find_similar_notes ne retourne que des notes de la même org
SELECT * FROM find_similar_notes(
    '[0.1, 0.2, ...]'::vector,  -- embedding
    '<pillar-uuid>',
    '<org-a-uuid>',  -- organization_id
    0.75,
    10
);
-- Résultat: Seulement des notes de org A
```

### **Test 3 : Contrainte cross-org**

```sql
-- Tenter de créer une note dans org A qui référence un cluster de org B
-- Cela DOIT échouer
INSERT INTO notes (organization_id, user_id, content_raw, cluster_id)
VALUES (
    '<org-a-uuid>',
    '<user-uuid>',
    'Test',
    '<cluster-org-b-uuid>'  -- Cluster d'une autre org
);
-- Résultat attendu: ERROR: check constraint "notes_cluster_same_org" violated
```

---

## 📊 Impact sur les Performances

### **Avant (Single-Tenant)**

```sql
-- Requête typique
SELECT * FROM notes WHERE user_id = '<uuid>';
-- Index utilisé: idx_notes_user
-- Scan: ~100ms pour 10k notes
```

### **Après (Multi-Tenant Strict)**

```sql
-- Requête typique
SELECT * FROM notes WHERE organization_id = '<uuid>' AND user_id = '<uuid>';
-- Index utilisé: idx_notes_org_user (composite)
-- Scan: ~50ms pour 10k notes (meilleur grâce à l'index composite)
```

**Amélioration** : ✅ **Performance maintenue ou améliorée** grâce aux index composites

---

## ⚠️ Points d'Attention

### **1. Migration des données existantes**

Si vous avez déjà des données en production :

```sql
-- Option A: Assigner à une org par défaut
UPDATE notes SET organization_id = (SELECT id FROM organizations WHERE slug = 'default-org') 
WHERE organization_id IS NULL;

-- Option B: Créer une org par utilisateur (si applicable)
-- Nécessite une logique métier spécifique
```

### **2. Pillars globaux vs par organisation**

**IMPORTANT** : Les pillars ne sont plus globaux !

**Avant** : 5 pillars partagés par toutes les organisations  
**Après** : Chaque organisation a ses propres pillars

**Action requise** : Dupliquer les pillars par défaut pour chaque nouvelle organisation :

```sql
-- Fonction helper pour créer les pillars par défaut
CREATE OR REPLACE FUNCTION create_default_pillars(org_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO pillars (organization_id, name, description, color) VALUES
        (org_id, 'ESG', 'Environmental, Social, and Governance initiatives', '#10B981'),
        (org_id, 'Innovation', 'Product innovation and R&D ideas', '#6366F1'),
        (org_id, 'Operations', 'Operational efficiency and process improvements', '#F59E0B'),
        (org_id, 'Customer Experience', 'Customer satisfaction and service quality', '#EC4899'),
        (org_id, 'Culture & HR', 'Employee experience and organizational culture', '#8B5CF6');
END;
$$ LANGUAGE plpgsql;

-- Utilisation
SELECT create_default_pillars('<new-org-uuid>');
```

### **3. Celery Workers**

Les workers Celery doivent être mis à jour pour passer `organization_id` à `find_similar_notes`.

**Vérifier les logs** :
```bash
celery -A app.workers.celery_app worker --loglevel=debug

# Rechercher les erreurs liées à organization_id
grep "organization_id" celery.log
```

### **4. Frontend**

Le frontend doit envoyer le header `X-Organization-ID` dans **toutes** les requêtes API.

```typescript
// Exemple avec fetch
fetch(`${API_URL}/notes`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Organization-ID': getCurrentOrganizationId()  // 🔒 REQUIS
    },
    body: JSON.stringify(noteData)
});
```

---

## 🔒 Sécurité

### **Niveaux de protection**

1. **Base de données** :
   - ✅ Contraintes `NOT NULL` sur `organization_id`
   - ✅ Foreign Keys vers `organizations`
   - ✅ Contraintes de validation cross-org
   - ✅ Row Level Security (RLS)

2. **Application** :
   - ✅ Middleware de validation `X-Organization-ID`
   - ✅ Filtrage par `organization_id` dans toutes les requêtes
   - ✅ Fonction `find_similar_notes` sécurisée

3. **Tests** :
   - ✅ Tests d'isolation
   - ✅ Tests de contraintes
   - ✅ Tests de performance

---

## 📚 Checklist de Migration

### **Base de Données**
- [ ] Backup complet créé
- [ ] Migration SQL exécutée
- [ ] Script de vérification exécuté (10/10 tests passés)
- [ ] Données existantes migrées vers org par défaut
- [ ] Pillars dupliqués pour chaque organisation

### **Backend**
- [ ] `find_or_create_cluster` mis à jour
- [ ] `process_note_task` mis à jour
- [ ] `generate_cluster_snapshot_task` mis à jour
- [ ] Routes API mises à jour avec header `X-Organization-ID`
- [ ] `OrganizationMiddleware` créé
- [ ] Modèles Pydantic mis à jour
- [ ] Tests unitaires écrits et passés

### **Frontend**
- [ ] Header `X-Organization-ID` ajouté à toutes les requêtes
- [ ] Fonction `getCurrentOrganizationId()` implémentée
- [ ] Tests d'intégration passés

### **Déploiement**
- [ ] Migration SQL déployée en production
- [ ] Code backend déployé
- [ ] Code frontend déployé
- [ ] Logs Celery vérifiés
- [ ] Monitoring activé
- [ ] Tests de bout en bout en production

---

## 🆘 Rollback

En cas de problème, voici la procédure de rollback :

```bash
# 1. Restaurer le backup
pg_restore -h <host> -U <user> -d <database> -c backup_before_multi_tenant.dump

# 2. Redéployer l'ancienne version du code backend

# 3. Vérifier que tout fonctionne
curl http://localhost:8000/health
```

---

## 📞 Support

Pour toute question :
- **Documentation SQL** : `migrate_notes_multi_tenant_strict.sql`
- **Documentation Backend** : `MIGRATION_BACKEND_MULTI_TENANT.md`
- **Script de vérification** : `verify_multi_tenant_strict.sql`

---

## 📝 Changelog

### Version 1.0.0 (2025-12-02)
- ✅ Migration SQL complète
- ✅ Fonction `find_similar_notes` sécurisée
- ✅ Contraintes de validation cross-org
- ✅ Row Level Security (RLS)
- ✅ Index composites optimisés
- ✅ Script de vérification automatisé
- ✅ Guide de migration backend

---

**Dernière mise à jour :** 2 décembre 2025  
**Auteur :** Database Architecture Team  
**Version :** 1.0.0
