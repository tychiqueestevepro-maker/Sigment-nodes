# SIGMENT Architecture Documentation

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Fire & Forget   │  │     Tracker      │  │   Dashboard   │ │
│  │      Input       │  │   (My Notes)     │  │   (Galaxy)    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Offline-First Layer (Dexie.js)              │  │
│  │                    IndexedDB Storage                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/REST API
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Python FastAPI)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     API Routes                            │  │
│  │  /notes  /clusters  /pillars  /users                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Celery Task Queue (Redis)                    │  │
│  │  • process_note_task                                      │  │
│  │  • generate_cluster_snapshot_task                         │  │
│  │  • reprocess_cluster_on_moderation_task                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   AI Service Layer                        │  │
│  │  • analyze_note (GPT-4o)                                  │  │
│  │  • generate_embedding (text-embedding-3-small)            │  │
│  │  • generate_cluster_synthesis                             │  │
│  │  • generate_cluster_title                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE (PostgreSQL + pgvector)                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │   users    │  │   notes    │  │  clusters  │  │ pillars  │ │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │
│                   ┌──────────────────────────┐                  │
│                   │   cluster_snapshots      │                  │
│                   │   (Time-Lapse History)   │                  │
│                   └──────────────────────────┘                  │
│                                                                  │
│  Vector Similarity Search (pgvector)                            │
│  • 1536-dimensional embeddings                                  │
│  • Cosine similarity clustering                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow

### 1. Note Submission Flow (Employee)

```
User Types Note
    ↓
Frontend: Save to IndexedDB (Dexie)
    ↓
Frontend: Show "Note Saved" Toast (Fire & Forget UX)
    ↓
Frontend: Clear Input Immediately
    ↓
Background: Auto-sync to Backend API
    ↓
Backend: Insert Note (status='draft')
    ↓
Backend: Enqueue Celery Task (process_note_task)
    ↓
Celery Worker:
  1. Fetch Note + User Context
  2. AI Analysis (GPT-4o)
     - Clarify content
     - Assign pillar
     - Calculate relevance score (1-10)
  3. Generate Embedding (OpenAI)
  4. Vector Search for Similar Notes (pgvector)
  5. Assign to Cluster or Create New Cluster
  6. Update Note (status='processed')
  7. Trigger Cluster Snapshot Generation
```

### 2. Cluster Synthesis Flow

```
Cluster Updated (New Note Added)
    ↓
Celery: generate_cluster_snapshot_task
    ↓
Fetch All Notes in Cluster
    ↓
Generate Title (if needed) via GPT-4o
    ↓
Generate Synthesis (Executive Summary) via GPT-4o
    ↓
Calculate Metrics (Department Breakdown, Avg Score)
    ↓
Insert New Snapshot Row (Historical Record)
    ↓
Time-Lapse Feature: Compare Snapshots Over Time
```

### 3. Moderation Flow (Admin)

```
Admin Refuses Note
    ↓
Backend: Update Note (status='refused')
    ↓
Backend: Trigger reprocess_cluster_on_moderation_task
    ↓
Celery: Regenerate Cluster Snapshot (Excluding Refused Note)
    ↓
New Snapshot Created
    ↓
Dashboard: Cluster Updated in Real-Time
```

## 🧠 AI Pipeline Details

### Context-Aware Scoring Algorithm

The AI assigns a **Relevance Score (1-10)** based on:

| Scenario | Score Range | Example |
|----------|-------------|---------|
| High Expertise Match | 8-10 | HR Manager discussing recruitment |
| Adjacent Domain | 5-7 | Developer discussing product features |
| Outside Expertise | 1-4 | Sales talking about infrastructure |

### Vectorization & Clustering

1. **Embedding Generation**: `text-embedding-3-small` (1536 dimensions)
2. **Similarity Search**: pgvector with cosine similarity (threshold: 0.75)
3. **Dynamic Clustering**: Notes with >75% similarity are grouped
4. **Cluster Evolution**: Tracked via `cluster_snapshots` table

## 🔄 Offline-First Strategy

### Local Storage (Dexie.js)

```typescript
interface LocalNote {
  id: number;              // Auto-increment
  tempId: string;          // UUID for sync tracking
  userId: string;
  contentRaw: string;
  status: 'draft' | 'syncing' | 'synced' | 'error';
  createdAt: Date;
  syncedAt?: Date;
}
```

### Sync Manager

- **Auto-sync**: Every 30 seconds
- **Online Detection**: `navigator.onLine`
- **Retry Logic**: Exponential backoff
- **Error Handling**: Mark notes as 'error' status

## 🎨 UI/UX Components

### 1. Fire & Forget Input

**Features**:
- Large, distraction-free textarea
- Keyboard shortcut (Cmd/Ctrl + Enter)
- Instant save confirmation
- Success animation
- Character count

**Philosophy**: Zero friction. User types → Clicks Send → Screen clears immediately.

### 2. Tracker Page

**Features**:
- Real-time status updates (draft/syncing/synced/error)
- Live query from IndexedDB
- Status badges with icons
- Timestamp display

### 3. Dashboard (Board View) - To Be Implemented

**Planned Features**:
- **Galaxy View**: Visual clusters (bubbles sized by note_count)
- **Time-Lapse Slider**: Travel through cluster evolution
- **Pillar Filtering**: Filter by strategic pillar
- **Contextual Weighting**: Sort by relevance score

## 🔐 Security Considerations

### Current Implementation

- **Frontend**: Public Supabase anon key (read-only)
- **Backend**: Service role key (full access)
- **API**: No authentication (MVP)

### Production Requirements

1. **Authentication**: Supabase Auth or JWT
2. **Row-Level Security**: Postgres RLS policies
3. **API Rate Limiting**: FastAPI middleware
4. **Input Validation**: Pydantic models
5. **CORS**: Strict origin policies

## 📈 Scalability

### Current Limits

- **Notes**: Unlimited (PostgreSQL)
- **Embeddings**: 1536 dims per note
- **Clustering**: O(n) similarity search (optimize with IVFFlat index)
- **Celery**: Single worker (scale horizontally)

### Optimization Strategies

1. **Vector Index**: Use `ivfflat` with appropriate `lists` parameter
2. **Celery Workers**: Deploy multiple workers
3. **Caching**: Redis cache for frequent queries
4. **CDN**: Static assets on CDN
5. **Database**: Connection pooling with pgBouncer

## 🧪 Testing Strategy

### Backend Tests

```bash
cd backend
pytest tests/
```

**Test Coverage**:
- Unit tests for AI service
- Integration tests for API endpoints
- Celery task tests (mocked)

### Frontend Tests

```bash
cd frontend
npm test
```

**Test Coverage**:
- Component rendering tests
- Dexie.js integration tests
- API client tests

## 🚀 Deployment

### Recommended Stack

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend | Vercel | Optimized for Next.js |
| Backend | Render.com | Web Service + Worker |
| Redis | Upstash | Managed Redis |
| Database | Supabase | PostgreSQL + pgvector |
| Monitoring | Sentry | Error tracking |

### Environment Variables

See `.env.example` for all required variables.

## 📚 API Documentation

Once running, visit:
- **Interactive Docs**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

## 🔮 Future Enhancements

1. **Real-time Updates**: WebSocket for live dashboard
2. **Advanced Analytics**: Trend detection, sentiment analysis
3. **Multi-language**: i18n support
4. **Mobile App**: React Native version
5. **Email Digests**: Weekly summaries for board members
6. **Export**: PDF reports generation
7. **Integrations**: Slack, Teams, Email

## 📞 Support

For architecture questions or clarifications, refer to:
- `SETUP.md` for installation
- `README.md` for project overview
- API docs at `/api/docs`

