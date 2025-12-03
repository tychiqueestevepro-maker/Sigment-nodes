# 🔧 Fix : Contrainte UNIQUE sur `pillars.name`

## 🚨 Problème

```
ERROR: 23505: duplicate key value violates unique constraint "pillars_name_key"
DETAIL: Key (name)=(Uncategorized) already exists.
```

Cette erreur se produit car la table `pillars` a une contrainte `UNIQUE` sur la colonne `name`, ce qui empêche d'avoir plusieurs pillars avec le même nom (même dans des organisations différentes).

---

## ✅ Solution

Il faut **supprimer** la contrainte `UNIQUE` sur `name` et s'assurer que la contrainte `UNIQUE(organization_id, name)` existe.

### **Ordre d'Exécution**

```bash
# 1. Supprimer la contrainte UNIQUE sur name
\i database/fix_pillars_unique_constraint.sql

# 2. Créer les pillars "Uncategorized"
\i database/add_uncategorized_pillar.sql
```

---

## 📋 Détails Techniques

### **Avant (❌ Problématique)**

```sql
CREATE TABLE pillars (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,  -- ❌ UNIQUE global
    organization_id UUID,
    ...
);
```

**Problème** : Impossible d'avoir "Uncategorized" dans plusieurs organisations.

### **Après (✅ Correct)**

```sql
CREATE TABLE pillars (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,  -- ✅ Pas de UNIQUE global
    organization_id UUID NOT NULL,
    ...
);

-- Contrainte UNIQUE par organisation
CREATE UNIQUE INDEX idx_pillars_org_name ON pillars(organization_id, name);
```

**Résultat** : Chaque organisation peut avoir son propre "Uncategorized".

---

## 🔍 Vérification

### **Vérifier que la contrainte a été supprimée**

```sql
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'pillars'::regclass 
AND conname = 'pillars_name_key';

-- Résultat attendu: 0 lignes
```

### **Vérifier que l'index composite existe**

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'pillars' 
AND indexname = 'idx_pillars_org_name';

-- Résultat attendu:
-- indexname: idx_pillars_org_name
-- indexdef: CREATE UNIQUE INDEX idx_pillars_org_name ON pillars USING btree (organization_id, name)
```

---

## 🧪 Test

### **Test 1 : Créer "Uncategorized" dans 2 organisations**

```sql
-- Organisation A
INSERT INTO pillars (organization_id, name, description, color)
VALUES (
    (SELECT id FROM organizations WHERE slug = 'org-a'),
    'Uncategorized',
    'Test',
    '#9CA3AF'
);

-- Organisation B (même nom, doit fonctionner)
INSERT INTO pillars (organization_id, name, description, color)
VALUES (
    (SELECT id FROM organizations WHERE slug = 'org-b'),
    'Uncategorized',
    'Test',
    '#9CA3AF'
);

-- Résultat attendu: SUCCESS (2 pillars créés)
```

### **Test 2 : Empêcher les doublons dans la même org**

```sql
-- Tenter de créer un 2ème "Uncategorized" dans org-a
INSERT INTO pillars (organization_id, name, description, color)
VALUES (
    (SELECT id FROM organizations WHERE slug = 'org-a'),
    'Uncategorized',  -- Doublon
    'Test',
    '#9CA3AF'
);

-- Résultat attendu: ERROR (contrainte UNIQUE(organization_id, name) violée)
```

---

## 📊 Impact

### **Avant le fix**

```
Organizations:
├─ org-a
│  ├─ ESG
│  ├─ Innovation
│  └─ ❌ Impossible de créer "Uncategorized" (déjà existe globalement)
└─ org-b
   ├─ ESG
   └─ Uncategorized (le seul autorisé)
```

### **Après le fix**

```
Organizations:
├─ org-a
│  ├─ ESG
│  ├─ Innovation
│  └─ ✅ Uncategorized (propre à org-a)
└─ org-b
   ├─ ESG
   └─ ✅ Uncategorized (propre à org-b)
```

---

## 🚀 Résumé de la Procédure Complète

```bash
# 1. Fix de la contrainte UNIQUE
\i database/fix_pillars_unique_constraint.sql

# 2. Création des pillars "Uncategorized"
\i database/add_uncategorized_pillar.sql

# 3. Vérification
SELECT 
    o.slug,
    COUNT(p.id) AS uncategorized_count
FROM organizations o
LEFT JOIN pillars p ON p.organization_id = o.id AND p.name = 'Uncategorized'
GROUP BY o.id, o.slug;

-- Résultat attendu: Chaque org a 1 "Uncategorized"
```

---

## ⚠️ Note Importante

Cette contrainte `UNIQUE` sur `name` était probablement présente dans le schéma initial (`schema.sql`) avant la migration multi-tenant.

La migration `migrate_notes_multi_tenant_strict.sql` a créé l'index `idx_pillars_org_name` (UNIQUE sur `organization_id, name`), mais n'a **pas supprimé** l'ancienne contrainte `UNIQUE` sur `name`.

Ce script `fix_pillars_unique_constraint.sql` corrige ce problème.

---

**Exécutez maintenant :**
```bash
\i database/fix_pillars_unique_constraint.sql
```

Puis :
```bash
\i database/add_uncategorized_pillar.sql
```

---

**Dernière mise à jour :** 2 décembre 2025
