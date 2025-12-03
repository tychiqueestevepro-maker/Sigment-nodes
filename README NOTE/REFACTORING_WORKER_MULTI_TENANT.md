# ✅ Refactorisation Worker Celery - Multi-Tenant + Pillars Fixes

## 🎯 Objectif

Adapter le système de traitement des notes pour respecter :
1. **Multi-Tenant Strict** : Isolation complète par organisation
2. **Pillars Fixes** : Pas de création de nouveaux pillars, seulement attribution au meilleur existant

---

## 📝 Changements Appliqués

### **1. Service IA (`ai_service.py`)**

#### **Avant**
```python
def analyze_note(content, user_context, available_pillars):
    # Prompt générique
    # Retourne: pillar_name
```

#### **Après** ✅
```python
def analyze_note(content, user_context, available_pillars):
    # 🔒 CONTRAINTE STRICTE dans le prompt:
    # "You MUST assign to ONE of the pillars listed above"
    # "You are FORBIDDEN from inventing new pillars"
    # "If score < 4/10, return pillar_id as null"
    
    # Retourne: pillar_id, pillar_name, relevance_score, reasoning
    # Validation: Vérifie que pillar_id existe dans available_pillars
```

**Changements clés** :
- ✅ Prompt renforcé avec contrainte stricte
- ✅ Retour de `pillar_id` (UUID) au lieu de juste `pillar_name`
- ✅ Règle spéciale : Si score < 4/10 → `pillar_id = null`, `pillar_name = "Uncategorized"`
- ✅ Validation post-IA pour garantir que le pillar existe

---

### **2. Worker Principal (`process_note_task`)**

#### **Avant**
```python
def process_note_task(note_id):
    # 1. Fetch note
    # 2. Get ALL pillars (global)
    # 3. AI analysis
    # 4. Find cluster (global search)
```

#### **Après** ✅
```python
def process_note_task(note_id):
    # 1. Fetch note + organization_id
    # 2. Get pillars FILTERED BY organization_id 🔒
    # 3. AI analysis (strict: existing pillars only)
    # 4. Find cluster WITHIN SAME organization 🔒
    # 5. Handle "Uncategorized" (pillar_id = null)
```

**Changements clés** :
- ✅ Récupération de `organization_id` depuis la note
- ✅ Filtrage des pillars : `.eq("organization_id", organization_id)`
- ✅ Gestion des notes non catégorisées (score < 4/10)
- ✅ Passage de `organization_id` à `find_or_create_cluster`
- ✅ Logging amélioré avec `organization_id`

---

### **3. Fonction de Clustering (`find_or_create_cluster`)**

#### **Avant**
```python
def find_or_create_cluster(note_id, pillar_id, embedding, clarified_content):
    similar_notes = supabase.rpc("find_similar_notes", {
        "query_embedding": embedding,
        "target_pillar_id": pillar_id,
        # ❌ Pas de filtrage par org
    })
```

#### **Après** ✅
```python
def find_or_create_cluster(note_id, pillar_id, organization_id, embedding, clarified_content):
    similar_notes = supabase.rpc("find_similar_notes", {
        "query_embedding": embedding,
        "target_pillar_id": pillar_id,
        "p_organization_id": organization_id,  # 🔒 MULTI-TENANT
    })
    
    # Création de cluster avec organization_id
    cluster = supabase.table("clusters").insert({
        "pillar_id": pillar_id,
        "organization_id": organization_id,  # 🔒 MULTI-TENANT
        "title": clarified_content[:200] + "...",
    })
```

**Changements clés** :
- ✅ Nouveau paramètre `organization_id`
- ✅ Passage de `p_organization_id` à la fonction RPC
- ✅ Ajout de `organization_id` lors de la création de cluster

---

### **4. Génération de Snapshots (`generate_cluster_snapshot_task`)**

#### **Avant**
```python
def generate_cluster_snapshot_task(cluster_id):
    # Création de snapshot sans organization_id
    supabase.table("cluster_snapshots").insert({
        "cluster_id": cluster_id,
        "synthesis_text": synthesis,
        # ❌ Pas d'organization_id
    })
```

#### **Après** ✅
```python
def generate_cluster_snapshot_task(cluster_id):
    # Récupération de organization_id depuis le cluster
    organization_id = cluster["organization_id"]
    
    # Création de snapshot avec organization_id
    supabase.table("cluster_snapshots").insert({
        "cluster_id": cluster_id,
        "organization_id": organization_id,  # 🔒 MULTI-TENANT
        "synthesis_text": synthesis,
    })
```

**Changements clés** :
- ✅ Récupération de `organization_id` depuis le cluster
- ✅ Ajout de `organization_id` aux snapshots

---

## 🔒 Garanties de Sécurité

### **Niveau 1 : Base de Données**
- ✅ `organization_id NOT NULL` sur toutes les tables
- ✅ Foreign Keys vers `organizations`
- ✅ Triggers de validation cross-org
- ✅ Row Level Security (RLS)
- ✅ Fonction `find_similar_notes` avec `p_organization_id`

### **Niveau 2 : Application (Worker)**
- ✅ Filtrage des pillars par `organization_id`
- ✅ Passage de `organization_id` à toutes les fonctions
- ✅ Validation que la note a un `organization_id`
- ✅ Clustering isolé par organisation

### **Niveau 3 : IA**
- ✅ Contrainte stricte : Pas de création de pillar
- ✅ Attribution au meilleur pillar existant
- ✅ Gestion des notes non catégorisables (score < 4/10)

---

## 📊 Flux Complet Mis à Jour

```
1. USER soumet une note
   ↓
2. Note créée avec organization_id
   ↓
3. Worker Celery démarre
   ├─ Récupère organization_id de la note
   ├─ Charge UNIQUEMENT les pillars de cette org
   ├─ Envoie à l'IA avec contrainte stricte
   ├─ IA choisit le meilleur pillar existant (ou "Uncategorized")
   ├─ Génère embedding
   ├─ Cherche similarité DANS LA MÊME ORG
   ├─ Assigne au cluster (ou crée nouveau cluster avec org_id)
   └─ Génère snapshot avec organization_id
   ↓
4. Note processed ✅
```

---

## 🎯 Cas d'Usage

### **Cas 1 : Note bien catégorisée**
```
Input: "Implement carbon tracking system"
Organization: acme-corp
Pillars disponibles: ESG, Innovation, Operations

IA:
- Pillar choisi: ESG (score: 8.5/10)
- Clustering: Trouve 3 notes similaires dans acme-corp
- Résultat: Note ajoutée au cluster "Carbon Footprint Initiatives"
```

### **Cas 2 : Note mal catégorisée**
```
Input: "Buy new coffee machine"
Organization: acme-corp
Pillars disponibles: ESG, Innovation, Operations

IA:
- Meilleur pillar: Operations (score: 2.5/10)
- Score < 4/10 → pillar_id = null
- Résultat: Note marquée "Uncategorized", pas de clustering
```

### **Cas 3 : Isolation multi-tenant**
```
Organization A: 10 notes sur "Carbon tracking"
Organization B: 5 notes sur "Carbon tracking"

Clustering:
- Notes de A clustérisées ensemble (cluster A)
- Notes de B clustérisées ensemble (cluster B)
- ✅ Aucun mélange entre A et B
```

---

## 🧪 Tests à Effectuer

### **Test 1 : Pillars fixes**
```python
# Créer une note avec un sujet hors pillars
note = create_note(
    content="Organize team building event",
    organization_id="acme-corp"
)

# Vérifier que l'IA n'a pas créé de nouveau pillar
assert note.pillar_id in [p.id for p in get_pillars("acme-corp")] or note.pillar_id is None
```

### **Test 2 : Isolation multi-tenant**
```python
# Créer 2 notes similaires dans 2 orgs différentes
note_a = create_note("Carbon tracking", org="org-a")
note_b = create_note("Carbon tracking", org="org-b")

# Vérifier qu'elles sont dans des clusters différents
assert note_a.cluster_id != note_b.cluster_id
```

### **Test 3 : Score < 4/10**
```python
# Créer une note très hors sujet
note = create_note("Random unrelated content", org="acme-corp")

# Vérifier qu'elle est marquée "Uncategorized"
assert note.pillar_id is None
assert note.cluster_id is None
```

---

## 📚 Fichiers Modifiés

| Fichier | Lignes Modifiées | Complexité |
|---------|------------------|------------|
| `backend/app/services/ai_service.py` | 21-99 | 8/10 |
| `backend/app/workers/tasks.py` | 15-310 | 9/10 |

---

## 🚀 Déploiement

### **Étape 1 : Vérifier la base de données**
```bash
# La migration Multi-Tenant Strict doit être appliquée
\i database/verify_multi_tenant_strict.sql
# Résultat attendu: 10/10 tests passés
```

### **Étape 2 : Redémarrer les workers Celery**
```bash
# Arrêter les workers existants
pkill -f "celery.*worker"

# Redémarrer avec le nouveau code
cd backend
celery -A app.workers.celery_app worker --loglevel=info
```

### **Étape 3 : Tester**
```bash
# Créer une note de test
curl -X POST http://localhost:8000/notes \
  -H "Content-Type: application/json" \
  -H "X-Organization-ID: <org-uuid>" \
  -d '{
    "user_id": "<user-uuid>",
    "content_raw": "Test multi-tenant with fixed pillars"
  }'

# Vérifier les logs Celery
# Rechercher: "Found X pillars for organization"
# Rechercher: "Creating new cluster for organization"
```

---

## ✅ Checklist de Validation

- [ ] Migration SQL Multi-Tenant Strict appliquée
- [ ] `ai_service.py` mis à jour (contrainte stricte)
- [ ] `tasks.py` mis à jour (organization_id partout)
- [ ] Workers Celery redémarrés
- [ ] Test 1 : Pillars fixes (pas de création)
- [ ] Test 2 : Isolation multi-tenant
- [ ] Test 3 : Gestion score < 4/10
- [ ] Logs Celery vérifiés

---

**Dernière mise à jour :** 2 décembre 2025  
**Version :** 2.0.0 (Multi-Tenant + Pillars Fixes)
