# 📁 Pillar "Uncategorized" - Guide Complet

## 🎯 Objectif

Créer un pillar par défaut "Uncategorized" pour chaque organisation afin de gérer les notes qui ne peuvent pas être catégorisées (score < 4/10).

---

## ✅ Solution Implémentée

### **1. Pillar "Uncategorized" par Organisation**

Au lieu de laisser `pillar_id = NULL`, toutes les notes sont maintenant assignées à un pillar, y compris "Uncategorized".

**Avantages** :
- ✅ Cohérence : Toutes les notes ont un pillar
- ✅ Clustering : Même les notes "Uncategorized" peuvent être groupées
- ✅ Statistiques : Facile de compter les notes non catégorisées
- ✅ UI : Pas de gestion spéciale pour les `NULL`

---

## 📊 Architecture

```
Organization A
├─ ESG (pillar)
│  ├─ Cluster 1
│  └─ Cluster 2
├─ Innovation (pillar)
│  └─ Cluster 3
├─ Operations (pillar)
│  └─ Cluster 4
└─ Uncategorized (pillar) 🆕
   ├─ Cluster 5 (notes avec score < 4/10)
   └─ Cluster 6

Organization B
├─ ESG (pillar)
├─ Innovation (pillar)
└─ Uncategorized (pillar) 🆕
```

---

## 🔧 Fichiers Créés/Modifiés

### **1. Script SQL** : `add_uncategorized_pillar.sql`

**Fonctionnalités** :
- ✅ Crée "Uncategorized" pour toutes les organisations existantes
- ✅ Trigger auto-création pour les nouvelles organisations
- ✅ Vérification de cohérence

**Exécution** :
```bash
\i database/add_uncategorized_pillar.sql
```

**Résultat attendu** :
```
NOTICE: Created "Uncategorized" pillar for organization: acme-corp (acme-corp)
NOTICE: Created "Uncategorized" pillar for organization: Default Organization (default-org)
...
NOTICE: ========================================
NOTICE: Created 5 "Uncategorized" pillars
NOTICE: ========================================
NOTICE: ✅ All organizations have "Uncategorized" pillar
```

---

### **2. Code Python** : `tasks.py`

**Changements** :

#### **Avant**
```python
if not pillar:
    pillar_id = None  # ❌ NULL
    # Skip clustering
```

#### **Après** ✅
```python
if not pillar or analysis["pillar_name"] == "Uncategorized":
    # Find "Uncategorized" pillar for this organization
    uncategorized_pillar = next(
        (p for p in available_pillars if p["name"] == "Uncategorized"), 
        None
    )
    
    if uncategorized_pillar:
        pillar_id = uncategorized_pillar["id"]
    else:
        # Fallback: Create it if missing
        uncategorized_response = supabase.table("pillars").insert({
            "organization_id": organization_id,
            "name": "Uncategorized",
            "description": "Ideas that could not be categorized...",
            "color": "#9CA3AF"
        }).execute()
        pillar_id = uncategorized_response.data[0]["id"]

# Clustering pour TOUTES les notes (y compris Uncategorized)
cluster_id = find_or_create_cluster(...)
```

---

## 🎨 Apparence UI

### **Couleur du Pillar "Uncategorized"**
```
Color: #9CA3AF (Gray 400)
```

### **Exemple d'affichage**

```
┌─────────────────────────────────────┐
│ Your Ideas                          │
├─────────────────────────────────────┤
│ 📊 ESG                     (12)     │
│ 💡 Innovation              (8)      │
│ ⚙️  Operations              (15)     │
│ 📁 Uncategorized           (3)      │ ← Gris
└─────────────────────────────────────┘
```

---

## 🔄 Flux Complet

```
1. Note soumise: "Buy new coffee machine"
   ↓
2. AI Analysis:
   - Meilleur pillar: Operations (score: 2.5/10)
   - Score < 4/10 → pillar_name = "Uncategorized"
   ↓
3. Worker Python:
   - Trouve le pillar "Uncategorized" de l'org
   - pillar_id = <uncategorized-uuid>
   ↓
4. Clustering:
   - Cherche similarité dans "Uncategorized"
   - Trouve 2 autres notes similaires
   - Assigne au cluster "Miscellaneous Office Requests"
   ↓
5. Note processed ✅
   - pillar_id: <uncategorized-uuid>
   - cluster_id: <cluster-uuid>
   - status: "processed"
```

---

## 📋 Migration : Ordre d'Exécution

### **Étape 1 : Exécuter le script SQL**

```bash
# Se connecter à la base de données
psql -h <host> -U <user> -d <database>

# Exécuter la migration
\i database/add_uncategorized_pillar.sql
```

### **Étape 2 : Vérifier**

```sql
-- Compter les pillars "Uncategorized"
SELECT COUNT(*) FROM pillars WHERE name = 'Uncategorized';
-- Résultat attendu: Nombre d'organisations

-- Voir tous les pillars "Uncategorized"
SELECT 
    o.slug,
    o.name AS org_name,
    p.id AS pillar_id,
    p.color
FROM organizations o
JOIN pillars p ON p.organization_id = o.id
WHERE p.name = 'Uncategorized';
```

### **Étape 3 : Redémarrer les workers**

```bash
# Arrêter les workers
pkill -f "celery.*worker"

# Redémarrer avec le nouveau code
cd backend
celery -A app.workers.celery_app worker --loglevel=info
```

### **Étape 4 : Tester**

```bash
# Créer une note qui devrait être "Uncategorized"
curl -X POST http://localhost:8000/notes \
  -H "Content-Type: application/json" \
  -H "X-Organization-ID: <org-uuid>" \
  -d '{
    "user_id": "<user-uuid>",
    "content_raw": "Buy new coffee machine for the office"
  }'

# Vérifier après 10 secondes
curl http://localhost:8000/notes/<note-id>

# Résultat attendu:
# {
#   "pillar_id": "<uncategorized-uuid>",
#   "cluster_id": "<cluster-uuid>",
#   "ai_relevance_score": 2.5,
#   "status": "processed"
# }
```

---

## 🧪 Tests de Validation

### **Test 1 : Pillar "Uncategorized" existe**

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

### **Test 2 : Notes "Uncategorized" sont clusterisées**

```sql
SELECT 
    n.id,
    n.content_raw,
    n.pillar_id,
    n.cluster_id,
    p.name AS pillar_name
FROM notes n
JOIN pillars p ON p.id = n.pillar_id
WHERE p.name = 'Uncategorized'
AND n.cluster_id IS NULL;

-- Résultat attendu: 0 lignes (toutes les notes Uncategorized ont un cluster)
```

### **Test 3 : Trigger auto-création**

```sql
-- Créer une nouvelle organisation
INSERT INTO organizations (slug, name) 
VALUES ('test-org-trigger', 'Test Org for Trigger');

-- Vérifier que "Uncategorized" a été créé automatiquement
SELECT * FROM pillars 
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'test-org-trigger')
AND name = 'Uncategorized';

-- Résultat attendu: 1 ligne

-- Nettoyer
DELETE FROM organizations WHERE slug = 'test-org-trigger';
```

---

## 📊 Statistiques

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

**Exemple de résultat** :
```
organization | pillar         | note_count | avg_score
-------------|----------------|------------|----------
acme-corp    | ESG            | 45         | 7.8
acme-corp    | Innovation     | 32         | 8.2
acme-corp    | Operations     | 28         | 6.5
acme-corp    | Uncategorized  | 5          | 2.3
default-org  | ESG            | 0          | NULL
default-org  | Uncategorized  | 0          | NULL
```

---

## 🎯 Avantages de cette Approche

### **1. Cohérence des Données**
- ✅ Toutes les notes ont un `pillar_id` (jamais NULL)
- ✅ Toutes les notes ont un `cluster_id` (jamais NULL)
- ✅ Pas de cas spéciaux à gérer dans le code

### **2. Clustering Amélioré**
- ✅ Même les notes "Uncategorized" sont groupées
- ✅ Exemple : "Buy coffee machine" + "Order new printer" → Cluster "Office Supplies"

### **3. Statistiques Faciles**
```sql
-- Taux de catégorisation
SELECT 
    o.slug,
    COUNT(CASE WHEN p.name != 'Uncategorized' THEN 1 END) AS categorized,
    COUNT(CASE WHEN p.name = 'Uncategorized' THEN 1 END) AS uncategorized,
    ROUND(
        100.0 * COUNT(CASE WHEN p.name != 'Uncategorized' THEN 1 END) / COUNT(*), 
        2
    ) AS categorization_rate
FROM notes n
JOIN pillars p ON p.id = n.pillar_id
JOIN organizations o ON o.id = n.organization_id
WHERE n.status = 'processed'
GROUP BY o.id, o.slug;
```

### **4. UI Simplifiée**
- ✅ Pas de gestion de `NULL`
- ✅ Filtre par pillar fonctionne pour toutes les notes
- ✅ Affichage uniforme

---

## 🔄 Rollback (si nécessaire)

Si vous voulez revenir en arrière :

```sql
-- Supprimer tous les pillars "Uncategorized"
DELETE FROM pillars WHERE name = 'Uncategorized';

-- Supprimer le trigger
DROP TRIGGER IF EXISTS auto_create_uncategorized_pillar ON organizations;
DROP FUNCTION IF EXISTS create_default_uncategorized_pillar();
```

---

## ✅ Checklist de Migration

- [ ] Script SQL `add_uncategorized_pillar.sql` exécuté
- [ ] Vérification : Toutes les orgs ont "Uncategorized"
- [ ] Code Python `tasks.py` mis à jour
- [ ] Workers Celery redémarrés
- [ ] Test 1 : Pillar "Uncategorized" existe
- [ ] Test 2 : Notes "Uncategorized" sont clusterisées
- [ ] Test 3 : Trigger auto-création fonctionne
- [ ] Test 4 : Note avec score < 4/10 assignée à "Uncategorized"

---

**Dernière mise à jour :** 2 décembre 2025  
**Version :** 2.1.0 (Uncategorized Pillar)
