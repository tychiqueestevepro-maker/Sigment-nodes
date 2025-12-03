# 🚀 Social Feed - Quick Reference Guide

## Installation Rapide

```bash
# Option 1 : Installation automatique
./install_social_feed.sh

# Option 2 : Installation manuelle
psql -U your_user -d your_db -f database/add_social_feed_system.sql
```

---

## API Endpoints

### Créer un Post
```http
POST /api/feed/posts
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Mon super post !",
  "media_urls": ["https://..."],
  "tag_names": ["innovation", "ai"]
}
```

**Response:**
```json
{
  "id": "uuid",
  "content": "...",
  "virality_score": 50.0,
  "virality_level": "local",
  "created_at": "2025-12-02T19:00:00Z"
}
```

---

### Feed Principal (avec pagination)
```http
GET /api/feed?limit=20&last_seen_score=145.3
Authorization: Bearer {token}
```

**Response:**
```json
{
  "posts": [...],
  "next_cursor": 98.7,
  "has_more": true
}
```

**Infinite Scroll (JavaScript):**
```javascript
let cursor = null;

async function loadMore() {
  const url = `/api/feed?limit=20${cursor ? `&last_seen_score=${cursor}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
  const data = await res.json();
  
  posts.push(...data.posts);
  if (data.has_more) cursor = data.next_cursor;
}
```

---

### Feed par Tag
```http
GET /api/feed/tag/innovation?limit=20
Authorization: Bearer {token}
```

---

### Like/Unlike
```http
POST /api/feed/posts/{post_id}/like
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "action": "liked",  // or "unliked"
  "new_count": 13
}
```

---

### Save/Unsave
```http
POST /api/feed/posts/{post_id}/save
Authorization: Bearer {token}
```

---

### Tags Tendances
```http
GET /api/feed/tags/trending?limit=10
Authorization: Bearer {token}
```

---

## Algorithme de Score

### Formule Complète
```
virality_score = (Engagement_Score + BOOST_NEWNESS) * Multiplier
```

### Poids d'Engagement
```
Like    = 1 point
Comment = 3 points
Share   = 5 points
Save    = 10 points
```

### Cold Start Boost
```
IF age < 2 hours:
  BOOST_NEWNESS = 50 points 🚀
ELSE:
  BOOST_NEWNESS = 0
```

### Niveaux de Viralité
```
Score >= 10000  → Global    (× 5.0)
Score >= 2000   → National  (× 3.0)
Score >= 500    → Viral     (× 2.0)
Score >= 100    → Trending  (× 1.5)
Score < 100     → Local     (× 1.0)
```

### Exemple Concret
```
Post neuf (1h) avec 0 engagement:
├─ Engagement = 0
├─ Boost = 50 (< 2h)
├─ Score = (0 + 50) × 1.0 = 50
└─ Niveau = Local

Post viral (100 likes, 20 comments, 10 saves):
├─ Engagement = (100×1) + (20×3) + (10×10) = 260
├─ Boost = 0 (> 2h)
├─ Score = (260 + 0) × 1.5 = 390
└─ Niveau = Trending
```

---

## Database Schema (Référence Rapide)

### Table: posts
```sql
id               UUID PRIMARY KEY
user_id          UUID → users(id)
organization_id  UUID → organizations(id)
content          TEXT
virality_score   FLOAT
virality_level   VARCHAR(20)  -- local, trending, viral, national, global
likes_count      INTEGER
comments_count   INTEGER
shares_count     INTEGER
saves_count      INTEGER
created_at       TIMESTAMP
```

### Table: tags
```sql
id               UUID PRIMARY KEY
organization_id  UUID → organizations(id)
name             VARCHAR(100)
trend_score      FLOAT
```

### Table: post_tags
```sql
post_id          UUID → posts(id)
tag_id           UUID → tags(id)
PRIMARY KEY (post_id, tag_id)
```

---

## Stored Functions

### get_social_feed
```sql
SELECT * FROM get_social_feed(
  p_user_org_id := 'uuid',
  p_limit := 20,
  p_last_seen_score := 145.3  -- Optional
);
```

**Logique "Local OR Viral":**
```sql
WHERE (
  posts.organization_id = p_user_org_id  -- Local
  OR
  posts.virality_level IN ('viral', 'national', 'global')  -- Viral
)
AND (virality_score < p_last_seen_score OR p_last_seen_score IS NULL)
ORDER BY virality_score DESC
```

### get_feed_by_tag
```sql
SELECT * FROM get_feed_by_tag(
  p_user_org_id := 'uuid',
  p_tag_name := 'innovation',
  p_limit := 20,
  p_last_seen_score := 145.3  -- Optional
);
```

---

## Celery Tasks

### Calculer le Score de Viralité
```python
from app.workers.social_feed_tasks import calculate_virality_score_task

# Déclenché automatiquement sur:
# - Création de post
# - Like/Save d'un post

# Déclenchement manuel:
calculate_virality_score_task.delay(post_id)
```

### Recalcul Batch (Maintenance)
```python
from app.workers.social_feed_tasks import recalculate_all_virality_scores_task

# Tous les posts
recalculate_all_virality_scores_task.delay()

# Pour une org spécifique
recalculate_all_virality_scores_task.delay(organization_id="uuid")
```

---

## Tests Rapides

### Test avec cURL

**Créer un post:**
```bash
curl -X POST http://localhost:8000/api/feed/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test!", "tag_names": ["test"]}'
```

**Récupérer le feed:**
```bash
curl http://localhost:8000/api/feed?limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

**Liker un post:**
```bash
curl -X POST http://localhost:8000/api/feed/posts/{POST_ID}/like \
  -H "Authorization: Bearer $TOKEN"
```

### Test Automatisé
```bash
./test_social_feed.sh
```

---

## Performance Tips

### Indexes Utilisés
- `idx_posts_feed_query` - Multi-column (org_id, score DESC)
- `idx_tags_name` - Recherche rapide par nom
- `idx_posts_virality_score` - Tri par score
- `idx_post_tags_tag` - Jointure optimisée

### Cursor Pagination
✅ **Bon:** `WHERE score < last_seen_score`
❌ **Mauvais:** `LIMIT 20 OFFSET 100`

### Query Optimization
- Utilisez les stored functions (calculs côté DB)
- Évitez les N+1 queries (utilisez `_enrich_posts`)
- Limitez le nombre de posts par page (max 100)

---

## Troubleshooting

### Posts n'apparaissent pas dans le feed
1. Vérifier le `organization_id` du post
2. Vérifier le `virality_level` (local vs viral)
3. Vérifier le score avec: `SELECT virality_score FROM posts WHERE id = 'uuid'`

### Score ne se met pas à jour
1. Vérifier que Celery worker tourne
2. Vérifier les logs Celery
3. Déclencher manuellement: `calculate_virality_score_task.delay(post_id)`

### Pagination ne fonctionne pas
1. Vérifier que `last_seen_score` est le score du DERNIER post vu
2. Vérifier l'ordre de tri (DESC)
3. Vérifier que l'index existe: `idx_posts_feed_query`

---

## Documentation Complète

- 📖 **GUIDE_SOCIAL_FEED_SYSTEM.md** - Guide détaillé
- 🏗️ **ARCHITECTURE_SOCIAL_FEED.md** - Architecture & diagrammes
- 📦 **README_SOCIAL_FEED_DELIVERY.md** - Résumé de livraison
- 🔧 **API Docs** - http://localhost:8000/api/docs

---

## Commandes Utiles

```bash
# Appliquer la migration
psql -U user -d db -f database/add_social_feed_system.sql

# Charger les données de test
psql -U user -d db -f database/seed_social_feed.sql

# Tester le système
./test_social_feed.sh

# Installer tout d'un coup
./install_social_feed.sh

# Vérifier les posts récents
psql -U user -d db -c "
  SELECT content, virality_score, virality_level, 
         EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS age_hours
  FROM posts 
  ORDER BY created_at DESC 
  LIMIT 10;
"

# Vérifier les tags tendances
psql -U user -d db -c "
  SELECT name, trend_score 
  FROM tags 
  ORDER BY trend_score DESC 
  LIMIT 10;
"
```

---

**Fait avec ❤️ - Version 1.0.0 - 2025-12-02**
