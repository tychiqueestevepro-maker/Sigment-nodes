# 🧠 SIGMENT Social Intelligence System

**Version :** 1.0.0 (Production Ready)  
**Date :** 2025-12-02  
**Statut :** ✅ Déployé & Sécurisé

---

## 📖 Introduction

Le **Social Intelligence System** transforme SIGMENT d'un simple outil de prise de notes en une plateforme d'intelligence collective dynamique.

Il connecte le traitement IA (Notes & Clusters) à un flux social engageant, permettant aux meilleures idées d'émerger organiquement grâce à un algorithme de viralité "Cold Start" et une logique de tri intelligente.

---

## 🚀 Fonctionnalités Clés

### 1. 🔗 Notes-to-Feed Integration
Les notes ne meurent pas dans un dossier. Dès qu'elles sont traitées par l'IA :
- Elles deviennent automatiquement des **Posts** (`type: linked_idea`).
- Elles héritent du contexte (Pillar, Cluster, Score IA).
- Elles profitent du **Cold Start Boost** (Score 50.0) pour être visibles immédiatement pendant 2h.

### 2. 🛡️ Unified Feed "Anti-Bruit"
Un flux unique qui mélange intelligemment **trois** types de contenus :
- **📦 Clusters :** Uniquement ceux actifs dans les dernières **48h**.
- **📝 Notes :** Uniquement les **orphelines** (non clustérisées) ou **mes notes**.
- **💬 Posts :** Les messages directs postés dans le Home Feed (type `standard`).
- **Tri :** Par "Dernière Activité". Un cluster remonte en haut dès qu'une nouvelle note lui est ajoutée.

### 3. ⏰ Time Decay Optimization
Pour garantir performance et pertinence :
- **30-Day Window :** Le feed ne charge que les 30 derniers jours.
- **Stop the Math :** Les scores de viralité ne sont plus recalculés après 7 jours.
- **Necromancy Effect :** Un vieux post qui reçoit un nouveau like est "ressuscité" et recalculé.

### 4. 🔒 Sécurité Multi-Tenant (Isolation Stricte)
- **Isolation Totale :** Un utilisateur ne voit **QUE** les données de son organisation.
- **Pas de fuite :** Même les posts viraux/globaux sont bloqués entre organisations.
- **Firewall SQL :** La sécurité est forcée au niveau des Stored Functions.

---

## 🏗️ Architecture Technique

### Base de Données (PostgreSQL)

| Fichier SQL | Description |
|-------------|-------------|
| `add_social_feed_system.sql` | Tables de base (`posts`, `tags`, `likes`) et fonctions de base. |
| `add_time_decay_optimization.sql` | Optimisation des performances (Index, Fenêtre 30j). |
| `add_notes_to_feed_integration.sql` | Pont entre Notes et Posts (`publish_note_to_feed`). |
| `add_unified_feed.sql` | Fonction `get_unified_feed` (UNION Polymorphique). |
| `restrict_feed_to_local_org.sql` | **SÉCURITÉ :** Force l'isolation stricte par organisation. |

### Backend (FastAPI + Celery)

| Composant | Rôle |
|-----------|------|
| `unified_feed.py` | Endpoint polymorphique (`GET /api/feed/unified`). |
| `social_feed.py` | Endpoints d'engagement (Like, Save, Comment). |
| `tasks.py` | Worker IA qui déclenche `publish_note_to_feed_task`. |
| `social_feed_tasks.py` | Worker de calcul de viralité (Cold Start + Time Decay). |

---

## 🛠️ Guide d'Installation

Pour déployer le système complet sur une nouvelle instance :

### 1. Appliquer les Migrations SQL (Ordre Important)

```bash
# 1. Système de base
psql -U user -d db -f database/add_social_feed_system.sql

# 2. Optimisations Time Decay
psql -U user -d db -f database/add_time_decay_optimization.sql

# 3. Intégration Notes
psql -U user -d db -f database/add_notes_to_feed_integration.sql

# 4. Feed Unifié
psql -U user -d db -f database/add_unified_feed.sql

# 5. Sécurité Stricte (CRITIQUE)
psql -U user -d db -f database/restrict_feed_to_local_org.sql
```

### 2. Redémarrer les Services

```bash
# Backend API
uvicorn main:app --reload

# Celery Worker
celery -A app.workers.celery_app worker --loglevel=info
```

---

## 📊 API Reference

### Unified Feed
- `GET /api/feed/unified` : Le flux principal (Clusters + Notes).
- `GET /api/feed/unified/stats` : Statistiques (Orphelines vs Clustérisées).
- `GET /api/feed/unified/{type}/{id}` : Détails d'un item.

### Social Actions
- `POST /api/feed/posts/{id}/like` : Liker un post/note.
- `POST /api/feed/posts/{id}/save` : Sauvegarder.
- `POST /api/feed/posts/{id}/comments` : Commenter.

---

## 🧪 Tests & Validation

Le système a passé avec succès l'audit de sécurité (`SECURITY_AUDIT_SOCIAL_FEED.md`) :
- ✅ Isolation des données par `organization_id`.
- ✅ Blocage des accès cross-org.
- ✅ Performance des requêtes (Indexes optimisés).

---

**Développé par l'équipe SIGMENT AI**  
*Turning Noise into Intelligence.*
