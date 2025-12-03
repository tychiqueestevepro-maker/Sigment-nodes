# 🔧 Fix : Erreur "cannot use subquery in check constraint"

## 🚨 Problème

```
ERROR: 0A000: cannot use subquery in check constraint
```

Cette erreur se produit car **PostgreSQL n'autorise pas les sous-requêtes (subqueries) dans les contraintes CHECK**.

### **Code problématique**

```sql
-- ❌ ERREUR: Subquery dans CHECK constraint
ALTER TABLE notes
ADD CONSTRAINT notes_cluster_same_org
CHECK (
    cluster_id IS NULL OR
    EXISTS (
        SELECT 1 FROM clusters c  -- ← Subquery interdite !
        WHERE c.id = cluster_id 
        AND c.organization_id = organization_id
    )
);
```

---

## ✅ Solution Appliquée

Les contraintes CHECK ont été **remplacées par des TRIGGERS** qui effectuent la même validation.

### **Nouveau code (avec triggers)**

```sql
-- ✅ SOLUTION: Trigger de validation
CREATE OR REPLACE FUNCTION validate_note_cross_org()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate cluster_id belongs to same organization
    IF NEW.cluster_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM clusters c 
            WHERE c.id = NEW.cluster_id 
            AND c.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Cluster % does not belong to organization %', 
                NEW.cluster_id, NEW.organization_id;
        END IF;
    END IF;
    
    -- Validate pillar_id belongs to same organization
    IF NEW.pillar_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM pillars p 
            WHERE p.id = NEW.pillar_id 
            AND p.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Pillar % does not belong to organization %', 
                NEW.pillar_id, NEW.organization_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_note_cross_org_trigger
BEFORE INSERT OR UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION validate_note_cross_org();
```

---

## 🔄 Changements Appliqués

### **Fichiers Modifiés**

1. **`migrate_notes_multi_tenant_strict.sql`**
   - ❌ Supprimé : 3 contraintes CHECK avec subqueries
   - ✅ Ajouté : 2 fonctions de validation + 2 triggers

2. **`verify_multi_tenant_strict.sql`**
   - ✅ Mis à jour : Test 7 vérifie maintenant les triggers au lieu des contraintes
   - ✅ Mis à jour : Test 10 attend une exception `raise_exception` au lieu de `check_violation`

---

## 📋 Triggers Créés

| Trigger | Table | Fonction | Validation |
|---------|-------|----------|------------|
| `validate_note_cross_org_trigger` | `notes` | `validate_note_cross_org()` | Vérifie que `cluster_id` et `pillar_id` appartiennent à la même org |
| `validate_cluster_cross_org_trigger` | `clusters` | `validate_cluster_cross_org()` | Vérifie que `pillar_id` appartient à la même org |

---

## 🧪 Test de Validation

### **Test 1 : Tentative de cross-org (doit échouer)**

```sql
-- Créer 2 organisations
INSERT INTO organizations (slug, name) VALUES ('org-a', 'Org A');
INSERT INTO organizations (slug, name) VALUES ('org-b', 'Org B');

-- Créer un pillar dans org A
INSERT INTO pillars (organization_id, name, description, color)
VALUES (
    (SELECT id FROM organizations WHERE slug = 'org-a'),
    'Test Pillar',
    'Test',
    '#000000'
);

-- Créer un cluster dans org B
INSERT INTO clusters (organization_id, pillar_id, title)
SELECT 
    (SELECT id FROM organizations WHERE slug = 'org-b'),
    p.id,
    'Test Cluster'
FROM pillars p
WHERE p.organization_id = (SELECT id FROM organizations WHERE slug = 'org-b')
LIMIT 1;

-- Tenter de créer une note dans org A qui référence le cluster de org B
-- Cela DOIT échouer
INSERT INTO notes (organization_id, user_id, content_raw, cluster_id)
VALUES (
    (SELECT id FROM organizations WHERE slug = 'org-a'),
    (SELECT id FROM users LIMIT 1),
    'Test note',
    (SELECT id FROM clusters WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'org-b') LIMIT 1)
);

-- Résultat attendu:
-- ERROR: Cluster <uuid> does not belong to organization <uuid>
```

### **Test 2 : Insertion valide (doit réussir)**

```sql
-- Créer une note dans org A qui référence un cluster de org A
INSERT INTO notes (organization_id, user_id, content_raw, cluster_id)
SELECT 
    (SELECT id FROM organizations WHERE slug = 'org-a'),
    (SELECT id FROM users LIMIT 1),
    'Test note',
    c.id
FROM clusters c
WHERE c.organization_id = (SELECT id FROM organizations WHERE slug = 'org-a')
LIMIT 1;

-- Résultat attendu: SUCCESS
```

---

## 🎯 Avantages des Triggers vs CHECK Constraints

| Aspect | CHECK Constraint | Trigger |
|--------|------------------|---------|
| **Subqueries** | ❌ Interdites | ✅ Autorisées |
| **Performance** | ⚡ Très rapide | ⚡ Rapide |
| **Flexibilité** | ❌ Limitée | ✅ Très flexible |
| **Messages d'erreur** | ❌ Génériques | ✅ Personnalisables |
| **Validation complexe** | ❌ Impossible | ✅ Possible |

---

## 🚀 Prochaines Étapes

La migration est maintenant **compatible avec PostgreSQL**. Vous pouvez l'exécuter :

```bash
# 1. Pré-migration (correction des NULL)
\i database/pre_migrate_fix_null_org.sql

# 2. Migration stricte (maintenant sans erreur)
\i database/migrate_notes_multi_tenant_strict.sql

# 3. Vérification
\i database/verify_multi_tenant_strict.sql
```

---

## 📊 Résumé des Erreurs Corrigées

1. ✅ **Erreur 1** : `column "organization_id" contains null values`
   - **Fix** : Script `pre_migrate_fix_null_org.sql`

2. ✅ **Erreur 2** : `cannot use subquery in check constraint`
   - **Fix** : Remplacement des CHECK constraints par des triggers

---

## 🔒 Sécurité Maintenue

Même avec des triggers au lieu de contraintes CHECK, la sécurité est **identique** :

- ✅ Impossible de créer une note dans org A avec un cluster de org B
- ✅ Impossible de créer une note dans org A avec un pillar de org B
- ✅ Impossible de créer un cluster dans org A avec un pillar de org B
- ✅ Validation exécutée **AVANT** l'insertion/mise à jour (BEFORE trigger)
- ✅ Transaction annulée en cas d'erreur (ROLLBACK automatique)

---

**Dernière mise à jour :** 2 décembre 2025  
**Fichiers modifiés :**
- ✅ `migrate_notes_multi_tenant_strict.sql`
- ✅ `verify_multi_tenant_strict.sql`
