# 🎯 Unified Feed - Guide Complet

## 📋 Objectif

Implémenter un **feed polymorphique "Anti-Bruit"** qui mélange intelligemment **Clusters** et **Notes** triés par **dernière activité**.

**Principe :** Seul le contenu pertinent apparaît :
- **Clusters actifs** (mis à jour dans les dernières 48h)
- **Notes orphelines** (pas encore clustérisées)
- **Mes notes** (exception personnelle)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED FEED LOGIC                           │
└─────────────────────────────────────────────────────────────────┘

  GET /api/feed/unified
  │
  ├─ Call: get_unified_feed(org_id, user_id, limit)
  │
  ▼
  UNION ALL
  ├─ PARTIE A: CLUSTERS (48h actifs)
  │  ├─ WHERE last_updated_at > NOW() - 48h
  │  ├─ sort_date = last_updated_at
  │  └─ type = 'CLUSTER'
  │
  └─ PARTIE B: NOTES (orphelines + mes notes)
     ├─ WHERE cluster_id IS NULL OR user_id = current_user
     ├─ sort_date = COALESCE(processed_at, created_at)
     └─ type = 'NOTE'
  │
  ▼
  ORDER BY sort_date DESC
  │
  └─ Retourne: List[ClusterFeedItem | NoteFeedItem]
```

---

## 📊 Logique "Anti-Bruit"

### **Problème Résolu**

Sans filtre, le feed serait pollué par :
- ❌ Vieux clusters inactifs (6 mois sans nouvelle note)
- ❌ Notes déjà clustérisées (doublon avec le cluster)
- ❌ Trop de contenu non pertinent

### **Solution Implémentée**

#### **Pour les Clusters :**
```sql
WHERE last_updated_at > NOW() - INTERVAL '48 hours'
```
✅ Seuls les clusters **actifs récemment** apparaissent  
✅ Un cluster remonte quand il reçoit une nouvelle note

#### **Pour les Notes :**
```sql
WHERE (
  cluster_id IS NULL          -- Notes orphelines
  OR user_id = current_user   -- Exception: Mes notes
)
```
✅ Notes orphelines visibles (en attente de clustering)  
✅ Mes notes toujours visibles (même si clustérisées)

---

## 🔄 Tri par Dernière Activité

### **Clusters**
```sql
sort_date = last_updated_at
```
**Comportement :**
- Cluster créé : `last_updated_at` = création
- Note ajoutée au cluster : `last_updated_at` mis à jour
- **Résultat :** Cluster "re-buzze" quand il reçoit du contenu

### **Notes**
```sql
sort_date = COALESCE(processed_at, created_at)
```
**Comportement :**
- Note créée : `sort_date` = `created_at`
- Note traitée par IA : `sort_date` = `processed_at`
- **Résultat :** Note remonte après traitement IA

---

## 📦 Modèles Pydantic (Polymorphisme)

### **ClusterFeedItem**
```python
class ClusterFeedItem(BaseModel):
    type: Literal["CLUSTER"] = "CLUSTER"
    id: str
    title: str
    note_count: int
    velocity_score: float
    pillar_id: Optional[str]
    pillar_name: Optional[str]
    pillar_color: Optional[str]
    created_at: datetime
    last_updated_at: datetime
    preview_notes: List[dict]  # 3 dernières notes
    sort_date: datetime
```

### **NoteFeedItem**
```python
class NoteFeedItem(BaseModel):
    type: Literal["NOTE"] = "NOTE"
    id: str
    content: str
    status: str
    cluster_id: Optional[str]
    pillar_id: Optional[str]
    pillar_name: Optional[str]
    pillar_color: Optional[str]
    user_id: str
    is_mine: bool  # True si c'est ma note
    created_at: datetime
    processed_at: Optional[datetime]
    sort_date: datetime
```

### **Union Discriminée**
```python
FeedItem = Union[ClusterFeedItem, NoteFeedItem]

class UnifiedFeedResponse(BaseModel):
    items: List[FeedItem]
    total_count: int
    stats: dict
```

---

## 🎨 Exemple de Réponse

```json
{
  "items": [
    {
      "type": "CLUSTER",
      "id": "cluster-uuid-1",
      "title": "Amélioration UX",
      "note_count": 5,
      "velocity_score": 0.8,
      "pillar_name": "Innovation",
      "pillar_color": "#8b5cf6",
      "last_updated_at": "2025-12-02T19:00:00Z",
      "preview_notes": [
        {
          "id": "note-uuid-1",
          "content": "Ajouter un dark mode",
          "created_at": "2025-12-02T18:50:00Z"
        },
        {
          "id": "note-uuid-2",
          "content": "Améliorer la navigation",
          "created_at": "2025-12-02T18:30:00Z"
        }
      ],
      "sort_date": "2025-12-02T19:00:00Z"
    },
    {
      "type": "NOTE",
      "id": "note-uuid-3",
      "content": "Implémenter des notifications push",
      "status": "pending",
      "cluster_id": null,
      "is_mine": true,
      "created_at": "2025-12-02T18:45:00Z",
      "sort_date": "2025-12-02T18:45:00Z"
    },
    {
      "type": "NOTE",
      "id": "note-uuid-4",
      "content": "Optimiser les performances de la base de données",
      "status": "processed",
      "cluster_id": null,
      "pillar_name": "Infrastructure",
      "pillar_color": "#10b981",
      "is_mine": false,
      "processed_at": "2025-12-02T18:20:00Z",
      "sort_date": "2025-12-02T18:20:00Z"
    }
  ],
  "total_count": 3,
  "stats": {
    "orphan_notes_count": 12,
    "clustered_notes_count": 45,
    "active_clusters_count": 8,
    "last_note_at": "2025-12-02T19:00:00Z"
  }
}
```

---

## 🎯 Affichage Frontend

### **Distinction Visuelle**

```jsx
function UnifiedFeedItem({ item }) {
  if (item.type === 'CLUSTER') {
    return (
      <ClusterCard
        title={item.title}
        noteCount={item.note_count}
        pillarColor={item.pillar_color}
        previewNotes={item.preview_notes}
        lastUpdated={item.last_updated_at}
      />
    );
  } else if (item.type === 'NOTE') {
    return (
      <NoteCard
        content={item.content}
        status={item.status}
        isMine={item.is_mine}
        pillarColor={item.pillar_color}
        createdAt={item.created_at}
      />
    );
  }
}
```

### **Exemple de Rendu**

```
┌────────────────────────────────────────────────────────┐
│ 📦 CLUSTER: Amélioration UX                           │
│ ────────────────────────────────────────────────────── │
│ 💡 Innovation | 5 notes | Velocity: 0.8               │
│                                                        │
│ Aperçu:                                               │
│ • Ajouter un dark mode                                │
│ • Améliorer la navigation                             │
│ • Refonte du menu principal                           │
│                                                        │
│ Mis à jour: il y a 2h                                 │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ 📝 NOTE (Orpheline)                                    │
│ ────────────────────────────────────────────────────── │
│ Implémenter des notifications push                    │
│                                                        │
│ 🏷️ Mes Notes | ⏳ En attente de traitement           │
│ Créée: il y a 3h                                      │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ 📝 NOTE (Orpheline)                                    │
│ ────────────────────────────────────────────────────── │
│ Optimiser les performances de la base de données      │
│                                                        │
│ 💡 Infrastructure | ✅ Traitée                        │
│ Traitée: il y a 4h                                    │
└────────────────────────────────────────────────────────┘
```

---

## 🧪 Tests

### **Test 1 : Feed Basique**

```bash
curl http://localhost:8000/api/feed/unified?limit=20 \
  -H "Authorization: Bearer $TOKEN"
```

**Résultat attendu :**
- Mélange de clusters et notes
- Trié par `sort_date` DESC
- Uniquement contenu pertinent

### **Test 2 : Stats**

```bash
curl http://localhost:8000/api/feed/unified/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Résultat :**
```json
{
  "orphan_notes_count": 12,
  "clustered_notes_count": 45,
  "active_clusters_count": 8,
  "last_note_at": "2025-12-02T19:00:00Z"
}
```

### **Test 3 : Détails d'un Item**

```bash
# Cluster
curl http://localhost:8000/api/feed/unified/cluster/{cluster_id} \
  -H "Authorization: Bearer $TOKEN"

# Note
curl http://localhost:8000/api/feed/unified/note/{note_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Scénarios d'Utilisation

### **Scénario 1 : Nouveau Cluster Actif**

```
1. User A soumet une note "Ajouter dark mode"
2. IA crée un nouveau cluster "Amélioration UX"
3. Cluster apparaît dans le feed (last_updated_at = NOW())
4. User B soumet "Améliorer navigation"
5. Note ajoutée au cluster
6. Cluster remonte en haut (last_updated_at mis à jour)
```

**Résultat :** Cluster toujours en haut tant qu'il reçoit du contenu

### **Scénario 2 : Note Orpheline**

```
1. User C soumet "Implémenter notifications"
2. IA ne trouve pas de cluster correspondant
3. Note reste orpheline (cluster_id = NULL)
4. Note apparaît dans le feed
5. Visible jusqu'à ce qu'elle soit clustérisée
```

**Résultat :** Notes orphelines visibles pour tout le monde

### **Scénario 3 : Mes Notes**

```
1. Je soumets "Idée confidentielle"
2. IA la clustérise dans "Stratégie"
3. Note disparaît du feed général (cluster_id != NULL)
4. MAIS reste visible pour moi (user_id = current_user)
```

**Résultat :** Mes notes toujours visibles même si clustérisées

### **Scénario 4 : Cluster Inactif**

```
1. Cluster "Vieille Idée" créé il y a 3 jours
2. Aucune nouvelle note depuis
3. last_updated_at > 48h
4. Cluster disparaît du feed
```

**Résultat :** Seuls les clusters actifs polluent le feed

---

## 🚀 Déploiement

### **Étape 1 : Appliquer la migration SQL**

```bash
psql -U your_user -d your_database \
  -f database/add_unified_feed.sql
```

**Contenu :**
- ✅ Fonction `get_unified_feed()`
- ✅ Indexes optimisés
- ✅ Vue `v_feed_stats`

### **Étape 2 : Le Backend est déjà à jour !**

Les fichiers sont en place :
- ✅ `backend/app/api/routes/unified_feed.py`
- ✅ `backend/main.py` (router ajouté)

### **Étape 3 : Redémarrer le serveur (si nécessaire)**

Le serveur devrait recharger automatiquement avec `--reload`.

### **Étape 4 : Vérifier**

Visitez : **http://localhost:8000/api/docs**

Vous devriez voir la section **"Unified Feed"** avec :
- ✅ `GET /api/feed/unified/`
- ✅ `GET /api/feed/unified/stats`
- ✅ `GET /api/feed/unified/{item_type}/{item_id}`

---

## 📊 Monitoring

### **Métriques SQL**

```sql
-- Distribution des items dans le feed
SELECT 
  'CLUSTER' AS type,
  COUNT(*) AS count
FROM clusters
WHERE last_updated_at > NOW() - INTERVAL '48 hours'

UNION ALL

SELECT 
  'NOTE' AS type,
  COUNT(*) AS count
FROM notes
WHERE cluster_id IS NULL;

-- Stats par organisation
SELECT * FROM v_feed_stats;
```

### **Performance**

```sql
-- Vérifier l'utilisation des indexes
EXPLAIN ANALYZE
SELECT * FROM get_unified_feed('org-uuid', 'user-uuid', 50);
```

---

## ✨ Bénéfices

### **Pour les Utilisateurs**
- ✅ **Feed pertinent** : Seul le contenu actif apparaît
- ✅ **Visibilité de mes notes** : Toujours visibles même si clustérisées
- ✅ **Découverte** : Notes orphelines des autres visibles
- ✅ **Contexte riche** : Clusters avec aperçu des notes

### **Pour l'Organisation**
- ✅ **Anti-Bruit** : Pas de pollution par vieux contenu
- ✅ **Engagement** : Contenu actif mis en avant
- ✅ **Traçabilité** : Stats claires (orphelines vs clustérisées)

### **Pour le Système**
- ✅ **Performance** : Indexes optimisés, queries rapides
- ✅ **Scalable** : UNION ALL efficace
- ✅ **Flexible** : Facile d'ajuster les filtres (48h → 72h)

---

## 🎉 Résultat Final

**Le feed unifié polymorphique est opérationnel !**

```
Clusters (actifs 48h) + Notes (orphelines + mes notes)
→ Triés par dernière activité
→ Polymorphisme Pydantic
→ Anti-Bruit automatique
```

**Développé avec ❤️ le 2025-12-02**
