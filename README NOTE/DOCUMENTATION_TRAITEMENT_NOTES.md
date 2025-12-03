# 📋 Documentation Complète : Traitement des Notes dans SIGMENT

## 🎯 Vue d'ensemble

Ce document détaille le **cycle de vie complet d'une note** dans SIGMENT, depuis sa soumission par un membre jusqu'à son stockage final en base de données, en passant par le traitement IA et la fusion en clusters.

---

## 📊 Architecture Globale

```
┌─────────────────┐
│   FRONTEND      │
│   (Member App)  │
└────────┬────────┘
         │
         │ POST /notes
         ▼
┌─────────────────┐
│   BACKEND API   │
│   (FastAPI)     │
└────────┬────────┘
         │
         │ Trigger async task
         ▼
┌─────────────────┐
│  CELERY WORKER  │
│  (AI Pipeline)  │
└────────┬────────┘
         │
         │ Store results
         ▼
┌─────────────────┐
│   SUPABASE DB   │
│  (PostgreSQL)   │
└─────────────────┘
```

---

## 🔄 Flux Complet de Traitement

### **Phase 1 : Soumission de la Note (Frontend)**

#### 📍 Fichier : `/frontend/member/app/node/page.tsx`

**Actions possibles pour l'utilisateur :**
- ✍️ Écrire une note dans une interface sphérique dynamique
- 🔍 Zoom/Pan pour naviguer dans le contenu
- 💾 Sauvegarder la note

**Code de soumission :**
```typescript
const handleSave = async () => {
    const userId = localStorage.getItem('sigment_user_id');
    const response = await fetch(`${api.baseURL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: userId,
            content_raw: text,
            source: 'web',
        }),
    });
    
    if (!response.ok) throw new Error('Failed to save node');
    toast.success('Node captured successfully!');
}
```

**Données envoyées :**
```json
{
  "user_id": "uuid-de-l-utilisateur",
  "content_raw": "Texte brut de la note",
  "source": "web"
}
```

---

### **Phase 2 : Réception API (Backend)**

#### 📍 Fichier : `/backend/app/api/routes/notes.py`

**Endpoint : `POST /notes`**

```python
@router.post("/", response_model=NoteResponse)
async def create_note(note: NoteCreate):
    """
    Create a single note (online mode)
    Returns immediately with "draft" status
    """
    # 1. Insertion en base de données
    response = supabase.table("notes").insert({
        "user_id": str(note.user_id),
        "content_raw": note.content_raw,
        "status": "draft"  # ⚠️ Statut initial
    }).execute()
    
    created_note = response.data[0]
    note_id = created_note["id"]
    
    # 2. Déclenchement du traitement asynchrone
    process_note_task.delay(note_id)
    
    # 3. Retour immédiat au frontend
    return created_note
```

**Statuts possibles d'une note :**
- `draft` : Note créée, en attente de traitement
- `processing` : En cours de traitement par l'IA
- `processed` : Traitement IA terminé
- `review` : En révision par le Board
- `approved` : Approuvée par le Board
- `refused` : Refusée par le Board

---

### **Phase 3 : Traitement IA Asynchrone (Celery Worker)**

#### 📍 Fichier : `/backend/app/workers/tasks.py`

**Task Celery : `process_note_task`**

Cette tâche exécute un **pipeline complet en 7 étapes** :

```python
@celery_app.task(name="process_note", bind=True, max_retries=3)
def process_note_task(self, note_id: str):
```

#### **Étape 1 : Récupération du contexte utilisateur**

```python
# Fetch Note + User Context (job_title, department, seniority_level)
note_response = supabase.table("notes").select(
    "*, users!inner(job_title, department, seniority_level)"
).eq("id", note_id).single().execute()

user_context = UserContext(
    job_title=user["job_title"],
    department=user["department"],
    seniority_level=user["seniority_level"]
)

# Mise à jour du statut
supabase.table("notes").update({"status": "processing"}).eq("id", note_id).execute()

# Log de l'événement
log_note_event(
    note_id=note_id,
    event_type="submission",
    title="Note Submitted",
    description="Your idea has been received and is being processed by our AI system"
)
```

#### **Étape 2 : Récupération des Pillars disponibles**

```python
pillars_response = supabase.table("pillars").select("*").execute()
available_pillars = pillars_response.data
```

**Pillars par défaut :**
- 🌱 ESG (Environmental, Social, Governance)
- 💡 Innovation
- ⚙️ Operations
- 🎯 Customer Experience
- 👥 Culture & HR

#### **Étape 3 : Analyse IA (OpenAI)**

📍 Fichier : `/backend/app/services/ai_service.py`

```python
analysis = ai_service.analyze_note(
    content=note["content_raw"],
    user_context=user_context,
    available_pillars=available_pillars
)
```

**Prompt système envoyé à OpenAI :**
```
You are a Strategic Analyst for a B2B company.

AUTHOR CONTEXT:
- Job Title: {user_context.job_title}
- Department: {user_context.department}
- Seniority Level: {user_context.seniority_level}/5

AVAILABLE PILLARS:
- ESG: Environmental, Social, and Governance initiatives
- Innovation: Product innovation and R&D ideas
- Operations: Operational efficiency and process improvements
- Customer Experience: Customer satisfaction and service quality
- Culture & HR: Employee experience and organizational culture

YOUR TASK:
1. Rewrite the note for clarity and executive comprehension (keep it concise)
2. Assign the most appropriate Pillar
3. Calculate a Relevance Score (1-10) based on:
   - HIGH SCORE (8-10): Topic matches author's expertise domain
   - MEDIUM SCORE (5-7): Topic is adjacent to author's domain
   - LOW SCORE (1-4): Topic is outside author's expertise

RESPONSE FORMAT (JSON):
{
  "clarified_content": "Clear, executive-friendly version",
  "pillar_name": "The pillar name exactly as listed",
  "relevance_score": 8.5,
  "reasoning": "Brief explanation of score"
}
```

**Résultat de l'analyse :**
```json
{
  "clarified_content": "Implement a carbon footprint tracking system for our supply chain",
  "pillar_name": "ESG",
  "relevance_score": 8.5,
  "reasoning": "Author is from Operations dept with high seniority, topic aligns with expertise"
}
```

**Log de l'événement :**
```python
log_note_event(
    note_id=note_id,
    event_type="ai_analysis",
    title="AI Analysis Complete",
    description=f"Relevance Score: {analysis['relevance_score']}/10 | Category: {analysis['pillar_name']}"
)
```

#### **Étape 4 : Génération de l'Embedding**

```python
embedding = ai_service.generate_embedding(analysis["clarified_content"])
```

**Modèle utilisé :** `text-embedding-3-small` (OpenAI)
**Dimensions :** 1536 dimensions
**Format :** Liste de floats `[0.123, -0.456, ...]`

#### **Étape 5 : Recherche de similarité et clustering**

```python
cluster_id = find_or_create_cluster(
    note_id=note_id,
    pillar_id=pillar["id"],
    embedding=embedding,
    clarified_content=analysis["clarified_content"]
)
```

**Fonction `find_or_create_cluster` :**

```python
def find_or_create_cluster(note_id, pillar_id, embedding, clarified_content):
    # 1. Recherche de notes similaires via pgvector
    similar_notes = supabase.rpc(
        "find_similar_notes",
        {
            "query_embedding": embedding,
            "target_pillar_id": pillar_id,
            "similarity_threshold": 0.75,  # 75% de similarité minimum
            "max_results": 10
        }
    ).execute()
    
    # 2. Si des notes similaires existent, rejoindre leur cluster
    if similar_notes.data and len(similar_notes.data) > 0:
        similar_note_id = similar_notes.data[0]["note_id"]
        note_response = supabase.table("notes").select("cluster_id").eq(
            "id", similar_note_id
        ).single().execute()
        
        if note_response.data and note_response.data["cluster_id"]:
            return note_response.data["cluster_id"]
    
    # 3. Sinon, créer un nouveau cluster
    cluster_response = supabase.table("clusters").insert({
        "pillar_id": pillar_id,
        "title": clarified_content[:200] + "...",  # Titre temporaire
        "note_count": 0
    }).execute()
    
    return cluster_response.data[0]["id"]
```

**Fonction PostgreSQL `find_similar_notes` :**

📍 Fichier : `/database/schema.sql`

```sql
CREATE OR REPLACE FUNCTION find_similar_notes(
    query_embedding vector(1536),
    target_pillar_id UUID,
    similarity_threshold FLOAT DEFAULT 0.75,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    note_id UUID,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id AS note_id,
        1 - (n.embedding <=> query_embedding) AS similarity
    FROM notes n
    WHERE 
        n.pillar_id = target_pillar_id
        AND n.status = 'processed'
        AND n.embedding IS NOT NULL
        AND 1 - (n.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY n.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
```

**Opérateur `<=>` :** Distance cosinus (pgvector)

#### **Étape 6 : Mise à jour de la note**

```python
supabase.table("notes").update({
    "content_clarified": analysis["clarified_content"],
    "embedding": embedding,
    "pillar_id": pillar["id"],
    "cluster_id": cluster_id,
    "ai_relevance_score": analysis["relevance_score"],
    "status": "processed",
    "processed_at": "now()"
}).eq("id", note_id).execute()

# Log de l'événement de fusion
cluster_response = supabase.table("clusters").select("title").eq("id", cluster_id).single().execute()
cluster_title = cluster_response.data.get("title", "Unknown Cluster")

log_note_event(
    note_id=note_id,
    event_type="fusion",
    title="Cluster Assignment",
    description=f"Your idea has been grouped with similar ideas: '{cluster_title}'"
)
```

#### **Étape 7 : Génération du snapshot du cluster**

```python
generate_cluster_snapshot_task.delay(cluster_id)
```

**Task `generate_cluster_snapshot_task` :**

```python
@celery_app.task(name="generate_cluster_snapshot")
def generate_cluster_snapshot_task(cluster_id: str):
    # 1. Récupérer toutes les notes du cluster
    cluster_response = supabase.table("clusters").select(
        "*, pillars(name), notes!inner(*, users(department, job_title))"
    ).eq("id", cluster_id).eq("notes.status", "processed").single().execute()
    
    cluster = cluster_response.data
    notes = cluster["notes"]
    
    # 2. Générer un nouveau titre pour le cluster (si nécessaire)
    if cluster["title"].endswith("...") or cluster["note_count"] != len(notes):
        new_title = ai_service.generate_cluster_title([
            {"content_clarified": n["content_clarified"]} for n in notes
        ])
        supabase.table("clusters").update({"title": new_title}).eq("id", cluster_id).execute()
    
    # 3. Préparer les notes pour la synthèse
    notes_for_synthesis = [
        {
            "content_clarified": n["content_clarified"],
            "ai_relevance_score": n["ai_relevance_score"],
            "user_department": n["users"]["department"],
            "user_job_title": n["users"]["job_title"]
        }
        for n in notes
    ]
    
    # 4. Générer la synthèse IA
    synthesis = ai_service.generate_cluster_synthesis(
        notes=notes_for_synthesis,
        cluster_title=cluster["title"],
        pillar_name=cluster["pillars"]["name"]
    )
    
    # 5. Calculer les métriques
    dept_counts = {}
    for note in notes:
        dept = note["users"]["department"]
        dept_counts[dept] = dept_counts.get(dept, 0) + 1
    
    avg_score = sum(n["ai_relevance_score"] for n in notes) / len(notes)
    
    metrics = {
        **dept_counts,
        "Avg_Weight": round(avg_score, 2)
    }
    
    # 6. Créer le snapshot
    supabase.table("cluster_snapshots").insert({
        "cluster_id": cluster_id,
        "synthesis_text": synthesis,
        "metrics_json": metrics,
        "included_note_ids": [n["id"] for n in notes],
        "note_count": len(notes),
        "avg_relevance_score": avg_score
    }).execute()
```

---

## 🗄️ Structure de la Base de Données

### **Table `notes`**

```sql
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Contenu
    content_raw TEXT NOT NULL,
    content_clarified TEXT,
    
    -- Analyse IA
    embedding vector(1536),
    pillar_id UUID REFERENCES pillars(id) ON DELETE SET NULL,
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    ai_relevance_score FLOAT CHECK (ai_relevance_score BETWEEN 1 AND 10),
    
    -- Statut
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'processed', 'refused')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb
);
```

**Index importants :**
```sql
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_status ON notes(status);
CREATE INDEX idx_notes_cluster ON notes(cluster_id);
CREATE INDEX idx_notes_embedding ON notes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### **Table `note_events`**

```sql
CREATE TABLE note_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('submission', 'ai_analysis', 'fusion', 'reviewing', 'refusal')),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Types d'événements :**
- `submission` : Note soumise
- `ai_analysis` : Analyse IA terminée
- `fusion` : Assignation à un cluster
- `reviewing` : En révision par le Board
- `refusal` : Note refusée

### **Table `clusters`**

```sql
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pillar_id UUID NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    note_count INTEGER DEFAULT 0,
    avg_relevance_score FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **Table `cluster_snapshots`**

```sql
CREATE TABLE cluster_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    synthesis_text TEXT NOT NULL,
    metrics_json JSONB NOT NULL,
    included_note_ids UUID[] NOT NULL,
    note_count INTEGER NOT NULL,
    avg_relevance_score FLOAT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Exemple de `metrics_json` :**
```json
{
  "IT": 5,
  "Sales": 2,
  "HR": 1,
  "Avg_Weight": 7.8
}
```

---

## 🎬 Actions Possibles sur les Notes

### **1. Actions Utilisateur (Member)**

#### **Soumettre une note**
- **Endpoint :** `POST /notes`
- **Payload :**
  ```json
  {
    "user_id": "uuid",
    "content_raw": "texte"
  }
  ```

#### **Voir ses notes**
- **Endpoint :** `GET /notes/user/{user_id}`
- **Retour :**
  ```json
  [
    {
      "id": "uuid",
      "title": "Titre clarifié par l'IA",
      "content": "Contenu brut",
      "category": "ESG",
      "status": "Processed",
      "date": "01 Dec 2025, 14:30",
      "relevance_score": 8.5,
      "cluster_title": "Carbon Footprint Initiatives"
    }
  ]
  ```

#### **Voir la timeline d'une note**
- **Endpoint :** `GET /notes/{note_id}/timeline`
- **Retour :**
  ```json
  [
    {
      "id": "uuid",
      "event_type": "submission",
      "title": "Note Submitted",
      "description": "Your idea has been received",
      "created_at": "2025-12-01T14:30:00Z"
    },
    {
      "id": "uuid",
      "event_type": "ai_analysis",
      "title": "AI Analysis Complete",
      "description": "Relevance Score: 8.5/10 | Category: ESG",
      "created_at": "2025-12-01T14:30:05Z"
    }
  ]
  ```

### **2. Actions Admin/Board**

#### **Modérer une note**
- **Endpoint :** `PATCH /notes/{note_id}`
- **Payload :**
  ```json
  {
    "status": "refused"
  }
  ```

**Effet :**
- Mise à jour du statut
- Log d'un événement `refusal`
- Déclenchement de `reprocess_cluster_on_moderation_task`

```python
@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: UUID, update: NoteUpdate):
    # Mise à jour
    response = supabase.table("notes").update({
        "status": update.status
    }).eq("id", str(note_id)).execute()
    
    # Log des événements
    if update.status == "processed":
        log_note_event(
            note_id=str(note_id),
            event_type="reviewing",
            title="Under Board Review",
            description="Your idea is being reviewed by the executive team"
        )
    elif update.status == "refused":
        log_note_event(
            note_id=str(note_id),
            event_type="refusal",
            title="Idea Closed",
            description="This idea was not selected for implementation at this time"
        )
    
    # Retraitement du cluster
    if update.status == "refused" and current.data.get("cluster_id"):
        reprocess_cluster_on_moderation_task.delay(
            note_id=str(note_id),
            cluster_id=current.data["cluster_id"]
        )
```

#### **Supprimer une note**
- **Endpoint :** `DELETE /notes/{note_id}`

---

## 📈 Visualisation Frontend (Track Queue)

📍 Fichier : `/frontend/member/app/track/page.tsx`

### **Affichage de la liste des notes**

```typescript
const { data: notesList = [], isLoading } = useQuery<any[]>({
    queryKey: ['user-notes', userId],
    queryFn: async () => {
        const response = await fetch(`${api.baseURL}/notes/user/${userId}`);
        const data = await response.json();
        
        return data.map((note: any) => ({
            ...note,
            date: formatDate(note.date),
            color: getColorForCategory(note.category),
            statusConfig: getStatusConfig(note.status),
        }));
    },
    enabled: !!userId,
});
```

### **Affichage de la timeline**

```typescript
const { data: timelineEvents = [] } = useQuery<any[]>({
    queryKey: ['note-timeline', selectedNote?.id],
    queryFn: async () => {
        return apiClient.getNoteTimeline(selectedNote.id);
    },
    enabled: !!selectedNote?.id,
});
```

**Rendu des événements :**
```tsx
{timelineEvents.slice().reverse().map((event: any) => (
    <li key={event.id}>
        <div>
            <span>{event.title}</span>
            <span>{formatDate(event.created_at)}</span>
        </div>
        {event.description && <p>{event.description}</p>}
    </li>
))}
```

---

## 🔧 Configuration Celery

📍 Fichier : `/backend/app/workers/celery_app.py`

```python
celery_app = Celery(
    "sigment",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max
    task_soft_time_limit=240,  # 4 minutes soft limit
)
```

**Variables d'environnement requises :**
```env
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

---

## 🚀 Démarrage du Système

### **1. Backend API**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

### **2. Celery Worker**
```bash
cd backend
source venv/bin/activate
celery -A app.workers.celery_app worker --loglevel=info
```

### **3. Frontend**
```bash
cd frontend/member
npm run dev
```

---

## 📊 Diagramme de Séquence Complet

```
Member          API             Celery          OpenAI          Database
  |              |                |               |               |
  |--POST /notes--->|              |               |               |
  |              |--INSERT note--->|               |               |
  |              |                 |               |               |---> notes (status: draft)
  |<--201 Created--|               |               |               |
  |              |--trigger task-->|               |               |
  |              |                 |               |               |
  |              |                 |--UPDATE status: processing--->|
  |              |                 |               |               |
  |              |                 |--log event: submission------->|
  |              |                 |               |               |
  |              |                 |--analyze note->|               |
  |              |                 |               |               |
  |              |                 |<--analysis----|               |
  |              |                 |               |               |
  |              |                 |--log event: ai_analysis------>|
  |              |                 |               |               |
  |              |                 |--generate embedding->|         |
  |              |                 |               |               |
  |              |                 |<--embedding---|               |
  |              |                 |               |               |
  |              |                 |--find similar notes---------->|
  |              |                 |               |               |
  |              |                 |<--cluster_id------------------|
  |              |                 |               |               |
  |              |                 |--UPDATE note (status: processed)->|
  |              |                 |               |               |
  |              |                 |--log event: fusion----------->|
  |              |                 |               |               |
  |              |                 |--trigger snapshot task------->|
  |              |                 |               |               |
```

---

## 🎯 Points Clés à Retenir

1. **Traitement Asynchrone** : La note est créée immédiatement en `draft`, puis traitée en arrière-plan
2. **Pipeline IA en 7 étapes** : Contexte → Pillars → Analyse → Embedding → Clustering → Update → Snapshot
3. **Logging d'événements** : Chaque étape importante est loggée dans `note_events`
4. **Similarité vectorielle** : pgvector avec distance cosinus (seuil 0.75)
5. **Modération** : Le Board peut changer le statut (`processed`, `refused`, `approved`)
6. **Snapshots** : Historique des clusters pour la fonctionnalité time-lapse

---

## 📝 Modèles de Données

### **NoteCreate (Input)**
```python
class NoteCreate(BaseModel):
    content_raw: str = Field(..., min_length=10, max_length=5000)
    user_id: UUID
```

### **NoteResponse (Output)**
```python
class NoteResponse(BaseModel):
    id: UUID
    user_id: UUID
    content_raw: str
    content_clarified: Optional[str] = None
    pillar_id: Optional[UUID] = None
    cluster_id: Optional[UUID] = None
    ai_relevance_score: Optional[float] = None
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
```

### **NoteUpdate (Admin)**
```python
class NoteUpdate(BaseModel):
    status: Optional[str] = None
    cluster_id: Optional[UUID] = None
```

---

## 🔐 Sécurité et Permissions

- **Member** : Peut créer et voir ses propres notes
- **Board** : Peut modérer toutes les notes
- **Admin** : Peut supprimer des notes

---

## 📚 Ressources

- **OpenAI API** : `gpt-4o-mini` pour l'analyse, `text-embedding-3-small` pour les embeddings
- **pgvector** : Extension PostgreSQL pour la recherche vectorielle
- **Celery** : Queue de tâches asynchrones avec Redis
- **Supabase** : Backend PostgreSQL avec API REST

---

**Dernière mise à jour :** 2 décembre 2025
