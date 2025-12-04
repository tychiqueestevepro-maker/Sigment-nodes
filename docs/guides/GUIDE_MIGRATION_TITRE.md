# 🚀 GUIDE D'APPLICATION DES MIGRATIONS

## ⚠️ ÉTAT ACTUEL

**Problème identifié** : Le champ `title_clarified` n'existe pas dans la base de données.

**Erreur** : `column notes.title_clarified does not exist`

## ✅ SOLUTION : Appliquer les Migrations SQL

### Étape 1 : Ajouter le champ title_clarified

1. Ouvrez [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor** (dans le menu de gauche)
4. Créez une nouvelle requête
5. Copiez-collez le contenu du fichier `database/add_title_clarified.sql` :

```sql
-- Migration: Add title_clarified field to notes table
-- This field will store the AI-generated title for each note

-- Add the column
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS title_clarified VARCHAR(255);

-- Add comment
COMMENT ON COLUMN notes.title_clarified IS 'AI-generated short title for the note (max 10 words)';

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title_clarified);

-- Verification
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'notes' AND column_name = 'title_clarified';
```

6. Cliquez sur **Run** (ou Ctrl+Enter)
7. Vérifiez que la requête s'exécute sans erreur

### Étape 2 : Mettre à jour la fonction get_unified_feed

1. Toujours dans **SQL Editor**
2. Créez une nouvelle requête
3. Copiez-collez le contenu du fichier `database/add_unified_feed.sql`
4. Cliquez sur **Run**
5. Vérifiez que la fonction est mise à jour

### Étape 3 : Redémarrer le Worker Celery

Le worker Celery doit être redémarré pour prendre en compte les changements dans le code :

1. Trouvez le terminal où Celery tourne
2. Appuyez sur **Ctrl+C** pour l'arrêter
3. Relancez-le avec :
   ```bash
   cd backend
   source venv/bin/activate
   celery -A app.workers.celery_app worker --loglevel=info
   ```

### Étape 4 : Vérifier que tout fonctionne

Exécutez le script de vérification :

```bash
python3 debug_feed.py
```

**Résultat attendu** :
- ✅ Aucune erreur sur `title_clarified`
- ✅ Les notes affichent leur titre (ou "⚠️ NO TITLE" pour les anciennes)

## 🧪 TEST

### Soumettre une nouvelle idée

1. Allez sur l'application frontend
2. Soumettez une nouvelle idée via le formulaire
3. Attendez 5-10 secondes (traitement IA)
4. Vérifiez dans le feed que :
   - ✅ Le titre AI-généré s'affiche
   - ✅ Le contenu clarified s'affiche en dessous
   - ✅ Pas de "Untitled Idea"

### Vérifier dans la base de données

```sql
-- Voir les notes avec titre
SELECT id, title_clarified, content_clarified, status, created_at
FROM notes
WHERE title_clarified IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

## 📝 NOTES IMPORTANTES

### Pour les notes existantes

Les notes qui ont été traitées **AVANT** l'ajout du champ `title_clarified` :
- ❌ N'auront **PAS** de titre
- ⚠️ Afficheront "Untitled Idea" dans le feed
- 💡 Continueront à fonctionner normalement

### Pour les nouvelles notes

Toutes les notes soumises **APRÈS** l'application de la migration :
- ✅ Auront un titre AI-généré
- ✅ S'afficheront correctement dans le feed
- ✅ S'afficheront correctement dans le Track Queue

## ⚡ COMMANDES RAPIDES

```bash
# Vérifier l'état actuel
python3 debug_feed.py

# Redémarrer Celery Worker
# (Dans le terminal Celery : Ctrl+C puis)
cd backend && source venv/bin/activate && celery -A app.workers.celery_app worker --loglevel=info
```

## 🎯 CHECKLIST

- [ ] Migration SQL `add_title_clarified.sql` appliquée
- [ ] Migration SQL `add_unified_feed.sql` appliquée
- [ ] Worker Celery redémarré
- [ ] Script `debug_feed.py` exécuté sans erreur
- [ ] Nouvelle idée soumise et testée
- [ ] Titre AI-généré visible dans le feed

---

**Une fois toutes ces étapes complétées, le système sera pleinement opérationnel ! 🚀**
