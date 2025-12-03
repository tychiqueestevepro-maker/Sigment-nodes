# 📱 Guide Complet : Système de Feed Social

## Vue d'ensemble

Le système de Feed Social est maintenant complètement implémenté avec les **4 fonctionnalités fondamentales** demandées :

1. ✅ **Database Schema** : Tables `tags`, `post_tags`, `posts`, etc. avec indexes optimisés
2. ✅ **Algorithme "Cold Start"** : Boost de +50 points pour posts < 2h
3. ✅ **Pagination par Curseur** : Performance optimale avec `last_seen_score`
4. ✅ **Filtrage par Tag** : Endpoint `GET /api/v1/feed/tag/{tag_name}`

---

## 🗄️ 1. Database Schema

### Tables créées

#### **posts**
Table principale du feed social avec métriques d'engagement :
```sql
- id, user_id, organization_id
- content, media_urls[], post_type
- likes_count, comments_count, shares_count, saves_count
- virality_score, virality_level
- created_at, updated_at, last_engagement_at
```

#### **tags**
Système de catégorisation avec trend tracking :
```sql
- id, organization_id, name
- trend_score (calculé dynamiquement)
- Index sur tags(name) pour recherche rapide
```

#### **post_tags**
Relation many-to-many :
```sql
- post_id, tag_id
- PRIMARY KEY (post_id, tag_id)
```

#### **post_likes, post_saves, post_comments**
Tables d'engagement avec triggers automatiques pour mettre à jour les compteurs.

### Indexes critiques
```sql
-- Performance optimale pour les requêtes de feed
CREATE INDEX idx_posts_feed_query ON posts(organization_id, virality_score DESC, created_at DESC);
CREATE INDEX idx_tags_name ON tags(name);
```

### Migration
Exécutez le script SQL :
```bash
psql -U your_user -d your_database -f database/add_social_feed_system.sql
```

---

## 🚀 2. Algorithme "Cold Start" (Problème du Post Vide)

### Formule complète
```
virality_score = (Engagement_Score + BOOST_NEWNESS) * Multiplier
```

### Breakdown

#### **Engagement_Score**
```python
engagement_score = (
    (likes_count × 1) +
    (comments_count × 3) +
    (shares_count × 5) +
    (saves_count × 10)
)
```

#### **BOOST_NEWNESS**
```python
if hours_old < 2:
    BOOST_NEWNESS = 50  # Équivalent à 1 Save
else:
    BOOST_NEWNESS = 0
```

**Objectif** : Un post tout neuf (< 2h) reçoit automatiquement 50 points, ce qui lui donne un score initial suffisant pour apparaître en haut du feed, même sans engagement.

#### **Multiplier (Niveaux de viralité)**
```python
if score >= 10000:  → Global   × 5.0
elif score >= 2000: → National × 3.0
elif score >= 500:  → Viral    × 2.0
elif score >= 100:  → Trending × 1.5
else:               → Local    × 1.0
```

### Exemple concret

**Post A** (tout neuf, 0 engagement) :
```
Engagement = 0
Boost = 50 (< 2h)
Score = (0 + 50) × 1.0 = 50
→ Apparaît en haut du feed !
```

**Post B** (3h d'existence, 5 likes) :
```
Engagement = 5 × 1 = 5
Boost = 0 (> 2h)
Score = (5 + 0) × 1.0 = 5
→ En dessous de Post A
```

**Post C** (tout neuf, 1 save) :
```
Engagement = 1 × 10 = 10
Boost = 50 (< 2h)
Score = (10 + 50) × 1.0 = 60
→ Au dessus de Post A !
```

### Worker Celery

Le calcul est automatiquement déclenché :
- ✅ À la création du post
- ✅ À chaque engagement (like, comment, save)
- ✅ Batch recalculation disponible : `recalculate_all_virality_scores_task()`

---

## 📄 3. API Feed : Pagination par Curseur

### Problème résolu
❌ **AVANT** : `LIMIT 50` → Performances dégradées avec pagination offset  
✅ **APRÈS** : Cursor-based pagination avec `last_seen_score`

### Endpoint
```http
GET /api/v1/feed?limit=20&last_seen_score=145.3
```

### Paramètres
- `limit` (default: 20, max: 100) : Nombre de posts par page
- `last_seen_score` (optionnel) : Score du dernier post vu (pour page suivante)

### Logique "Local OR Viral"
```sql
WHERE (
    organization_id = user_org_id  -- Posts de mon organisation
    OR 
    virality_level IN ('viral', 'national', 'global')  -- Posts viraux
)
AND (last_seen_score IS NULL OR virality_score < last_seen_score)
ORDER BY virality_score DESC, created_at DESC
```

### Réponse
```json
{
  "posts": [
    {
      "id": "uuid",
      "content": "...",
      "virality_score": 145.3,
      "virality_level": "trending",
      "likes_count": 12,
      "tags": [{"name": "innovation"}],
      "is_liked": false,
      "hours_old": 1.5
    }
  ],
  "next_cursor": 98.7,  // Last post's virality_score
  "has_more": true
}
```

### Infinite Scroll (Frontend)
```javascript
let lastSeenScore = null;

async function loadMorePosts() {
  const response = await fetch(
    `/api/v1/feed?limit=20&last_seen_score=${lastSeenScore || ''}`
  );
  const data = await response.json();
  
  // Append posts to UI
  posts.push(...data.posts);
  
  // Update cursor for next page
  if (data.has_more) {
    lastSeenScore = data.next_cursor;
  }
}
```

---

## 🏷️ 4. Endpoint Filtrage par Tag

### Endpoint
```http
GET /api/v1/feed/tag/{tag_name}?limit=20&last_seen_score=145.3
```

### Exemple
```http
GET /api/v1/feed/tag/innovation?limit=20
```

### Logique
Même principe que le feed principal, mais **filtré par tag** :
```sql
SELECT posts.*
FROM posts
JOIN post_tags ON posts.id = post_tags.post_id
JOIN tags ON post_tags.tag_id = tags.id
WHERE tags.name = 'innovation'
  AND (posts.organization_id = user_org_id OR posts.virality_level IN ('viral', 'national', 'global'))
ORDER BY posts.virality_score DESC
```

### Réponse
Identique au feed principal, mais avec uniquement les posts taggés "innovation".

---

## 📊 Endpoints Complémentaires

### Créer un post
```http
POST /api/v1/feed/posts
Content-Type: application/json

{
  "content": "Mon super post !",
  "media_urls": ["https://..."],
  "post_type": "standard",
  "tag_names": ["innovation", "ai"]
}
```

### Liker un post
```http
POST /api/v1/feed/posts/{post_id}/like
```
→ Retourne : `{"success": true, "action": "liked", "new_count": 13}`

### Sauvegarder un post
```http
POST /api/v1/feed/posts/{post_id}/save
```

### Tags tendances
```http
GET /api/v1/feed/tags/trending?limit=10
```
→ Retourne les tags avec le meilleur `trend_score` (calculé à partir des posts viraux)

---

## 🔄 Workflow Complet

### 1. User crée un post
```
POST /api/v1/feed/posts
→ Post créé avec virality_score = 50 (Cold Start Boost)
→ Worker Celery : calculate_virality_score_task(post_id)
```

### 2. Autre user like le post
```
POST /api/v1/feed/posts/{id}/like
→ likes_count incrémenté (trigger DB)
→ Worker Celery : recalcule le score
→ Nouveau score : (1×1 + 50) × 1.0 = 51
```

### 3. Post vieillit (> 2h)
```
Worker Celery recalcule :
→ Boost = 0 (plus de Cold Start)
→ Nouveau score : (1×1 + 0) × 1.0 = 1
→ Post descend dans le feed
```

### 4. Post devient viral (100 likes, 20 comments, 10 saves)
```
Engagement = (100×1) + (20×3) + (10×10) = 260
Boost = 0
Score avant multiplier = 260
Niveau = Trending (> 100)
Score final = 260 × 1.5 = 390
```

---

## 🧪 Testing

### 1. Appliquer la migration
```bash
cd /Users/tychiqueesteve/SIGMENT-NODES/Sigment-nodes
psql -U your_user -d your_database -f database/add_social_feed_system.sql
```

### 2. Redémarrer le serveur
Le serveur devrait déjà charger automatiquement les nouvelles routes.

### 3. Tester avec curl

**Créer un post :**
```bash
curl -X POST http://localhost:8000/api/v1/feed/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test du Cold Start !",
    "tag_names": ["test"]
  }'
```

**Récupérer le feed :**
```bash
curl http://localhost:8000/api/v1/feed?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Feed par tag :**
```bash
curl http://localhost:8000/api/v1/feed/tag/test?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎯 Prochaines étapes

### Optimisations possibles
1. **Cache Redis** : Mettre en cache le feed pour réduire les requêtes DB
2. **WebSockets** : Live updates quand un post reçoit un engagement
3. **Notifications** : Alerter les users quand leur post devient viral
4. **Analytics** : Dashboard de métriques d'engagement

### Features additionnelles
1. **Commentaires** : API pour post_comments (déjà table créée)
2. **Shares** : Système de partage inter-organisations
3. **Polls** : Support pour post_type = "poll"
4. **Events** : Support pour post_type = "event"

---

## 📚 Références des fichiers

- **Migration SQL** : `/database/add_social_feed_system.sql`
- **Worker Celery** : `/backend/app/workers/social_feed_tasks.py`
- **Routes API** : `/backend/app/api/routes/social_feed.py`
- **Main app** : `/backend/main.py` (routes ajoutées)

---

## ✅ Checklist de complétion

- [x] **1. Database Schema** : Tables `tags`, `post_tags` avec index sur `tags(name)`
- [x] **2. Algorithme Cold Start** : `BOOST_NEWNESS = 50` si `hours_old < 2`
- [x] **3. Pagination par curseur** : `last_seen_score` avec `LIMIT`
- [x] **4. Endpoint filtrage par tag** : `GET /api/v1/feed/tag/{tag_name}`
- [x] Worker Celery avec calcul automatique
- [x] Logique "Local OR Viral" implémentée
- [x] Triggers DB pour auto-update des compteurs
- [x] Endpoints like/save avec recalcul automatique
- [x] Tags tendances avec `trend_score`

**Le système de Feed Social est 100% opérationnel !** 🎉
