# 🗄️ Schéma de Base de Données - Notes System

## Vue d'ensemble

Le système utilise **PostgreSQL avec Supabase** et l'extension **pgvector** pour la recherche vectorielle.

---

## 📊 Diagramme Relationnel

```
┌─────────────┐
│   users     │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────┐      ┌──────────────┐
│   notes     │─────▶│ note_events  │
└──────┬──────┘ 1:N  └──────────────┘
       │
       │ N:1
       ▼
┌─────────────┐      ┌──────────────────┐
│  clusters   │─────▶│cluster_snapshots │
└──────┬──────┘ 1:N  └──────────────────┘
       │
       │ N:1
       ▼
┌─────────────┐
│  pillars    │
└─────────────┘
```

---

## 📋 Tables

### 1. **users**

Stocke les informations des utilisateurs avec leur contexte métier pour l'IA.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'admin', 'board')),
    
    -- Métadonnées IA pour scoring contextuel
    job_title VARCHAR(255),
    department VARCHAR(255),
    seniority_level INTEGER CHECK (seniority_level BETWEEN 1 AND 5),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Index :**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**Exemple de données :**
```sql
INSERT INTO users (email, role, job_title, department, seniority_level) VALUES
('john.doe@company.com', 'employee', 'Senior Developer', 'IT', 4),
('jane.smith@company.com', 'employee', 'HR Manager', 'Human Resources', 3),
('board@company.com', 'board', 'Board Member', 'Board', 5);
```

**Résultat :**
| id | email | role | job_title | department | seniority_level |
|----|-------|------|-----------|------------|-----------------|
| 550e8400-... | john.doe@company.com | employee | Senior Developer | IT | 4 |
| 660e9511-... | jane.smith@company.com | employee | HR Manager | Human Resources | 3 |
| 770e0622-... | board@company.com | board | Board Member | Board | 5 |

---

### 2. **pillars**

Catégories stratégiques définies par l'entreprise.

```sql
CREATE TABLE pillars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Couleur hex pour l'UI (ex: '#3B82F6')
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Données par défaut :**
```sql
INSERT INTO pillars (name, description, color) VALUES
('ESG', 'Environmental, Social, and Governance initiatives', '#10B981'),
('Innovation', 'Product innovation and R&D ideas', '#6366F1'),
('Operations', 'Operational efficiency and process improvements', '#F59E0B'),
('Customer Experience', 'Customer satisfaction and service quality', '#EC4899'),
('Culture & HR', 'Employee experience and organizational culture', '#8B5CF6');
```

**Résultat :**
| id | name | description | color |
|----|------|-------------|-------|
| 789e0123-... | ESG | Environmental, Social, and Governance initiatives | #10B981 |
| 890e1234-... | Innovation | Product innovation and R&D ideas | #6366F1 |
| 901e2345-... | Operations | Operational efficiency and process improvements | #F59E0B |
| 012e3456-... | Customer Experience | Customer satisfaction and service quality | #EC4899 |
| 123e4567-... | Culture & HR | Employee experience and organizational culture | #8B5CF6 |

---

### 3. **notes**

Table centrale stockant toutes les notes soumises.

```sql
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Contenu
    content_raw TEXT NOT NULL,
    content_clarified TEXT,
    
    -- Analyse IA
    embedding vector(1536), -- OpenAI text-embedding-3-small
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

**Index :**
```sql
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_status ON notes(status);
CREATE INDEX idx_notes_pillar ON notes(pillar_id);
CREATE INDEX idx_notes_cluster ON notes(cluster_id);
CREATE INDEX idx_notes_created ON notes(created_at DESC);

-- Index vectoriel CRITIQUE pour la performance
CREATE INDEX idx_notes_embedding ON notes USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Exemple de données :**

**Note 1 (draft) :**
```sql
INSERT INTO notes (user_id, content_raw, status) VALUES
('550e8400-e29b-41d4-a716-446655440000', 
 'Nous devrions implémenter un système de suivi de l''empreinte carbone pour notre chaîne d''approvisionnement',
 'draft');
```

**Note 2 (processed) :**
```sql
INSERT INTO notes (
    user_id, 
    content_raw, 
    content_clarified, 
    embedding,
    pillar_id, 
    cluster_id, 
    ai_relevance_score, 
    status, 
    processed_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Nous devrions implémenter un système de suivi de l''empreinte carbone',
    'Implement a carbon footprint tracking system for our supply chain to monitor and reduce environmental impact',
    '[0.123, -0.456, 0.789, ...]'::vector, -- 1536 dimensions
    '789e0123-e89b-12d3-a456-426614174002', -- ESG pillar
    '890e1234-e89b-12d3-a456-426614174003', -- Cluster ID
    8.5,
    'processed',
    NOW()
);
```

**Résultat :**
| id | user_id | content_raw | content_clarified | pillar_id | cluster_id | ai_relevance_score | status | created_at | processed_at |
|----|---------|-------------|-------------------|-----------|------------|-------------------|--------|------------|--------------|
| 123e4567-... | 550e8400-... | Nous devrions implémenter... | Implement a carbon footprint... | 789e0123-... | 890e1234-... | 8.5 | processed | 2025-12-02 03:54:30 | 2025-12-02 03:54:35 |
| 234e5678-... | 550e8400-... | Améliorer l'expérience client... | NULL | NULL | NULL | NULL | draft | 2025-12-02 04:10:15 | NULL |

---

### 4. **note_events**

Journal des événements du cycle de vie des notes.

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

**Index :**
```sql
CREATE INDEX idx_note_events_note_id_created_at ON note_events (note_id, created_at);
```

**Exemple de données :**
```sql
-- Événement 1 : Soumission
INSERT INTO note_events (note_id, event_type, title, description) VALUES
('123e4567-e89b-12d3-a456-426614174000', 
 'submission', 
 'Note Submitted', 
 'Your idea has been received and is being processed by our AI system');

-- Événement 2 : Analyse IA
INSERT INTO note_events (note_id, event_type, title, description) VALUES
('123e4567-e89b-12d3-a456-426614174000', 
 'ai_analysis', 
 'AI Analysis Complete', 
 'Relevance Score: 8.5/10 | Category: ESG');

-- Événement 3 : Fusion
INSERT INTO note_events (note_id, event_type, title, description) VALUES
('123e4567-e89b-12d3-a456-426614174000', 
 'fusion', 
 'Cluster Assignment', 
 'Your idea has been grouped with similar ideas: ''Carbon Footprint Reduction Initiatives''');

-- Événement 4 : Révision
INSERT INTO note_events (note_id, event_type, title, description) VALUES
('123e4567-e89b-12d3-a456-426614174000', 
 'reviewing', 
 'Under Board Review', 
 'Your idea is being reviewed by the executive team');
```

**Résultat :**
| id | note_id | event_type | title | description | created_at |
|----|---------|------------|-------|-------------|------------|
| 345e6789-... | 123e4567-... | submission | Note Submitted | Your idea has been received... | 2025-12-02 03:54:30 |
| 456e7890-... | 123e4567-... | ai_analysis | AI Analysis Complete | Relevance Score: 8.5/10... | 2025-12-02 03:54:32 |
| 567e8901-... | 123e4567-... | fusion | Cluster Assignment | Your idea has been grouped... | 2025-12-02 03:54:35 |
| 678e9012-... | 123e4567-... | reviewing | Under Board Review | Your idea is being reviewed... | 2025-12-02 10:15:00 |

---

### 5. **clusters**

Groupes dynamiques de notes similaires.

```sql
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pillar_id UUID NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    
    -- Métadonnées du cluster
    note_count INTEGER DEFAULT 0,
    avg_relevance_score FLOAT DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Index :**
```sql
CREATE INDEX idx_clusters_pillar ON clusters(pillar_id);
CREATE INDEX idx_clusters_updated ON clusters(last_updated_at DESC);
```

**Trigger automatique pour mettre à jour les métadonnées :**
```sql
CREATE OR REPLACE FUNCTION update_cluster_metadata()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE clusters
    SET 
        note_count = (
            SELECT COUNT(*)
            FROM notes
            WHERE cluster_id = NEW.cluster_id AND status = 'processed'
        ),
        avg_relevance_score = (
            SELECT COALESCE(AVG(ai_relevance_score), 0)
            FROM notes
            WHERE cluster_id = NEW.cluster_id AND status = 'processed'
        ),
        last_updated_at = NOW()
    WHERE id = NEW.cluster_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cluster_on_note_change
AFTER INSERT OR UPDATE ON notes
FOR EACH ROW
WHEN (NEW.cluster_id IS NOT NULL AND NEW.status = 'processed')
EXECUTE FUNCTION update_cluster_metadata();
```

**Exemple de données :**
```sql
INSERT INTO clusters (pillar_id, title, note_count, avg_relevance_score) VALUES
('789e0123-e89b-12d3-a456-426614174002', -- ESG pillar
 'Carbon Footprint Reduction Initiatives',
 5,
 7.8);
```

**Résultat :**
| id | pillar_id | title | note_count | avg_relevance_score | created_at | last_updated_at |
|----|-----------|-------|------------|-------------------|------------|-----------------|
| 890e1234-... | 789e0123-... | Carbon Footprint Reduction Initiatives | 5 | 7.8 | 2025-12-01 10:00:00 | 2025-12-02 03:54:35 |

---

### 6. **cluster_snapshots**

Historique des snapshots de clusters (pour la fonctionnalité time-lapse).

```sql
CREATE TABLE cluster_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    
    -- Contenu du snapshot
    synthesis_text TEXT NOT NULL,
    metrics_json JSONB NOT NULL,
    included_note_ids UUID[] NOT NULL,
    
    -- Métadonnées du snapshot
    note_count INTEGER NOT NULL,
    avg_relevance_score FLOAT NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Index :**
```sql
CREATE INDEX idx_snapshots_cluster ON cluster_snapshots(cluster_id);
CREATE INDEX idx_snapshots_created ON cluster_snapshots(created_at DESC);
CREATE INDEX idx_snapshots_cluster_time ON cluster_snapshots(cluster_id, created_at DESC);
```

**Exemple de données :**
```sql
INSERT INTO cluster_snapshots (
    cluster_id, 
    synthesis_text, 
    metrics_json, 
    included_note_ids, 
    note_count, 
    avg_relevance_score
) VALUES (
    '890e1234-e89b-12d3-a456-426614174003',
    'This cluster focuses on implementing carbon footprint tracking across the supply chain. Key insights from IT (5 ideas, avg score 8.2) and Operations (2 ideas, avg score 7.0) suggest a strong technical foundation with operational buy-in. Recommended next steps: pilot program in Q1 2026.',
    '{"IT": 5, "Operations": 2, "Avg_Weight": 7.8}'::jsonb,
    ARRAY[
        '123e4567-e89b-12d3-a456-426614174000',
        '234e5678-e89b-12d3-a456-426614174001',
        '345e6789-e89b-12d3-a456-426614174002',
        '456e7890-e89b-12d3-a456-426614174003',
        '567e8901-e89b-12d3-a456-426614174004'
    ]::UUID[],
    5,
    7.8
);
```

**Résultat :**
| id | cluster_id | synthesis_text | metrics_json | included_note_ids | note_count | avg_relevance_score | created_at |
|----|------------|----------------|--------------|-------------------|------------|-------------------|------------|
| 678e9012-... | 890e1234-... | This cluster focuses on implementing... | {"IT": 5, "Operations": 2, "Avg_Weight": 7.8} | {123e4567-..., 234e5678-..., ...} | 5 | 7.8 | 2025-12-02 03:54:40 |

---

## 🔍 Fonctions PostgreSQL

### **find_similar_notes**

Recherche de notes similaires par similarité vectorielle.

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

**Utilisation :**
```sql
SELECT * FROM find_similar_notes(
    '[0.123, -0.456, ...]'::vector,
    '789e0123-e89b-12d3-a456-426614174002', -- ESG pillar
    0.75,
    10
);
```

**Résultat :**
| note_id | similarity |
|---------|-----------|
| 234e5678-... | 0.92 |
| 345e6789-... | 0.87 |
| 456e7890-... | 0.81 |

**Opérateur `<=>`** : Distance cosinus (pgvector)
- `0.0` = Identiques
- `1.0` = Opposés
- `1 - distance` = Similarité (0 à 1)

---

## 📊 Requêtes Utiles

### **1. Récupérer toutes les notes d'un utilisateur avec leurs clusters**

```sql
SELECT 
    n.id,
    n.content_raw,
    n.content_clarified,
    n.status,
    n.created_at,
    n.processed_at,
    n.ai_relevance_score,
    c.id AS cluster_id,
    c.title AS cluster_title,
    c.note_count AS cluster_note_count,
    p.name AS pillar_name
FROM notes n
LEFT JOIN clusters c ON n.cluster_id = c.id
LEFT JOIN pillars p ON c.pillar_id = p.id
WHERE n.user_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY n.created_at DESC;
```

### **2. Récupérer la timeline d'une note**

```sql
SELECT 
    id,
    event_type,
    title,
    description,
    created_at
FROM note_events
WHERE note_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at ASC;
```

### **3. Récupérer tous les clusters d'un pillar avec leurs métriques**

```sql
SELECT 
    c.id,
    c.title,
    c.note_count,
    c.avg_relevance_score,
    p.name AS pillar_name,
    COUNT(cs.id) AS snapshot_count
FROM clusters c
JOIN pillars p ON c.pillar_id = p.id
LEFT JOIN cluster_snapshots cs ON c.id = cs.cluster_id
WHERE p.id = '789e0123-e89b-12d3-a456-426614174002'
GROUP BY c.id, c.title, c.note_count, c.avg_relevance_score, p.name
ORDER BY c.last_updated_at DESC;
```

### **4. Récupérer l'historique des snapshots d'un cluster**

```sql
SELECT 
    id,
    synthesis_text,
    metrics_json,
    note_count,
    avg_relevance_score,
    created_at
FROM cluster_snapshots
WHERE cluster_id = '890e1234-e89b-12d3-a456-426614174003'
ORDER BY created_at DESC;
```

### **5. Statistiques globales**

```sql
SELECT 
    (SELECT COUNT(*) FROM notes) AS total_notes,
    (SELECT COUNT(*) FROM notes WHERE status = 'processed') AS processed_notes,
    (SELECT COUNT(*) FROM clusters) AS total_clusters,
    (SELECT COUNT(DISTINCT pillar_id) FROM clusters) AS active_pillars,
    (SELECT AVG(ai_relevance_score) FROM notes WHERE status = 'processed') AS avg_relevance_score;
```

---

## 🔐 Contraintes et Validations

### **Contraintes CHECK**

```sql
-- Statut des notes
CHECK (status IN ('draft', 'processing', 'processed', 'refused'))

-- Score de relevance
CHECK (ai_relevance_score BETWEEN 1 AND 10)

-- Niveau de séniorité
CHECK (seniority_level BETWEEN 1 AND 5)

-- Rôle utilisateur
CHECK (role IN ('employee', 'admin', 'board'))

-- Type d'événement
CHECK (event_type IN ('submission', 'ai_analysis', 'fusion', 'reviewing', 'refusal'))
```

### **Contraintes de clés étrangères**

```sql
-- Suppression en cascade
user_id REFERENCES users(id) ON DELETE CASCADE
cluster_id REFERENCES clusters(id) ON DELETE CASCADE
pillar_id REFERENCES pillars(id) ON DELETE CASCADE

-- Suppression avec NULL
pillar_id REFERENCES pillars(id) ON DELETE SET NULL
cluster_id REFERENCES clusters(id) ON DELETE SET NULL
```

---

## 🚀 Optimisations

### **Index pour la performance**

1. **Index B-tree** (recherches exactes)
   - `idx_users_email` : Recherche par email
   - `idx_notes_user` : Notes par utilisateur
   - `idx_notes_status` : Filtrage par statut

2. **Index IVFFlat** (recherche vectorielle)
   - `idx_notes_embedding` : Similarité cosinus
   - `lists = 100` : Nombre de partitions (ajuster selon le volume)

3. **Index composites**
   - `idx_note_events_note_id_created_at` : Timeline ordonnée
   - `idx_snapshots_cluster_time` : Historique de cluster

### **Triggers pour la cohérence**

1. **update_cluster_metadata** : Met à jour automatiquement `note_count` et `avg_relevance_score`
2. **update_updated_at_column** : Met à jour `updated_at` sur modification

---

## 📈 Volumétrie Estimée

| Table | Croissance | Volume (1 an) |
|-------|-----------|---------------|
| users | Faible | ~1,000 |
| pillars | Très faible | ~10 |
| notes | Élevée | ~100,000 |
| note_events | Très élevée | ~400,000 (4 événements/note) |
| clusters | Moyenne | ~5,000 |
| cluster_snapshots | Moyenne | ~20,000 (4 snapshots/cluster) |

**Taille estimée :** ~10 GB (avec embeddings)

---

**Dernière mise à jour :** 2 décembre 2025
