# 🎯 TODO - Prochaines Étapes pour Démarrer SIGMENT

## ✅ Ce qui est Déjà Fait

Félicitations ! La structure complète du projet SIGMENT est en place :

- ✅ **Backend Python** : FastAPI + Celery + AI Service complet
- ✅ **Frontend Next.js** : Interface Fire & Forget + Tracker
- ✅ **Base de données** : Schéma PostgreSQL avec pgvector
- ✅ **Offline-first** : Dexie.js avec auto-sync
- ✅ **Documentation** : README, QUICKSTART, SETUP, ARCHITECTURE
- ✅ **Configuration** : Docker Compose, scripts de démarrage

## 🚀 Actions Immédiates (Aujourd'hui)

### 1. ⚙️ Configuration des Credentials (5 minutes)

**Fichier** : `.env` (à la racine)

```bash
# 1. Créer un projet Supabase (gratuit)
# → https://app.supabase.com
# → New Project → Attendre 2 minutes

# 2. Récupérer les clés Supabase
# → Settings > API
# → Copier : Project URL, anon key, service_role key

# 3. Obtenir une clé OpenAI
# → https://platform.openai.com/api-keys
# → Create new secret key

# 4. Remplir le fichier .env
nano .env  # ou ouvrir avec votre éditeur
```

**Exemple de .env complet** :
```env
SUPABASE_URL=https://abcdefghijk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-proj-...
REDIS_URL=redis://localhost:6379/0
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. 🗄️ Initialiser la Base de Données (2 minutes)

**Dans Supabase** :

```bash
# Option A : Via SQL Editor (Recommandé)
1. Aller sur https://app.supabase.com
2. Sélectionner votre projet
3. SQL Editor (menu gauche)
4. Copier TOUT le contenu de database/schema.sql
5. Coller dans l'éditeur
6. Cliquer "Run"
7. Vérifier : "Success. No rows returned"
```

**Option B : Via psql (Alternative)** :
```bash
# Récupérer la connection string depuis Supabase
# Settings > Database > Connection string (Direct connection)
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" -f database/schema.sql
```

**Vérification** :
- Allez dans "Table Editor" sur Supabase
- Vous devriez voir : `users`, `pillars`, `notes`, `clusters`, `cluster_snapshots`
- La table `pillars` devrait contenir 5 lignes (ESG, Innovation, etc.)

### 3. 🐍 Installation Backend (5 minutes)

```bash
cd backend

# Créer l'environnement virtuel
python3 -m venv venv

# Activer (macOS/Linux)
source venv/bin/activate

# OU Activer (Windows)
venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Vérifier l'installation
python -c "import fastapi; import celery; import openai; print('✅ Backend OK')"

cd ..
```

### 4. ⚛️ Installation Frontend (3 minutes)

```bash
cd frontend

# Installer les dépendances
npm install

# Vérifier l'installation
npm run build  # Devrait se terminer sans erreur

cd ..
```

### 5. 🚀 Premier Démarrage (Test)

**Terminal 1 - Redis** :
```bash
docker-compose up
# Attendre : "Ready to accept connections"
```

**Terminal 2 - Backend API** :
```bash
cd backend
source venv/bin/activate  # ou venv\Scripts\activate sur Windows
uvicorn main:app --reload --port 8000

# Vous devriez voir :
# INFO:     Application startup complete.
# INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Tester le backend** :
```bash
# Dans un nouveau terminal
curl http://localhost:8000/health

# Réponse attendue :
# {"status":"healthy","database":"connected","redis":"connected"}
```

**Terminal 3 - Celery Worker** :
```bash
cd backend
source venv/bin/activate
celery -A app.workers.celery_app worker --loglevel=info

# Vous devriez voir :
# [INFO/MainProcess] Connected to redis://localhost:6379/0
# [INFO/MainProcess] celery@... ready.
```

**Terminal 4 - Frontend** :
```bash
cd frontend
npm run dev

# Vous devriez voir :
# ▲ Next.js 14.x.x
# - Local:        http://localhost:3000
```

**Test Complet** :
1. Ouvrir http://localhost:3000
2. Taper une note : "Nous devrions améliorer notre onboarding"
3. Cliquer "Send"
4. ✅ Toast "Note saved! 🚀"
5. Vérifier dans Terminal 3 (Celery) : Logs de traitement AI
6. Aller sur "My Notes" : Voir le statut de la note

---

## 📋 Checklist de Vérification

Avant de continuer, vérifiez que tout fonctionne :

- [x ] `.env` rempli avec toutes les clés
- [x ] Supabase database contient les tables
- [x ] `docker ps` montre Redis en cours d'exécution
- [x ] Backend répond sur http://localhost:8000/health
- [x ] Celery worker affiche "ready"
- [ x] Frontend affiche la page sur http://localhost:3000
- [x ] Création d'une note fonctionne
- [ x] Logs Celery montrent le traitement AI
- [ x] Note apparaît dans "My Notes" avec statut "synced"

---

## 🐛 Dépannage Rapide

### Problème : "Module not found" (Python)

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt --force-reinstall
```

### Problème : "Cannot connect to Supabase"

```bash
# Vérifier les variables dans .env
cat .env | grep SUPABASE

# Tester la connexion
curl https://[YOUR-PROJECT].supabase.co/rest/v1/
```

### Problème : "OpenAI API Error"

```bash
# Vérifier votre clé
cat .env | grep OPENAI

# Tester sur OpenAI Playground
# https://platform.openai.com/playground
```

### Problème : "Redis connection refused"

```bash
# Vérifier Docker
docker ps

# Redémarrer Redis
docker-compose down
docker-compose up -d
```

---

## 🎨 Prochaines Fonctionnalités à Développer

Une fois que tout fonctionne, vous pouvez développer :

### A. Dashboard Board (Priorité Haute)

**Fichier** : `frontend/app/dashboard/page.tsx`

Créer :
- [ x] Vue Galaxy (bulles de clusters)
- [ x] Filtres par Pillar
- [ ] Détail d'un cluster au clic
- [ ] Time-lapse slider

**Composants** :
- `components/GalaxyView.tsx`
- `components/ClusterDetail.tsx`
- `components/TimelapseSlider.tsx`

### B. Admin Panel (Modération)

**Fichier** : `frontend/app/admin/page.tsx`

Créer :
- [ ] Liste de toutes les notes
- [ ] Bouton "Refuse" pour modération
- [ ] Statistiques globales
- [ ] Gestion des Pillars

### C. Authentification

**Backend** :
- [ ] Middleware d'authentification
- [ ] JWT token validation
- [ ] Protected routes

**Frontend** :
- [ ] Page de login (Supabase Auth)
- [ ] Context utilisateur
- [ ] Protected pages

### D. Notifications Real-time

**Backend** :
- [ ] WebSocket avec FastAPI
- [ ] Events Celery → WebSocket

**Frontend** :
- [ ] WebSocket client
- [ ] Live updates dashboard

---

## 📚 Ressources Utiles

### Documentation Externe

- **Supabase Docs** : https://supabase.com/docs
- **OpenAI API Reference** : https://platform.openai.com/docs
- **FastAPI Tutorial** : https://fastapi.tiangolo.com/tutorial/
- **Next.js Docs** : https://nextjs.org/docs
- **Celery Guide** : https://docs.celeryq.dev/en/stable/

### Fichiers du Projet

- **Architecture** : `ARCHITECTURE.md`
- **Setup Détaillé** : `SETUP.md`
- **Quick Start** : `QUICKSTART.md`
- **Structure** : `PROJECT_STRUCTURE.md`

---

## 🎯 Objectifs Cette Semaine

### Jour 1-2 : Setup & Test
- [ x] Configurer tous les services
- [x ] Tester le flow complet
- [ x] Créer 10-20 notes de test

### Jour 3-4 : Dashboard
- [ ] Créer la page dashboard
- [ ] Afficher les clusters
- [ ] Ajouter les filtres

### Jour 5 : Polish & Deploy
- [ ] Corriger les bugs
- [ ] Améliorer l'UI
- [ ] Préparer le déploiement

---

## 💡 Conseils Pro

1. **Commencez Simple** : Testez d'abord avec le flow complet avant d'ajouter des features
2. **Regardez les Logs** : Celery worker montre tout le pipeline AI
3. **Testez Offline** : Désactivez WiFi, créez une note, réactivez → Auto-sync magic
4. **Utilisez l'API Docs** : http://localhost:8000/api/docs pour tester les endpoints
5. **Inspectez Supabase** : Table Editor pour voir les données en temps réel

---

## 🚀 Prêt à Démarrer ?

```bash
# Script de démarrage rapide (macOS/Linux)
./start.sh

# OU Démarrage manuel (Windows/Linux/macOS)
# Terminal 1
docker-compose up

# Terminal 2
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Terminal 3
cd backend && source venv/bin/activate && celery -A app.workers.celery_app worker --loglevel=info

# Terminal 4
cd frontend && npm run dev
```

**Puis ouvrez** : http://localhost:3000

---

Bon développement ! 🎉

Si vous rencontrez des problèmes, consultez `SETUP.md` pour plus de détails.

