# 🎯 Guide Complet : Migration Multi-Tenant Strict - Résolution des Erreurs

## 📋 Vue d'ensemble

Ce guide résume **toutes les erreurs rencontrées** lors de la migration Multi-Tenant Strict et leurs solutions.

---

## ❌ Erreur 1 : `organization_id` contains null values

### **Message d'erreur**
```
ERROR: 23502: column "organization_id" of relation "pillars" contains null values
```

### **Cause**
La migration `add_multi_tenant_support.sql` a ajouté `organization_id` en **nullable**, mais la migration stricte veut le rendre **NOT NULL**.

### **Solution**
Exécuter le script de pré-migration qui assigne toutes les données à une org par défaut.

```bash
\i database/pre_migrate_fix_null_org.sql
```

### **Détails**
📖 Voir : `FIX_ORGANIZATION_ID_NULL.md`

---

## ❌ Erreur 2 : cannot use subquery in check constraint

### **Message d'erreur**
```
ERROR: 0A000: cannot use subquery in check constraint
```

### **Cause**
PostgreSQL n'autorise pas les sous-requêtes (subqueries) dans les contraintes CHECK.

### **Code problématique**
```sql
ALTER TABLE notes
ADD CONSTRAINT notes_cluster_same_org
CHECK (
    EXISTS (SELECT 1 FROM clusters ...)  -- ← Subquery interdite
);
```

### **Solution**
Remplacement des contraintes CHECK par des **triggers de validation**.

```sql
CREATE FUNCTION validate_note_cross_org() ...
CREATE TRIGGER validate_note_cross_org_trigger ...
```

### **Détails**
📖 Voir : `FIX_SUBQUERY_CHECK_CONSTRAINT.md`

---

## ✅ Ordre d'Exécution Correct

### **Étape 1 : Migration multi-tenant de base**

```bash
\i database/add_multi_tenant_support.sql
```

**Résultat :**
- ✅ Table `organizations` créée
- ✅ Table `memberships` créée
- ✅ Colonne `organization_id` ajoutée (nullable) à `pillars`, `notes`, `clusters`

### **Étape 2 : Correction des NULL** ⚠️ **REQUIS**

```bash
\i database/pre_migrate_fix_null_org.sql
```

**Résultat :**
- ✅ Organisation `default-org` créée
- ✅ Toutes les lignes NULL assignées à `default-org`
- ✅ Vérification : 0 NULL restants

### **Étape 3 : Migration stricte**

```bash
\i database/migrate_notes_multi_tenant_strict.sql
```

**Résultat :**
- ✅ `organization_id` rendu NOT NULL partout
- ✅ Foreign Keys ajoutées
- ✅ Index composites créés
- ✅ Fonction `find_similar_notes` mise à jour
- ✅ Triggers de validation créés
- ✅ Row Level Security activé

### **Étape 4 : Vérification**

```bash
\i database/verify_multi_tenant_strict.sql
```

**Résultat attendu :**
```
✅ ✅ ✅ MIGRATION RÉUSSIE ✅ ✅ ✅
Tests réussis: 10 / 10
```

---

## 📊 Résumé des Fichiers

| Fichier | Taille | Ordre | Description |
|---------|--------|-------|-------------|
| `add_multi_tenant_support.sql` | 3.6 KB | 1️⃣ | Migration multi-tenant de base |
| **`pre_migrate_fix_null_org.sql`** | **8.2 KB** | **2️⃣** | **🔧 Fix NULL** |
| `migrate_notes_multi_tenant_strict.sql` | 13 KB | 3️⃣ | Migration stricte (avec triggers) |
| `verify_multi_tenant_strict.sql` | 12 KB | 4️⃣ | Vérification (10 tests) |
| `FIX_ORGANIZATION_ID_NULL.md` | 4.3 KB | 📖 | Guide fix erreur 1 |
| `FIX_SUBQUERY_CHECK_CONSTRAINT.md` | 5.1 KB | 📖 | Guide fix erreur 2 |
| `MIGRATION_BACKEND_MULTI_TENANT.md` | 15 KB | 📖 | Guide backend Python |
| `README_MIGRATION_MULTI_TENANT.md` | 11 KB | 📖 | README complet |

---

## 🧪 Tests de Validation

### **Test 1 : Vérifier qu'il ne reste pas de NULL**

```sql
SELECT 
    'pillars' AS table_name, 
    COUNT(*) AS null_count 
FROM pillars 
WHERE organization_id IS NULL

UNION ALL

SELECT 'notes', COUNT(*) FROM notes WHERE organization_id IS NULL
UNION ALL
SELECT 'clusters', COUNT(*) FROM clusters WHERE organization_id IS NULL;

-- Résultat attendu: 0 pour toutes les tables
```

### **Test 2 : Vérifier les triggers**

```sql
SELECT 
    trigger_name,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE '%cross_org%';

-- Résultat attendu:
-- validate_note_cross_org_trigger    | notes    | BEFORE
-- validate_cluster_cross_org_trigger | clusters | BEFORE
```

### **Test 3 : Tester la validation cross-org**

```sql
-- Doit échouer avec: "Cluster <uuid> does not belong to organization <uuid>"
INSERT INTO notes (organization_id, user_id, content_raw, cluster_id)
VALUES (
    '<org-a-uuid>',
    '<user-uuid>',
    'Test',
    '<cluster-org-b-uuid>'  -- Cluster d'une autre org
);
```

---

## 🎯 Checklist Complète

### **Base de Données**
- [ ] Backup complet créé
- [ ] `add_multi_tenant_support.sql` exécuté
- [ ] `pre_migrate_fix_null_org.sql` exécuté ✅ **REQUIS**
- [ ] `migrate_notes_multi_tenant_strict.sql` exécuté
- [ ] `verify_multi_tenant_strict.sql` exécuté (10/10 tests passés)
- [ ] Aucune erreur dans les logs

### **Backend Python**
- [ ] `find_or_create_cluster` mis à jour avec `organization_id`
- [ ] `process_note_task` mis à jour
- [ ] `generate_cluster_snapshot_task` mis à jour
- [ ] Routes API mises à jour avec header `X-Organization-ID`
- [ ] `OrganizationMiddleware` créé
- [ ] Tests unitaires passés

### **Frontend**
- [ ] Header `X-Organization-ID` ajouté à toutes les requêtes
- [ ] Tests d'intégration passés

---

## 🚨 Erreurs Communes et Solutions

### **Erreur : "relation does not exist"**

**Cause :** Vous avez sauté l'étape 1 (`add_multi_tenant_support.sql`)

**Solution :**
```bash
\i database/add_multi_tenant_support.sql
```

### **Erreur : "organization_id contains null values"**

**Cause :** Vous avez sauté l'étape 2 (`pre_migrate_fix_null_org.sql`)

**Solution :**
```bash
\i database/pre_migrate_fix_null_org.sql
```

### **Erreur : "cannot use subquery in check constraint"**

**Cause :** Vous utilisez une ancienne version de `migrate_notes_multi_tenant_strict.sql`

**Solution :** Utiliser la version corrigée avec triggers (déjà appliquée)

### **Erreur : "trigger already exists"**

**Cause :** Vous avez exécuté la migration plusieurs fois

**Solution :**
```sql
-- Supprimer les triggers existants
DROP TRIGGER IF EXISTS validate_note_cross_org_trigger ON notes;
DROP TRIGGER IF EXISTS validate_cluster_cross_org_trigger ON clusters;

-- Réexécuter la migration
\i database/migrate_notes_multi_tenant_strict.sql
```

---

## 🔄 Rollback en Cas de Problème

Si vous rencontrez des problèmes, voici comment revenir en arrière :

```bash
# 1. Restaurer le backup
pg_restore -h <host> -U <user> -d <database> -c backup_before_multi_tenant.dump

# 2. Vérifier que tout fonctionne
psql -h <host> -U <user> -d <database> -c "SELECT COUNT(*) FROM notes;"
```

---

## 📞 Support

### **Documentation Disponible**

1. **Erreur 1 (NULL)** : `FIX_ORGANIZATION_ID_NULL.md`
2. **Erreur 2 (Subquery)** : `FIX_SUBQUERY_CHECK_CONSTRAINT.md`
3. **Migration Backend** : `MIGRATION_BACKEND_MULTI_TENANT.md`
4. **README Complet** : `README_MIGRATION_MULTI_TENANT.md`

### **Commandes Utiles**

```bash
# Vérifier l'état de la migration
psql -h <host> -U <user> -d <database> -f database/verify_multi_tenant_strict.sql

# Voir les logs PostgreSQL
tail -f /var/log/postgresql/postgresql-*.log

# Compter les NULL
psql -h <host> -U <user> -d <database> -c "
SELECT 'pillars' AS table_name, COUNT(*) FROM pillars WHERE organization_id IS NULL
UNION ALL
SELECT 'notes', COUNT(*) FROM notes WHERE organization_id IS NULL;
"
```

---

## 🎉 Résultat Final

Après avoir suivi ce guide, vous aurez :

✅ **Isolation stricte** : Toutes les données ont `organization_id NOT NULL`  
✅ **Sécurité renforcée** : Triggers de validation cross-org  
✅ **Performance optimisée** : Index composites  
✅ **Fonction sécurisée** : `find_similar_notes` avec `p_organization_id`  
✅ **RLS activé** : Row Level Security sur toutes les tables  
✅ **Tests passés** : 10/10 tests de vérification  

---

**Dernière mise à jour :** 2 décembre 2025  
**Version :** 1.0.0 (avec corrections)
