# Implémentation du Titre Clarified pour les Idées

## 🎯 Objectif

Afficher le **titre généré par l'IA** pour chaque idée au lieu d'extraire la première phrase du contenu. Ce titre est créé lors de l'analyse AI et stocké dans la base de données.

## 📋 Changements Appliqués

### 1. **Base de Données** (`database/add_title_clarified.sql`)

Ajout d'un nouveau champ `title_clarified` à la table `notes` :

```sql
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS title_clarified VARCHAR(255);
```

**À APPLIQUER** : Exécutez ce fichier SQL via Supabase Dashboard > SQL Editor

### 2. **Service AI** (`backend/app/services/ai_service.py`)

Modification du prompt AI pour générer un titre en plus du contenu clarified :

```python
"clarified_title": "Short, specific title capturing the core idea",
"clarified_content": "Clear, executive-friendly version",
```

**Impact** : L'IA génère maintenant un titre court (max 10 mots) pour chaque note

### 3. **Worker Celery** (`backend/app/workers/tasks.py`)

Sauvegarde du titre généré par l'IA :

```python
supabase.table("notes").update({
    "title_clarified": analysis.get("clarified_title", ""),
    "content_clarified": analysis["clarified_content"],
    ...
})
```

**Impact** : Le titre est stocké en base de données lors du traitement

### 4. **SQL Feed** (`database/add_unified_feed.sql`)

Ajout du titre dans la réponse du feed unifié :

```sql
jsonb_build_object(
    'id', n.id,
    'title', n.title_clarified,
    'content', COALESCE(n.content_clarified, n.content_raw),
    ...
)
```

**À APPLIQUER** : Exécutez ce fichier SQL via Supabase Dashboard > SQL Editor

### 5. **Types TypeScript** (`frontend/shared/types/feed.ts`)

Ajout du champ `title` dans l'interface :

```typescript
export interface NoteItem extends BaseFeedItem {
    type: 'NOTE';
    title?: string;  // ✅ Nouveau champ
    content: string;
    ...
}
```

### 6. **Composant IdeaCard** (`frontend/components/feed/cards/IdeaCard.tsx`)

Utilisation du titre de l'API au lieu de l'extraire :

```typescript
// Avant : Extraction manuelle
const extractTitle = (content: string) => { ... }

// Après : Utilisation directe
const ideaTitle = item.title || 'Untitled Idea';
```

**Impact** : Affichage propre du titre généré par l'IA

### 7. **API Notes** (`backend/app/api/routes/notes.py`)

Inclusion du `title_clarified` dans l'endpoint Track Queue :

```python
query = supabase.table("notes").select("""
    id,
    title_clarified,  # ✅ Nouveau champ
    content_raw,
    ...
""")
```

## 🚀 Étapes de Déploiement

### 1. Appliquer les Migrations SQL

```bash
# Via Supabase Dashboard > SQL Editor
# Exécuter dans l'ordre :
1. database/add_title_clarified.sql
2. database/add_unified_feed.sql
```

### 2. Redémarrer les Services

```bash
# Le backend se recharge automatiquement (--reload)
# Le frontend se recharge automatiquement (npm run dev)
# Redémarrer le worker Celery :
# Dans le terminal Celery, Ctrl+C puis relancer
```

### 3. Tester

1. Soumettre une nouvelle idée
2. Attendre le traitement (5-10 secondes)
3. Vérifier dans le feed que le titre s'affiche correctement
4. Vérifier dans le Track Queue que le titre s'affiche correctement

## 📊 Flux de Données

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Utilisateur soumet une idée                              │
│    └─> content_raw: "Create an intelligent platform..."    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Worker Celery appelle AI Service                        │
│    └─> analyze_note()                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. IA génère titre + contenu                                │
│    ├─> title_clarified: "Intelligent Customer Platform"    │
│    └─> content_clarified: "Create an intelligent..."       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Sauvegarde en base de données                            │
│    ├─> notes.title_clarified                                │
│    └─> notes.content_clarified                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Affichage dans le Feed                                   │
│    ├─> Titre: "Intelligent Customer Platform"              │
│    └─> Contenu: "Create an intelligent..." (3 lignes max)  │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Affichage Final

### IdeaCard

```
┌─────────────────────────────────────────────────────┐
│ Intelligent Customer Platform      [✨ Idea Badge]  │
│ 18 minutes ago                                      │
│                                                     │
│ Create an intelligent customer platform that       │
│ predicts needs by analyzing behaviors, provides    │
│ instant automated assistance...                     │
│                                                     │
│ ─────────────────────────────────────────────────  │
│ [Product Badge]                                     │
└─────────────────────────────────────────────────────┘
```

### Track Queue

```
┌─────────────────────────────────────────────────────┐
│ Intelligent Customer Platform                       │
│ Dec 04, 2025, 08:00                                 │
│ Product | Processed                                 │
└─────────────────────────────────────────────────────┘
```

## ⚠️ Notes Importantes

1. **Migration SQL** : Les notes existantes n'auront pas de `title_clarified`. Elles afficheront "Untitled Note" jusqu'à ce qu'elles soient retraitées.

2. **Retraitement** : Pour retraiter les notes existantes, vous pouvez :
   - Soit les soumettre à nouveau
   - Soit créer un script de migration pour appeler l'IA sur toutes les notes existantes

3. **Fallback** : Le code gère gracieusement l'absence de titre avec `item.title || 'Untitled Idea'`

## ✅ Vérification

Pour vérifier que tout fonctionne :

```sql
-- Vérifier que le champ existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notes' AND column_name = 'title_clarified';

-- Vérifier les notes avec titre
SELECT id, title_clarified, content_clarified 
FROM notes 
WHERE title_clarified IS NOT NULL 
LIMIT 5;
```

## 📁 Fichiers Modifiés

- ✅ `database/add_title_clarified.sql` (nouveau)
- ✅ `database/add_unified_feed.sql` (modifié)
- ✅ `backend/app/services/ai_service.py` (modifié)
- ✅ `backend/app/workers/tasks.py` (modifié)
- ✅ `backend/app/api/routes/notes.py` (modifié)
- ✅ `frontend/shared/types/feed.ts` (modifié)
- ✅ `frontend/components/feed/cards/IdeaCard.tsx` (modifié)
