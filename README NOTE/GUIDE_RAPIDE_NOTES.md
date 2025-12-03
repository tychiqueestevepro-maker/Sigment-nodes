# 🎯 Guide Rapide : Traitement des Notes SIGMENT

## 📋 Résumé Exécutif

Ce document fournit une vue d'ensemble rapide du système de traitement des notes dans SIGMENT.

---

## 🔄 Flux Complet en 1 Minute

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Member App)                              │
│                                                                              │
│  1. Utilisateur écrit une note dans l'interface sphérique                   │
│  2. Clique sur "Save Node"                                                  │
│  3. POST /notes avec { user_id, content_raw }                               │
│                                                                              │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND API (FastAPI)                              │
│                                                                              │
│  4. Reçoit la requête POST /notes                                           │
│  5. INSERT dans la table notes (status: "draft")                            │
│  6. Retourne 201 Created immédiatement                                      │
│  7. Déclenche process_note_task.delay(note_id) (async)                      │
│                                                                              │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CELERY WORKER (Pipeline IA)                           │
│                                                                              │
│  ÉTAPE 1: Récupération du contexte                                          │
│  ├─ Fetch note + user (job_title, department, seniority)                    │
│  ├─ UPDATE status = "processing"                                            │
│  └─ LOG event: "submission"                                                 │
│                                                                              │
│  ÉTAPE 2: Récupération des Pillars                                          │
│  └─ SELECT * FROM pillars (ESG, Innovation, Operations, etc.)               │
│                                                                              │
│  ÉTAPE 3: Analyse IA (OpenAI GPT-4o-mini)                                   │
│  ├─ Prompt: Clarifier + Assigner Pillar + Calculer Score                    │
│  ├─ Résultat: { clarified_content, pillar_name, relevance_score }           │
│  └─ LOG event: "ai_analysis"                                                │
│                                                                              │
│  ÉTAPE 4: Génération Embedding (OpenAI text-embedding-3-small)              │
│  └─ Résultat: vector(1536) [0.123, -0.456, ...]                             │
│                                                                              │
│  ÉTAPE 5: Clustering (pgvector)                                             │
│  ├─ RPC find_similar_notes(embedding, pillar_id, threshold=0.75)            │
│  ├─ Si similarité > 75% → Rejoindre cluster existant                        │
│  └─ Sinon → Créer nouveau cluster                                           │
│                                                                              │
│  ÉTAPE 6: Mise à jour de la note                                            │
│  ├─ UPDATE notes SET content_clarified, embedding, pillar_id, cluster_id    │
│  ├─ UPDATE status = "processed", processed_at = NOW()                       │
│  └─ LOG event: "fusion"                                                     │
│                                                                              │
│  ÉTAPE 7: Génération Snapshot (async)                                       │
│  ├─ Trigger generate_cluster_snapshot_task.delay(cluster_id)                │
│  ├─ Générer titre du cluster (si nouveau)                                   │
│  ├─ Générer synthèse IA du cluster                                          │
│  ├─ Calculer métriques (dept_counts, avg_score)                             │
│  └─ INSERT cluster_snapshot                                                 │
│                                                                              │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL + pgvector)                        │
│                                                                              │
│  Tables mises à jour:                                                        │
│  ├─ notes (status: processed, embedding, cluster_id, etc.)                  │
│  ├─ note_events (4 événements: submission, ai_analysis, fusion, ...)        │
│  ├─ clusters (note_count++, avg_relevance_score recalculé)                  │
│  └─ cluster_snapshots (nouveau snapshot créé)                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**⏱️ Temps total : ~5-10 secondes**

---

## 📊 Statuts d'une Note

```
draft ──────▶ processing ──────▶ processed ──────▶ review ──────▶ approved
                                                      │
                                                      └──────▶ refused
```

| Statut | Description | Durée |
|--------|-------------|-------|
| `draft` | Note créée, en attente | ~50ms |
| `processing` | Traitement IA en cours | ~5-10s |
| `processed` | Prête pour révision Board | - |
| `review` | En révision par le Board | Variable |
| `approved` | Approuvée par le Board | - |
| `refused` | Refusée par le Board | - |

---

## 🎯 Actions Possibles

### **Pour les Members**

| Action | Endpoint | Méthode |
|--------|----------|---------|
| Soumettre une note | `/notes` | POST |
| Voir ses notes | `/notes/user/{user_id}` | GET |
| Voir une note | `/notes/{note_id}` | GET |
| Voir la timeline | `/notes/{note_id}/timeline` | GET |

### **Pour le Board/Admin**

| Action | Endpoint | Méthode |
|--------|----------|---------|
| Modérer une note | `/notes/{note_id}` | PATCH |
| Supprimer une note | `/notes/{note_id}` | DELETE |

---

## 🧠 Traitement IA

### **Analyse (GPT-4o-mini)**

**Input :**
```
Contenu brut: "Nous devrions implémenter un système de suivi de l'empreinte carbone"
Contexte utilisateur: Senior Developer, IT, Seniority 4
```

**Output :**
```json
{
  "clarified_content": "Implement a carbon footprint tracking system for our supply chain to monitor and reduce environmental impact",
  "pillar_name": "ESG",
  "relevance_score": 8.5,
  "reasoning": "Author is from IT with high seniority, topic aligns with technical expertise"
}
```

### **Embedding (text-embedding-3-small)**

**Input :**
```
"Implement a carbon footprint tracking system for our supply chain..."
```

**Output :**
```
vector(1536): [0.123, -0.456, 0.789, ..., 0.321]
```

### **Clustering (pgvector)**

**Recherche de similarité :**
```sql
SELECT * FROM find_similar_notes(
    embedding,
    pillar_id,
    similarity_threshold = 0.75,
    max_results = 10
);
```

**Résultat :**
- Si similarité > 75% → Rejoindre cluster existant
- Sinon → Créer nouveau cluster

---

## 📋 Tables Principales

```
users ──────┐
            │
            ├──▶ notes ──────┬──▶ note_events
            │                │
            │                └──▶ clusters ──────▶ cluster_snapshots
            │                         │
pillars ────┘                         │
                                      └──────────┘
```

### **notes**
- Stocke le contenu brut et clarifié
- Embedding vectoriel (1536 dimensions)
- Statut, scores, timestamps

### **note_events**
- Journal des événements (submission, ai_analysis, fusion, reviewing, refusal)
- Timeline pour feedback utilisateur

### **clusters**
- Groupes de notes similaires
- Titre, nombre de notes, score moyen

### **cluster_snapshots**
- Historique des clusters (time-lapse)
- Synthèse IA, métriques par département

---

## 🔧 Configuration Requise

### **Backend**

```bash
# .env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
SUPABASE_URL=https://...
SUPABASE_KEY=...
```

### **Database**

```sql
-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

### **Services**

```bash
# 1. Backend API
cd backend
uvicorn main:app --reload --port 8000

# 2. Celery Worker
cd backend
celery -A app.workers.celery_app worker --loglevel=info

# 3. Redis (broker Celery)
redis-server

# 4. Frontend
cd frontend/member
npm run dev
```

---

## 📊 Exemple Complet

### **1. Soumission**

```bash
curl -X POST http://localhost:8000/notes \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "content_raw": "Implémenter un chatbot IA pour le support client"
  }'
```

**Réponse immédiate :**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "draft",
  "created_at": "2025-12-02T03:54:30.123Z"
}
```

### **2. Traitement (5-10s en arrière-plan)**

```
[Celery Worker]
├─ Fetch user context
├─ AI Analysis → "Implement AI-powered chatbot for customer support"
├─ Generate embedding → [0.123, -0.456, ...]
├─ Find similar notes → Cluster ID: 890e1234-...
├─ Update note → status: "processed"
└─ Generate snapshot
```

### **3. Vérification**

```bash
curl http://localhost:8000/notes/123e4567-e89b-12d3-a456-426614174000
```

**Réponse :**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "content_clarified": "Implement AI-powered chatbot for customer support to improve response time and customer satisfaction",
  "pillar_id": "012e3456-...", // Customer Experience
  "cluster_id": "890e1234-...",
  "ai_relevance_score": 7.5,
  "status": "processed",
  "processed_at": "2025-12-02T03:54:35.789Z"
}
```

### **4. Timeline**

```bash
curl http://localhost:8000/notes/123e4567-e89b-12d3-a456-426614174000/timeline
```

**Réponse :**
```json
[
  {
    "event_type": "submission",
    "title": "Note Submitted",
    "created_at": "2025-12-02T03:54:30.123Z"
  },
  {
    "event_type": "ai_analysis",
    "title": "AI Analysis Complete",
    "description": "Relevance Score: 7.5/10 | Category: Customer Experience",
    "created_at": "2025-12-02T03:54:32.456Z"
  },
  {
    "event_type": "fusion",
    "title": "Cluster Assignment",
    "description": "Your idea has been grouped with similar ideas: 'Customer Support Automation'",
    "created_at": "2025-12-02T03:54:35.789Z"
  }
]
```

---

## 🎨 Interface Utilisateur

### **Page Node (Soumission)**

- Interface sphérique dynamique
- Zoom/Pan pour navigation
- Redimensionnement automatique
- Sauvegarde instantanée

### **Page Track Queue (Suivi)**

**Liste des notes :**
- Titre (clarifié par l'IA)
- Catégorie (pillar)
- Date de soumission
- Statut actuel

**Détail d'une note :**
- Timeline des événements
- Contenu brut et clarifié
- Score de relevance
- Cluster assigné
- Nombre de notes similaires

---

## 🔐 Sécurité

### **Permissions**

| Rôle | Créer | Voir | Modifier | Supprimer |
|------|-------|------|----------|-----------|
| Member | ✅ | ✅ (ses notes) | ❌ | ❌ |
| Board | ✅ | ✅ (toutes) | ✅ | ❌ |
| Admin | ✅ | ✅ (toutes) | ✅ | ✅ |

### **Validation**

- `content_raw` : 10-5000 caractères
- `user_id` : UUID valide
- `status` : Valeurs prédéfinies uniquement
- `ai_relevance_score` : 1-10

---

## 📈 Métriques Clés

### **Performance**

- Insertion DB : ~50ms
- Traitement IA complet : ~5-10s
- Recherche vectorielle : ~500ms
- Génération snapshot : ~2-3s

### **Volumétrie (estimée 1 an)**

- Notes : ~100,000
- Événements : ~400,000
- Clusters : ~5,000
- Snapshots : ~20,000

---

## 🚨 Gestion des Erreurs

### **Retry automatique (Celery)**

```python
@celery_app.task(bind=True, max_retries=3)
def process_note_task(self, note_id: str):
    try:
        # Traitement...
    except Exception as e:
        # Retry avec backoff exponentiel
        raise self.retry(exc=e, countdown=2 ** self.request.retries)
```

### **Fallback**

Si le traitement échoue après 3 tentatives :
- Statut revient à `draft`
- Erreur loggée dans `metadata`
- Notification admin

---

## 📚 Documents Complémentaires

1. **[DOCUMENTATION_TRAITEMENT_NOTES.md](./DOCUMENTATION_TRAITEMENT_NOTES.md)**
   - Flux complet détaillé
   - Code source commenté
   - Diagrammes de séquence

2. **[API_ROUTES_NOTES.md](./API_ROUTES_NOTES.md)**
   - Tous les endpoints
   - Paramètres et réponses
   - Exemples cURL

3. **[DATABASE_SCHEMA_NOTES.md](./DATABASE_SCHEMA_NOTES.md)**
   - Structure des tables
   - Index et triggers
   - Requêtes SQL utiles

---

## 🎯 Points Clés à Retenir

1. **Traitement asynchrone** : La note est créée immédiatement, traitée en arrière-plan
2. **Pipeline IA en 7 étapes** : Contexte → Pillars → Analyse → Embedding → Clustering → Update → Snapshot
3. **Similarité vectorielle** : pgvector avec seuil de 75%
4. **Logging d'événements** : Timeline complète pour feedback utilisateur
5. **Snapshots historiques** : Time-lapse des clusters

---

## 🔗 Ressources

- **OpenAI API** : https://platform.openai.com/docs
- **pgvector** : https://github.com/pgvector/pgvector
- **Celery** : https://docs.celeryq.dev/
- **Supabase** : https://supabase.com/docs

---

**Dernière mise à jour :** 2 décembre 2025
**Version :** 1.0.0
