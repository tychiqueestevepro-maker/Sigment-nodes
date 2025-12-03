# 🔐 Guide de Migration Backend - Multi-Tenant Strict

## Vue d'ensemble

Ce document explique comment adapter le code backend Python pour supporter le mode **Multi-Tenant Strict** après l'exécution de la migration SQL.

---

## 📋 Changements Requis

### **1. Mise à jour de la fonction `find_or_create_cluster`**

📍 Fichier : `/backend/app/workers/tasks.py`

#### **Avant (Single-Tenant)**

```python
def find_or_create_cluster(
    note_id: str,
    pillar_id: str,
    embedding: List[float],
    clarified_content: str
) -> str:
    # Recherche de notes similaires
    similar_notes = supabase.rpc(
        "find_similar_notes",
        {
            "query_embedding": embedding,
            "target_pillar_id": pillar_id,
            "similarity_threshold": 0.75,
            "max_results": 10
        }
    ).execute()
```

#### **Après (Multi-Tenant Strict)**

```python
def find_or_create_cluster(
    note_id: str,
    pillar_id: str,
    embedding: List[float],
    clarified_content: str,
    organization_id: str  # 🔒 NOUVEAU PARAMÈTRE
) -> str:
    # Recherche de notes similaires DANS LA MÊME ORGANISATION
    similar_notes = supabase.rpc(
        "find_similar_notes",
        {
            "query_embedding": embedding,
            "target_pillar_id": pillar_id,
            "p_organization_id": organization_id,  # 🔒 SÉCURITÉ CRITIQUE
            "similarity_threshold": 0.75,
            "max_results": 10
        }
    ).execute()
    
    # ... reste du code inchangé
    
    # Créer nouveau cluster AVEC organization_id
    cluster_response = supabase.table("clusters").insert({
        "pillar_id": pillar_id,
        "organization_id": organization_id,  # 🔒 NOUVEAU
        "title": clarified_content[:200] + "...",
        "note_count": 0
    }).execute()
    
    return cluster_response.data[0]["id"]
```

---

### **2. Mise à jour de `process_note_task`**

📍 Fichier : `/backend/app/workers/tasks.py`

#### **Changements requis**

```python
@celery_app.task(name="process_note", bind=True, max_retries=3)
def process_note_task(self, note_id: str):
    try:
        logger.info(f"Processing note: {note_id}")
        
        # ============================================
        # STEP 1: Fetch Note + User + Organization
        # ============================================
        note_response = supabase.table("notes").select(
            "*, users!inner(job_title, department, seniority_level, organization_id)"  # 🔒 AJOUT organization_id
        ).eq("id", note_id).single().execute()
        
        if not note_response.data:
            raise ValueError(f"Note {note_id} not found")
        
        note = note_response.data
        user = note["users"]
        organization_id = note["organization_id"]  # 🔒 RÉCUPÉRATION
        
        # ... (code inchangé jusqu'à STEP 2)
        
        # ============================================
        # STEP 2: Get Available Pillars (FILTERED BY ORG)
        # ============================================
        pillars_response = supabase.table("pillars").select("*").eq(
            "organization_id", organization_id  # 🔒 FILTRAGE PAR ORG
        ).execute()
        available_pillars = pillars_response.data
        
        # ... (STEP 3 et 4 inchangés)
        
        # ============================================
        # STEP 5: Find Similar Notes & Cluster (WITH ORG)
        # ============================================
        cluster_id = find_or_create_cluster(
            note_id=note_id,
            pillar_id=pillar["id"],
            embedding=embedding,
            clarified_content=analysis["clarified_content"],
            organization_id=organization_id  # 🔒 PASSAGE DU PARAMÈTRE
        )
        
        # ... (reste inchangé)
        
    except Exception as e:
        logger.error(f"❌ Error processing note {note_id}: {e}")
        # ... (gestion d'erreur inchangée)
```

---

### **3. Mise à jour de `generate_cluster_snapshot_task`**

📍 Fichier : `/backend/app/workers/tasks.py`

#### **Changements requis**

```python
@celery_app.task(name="generate_cluster_snapshot")
def generate_cluster_snapshot_task(cluster_id: str):
    try:
        logger.info(f"Generating snapshot for cluster: {cluster_id}")
        
        # ============================================
        # STEP 1: Fetch Cluster + Notes (WITH ORG CHECK)
        # ============================================
        cluster_response = supabase.table("clusters").select(
            "*, pillars(name), notes!inner(*, users(department, job_title))"
        ).eq("id", cluster_id).eq(
            "notes.status", "processed"
        ).single().execute()
        
        if not cluster_response.data:
            raise ValueError(f"Cluster {cluster_id} not found")
        
        cluster = cluster_response.data
        notes = cluster["notes"]
        organization_id = cluster["organization_id"]  # 🔒 RÉCUPÉRATION
        
        # ... (code de génération inchangé)
        
        # ============================================
        # STEP 6: Create Snapshot (WITH ORG)
        # ============================================
        supabase.table("cluster_snapshots").insert({
            "cluster_id": cluster_id,
            "organization_id": organization_id,  # 🔒 NOUVEAU
            "synthesis_text": synthesis,
            "metrics_json": metrics,
            "included_note_ids": [n["id"] for n in notes],
            "note_count": len(notes),
            "avg_relevance_score": avg_score
        }).execute()
        
        # ... (reste inchangé)
        
    except Exception as e:
        logger.error(f"❌ Error generating snapshot for cluster {cluster_id}: {e}")
        raise
```

---

### **4. Mise à jour des routes API**

📍 Fichier : `/backend/app/api/routes/notes.py`

#### **4.1 Route `POST /notes`**

```python
@router.post("/", response_model=NoteResponse)
async def create_note(note: NoteCreate, organization_id: str = Header(..., alias="X-Organization-ID")):
    """
    Create a single note (online mode)
    Returns immediately with "draft" status
    """
    try:
        # Insert note WITH organization_id
        response = supabase.table("notes").insert({
            "user_id": str(note.user_id),
            "content_raw": note.content_raw,
            "organization_id": organization_id,  # 🔒 NOUVEAU
            "status": "draft"
        }).execute()
        
        created_note = response.data[0]
        note_id = created_note["id"]
        
        # Trigger async processing
        process_note_task.delay(note_id)
        
        logger.info(f"Note created: {note_id} (org: {organization_id})")
        
        return created_note
        
    except Exception as e:
        logger.error(f"Error creating note: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### **4.2 Route `GET /notes/user/{user_id}`**

```python
@router.get("/notes/user/{user_id}")
async def get_user_notes(user_id: str, organization_id: str = Header(..., alias="X-Organization-ID")):
    """
    Get all notes for a specific user (for Track Queue page)
    FILTERED BY ORGANIZATION
    """
    try:
        # Query notes filtered by user_id AND organization_id
        query = supabase.table("notes").select(
            """
            id,
            content_raw,
            content_clarified,
            status,
            created_at,
            processed_at,
            ai_relevance_score,
            cluster_id,
            clusters(id, title, pillar_id, note_count, pillars(id, name))
            """
        ).eq("user_id", user_id).eq(
            "organization_id", organization_id  # 🔒 FILTRAGE PAR ORG
        )
            
        response = query.order("created_at", desc=True).execute()
        
        # ... (reste du code inchangé)
        
    except Exception as e:
        logger.error(f"❌ Error fetching user notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### **4.3 Autres routes**

Appliquer le même pattern à toutes les routes :
- `GET /notes/{note_id}` : Vérifier que `note.organization_id == organization_id`
- `PATCH /notes/{note_id}` : Vérifier que `note.organization_id == organization_id`
- `DELETE /notes/{note_id}` : Vérifier que `note.organization_id == organization_id`
- `GET /notes/{note_id}/timeline` : Filtrer par `organization_id`

---

### **5. Middleware pour extraire `organization_id`**

📍 Fichier : `/backend/app/middleware/organization.py` (NOUVEAU)

```python
"""
Middleware to extract and validate organization_id from request
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger

class OrganizationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Extract organization_id from header
        org_id = request.headers.get("X-Organization-ID")
        
        # Skip for public routes
        if request.url.path in ["/health", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        # Validate organization_id
        if not org_id:
            logger.error("Missing X-Organization-ID header")
            raise HTTPException(
                status_code=400,
                detail="Missing X-Organization-ID header"
            )
        
        # Validate UUID format
        try:
            from uuid import UUID
            UUID(org_id)
        except ValueError:
            logger.error(f"Invalid organization_id format: {org_id}")
            raise HTTPException(
                status_code=400,
                detail="Invalid organization_id format"
            )
        
        # Store in request state
        request.state.organization_id = org_id
        
        # Continue processing
        response = await call_next(request)
        return response
```

#### **Enregistrement du middleware**

📍 Fichier : `/backend/main.py`

```python
from app.middleware.organization import OrganizationMiddleware

app = FastAPI(title="SIGMENT API")

# Add organization middleware
app.add_middleware(OrganizationMiddleware)
```

---

### **6. Mise à jour des modèles Pydantic**

📍 Fichier : `/backend/app/models/note.py`

```python
class NoteCreate(BaseModel):
    """Note creation payload from frontend"""
    content_raw: str = Field(..., min_length=10, max_length=5000)
    user_id: UUID
    # organization_id sera extrait du header, pas du body

class NoteResponse(BaseModel):
    """Note response model"""
    id: UUID
    user_id: UUID
    organization_id: UUID  # 🔒 NOUVEAU
    content_raw: str
    content_clarified: Optional[str] = None
    pillar_id: Optional[UUID] = None
    cluster_id: Optional[UUID] = None
    ai_relevance_score: Optional[float] = None
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
```

---

## 🧪 Tests de Validation

### **Test 1 : Isolation des notes**

```python
# Test que les notes d'une org ne sont pas visibles par une autre org
def test_note_isolation():
    # Créer une note dans org A
    note_org_a = create_note(user_id="user1", org_id="org-a", content="Test A")
    
    # Essayer de récupérer depuis org B
    response = get_note(note_id=note_org_a["id"], org_id="org-b")
    
    # Doit retourner 404 ou 403
    assert response.status_code in [403, 404]
```

### **Test 2 : Clustering isolé**

```python
# Test que le clustering ne mélange pas les orgs
def test_cluster_isolation():
    # Créer 2 notes similaires dans org A
    note1_org_a = create_note(org_id="org-a", content="Carbon footprint tracking")
    note2_org_a = create_note(org_id="org-a", content="Carbon emissions monitoring")
    
    # Créer 1 note similaire dans org B
    note1_org_b = create_note(org_id="org-b", content="Carbon footprint system")
    
    # Attendre le traitement
    time.sleep(10)
    
    # Vérifier que note1_org_a et note2_org_a sont dans le même cluster
    note1_data = get_note(note1_org_a["id"], org_id="org-a")
    note2_data = get_note(note2_org_a["id"], org_id="org-a")
    assert note1_data["cluster_id"] == note2_data["cluster_id"]
    
    # Vérifier que note1_org_b est dans un cluster différent
    note_b_data = get_note(note1_org_b["id"], org_id="org-b")
    assert note_b_data["cluster_id"] != note1_data["cluster_id"]
```

### **Test 3 : Pillars par organisation**

```python
# Test que chaque org a ses propres pillars
def test_pillars_isolation():
    # Récupérer les pillars de org A
    pillars_org_a = get_pillars(org_id="org-a")
    
    # Récupérer les pillars de org B
    pillars_org_b = get_pillars(org_id="org-b")
    
    # Vérifier qu'ils sont différents
    pillar_ids_a = {p["id"] for p in pillars_org_a}
    pillar_ids_b = {p["id"] for p in pillars_org_b}
    assert pillar_ids_a.isdisjoint(pillar_ids_b)
```

---

## 🚀 Déploiement

### **Étape 1 : Exécuter la migration SQL**

```bash
# Se connecter à la base de données
psql -h <host> -U <user> -d <database>

# Exécuter la migration
\i database/migrate_notes_multi_tenant_strict.sql

# Vérifier les résultats
SELECT table_name, column_name, is_nullable 
FROM information_schema.columns 
WHERE column_name = 'organization_id' 
AND table_name IN ('pillars', 'notes', 'clusters', 'note_events', 'cluster_snapshots');
```

### **Étape 2 : Mettre à jour le code backend**

```bash
# Appliquer tous les changements listés ci-dessus
# Tester localement avec pytest
pytest tests/test_multi_tenant.py -v

# Vérifier les logs Celery
celery -A app.workers.celery_app worker --loglevel=debug
```

### **Étape 3 : Mettre à jour le frontend**

```typescript
// Ajouter le header X-Organization-ID à toutes les requêtes
const api = {
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-Organization-ID': getCurrentOrganizationId() // 🔒 NOUVEAU
    }
};
```

---

## ⚠️ Points d'Attention

### **1. Migration des données existantes**

Si vous avez déjà des données en production :

```sql
-- Assigner toutes les données existantes à une org par défaut
UPDATE notes SET organization_id = (SELECT id FROM organizations WHERE slug = 'default-org') WHERE organization_id IS NULL;
UPDATE clusters SET organization_id = (SELECT id FROM organizations WHERE slug = 'default-org') WHERE organization_id IS NULL;
UPDATE pillars SET organization_id = (SELECT id FROM organizations WHERE slug = 'default-org') WHERE organization_id IS NULL;
```

### **2. Performance**

Les index composites créés garantissent de bonnes performances :
- `idx_notes_org_status` : Pour les requêtes de statut
- `idx_notes_org_user` : Pour les requêtes utilisateur
- `idx_clusters_org_pillar` : Pour les requêtes de clustering

### **3. Sécurité**

- ✅ Row Level Security (RLS) activé
- ✅ Contraintes de validation cross-org
- ✅ Fonction `find_similar_notes` sécurisée
- ✅ Middleware de validation

---

## 📚 Checklist de Migration

- [ ] Exécuter `migrate_notes_multi_tenant_strict.sql`
- [ ] Mettre à jour `find_or_create_cluster` avec `organization_id`
- [ ] Mettre à jour `process_note_task` pour récupérer `organization_id`
- [ ] Mettre à jour `generate_cluster_snapshot_task` avec `organization_id`
- [ ] Ajouter header `X-Organization-ID` à toutes les routes API
- [ ] Créer `OrganizationMiddleware`
- [ ] Mettre à jour les modèles Pydantic
- [ ] Mettre à jour le frontend pour envoyer `X-Organization-ID`
- [ ] Écrire et exécuter les tests d'isolation
- [ ] Vérifier les logs Celery
- [ ] Déployer en production

---

**Dernière mise à jour :** 2 décembre 2025  
**Version :** 1.0.0
