# 🚨 Fix : Erreur `organization_id` NULL

## Problème

```
ERROR: 23502: column "organization_id" of relation "pillars" contains null values
```

Cette erreur se produit car la migration `migrate_notes_multi_tenant_strict.sql` essaie de rendre la colonne `organization_id` **NOT NULL**, mais certaines lignes ont encore des valeurs NULL.

---

## ✅ Solution Rapide

### **Étape 1 : Exécuter le script de pré-migration**

```bash
# Se connecter à la base de données
psql -h <host> -U <user> -d <database>

# Exécuter le script de correction
\i database/pre_migrate_fix_null_org.sql
```

Ce script va :
1. ✅ Créer une organisation par défaut (`default-org`)
2. ✅ Assigner toutes les lignes NULL à cette organisation
3. ✅ Vérifier qu'il ne reste plus de NULL

### **Étape 2 : Exécuter la migration stricte**

```bash
# Maintenant vous pouvez exécuter la migration
\i database/migrate_notes_multi_tenant_strict.sql
```

---

## 📋 Ordre d'Exécution Complet

```bash
# 1. Migration multi-tenant de base (si pas déjà fait)
\i database/add_multi_tenant_support.sql

# 2. Correction des NULL (NOUVEAU - REQUIS)
\i database/pre_migrate_fix_null_org.sql

# 3. Migration stricte
\i database/migrate_notes_multi_tenant_strict.sql

# 4. Vérification
\i database/verify_multi_tenant_strict.sql
```

---

## 🔍 Diagnostic Manuel

Si vous voulez vérifier manuellement avant de corriger :

```sql
-- Compter les NULL dans chaque table
SELECT 
    'pillars' AS table_name, 
    COUNT(*) AS null_count 
FROM pillars 
WHERE organization_id IS NULL

UNION ALL

SELECT 
    'notes', 
    COUNT(*) 
FROM notes 
WHERE organization_id IS NULL

UNION ALL

SELECT 
    'clusters', 
    COUNT(*) 
FROM clusters 
WHERE organization_id IS NULL;
```

---

## 🛠️ Correction Manuelle (Alternative)

Si vous préférez corriger manuellement :

```sql
-- 1. Créer l'organisation par défaut
INSERT INTO organizations (slug, name, description)
VALUES ('default-org', 'Default Organization', 'Organisation par défaut')
ON CONFLICT (slug) DO NOTHING;

-- 2. Récupérer son ID
SELECT id FROM organizations WHERE slug = 'default-org';
-- Résultat: 550e8400-e29b-41d4-a716-446655440000 (exemple)

-- 3. Mettre à jour les pillars
UPDATE pillars
SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE organization_id IS NULL;

-- 4. Mettre à jour les notes
UPDATE notes
SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE organization_id IS NULL;

-- 5. Mettre à jour les clusters
UPDATE clusters
SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE organization_id IS NULL;

-- 6. Vérifier qu'il ne reste plus de NULL
SELECT COUNT(*) FROM pillars WHERE organization_id IS NULL;
-- Résultat attendu: 0
```

---

## ⚠️ Pourquoi ce problème ?

La migration `add_multi_tenant_support.sql` a ajouté la colonne `organization_id` aux tables, mais elle est **nullable** par défaut.

La migration `migrate_notes_multi_tenant_strict.sql` veut rendre cette colonne **NOT NULL** pour garantir l'isolation stricte, mais elle ne peut pas le faire s'il reste des valeurs NULL.

Le script `pre_migrate_fix_null_org.sql` comble ce gap en assignant toutes les données existantes à une organisation par défaut.

---

## 📊 Vérification Post-Correction

Après avoir exécuté `pre_migrate_fix_null_org.sql`, vérifiez :

```sql
-- Doit retourner 0 pour toutes les tables
SELECT 
    'pillars' AS table_name, 
    COUNT(*) AS null_count 
FROM pillars 
WHERE organization_id IS NULL

UNION ALL

SELECT 'notes', COUNT(*) FROM notes WHERE organization_id IS NULL
UNION ALL
SELECT 'clusters', COUNT(*) FROM clusters WHERE organization_id IS NULL;

-- Résultat attendu:
-- table_name | null_count
-- -----------+-----------
-- pillars    |          0
-- notes      |          0
-- clusters   |          0
```

---

## 🚀 Résumé

1. **Problème** : `organization_id` NULL empêche la migration stricte
2. **Solution** : Exécuter `pre_migrate_fix_null_org.sql` AVANT `migrate_notes_multi_tenant_strict.sql`
3. **Résultat** : Toutes les données existantes sont assignées à `default-org`
4. **Ensuite** : La migration stricte peut s'exécuter sans erreur

---

**Fichiers créés pour résoudre ce problème :**
- ✅ `database/pre_migrate_fix_null_org.sql` - Script de correction automatique
- ✅ Ce guide de dépannage

**Dernière mise à jour :** 2 décembre 2025
