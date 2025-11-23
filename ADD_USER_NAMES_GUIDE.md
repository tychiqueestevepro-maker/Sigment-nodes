# 👤 Guide: Ajout Nom et Prénom aux Utilisateurs

## 🎯 Objectif

Afficher le **nom complet** des auteurs dans les rapports de la Time Machine, en plus du job title et département.

---

## ✅ Modifications Effectuées

### 1. Base de Données (Supabase) ✅

**Fichier**: `database/add_user_names.sql`

**Changements**:
- Ajout de 2 colonnes à la table `users`:
  - `first_name` (VARCHAR 100)
  - `last_name` (VARCHAR 100)
- Mise à jour des utilisateurs existants avec des noms

**Migration à Exécuter**:
```sql
-- Dans Supabase SQL Editor
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
```

---

### 2. Backend API ✅

**Fichier**: `backend/app/api/routes/board.py`

**Changements**:
- Ligne 173: Ajout de `first_name, last_name` dans la requête Supabase
- Lignes 180-192: Construction du nom complet et ajout au champ `author.name`

**Avant**:
```python
users(job_title, department)
```

**Après**:
```python
users(first_name, last_name, job_title, department)
```

**Objet retourné** (nouvelles données):
```json
{
  "author": {
    "name": "John Doe",          // ← NOUVEAU
    "job_title": "Product Manager",
    "department": "Product"
  }
}
```

---

### 3. Frontend (TypeScript) ✅

**Fichier**: `frontend/app/dashboard/cluster/[id]/page.tsx`

**Changements**:
1. **Interface TypeScript** (ligne 14):
   ```typescript
   interface Evidence {
     author: {
       name: string;        // ← NOUVEAU
       job_title: string;
       department: string;
     };
   }
   ```

2. **Affichage** (lignes 190-206):
   - **Avant**: Job title en premier, puis département
   - **Après**: Nom en gros (blanc), puis job + département en petit

**Design de la carte Evidence**:
```
┌────────────────────────────────────────┐
│ "The parking is always full"           │
│                                        │
│ John Doe                    Impact: 6/10│
│ Product Manager • Product             │
└────────────────────────────────────────┘
```

---

## 🚀 Étapes d'Installation

### Étape 1: Migrer la Base de Données

**Allez dans Supabase SQL Editor**:
```
https://app.supabase.com/project/YOUR-PROJECT/sql
```

**Copiez et exécutez** le contenu de `database/add_user_names.sql`:
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

UPDATE users 
SET first_name = 'John', last_name = 'Doe'
WHERE id = 'f8a49ff4-2605-42a4-a920-ec989ac75b32';
```

**Vérifiez** que ça a fonctionné:
```sql
SELECT id, email, first_name, last_name, job_title, department 
FROM users;
```

---

### Étape 2: Redémarrer le Backend

Le backend détectera automatiquement le changement avec `uvicorn --reload`:

```bash
# Si le backend tourne déjà, il se recharge automatiquement
# Sinon, démarrez-le:
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

**Vérifiez** que le backend retourne le nom:
```bash
curl -s http://localhost:8000/api/v1/board/cluster/YOUR-CLUSTER-ID/history | jq '.snapshots[0].evidence[0].author'
```

**Résultat attendu**:
```json
{
  "name": "John Doe",
  "job_title": "Product Manager",
  "department": "Product"
}
```

---

### Étape 3: Rafraîchir le Frontend

Le frontend Next.js se recharge automatiquement en mode dev.

**Si nécessaire**, rafraîchissez votre navigateur avec `Cmd+Shift+R` (Mac) ou `Ctrl+Shift+R` (PC).

---

## 🧪 Test Complet

### 1. Créez une Note

Allez sur **http://localhost:3000** et créez une note:
```
"We need better coffee in the break room"
```

### 2. Attendez le Traitement

Surveillez les logs Celery (terminal):
```
✅ Note processed successfully
✅ Snapshot created for cluster
```

### 3. Ouvrez le Dashboard

Allez sur **http://localhost:3000/dashboard**

### 4. Cliquez sur un Cluster

Dans la liste "Top Priorities", cliquez sur n'importe quel cluster.

### 5. Vérifiez l'Affichage

Dans la section "Evidence", vous devriez voir:

```
┌─────────────────────────────────────────────────┐
│ "We need better coffee in the break room"      │
│                                                 │
│ John Doe                         Impact: 7/10  │
│ Product Manager • Product                      │
└─────────────────────────────────────────────────┘
```

**Avant** (sans nom):
- Product Manager • Product (pas de nom personnel)

**Après** (avec nom):
- **John Doe** (en blanc, gros)
- Product Manager • Product (en gris, petit)

---

## 🎨 Design Details

### Hiérarchie Visuelle

**Nom de l'auteur** (le plus important):
- Couleur: Blanc (`text-white`)
- Taille: Normal (`font-semibold`)
- Position: En haut

**Job Title + Département** (contexte):
- Couleur: Gris/Purple (`text-purple-400` + `text-gray-400`)
- Taille: Plus petit (`text-xs`)
- Position: En dessous
- Séparateur: Bullet point (`•`)

### Layout

```
[Nom complet]           [Impact Score]
[Job • Dept]
```

---

## 📊 Avant / Après

### AVANT
```json
{
  "author": {
    "job_title": "Product Manager",
    "department": "Product"
  }
}
```

**Affichage**:
```
Product Manager • Product          Impact: 7/10
```

---

### APRÈS
```json
{
  "author": {
    "name": "John Doe",
    "job_title": "Product Manager",
    "department": "Product"
  }
}
```

**Affichage**:
```
John Doe                           Impact: 7/10
Product Manager • Product
```

---

## 🐛 Troubleshooting

### Problème: "Anonymous" s'affiche au lieu du nom

**Cause**: La base de données n'a pas été migrée ou l'utilisateur n'a pas de nom.

**Solution**:
1. Vérifiez dans Supabase que les colonnes existent:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'users' AND column_name IN ('first_name', 'last_name');
   ```

2. Vérifiez que l'utilisateur a un nom:
   ```sql
   SELECT id, first_name, last_name FROM users 
   WHERE id = 'f8a49ff4-2605-42a4-a920-ec989ac75b32';
   ```

3. Si vide, mettez à jour:
   ```sql
   UPDATE users 
   SET first_name = 'John', last_name = 'Doe'
   WHERE id = 'f8a49ff4-2605-42a4-a920-ec989ac75b32';
   ```

---

### Problème: Backend retourne une erreur

**Erreur possible**: `column "first_name" does not exist`

**Solution**: Exécutez la migration SQL dans Supabase.

---

### Problème: Frontend ne montre pas le nom

**Cause**: Cache du navigateur ou TypeScript non recompilé.

**Solution**:
1. Hard refresh: `Cmd+Shift+R` (Mac) ou `Ctrl+Shift+R` (PC)
2. Vérifiez la console du navigateur (F12) pour des erreurs TypeScript
3. Redémarrez Next.js si nécessaire:
   ```bash
   cd frontend
   npm run dev
   ```

---

## 📝 Prochaines Étapes (Optionnel)

### 1. Rendre les Noms Obligatoires

Dans Supabase, rendez les colonnes NOT NULL:
```sql
ALTER TABLE users 
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL;
```

### 2. Ajouter une Photo de Profil

1. Ajouter colonne `avatar_url` à `users`
2. Afficher l'avatar dans les cartes Evidence
3. Utiliser Supabase Storage pour les images

### 3. Afficher le Nom dans d'Autres Vues

- Page Tracker (`/tracker`)
- Fire & Forget (confirmation "Note de John Doe enregistrée")
- Dashboard Galaxy (tooltip sur les bulles)

---

## ✅ Checklist de Vérification

- [ ] Colonnes `first_name` et `last_name` ajoutées à `users`
- [ ] Utilisateur de test mis à jour avec un nom
- [ ] Backend retourne `author.name` dans l'API
- [ ] Frontend affiche le nom en blanc (gros)
- [ ] Job title et département affichés en dessous (petit)
- [ ] Layout responsive (mobile-friendly)
- [ ] Tests effectués sur un cluster réel

---

## 🎉 Résultat Final

**Avant**: Seul le rôle professionnel était visible (impersonnel)

**Après**: L'identité complète de la personne est affichée, créant une connexion plus humaine avec les retours.

**Impact Business**:
- ✅ Meilleure traçabilité (qui a dit quoi)
- ✅ Confiance accrue (nom + contexte)
- ✅ Responsabilisation (les gens voient leur nom associé)
- ✅ Reconnaissance (les contributions sont personnalisées)

---

**Documentation créée**: November 23, 2025  
**Fichiers modifiés**: 3 (backend, frontend, database)  
**Temps d'implémentation**: ~15 minutes  
**Complexité**: ⭐⭐ Facile

---

🎯 **Votre Time Machine affiche maintenant les noms complets !**

