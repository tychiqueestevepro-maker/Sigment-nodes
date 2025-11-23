# SIGMENT - Quick Start Guide ⚡

Bienvenue dans SIGMENT ! Ce guide vous aidera à démarrer rapidement.

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir :

- ✅ Node.js 18+ installé
- ✅ Python 3.10+ installé
- ✅ Docker Desktop installé et en cours d'exécution
- ✅ Un compte Supabase (gratuit sur https://supabase.com)
- ✅ Une clé API OpenAI (https://platform.openai.com)

## 🚀 Installation Rapide

### 1. Configuration de la base de données (Supabase)

1. **Créer un projet Supabase** :
   - Allez sur https://app.supabase.com
   - Cliquez sur "New Project"
   - Donnez-lui un nom (ex: "sigment")
   - Attendez que le projet soit prêt (~2 minutes)

2. **Activer pgvector** :
   - Dans Supabase, allez dans "SQL Editor"
   - Exécutez :
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Appliquer le schéma** :
   - Copiez tout le contenu de `database/schema.sql`
   - Collez-le dans le SQL Editor de Supabase
   - Cliquez sur "Run"

4. **Récupérer vos clés** :
   - Allez dans Settings > API
   - Notez :
     - **Project URL** (ex: `https://xxxxx.supabase.co`)
     - **anon public** key
     - **service_role** key (secret)

### 2. Configuration des variables d'environnement

Ouvrez le fichier `.env` à la racine du projet et remplissez :

```bash
# Supabase - Collez vos valeurs ici
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key

# OpenAI - Collez votre clé API
OPENAI_API_KEY=sk-votre-cle-openai

# Redis (ne pas modifier)
REDIS_URL=redis://localhost:6379/0

# API URLs (ne pas modifier pour le développement local)
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000

# Next.js - Mêmes valeurs que Supabase ci-dessus
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
```

### 3. Installation du Backend (Python)

```bash
cd backend

# Créer l'environnement virtuel
python3 -m venv venv

# Activer l'environnement
source venv/bin/activate  # Sur macOS/Linux
# OU
venv\Scripts\activate     # Sur Windows

# Installer les dépendances
pip install -r requirements.txt

cd ..
```

### 4. Installation du Frontend (Next.js)

```bash
cd frontend

# Installer les dépendances
npm install

cd ..
```

### 5. Démarrage des services

#### Option A : Script automatique (macOS/Linux uniquement)

```bash
./start.sh
```

Ce script va :
- Démarrer Redis avec Docker
- Ouvrir un terminal pour FastAPI
- Ouvrir un terminal pour Celery
- Ouvrir un terminal pour Next.js

#### Option B : Démarrage manuel (Recommandé)

**Terminal 1 - Redis :**
```bash
docker-compose up
```

**Terminal 2 - FastAPI :**
```bash
cd backend
source venv/bin/activate  # ou venv\Scripts\activate sur Windows
uvicorn main:app --reload --port 8000
```

**Terminal 3 - Celery Worker :**
```bash
cd backend
source venv/bin/activate  # ou venv\Scripts\activate sur Windows
celery -A app.workers.celery_app worker --loglevel=info
```

**Terminal 4 - Next.js :**
```bash
cd frontend
npm run dev
```

### 6. Tester l'application

1. **Ouvrez votre navigateur** : http://localhost:3000

2. **Créez votre première note** :
   - Tapez un texte (minimum 10 caractères)
   - Ex: "Nous devrions améliorer notre processus d'onboarding pour les nouveaux employés"
   - Cliquez sur "Send" ou appuyez sur Cmd/Ctrl + Enter
   - Vous devriez voir "Note saved! 🚀"

3. **Vérifiez le traitement** :
   - Allez sur "My Notes" (en haut à droite)
   - Vous verrez votre note avec le statut :
     - 🔄 **syncing** : En cours de synchronisation
     - ✅ **synced** : Synchronisée avec succès

4. **Vérifiez les logs backend** :
   - Dans le terminal Celery, vous devriez voir :
   ```
   [INFO] Processing note: xxxxx
   [INFO] AI Analysis: Pillar=Culture & HR, Score=8.5
   [INFO] ✅ Note processed successfully
   ```

## 🎯 Points d'accès

Une fois tout démarré :

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Interface utilisateur |
| **Backend API** | http://localhost:8000 | API REST |
| **API Docs** | http://localhost:8000/api/docs | Documentation interactive |
| **Health Check** | http://localhost:8000/health | Statut du backend |

## 🐛 Dépannage

### "Connection refused" sur l'API

**Problème** : Le frontend ne peut pas se connecter au backend.

**Solution** :
1. Vérifiez que FastAPI est bien démarré sur le port 8000
2. Vérifiez que `NEXT_PUBLIC_API_URL=http://localhost:8000` dans `.env`
3. Redémarrez le frontend après modification du `.env`

### "OpenAI API Error"

**Problème** : Erreur lors de l'analyse AI.

**Solution** :
1. Vérifiez votre `OPENAI_API_KEY` dans `.env`
2. Vérifiez que vous avez des crédits sur votre compte OpenAI
3. Testez votre clé : https://platform.openai.com/playground

### "Celery ne traite pas les tâches"

**Problème** : Les notes restent en statut "draft".

**Solution** :
1. Vérifiez que Redis est démarré : `docker ps`
2. Vérifiez que Celery worker est actif (terminal 3)
3. Regardez les logs Celery pour les erreurs

### "Notes not syncing"

**Problème** : Les notes ne se synchronisent pas.

**Solution** :
1. Ouvrez la console du navigateur (F12)
2. Vérifiez les erreurs réseau
3. Vérifiez que `NEXT_PUBLIC_API_URL` est correct
4. Testez manuellement : http://localhost:8000/health

## 📚 Prochaines étapes

Maintenant que votre installation fonctionne :

1. **Lisez `ARCHITECTURE.md`** pour comprendre le système
2. **Explorez `SETUP.md`** pour des détails avancés
3. **Consultez l'API** : http://localhost:8000/api/docs
4. **Personnalisez les Pillars** dans Supabase (table `pillars`)

## 💡 Conseils

- **Offline Mode** : Essayez de désactiver votre WiFi, créer une note, puis réactiver. La note se synchronisera automatiquement !
- **Dashboard** : Le dashboard board/admin est prévu pour la prochaine phase
- **Time-Lapse** : La fonctionnalité time-lapse sera ajoutée une fois plusieurs snapshots créés

## 🆘 Besoin d'aide ?

Si vous rencontrez des problèmes :

1. Vérifiez tous les terminaux pour les messages d'erreur
2. Consultez la console du navigateur (F12)
3. Vérifiez votre fichier `.env`
4. Assurez-vous que tous les services sont démarrés

## ✨ Fonctionnalités clés

- ✅ **Fire & Forget** : Saisissez et oubliez, l'IA s'occupe du reste
- ✅ **Offline-First** : Fonctionne sans connexion internet
- ✅ **AI Analysis** : Classification automatique et scoring contextuel
- ✅ **Vector Clustering** : Regroupement intelligent des idées similaires
- ✅ **Real-time Tracking** : Suivez le statut de vos notes en temps réel

Bon développement ! 🚀

