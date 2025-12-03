# 📚 Documentation Système de Notes - SIGMENT

Bienvenue dans la documentation complète du système de traitement des notes de SIGMENT.

---

## 🎯 Objectif

Ce système permet aux membres de l'organisation de soumettre des idées qui sont automatiquement :
- ✅ Clarifiées par l'IA
- ✅ Catégorisées par pilier stratégique
- ✅ Évaluées selon leur pertinence
- ✅ Regroupées avec des idées similaires
- ✅ Suivies tout au long de leur cycle de vie

---

## 📖 Documents Disponibles

### 🚀 **[GUIDE_RAPIDE_NOTES.md](./GUIDE_RAPIDE_NOTES.md)**
**Pour : Développeurs, Product Managers**

Vue d'ensemble rapide du système en 1 minute :
- Diagramme ASCII du flux complet
- Résumé des statuts et actions
- Exemple complet de bout en bout
- Métriques clés

👉 **Commencez par ici si vous découvrez le système !**

---

### 📋 **[DOCUMENTATION_TRAITEMENT_NOTES.md](./DOCUMENTATION_TRAITEMENT_NOTES.md)**
**Pour : Développeurs Backend, Architectes**

Documentation technique complète :
- Architecture globale
- Flux détaillé en 7 étapes
- Code source commenté
- Configuration Celery
- Modèles de données Pydantic
- Diagramme de séquence

👉 **Pour comprendre en profondeur le pipeline IA**

---

### 🔌 **[API_ROUTES_NOTES.md](./API_ROUTES_NOTES.md)**
**Pour : Développeurs Frontend/Backend, Testeurs**

Documentation des endpoints API :
- 7 routes complètes (POST, GET, PATCH, DELETE)
- Paramètres et body de requête
- Réponses et codes d'erreur
- Exemples cURL
- Permissions par rôle

👉 **Pour intégrer l'API dans votre code**

---

### 🗄️ **[DATABASE_SCHEMA_NOTES.md](./DATABASE_SCHEMA_NOTES.md)**
**Pour : DBA, Développeurs Backend**

Schéma de base de données complet :
- 6 tables détaillées (users, notes, clusters, etc.)
- Relations et contraintes
- Index et triggers
- Fonctions PostgreSQL (pgvector)
- Requêtes SQL utiles
- Optimisations

👉 **Pour comprendre la structure des données**

---

## 🔄 Flux Simplifié

```
Member écrit une note
         ↓
    POST /notes
         ↓
  Insertion DB (draft)
         ↓
  Celery Worker (async)
    ├─ Analyse IA
    ├─ Embedding
    ├─ Clustering
    └─ Snapshot
         ↓
  Note processed ✅
         ↓
  Member voit la timeline
```

---

## 🎯 Cas d'Usage

### **1. Soumission d'une idée**

**Acteur :** Member  
**Action :** Écrit une note dans l'interface Node  
**Résultat :** Note créée avec statut `draft`, traitement IA déclenché  
**Temps :** ~50ms (réponse immédiate)

### **2. Traitement IA**

**Acteur :** Celery Worker  
**Action :** Pipeline en 7 étapes  
**Résultat :** Note `processed` avec clarification, pillar, cluster  
**Temps :** ~5-10 secondes

### **3. Suivi de l'idée**

**Acteur :** Member  
**Action :** Consulte la page Track Queue  
**Résultat :** Voit la timeline complète (submission → ai_analysis → fusion)  
**Temps :** Temps réel

### **4. Modération**

**Acteur :** Board  
**Action :** Change le statut à `refused` ou `approved`  
**Résultat :** Événement loggé, cluster retraité si refusé  
**Temps :** Instantané

---

## 🛠️ Technologies Utilisées

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **Frontend** | Next.js, React, TailwindCSS | Interface utilisateur |
| **Backend API** | FastAPI, Python | Endpoints REST |
| **Worker** | Celery, Redis | Traitement asynchrone |
| **IA** | OpenAI (GPT-4o-mini, text-embedding-3-small) | Analyse et embeddings |
| **Database** | PostgreSQL, Supabase, pgvector | Stockage et recherche vectorielle |

---

## 📊 Modèle de Données

### **Tables Principales**

```
users
├─ id (UUID)
├─ email
├─ role (employee, admin, board)
├─ job_title
├─ department
└─ seniority_level (1-5)

notes
├─ id (UUID)
├─ user_id → users(id)
├─ content_raw (texte brut)
├─ content_clarified (texte clarifié par IA)
├─ embedding (vector 1536)
├─ pillar_id → pillars(id)
├─ cluster_id → clusters(id)
├─ ai_relevance_score (1-10)
├─ status (draft, processing, processed, refused)
├─ created_at
└─ processed_at

note_events
├─ id (UUID)
├─ note_id → notes(id)
├─ event_type (submission, ai_analysis, fusion, reviewing, refusal)
├─ title
├─ description
└─ created_at

clusters
├─ id (UUID)
├─ pillar_id → pillars(id)
├─ title
├─ note_count
├─ avg_relevance_score
└─ last_updated_at

cluster_snapshots
├─ id (UUID)
├─ cluster_id → clusters(id)
├─ synthesis_text (synthèse IA)
├─ metrics_json ({"IT": 5, "Sales": 2, "Avg_Weight": 7.8})
├─ included_note_ids (array de UUIDs)
└─ created_at

pillars
├─ id (UUID)
├─ name (ESG, Innovation, Operations, etc.)
├─ description
└─ color (hex)
```

---

## 🔐 Permissions

| Rôle | Créer Note | Voir Notes | Modifier Note | Supprimer Note |
|------|------------|------------|---------------|----------------|
| **Member** | ✅ | ✅ (ses notes) | ❌ | ❌ |
| **Board** | ✅ | ✅ (toutes) | ✅ (modération) | ❌ |
| **Admin** | ✅ | ✅ (toutes) | ✅ | ✅ |

---

## 📈 Métriques de Performance

| Opération | Temps Moyen | Optimisation |
|-----------|-------------|--------------|
| Insertion note | ~50ms | Index B-tree |
| Analyse IA | ~2-3s | Cache OpenAI |
| Génération embedding | ~1-2s | Batch processing |
| Recherche similarité | ~500ms | Index IVFFlat |
| Mise à jour DB | ~100ms | Transactions |
| Génération snapshot | ~2-3s | Async task |
| **TOTAL** | **~5-10s** | Pipeline optimisé |

---

## 🚀 Démarrage Rapide

### **1. Prérequis**

```bash
# Backend
- Python 3.9+
- Redis
- PostgreSQL avec pgvector

# Frontend
- Node.js 18+
- npm ou yarn
```

### **2. Installation**

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend/member
npm install
```

### **3. Configuration**

```bash
# backend/.env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
SUPABASE_URL=https://...
SUPABASE_KEY=...
```

### **4. Lancement**

```bash
# Terminal 1 : Backend API
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 : Celery Worker
cd backend
celery -A app.workers.celery_app worker --loglevel=info

# Terminal 3 : Redis
redis-server

# Terminal 4 : Frontend
cd frontend/member
npm run dev
```

### **5. Test**

```bash
# Créer une note
curl -X POST http://localhost:8000/notes \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "content_raw": "Test note"
  }'

# Vérifier le traitement (attendre 5-10s)
curl http://localhost:8000/notes/{note_id}
```

---

## 🐛 Debugging

### **Logs Celery**

```bash
# Voir les logs en temps réel
celery -A app.workers.celery_app worker --loglevel=debug

# Logs importants :
# ✅ "Processing note: {note_id}"
# ✅ "AI Analysis: Pillar=ESG, Score=8.5"
# ✅ "Generated embedding: 1536 dimensions"
# ✅ "Note {note_id} processed successfully"
```

### **Vérifier l'état d'une note**

```sql
-- Statut actuel
SELECT id, status, created_at, processed_at 
FROM notes 
WHERE id = '123e4567-...';

-- Timeline complète
SELECT event_type, title, created_at 
FROM note_events 
WHERE note_id = '123e4567-...' 
ORDER BY created_at;
```

### **Problèmes courants**

| Problème | Cause | Solution |
|----------|-------|----------|
| Note reste en `draft` | Celery worker non démarré | Lancer `celery worker` |
| Erreur OpenAI | API key invalide | Vérifier `.env` |
| Similarité 0% | Embedding NULL | Vérifier génération embedding |
| Cluster non créé | Erreur SQL | Vérifier extension pgvector |

---

## 📚 Ressources Externes

- **OpenAI API** : https://platform.openai.com/docs
- **pgvector** : https://github.com/pgvector/pgvector
- **Celery** : https://docs.celeryq.dev/
- **FastAPI** : https://fastapi.tiangolo.com/
- **Supabase** : https://supabase.com/docs

---

## 🤝 Contribution

Pour contribuer au système :

1. Lire la documentation complète
2. Créer une branche feature
3. Tester localement avec Celery
4. Soumettre une PR avec tests

---

## 📞 Support

Pour toute question :
- **Documentation** : Consulter les 4 fichiers MD
- **Code** : Voir `/backend/app/workers/tasks.py`
- **API** : Voir `/backend/app/api/routes/notes.py`
- **DB** : Voir `/database/schema.sql`

---

## 📝 Changelog

### Version 1.0.0 (2025-12-02)
- ✅ Pipeline IA complet en 7 étapes
- ✅ Clustering automatique avec pgvector
- ✅ Timeline des événements
- ✅ Snapshots de clusters
- ✅ Interface Track Queue

---

**Dernière mise à jour :** 2 décembre 2025  
**Auteur :** Équipe SIGMENT  
**Version :** 1.0.0
