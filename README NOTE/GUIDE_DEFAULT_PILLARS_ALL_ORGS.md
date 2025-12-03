# 📋 Pillars par Défaut pour Toutes les Organisations

## 🎯 Objectif

Créer automatiquement **6 pillars par défaut** pour chaque organisation :

1. **ESG** - Environmental, Social, and Governance initiatives
2. **Innovation** - Product innovation and R&D ideas
3. **Operations** - Operational efficiency and process improvements
4. **Customer Experience** - Customer satisfaction and service quality
5. **Culture & HR** - Employee experience and organizational culture
6. **Uncategorized** - Ideas that could not be categorized (score < 4/10)

---

## 📊 Architecture

### **Avant (❌ Problématique)**

```
Pillars (globaux):
├─ ESG
├─ Innovation
├─ Operations
├─ Customer Experience
└─ Culture & HR

Organizations:
├─ org-a (utilise les pillars globaux)
├─ org-b (utilise les pillars globaux)
└─ org-c (utilise les pillars globaux)

❌ Problème: Pas d'isolation, tous partagent les mêmes pillars
```

### **Après (✅ Multi-Tenant Strict)**

```
Organizations:
├─ org-a
│  ├─ ESG (propre à org-a)
│  ├─ Innovation
│  ├─ Operations
│  ├─ Customer Experience
│  ├─ Culture & HR
│  └─ Uncategorized
├─ org-b
│  ├─ ESG (propre à org-b)
│  ├─ Innovation
│  ├─ Operations
│  ├─ Customer Experience
│  ├─ Culture & HR
│  └─ Uncategorized
└─ org-c
   ├─ ESG (propre à org-c)
   ├─ Innovation
   ├─ Operations
   ├─ Customer Experience
   ├─ Culture & HR
   └─ Uncategorized

✅ Isolation complète: Chaque org a ses propres pillars
```

---

## 🚀 Migration Complète

### **Ordre d'Exécution**

```bash
# 1. Fix de la contrainte UNIQUE sur name
\i database/fix_pillars_unique_constraint.sql

# 2. Création des 6 pillars par défaut pour toutes les orgs
\i database/create_default_pillars_all_orgs.sql
```

---

## 📋 Détails du Script

### **STEP 1 : Création pour organisations existantes**

Le script boucle sur toutes les organisations et crée les 6 pillars si ils n'existent pas déjà.

```sql
FOR org_record IN SELECT id, slug, name FROM organizations
LOOP
    -- Pour chaque pillar par défaut
    FOR pillar_record IN (ESG, Innovation, Operations, ...)
    LOOP
        -- Créer si n'existe pas
        IF NOT EXISTS (pillar pour cette org) THEN
            INSERT INTO pillars (organization_id, name, ...)
        END IF
    END LOOP
END LOOP
```

### **STEP 2 : Trigger pour nouvelles organisations**

Quand une nouvelle organisation est créée, les 6 pillars sont automatiquement créés.

```sql
CREATE TRIGGER auto_create_default_pillars
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION create_default_pillars_for_new_org();
```

### **STEP 3 : Vérification**

Le script vérifie que toutes les organisations ont bien leurs 6 pillars.

### **STEP 4 : Affichage**

Le script affiche un tableau récapitulatif des pillars par organisation.

---

## 📊 Résultat Attendu

### **Après exécution**

```
========================================
Creating Default Pillars for All Organizations
========================================

Processing organization: acme corp (acme-corp)
  ✅ Created pillar: ESG
  ✅ Created pillar: Innovation
  ✅ Created pillar: Operations
  ✅ Created pillar: Customer Experience
  ✅ Created pillar: Culture & HR
  ✅ Created pillar: Uncategorized

Processing organization: Default Organization (default-org)
  ⏭️  Skipped pillar: ESG (already exists)
  ⏭️  Skipped pillar: Innovation (already exists)
  ⏭️  Skipped pillar: Operations (already exists)
  ⏭️  Skipped pillar: Customer Experience (already exists)
  ⏭️  Skipped pillar: Culture & HR (already exists)
  ✅ Created pillar: Uncategorized

...

========================================
SUMMARY
========================================
Pillars created: 25
Pillars skipped: 5
========================================

✅ Trigger created: auto_create_default_pillars
   New organizations will automatically get 6 default pillars

========================================
VERIFICATION
========================================
Total organizations: 5
Total pillars: 30
Expected pillars: 30 (6 per org)
Organizations with all 6 pillars: 5

✅ All organizations have at least 6 pillars
========================================

organization | org_name              | pillar_count | pillars
-------------|-----------------------|--------------|--------------------------------------------------
acme         | acme                  | 6            | ESG, Innovation, Operations, Customer Experience, Culture & HR, Uncategorized
acme-corp    | acme corp             | 6            | ESG, Innovation, Operations, Customer Experience, Culture & HR, Uncategorized
default-org  | Default Organization  | 6            | ESG, Innovation, Operations, Customer Experience, Culture & HR, Uncategorized
lz-sl        | LZ SL                 | 6            | ESG, Innovation, Operations, Customer Experience, Culture & HR, Uncategorized
sflhcbjsf    | sflhcbjsf             | 6            | ESG, Innovation, Operations, Customer Experience, Culture & HR, Uncategorized
```

---

## 🎨 Couleurs des Pillars

| Pillar | Couleur | Hex |
|--------|---------|-----|
| ESG | 🟢 Vert | `#10B981` |
| Innovation | 🔵 Bleu | `#6366F1` |
| Operations | 🟠 Orange | `#F59E0B` |
| Customer Experience | 🔴 Rose | `#EC4899` |
| Culture & HR | 🟣 Violet | `#8B5CF6` |
| Uncategorized | ⚪ Gris | `#9CA3AF` |

---

## 🧪 Tests de Validation

### **Test 1 : Toutes les orgs ont 6 pillars**

```sql
SELECT 
    o.slug,
    COUNT(p.id) AS pillar_count
FROM organizations o
LEFT JOIN pillars p ON p.organization_id = o.id
GROUP BY o.id, o.slug
HAVING COUNT(p.id) < 6;

-- Résultat attendu: 0 lignes (toutes les orgs ont au moins 6 pillars)
```

### **Test 2 : Chaque org a "Uncategorized"**

```sql
SELECT 
    o.slug,
    COUNT(p.id) AS uncategorized_count
FROM organizations o
LEFT JOIN pillars p ON p.organization_id = o.id AND p.name = 'Uncategorized'
GROUP BY o.id, o.slug
HAVING COUNT(p.id) = 0;

-- Résultat attendu: 0 lignes (toutes les orgs ont "Uncategorized")
```

### **Test 3 : Trigger auto-création**

```sql
-- Créer une nouvelle organisation
INSERT INTO organizations (slug, name) 
VALUES ('test-trigger-org', 'Test Trigger Organization');

-- Vérifier que les 6 pillars ont été créés automatiquement
SELECT name 
FROM pillars 
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'test-trigger-org')
ORDER BY name;

-- Résultat attendu: 6 lignes
-- Culture & HR, Customer Experience, ESG, Innovation, Operations, Uncategorized

-- Nettoyer
DELETE FROM organizations WHERE slug = 'test-trigger-org';
```

### **Test 4 : Pas de doublons dans une org**

```sql
SELECT 
    organization_id,
    name,
    COUNT(*) AS duplicate_count
FROM pillars
GROUP BY organization_id, name
HAVING COUNT(*) > 1;

-- Résultat attendu: 0 lignes (pas de doublons)
```

---

## 📊 Statistiques

### **Compter les pillars par organisation**

```sql
SELECT 
    o.slug AS organization,
    COUNT(p.id) AS total_pillars,
    COUNT(CASE WHEN p.name = 'Uncategorized' THEN 1 END) AS uncategorized,
    COUNT(CASE WHEN p.name != 'Uncategorized' THEN 1 END) AS categorized
FROM organizations o
LEFT JOIN pillars p ON p.organization_id = o.id
GROUP BY o.id, o.slug
ORDER BY o.slug;
```

### **Compter les notes par pillar**

```sql
SELECT 
    o.slug AS organization,
    p.name AS pillar,
    COUNT(n.id) AS note_count,
    ROUND(AVG(n.ai_relevance_score), 2) AS avg_score
FROM organizations o
JOIN pillars p ON p.organization_id = o.id
LEFT JOIN notes n ON n.pillar_id = p.id AND n.status = 'processed'
GROUP BY o.id, o.slug, p.id, p.name
ORDER BY o.slug, note_count DESC;
```

---

## 🔄 Rollback (si nécessaire)

Si vous voulez revenir en arrière :

```sql
-- Supprimer tous les pillars (ATTENTION: Supprime aussi les notes associées)
TRUNCATE TABLE pillars CASCADE;

-- Supprimer le trigger
DROP TRIGGER IF EXISTS auto_create_default_pillars ON organizations;
DROP FUNCTION IF EXISTS create_default_pillars_for_new_org();
```

---

## 📋 Checklist Complète

### **Base de Données**
- [ ] `fix_pillars_unique_constraint.sql` exécuté
- [ ] Contrainte `UNIQUE` sur `name` supprimée
- [ ] Index `idx_pillars_org_name` (UNIQUE sur `organization_id, name`) existe
- [ ] `create_default_pillars_all_orgs.sql` exécuté
- [ ] Toutes les orgs ont 6 pillars
- [ ] Trigger `auto_create_default_pillars` créé
- [ ] Test 1 : Toutes les orgs ont 6 pillars ✅
- [ ] Test 2 : Chaque org a "Uncategorized" ✅
- [ ] Test 3 : Trigger auto-création fonctionne ✅
- [ ] Test 4 : Pas de doublons ✅

### **Backend**
- [ ] Code Python `tasks.py` mis à jour (déjà fait)
- [ ] Workers Celery redémarrés
- [ ] Test : Note avec score < 4/10 → "Uncategorized"

---

## 🎯 Résumé

**Avant** :
- ❌ Pillars globaux partagés
- ❌ Pas d'isolation
- ❌ Pas de "Uncategorized"

**Après** :
- ✅ 6 pillars par organisation
- ✅ Isolation complète
- ✅ "Uncategorized" pour notes avec score < 4/10
- ✅ Trigger auto-création pour nouvelles orgs

---

**Exécutez maintenant :**

```bash
# 1. Fix contrainte UNIQUE
\i database/fix_pillars_unique_constraint.sql

# 2. Créer pillars par défaut
\i database/create_default_pillars_all_orgs.sql
```

---

**Dernière mise à jour :** 2 décembre 2025  
**Version :** 2.2.0 (Default Pillars for All Organizations)
