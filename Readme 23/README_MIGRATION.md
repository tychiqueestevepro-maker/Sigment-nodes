# Instructions pour appliquer la migration Supabase

## Contexte
Cette migration ajoute deux nouveaux statuts pour les notes :
- **`review`** : Pour les notes envoyées en zone Review (bouton "Treated Notes")
- **`approved`** : Pour une validation finale ultérieure

## Étapes pour appliquer la migration

### 1. Ouvrir Supabase Dashboard
- Aller sur https://supabase.com
- Se connecter à votre projet SIGMENT

### 2. Accéder à l'éditeur SQL
- Dans le menu latéral, cliquer sur **SQL Editor**
- Créer une nouvelle requête

### 3. Copier et exécuter le script
Copier le contenu du fichier `add_review_approved_statuses.sql` et l'exécuter dans l'éditeur SQL.

**OU** si vous préférez une version simplifiée :

```sql
-- Version simplifiée : ajouter les nouveaux statuts
ALTER TYPE note_status ADD VALUE IF NOT EXISTS 'review';
ALTER TYPE note_status ADD VALUE IF NOT EXISTS 'approved';
```

### 4. Vérifier l'application
Après avoir exécuté la migration :
- Les statuts `review` et `approved` seront disponibles
- Le bouton "Treated Notes" marquera les notes comme `review`
- Le bouton "Refused" marquera les notes comme `refused`

## Alternative si ENUM n'existe pas
Si la colonne `status` est de type TEXT avec une contrainte CHECK :

```sql
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_status_check;
ALTER TABLE notes ADD CONSTRAINT notes_status_check 
    CHECK (status IN ('draft', 'processing', 'processed', 'refused', 'review', 'approved'));
```

## Vérification
Pour vérifier que les statuts ont été ajoutés :

```sql
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'note_status')
ORDER BY enumlabel;
```

Vous devriez voir : `approved`, `draft`, `processed`, `processing`, `refused`, `review`
