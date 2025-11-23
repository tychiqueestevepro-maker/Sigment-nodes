# SIGMENT Project Structure

```
sigment/
│
├── backend/                        # Python FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── api/                   # API Routes
│   │   │   ├── __init__.py
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── notes.py       # Notes endpoints
│   │   │       ├── clusters.py    # Clusters endpoints
│   │   │       ├── pillars.py     # Pillars endpoints
│   │   │       └── users.py       # Users endpoints
│   │   │
│   │   ├── core/                  # Core Configuration
│   │   │   ├── __init__.py
│   │   │   └── config.py          # Settings & env vars
│   │   │
│   │   ├── models/                # Pydantic Models
│   │   │   ├── __init__.py
│   │   │   └── note.py            # Note models
│   │   │
│   │   ├── services/              # Business Logic
│   │   │   ├── __init__.py
│   │   │   ├── ai_service.py      # OpenAI integration
│   │   │   └── supabase_client.py # Supabase client
│   │   │
│   │   └── workers/               # Celery Tasks
│   │       ├── __init__.py
│   │       ├── celery_app.py      # Celery config
│   │       └── tasks.py           # Background tasks
│   │
│   ├── main.py                    # FastAPI entry point
│   ├── requirements.txt           # Python dependencies
│   └── venv/                      # Virtual environment (git-ignored)
│
├── frontend/                      # Next.js Frontend
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page (Fire & Forget)
│   │   ├── providers.tsx         # React Query provider
│   │   ├── globals.css           # Global styles
│   │   └── tracker/              # My Notes page
│   │       └── page.tsx
│   │
│   ├── components/                # React Components
│   │   └── FireAndForgetInput.tsx # Main input component
│   │
│   ├── lib/                       # Utilities & Config
│   │   ├── db.ts                 # Dexie.js (IndexedDB)
│   │   ├── api.ts                # API client
│   │   ├── sync.ts               # Offline sync manager
│   │   └── supabase.ts           # Supabase client
│   │
│   ├── public/                    # Static assets
│   │   └── manifest.json         # PWA manifest
│   │
│   ├── package.json               # Node dependencies
│   ├── tsconfig.json              # TypeScript config
│   ├── tailwind.config.ts         # Tailwind CSS config
│   ├── postcss.config.js          # PostCSS config
│   ├── next.config.js             # Next.js config
│   └── .eslintrc.json            # ESLint config
│
├── database/                      # Database Setup
│   └── schema.sql                # PostgreSQL schema with pgvector
│
├── lib/                           # Legacy files (from initial setup)
│   ├── index.ts
│   └── supabase.ts
│
├── .env                           # Environment variables (git-ignored)
├── .env.example                   # Template for .env
├── .gitignore                     # Git ignore rules
├── docker-compose.yml             # Docker services (Redis)
├── package.json                   # Root package.json
├── tsconfig.json                  # Root TypeScript config
│
├── README.md                      # Project overview
├── QUICKSTART.md                  # ⚡ Quick start guide
├── SETUP.md                       # 📚 Detailed setup instructions
├── ARCHITECTURE.md                # 🏗️ Architecture documentation
├── PROJECT_STRUCTURE.md           # 📁 This file
│
└── start.sh                       # Quick start script (macOS/Linux)

```

## 📂 Key Directories Explained

### Backend (`backend/`)

**Purpose**: Python FastAPI backend with AI processing pipeline.

- **`app/api/routes/`**: RESTful API endpoints for notes, clusters, pillars, users
- **`app/services/`**: Business logic separated from routes
  - `ai_service.py`: All OpenAI interactions (GPT-4o, embeddings)
  - `supabase_client.py`: Database access layer
- **`app/workers/`**: Celery tasks for async processing
  - `tasks.py`: Note processing, cluster synthesis, moderation
- **`app/core/`**: Configuration and settings management
- **`app/models/`**: Pydantic models for request/response validation

### Frontend (`frontend/`)

**Purpose**: Next.js 14 (App Router) with offline-first architecture.

- **`app/`**: Next.js pages using App Router
  - `page.tsx`: Home page with Fire & Forget input
  - `tracker/page.tsx`: My Notes tracker
  - `providers.tsx`: React Query + Toaster setup
- **`components/`**: Reusable React components
  - `FireAndForgetInput.tsx`: Main note input with success animation
- **`lib/`**: Core utilities
  - `db.ts`: Dexie.js IndexedDB schema
  - `sync.ts`: Offline sync manager (auto-sync every 30s)
  - `api.ts`: Type-safe API client
  - `supabase.ts`: Supabase client for auth (future)

### Database (`database/`)

**Purpose**: SQL schema for PostgreSQL + pgvector.

- **`schema.sql`**: Complete database schema with:
  - Users, Pillars, Notes, Clusters tables
  - `cluster_snapshots` for time-lapse feature
  - Vector similarity functions
  - Triggers for metadata updates

## 🔑 Critical Files

| File | Purpose | Notes |
|------|---------|-------|
| `backend/main.py` | FastAPI entry point | Includes all routers |
| `backend/app/workers/tasks.py` | AI processing pipeline | Core business logic |
| `backend/app/services/ai_service.py` | OpenAI integration | GPT-4o + embeddings |
| `frontend/lib/db.ts` | IndexedDB schema | Offline-first storage |
| `frontend/lib/sync.ts` | Sync manager | Auto-sync mechanism |
| `frontend/components/FireAndForgetInput.tsx` | Main UI component | Fire & Forget UX |
| `database/schema.sql` | Database schema | Apply to Supabase |
| `.env` | Environment variables | ⚠️ Never commit! |

## 🚀 Entry Points

### Development

```bash
# Backend API
cd backend && uvicorn main:app --reload

# Celery Worker
cd backend && celery -A app.workers.celery_app worker --loglevel=info

# Frontend
cd frontend && npm run dev

# Redis
docker-compose up
```

### Production

- **Frontend**: Deploy to Vercel
- **Backend**: Deploy to Render.com (Web Service + Worker)
- **Database**: Supabase (already hosted)
- **Redis**: Upstash or Render Redis

## 📦 Dependencies

### Backend (Python)

- **FastAPI**: Web framework
- **Celery**: Async task queue
- **OpenAI**: AI analysis & embeddings
- **Supabase**: Database client
- **pgvector**: Vector similarity

### Frontend (Node.js)

- **Next.js 14**: React framework
- **TanStack Query**: Data fetching
- **Dexie.js**: IndexedDB wrapper
- **Framer Motion**: Animations
- **TailwindCSS**: Styling
- **React Hot Toast**: Notifications

## 🔄 Data Flow

```
User Input (Frontend)
    ↓
IndexedDB (Dexie) - Local Storage
    ↓
Sync Manager - Auto Background Sync
    ↓
FastAPI Backend - REST API
    ↓
Celery Task Queue - Async Processing
    ↓
OpenAI API - AI Analysis
    ↓
PostgreSQL + pgvector - Persistent Storage
    ↓
Cluster Snapshots - Historical Records
```

## 📝 Notes

- **Legacy `lib/` folder**: Contains initial Supabase connection files, kept for reference
- **`.next/` folder**: Next.js build output (git-ignored)
- **`venv/` folder**: Python virtual environment (git-ignored)
- **`node_modules/` folders**: NPM dependencies (git-ignored)

## 🔐 Security

- `.env` file is **git-ignored** by default
- Never commit API keys or secrets
- Use `.env.example` as template

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview and features |
| `QUICKSTART.md` | Fast setup guide (5-10 minutes) |
| `SETUP.md` | Detailed installation steps |
| `ARCHITECTURE.md` | System design and data flow |
| `PROJECT_STRUCTURE.md` | This file - directory layout |

---

**Last Updated**: November 23, 2025

