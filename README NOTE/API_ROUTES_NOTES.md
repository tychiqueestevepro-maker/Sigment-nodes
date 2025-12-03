# 🔌 API Routes - Notes System

## Vue d'ensemble des endpoints

Toutes les routes sont préfixées par `/notes`

---

## 📝 Routes Notes

### 1. **Créer une note**

```http
POST /notes
```

**Description :** Crée une nouvelle note et déclenche le traitement IA asynchrone.

**Headers :**
```
Content-Type: application/json
```

**Body :**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_raw": "Nous devrions implémenter un système de suivi de l'empreinte carbone pour notre chaîne d'approvisionnement"
}
```

**Response (201 Created) :**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_raw": "Nous devrions implémenter un système de suivi de l'empreinte carbone pour notre chaîne d'approvisionnement",
  "content_clarified": null,
  "pillar_id": null,
  "cluster_id": null,
  "ai_relevance_score": null,
  "status": "draft",
  "created_at": "2025-12-02T03:54:30.123Z",
  "processed_at": null
}
```

**Codes d'erreur :**
- `400 Bad Request` : Données invalides (contenu trop court/long)
- `500 Internal Server Error` : Erreur serveur

---

### 2. **Synchroniser plusieurs notes (batch)**

```http
POST /notes/sync
```

**Description :** Permet de synchroniser plusieurs notes en une seule requête (mode offline-first).

**Body :**
```json
{
  "notes": [
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "content_raw": "Première idée..."
    },
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "content_raw": "Deuxième idée..."
    }
  ]
}
```

**Response (200 OK) :**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "content_raw": "Première idée...",
    "status": "draft",
    "created_at": "2025-12-02T03:54:30.123Z"
  },
  {
    "id": "234e5678-e89b-12d3-a456-426614174001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "content_raw": "Deuxième idée...",
    "status": "draft",
    "created_at": "2025-12-02T03:54:30.456Z"
  }
]
```

---

### 3. **Récupérer une note par ID**

```http
GET /notes/{note_id}
```

**Description :** Récupère les détails d'une note spécifique.

**Paramètres :**
- `note_id` (UUID) : ID de la note

**Response (200 OK) :**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_raw": "Nous devrions implémenter un système de suivi de l'empreinte carbone",
  "content_clarified": "Implement a carbon footprint tracking system for our supply chain to monitor and reduce environmental impact",
  "pillar_id": "789e0123-e89b-12d3-a456-426614174002",
  "cluster_id": "890e1234-e89b-12d3-a456-426614174003",
  "ai_relevance_score": 8.5,
  "status": "processed",
  "created_at": "2025-12-02T03:54:30.123Z",
  "processed_at": "2025-12-02T03:54:35.789Z"
}
```

**Codes d'erreur :**
- `404 Not Found` : Note introuvable
- `500 Internal Server Error` : Erreur serveur

---

### 4. **Récupérer toutes les notes d'un utilisateur**

```http
GET /notes/user/{user_id}
```

**Description :** Récupère toutes les notes soumises par un utilisateur spécifique (pour la page Track Queue).

**Paramètres :**
- `user_id` (UUID) : ID de l'utilisateur

**Response (200 OK) :**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Implement a carbon footprint tracking system for our supply chain",
    "content": "Nous devrions implémenter un système de suivi de l'empreinte carbone pour notre chaîne d'approvisionnement",
    "category": "ESG",
    "status": "Processed",
    "status_raw": "processed",
    "date": "02 Dec 2025, 03:54",
    "processed_date": "02 Dec 2025, 03:55",
    "relevance_score": 8.5,
    "cluster_id": "890e1234-e89b-12d3-a456-426614174003",
    "cluster_title": "Carbon Footprint Reduction Initiatives",
    "cluster_note_count": 5
  },
  {
    "id": "234e5678-e89b-12d3-a456-426614174001",
    "title": "Améliorer l'expérience client sur notre plateforme web",
    "content": "Améliorer l'expérience client sur notre plateforme web",
    "category": "Customer Experience",
    "status": "Processing",
    "status_raw": "processing",
    "date": "01 Dec 2025, 14:30",
    "processed_date": null,
    "relevance_score": 0,
    "cluster_id": null,
    "cluster_title": null,
    "cluster_note_count": 0
  }
]
```

**Transformation des données :**
- `title` : Utilise `content_clarified` si disponible, sinon tronque `content_raw`
- `category` : Nom du pillar (ex: "ESG", "Innovation")
- `status` : Version formatée du statut (ex: "Processed", "In Review")
- `date` : Date formatée (ex: "02 Dec 2025, 03:54")

**Codes d'erreur :**
- `500 Internal Server Error` : Erreur serveur

---

### 5. **Récupérer la timeline d'une note**

```http
GET /notes/{note_id}/timeline
```

**Description :** Récupère tous les événements du cycle de vie d'une note, ordonnés chronologiquement.

**Paramètres :**
- `note_id` (UUID) : ID de la note

**Response (200 OK) :**
```json
[
  {
    "id": "345e6789-e89b-12d3-a456-426614174004",
    "note_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": "submission",
    "title": "Note Submitted",
    "description": "Your idea has been received and is being processed by our AI system",
    "created_at": "2025-12-02T03:54:30.123Z"
  },
  {
    "id": "456e7890-e89b-12d3-a456-426614174005",
    "note_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": "ai_analysis",
    "title": "AI Analysis Complete",
    "description": "Relevance Score: 8.5/10 | Category: ESG",
    "created_at": "2025-12-02T03:54:32.456Z"
  },
  {
    "id": "567e8901-e89b-12d3-a456-426614174006",
    "note_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": "fusion",
    "title": "Cluster Assignment",
    "description": "Your idea has been grouped with similar ideas: 'Carbon Footprint Reduction Initiatives'",
    "created_at": "2025-12-02T03:54:35.789Z"
  },
  {
    "id": "678e9012-e89b-12d3-a456-426614174007",
    "note_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": "reviewing",
    "title": "Under Board Review",
    "description": "Your idea is being reviewed by the executive team",
    "created_at": "2025-12-02T10:15:00.000Z"
  }
]
```

**Types d'événements possibles :**
- `submission` : Note soumise
- `ai_analysis` : Analyse IA terminée
- `fusion` : Assignation à un cluster
- `reviewing` : En révision par le Board
- `refusal` : Note refusée

**Codes d'erreur :**
- `404 Not Found` : Note introuvable
- `500 Internal Server Error` : Erreur serveur

---

### 6. **Mettre à jour une note (Admin/Board)**

```http
PATCH /notes/{note_id}
```

**Description :** Permet de modérer une note (changer le statut ou le cluster). Réservé aux admins/board.

**Paramètres :**
- `note_id` (UUID) : ID de la note

**Body :**
```json
{
  "status": "refused"
}
```

**Ou :**
```json
{
  "status": "processed",
  "cluster_id": "890e1234-e89b-12d3-a456-426614174003"
}
```

**Response (200 OK) :**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_raw": "Nous devrions implémenter un système de suivi de l'empreinte carbone",
  "content_clarified": "Implement a carbon footprint tracking system for our supply chain",
  "pillar_id": "789e0123-e89b-12d3-a456-426614174002",
  "cluster_id": "890e1234-e89b-12d3-a456-426614174003",
  "ai_relevance_score": 8.5,
  "status": "refused",
  "created_at": "2025-12-02T03:54:30.123Z",
  "processed_at": "2025-12-02T03:54:35.789Z"
}
```

**Effets secondaires :**
- Si `status = "processed"` : Log d'un événement `reviewing`
- Si `status = "refused"` : Log d'un événement `refusal` + retraitement du cluster

**Codes d'erreur :**
- `404 Not Found` : Note introuvable
- `500 Internal Server Error` : Erreur serveur

---

### 7. **Supprimer une note (Admin)**

```http
DELETE /notes/{note_id}
```

**Description :** Supprime définitivement une note. Réservé aux admins.

**Paramètres :**
- `note_id` (UUID) : ID de la note

**Response (200 OK) :**
```json
{
  "status": "deleted",
  "note_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Codes d'erreur :**
- `500 Internal Server Error` : Erreur serveur

---

## 🔄 Statuts des Notes

| Statut | Description | Visible par |
|--------|-------------|-------------|
| `draft` | Note créée, en attente de traitement | Member, Admin, Board |
| `processing` | En cours de traitement par l'IA | Member, Admin, Board |
| `processed` | Traitement IA terminé, prête pour révision | Member, Admin, Board |
| `review` | En révision par le Board | Member, Admin, Board |
| `approved` | Approuvée par le Board | Member, Admin, Board |
| `refused` | Refusée par le Board | Member, Admin, Board |

---

## 🎯 Transitions de Statuts

```
draft → processing → processed → review → approved
                                      ↓
                                   refused
```

**Transitions automatiques (Celery) :**
- `draft` → `processing` : Au début du traitement
- `processing` → `processed` : À la fin du traitement

**Transitions manuelles (Board/Admin) :**
- `processed` → `review` : Board commence la révision
- `review` → `approved` : Board approuve
- `review` → `refused` : Board refuse

---

## 📊 Exemples d'utilisation

### **Scénario 1 : Soumission d'une note**

```bash
# 1. Créer une note
curl -X POST http://localhost:8000/notes \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "content_raw": "Implémenter un chatbot IA pour le support client"
  }'

# Réponse : Note créée avec status "draft"

# 2. Attendre quelques secondes (traitement async)

# 3. Vérifier la note
curl http://localhost:8000/notes/123e4567-e89b-12d3-a456-426614174000

# Réponse : Note avec status "processed", content_clarified rempli, cluster_id assigné
```

### **Scénario 2 : Suivi d'une note**

```bash
# 1. Récupérer toutes les notes de l'utilisateur
curl http://localhost:8000/notes/user/550e8400-e29b-41d4-a716-446655440000

# 2. Récupérer la timeline d'une note spécifique
curl http://localhost:8000/notes/123e4567-e89b-12d3-a456-426614174000/timeline

# Réponse : Liste des événements (submission, ai_analysis, fusion, etc.)
```

### **Scénario 3 : Modération par le Board**

```bash
# 1. Mettre la note en révision
curl -X PATCH http://localhost:8000/notes/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{"status": "processed"}'

# 2. Refuser la note
curl -X PATCH http://localhost:8000/notes/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{"status": "refused"}'

# Effet : Événement "refusal" loggé + cluster retraité
```

---

## 🔐 Permissions

| Endpoint | Member | Board | Admin |
|----------|--------|-------|-------|
| `POST /notes` | ✅ | ✅ | ✅ |
| `POST /notes/sync` | ✅ | ✅ | ✅ |
| `GET /notes/{id}` | ✅ (ses notes) | ✅ | ✅ |
| `GET /notes/user/{id}` | ✅ (soi-même) | ✅ | ✅ |
| `GET /notes/{id}/timeline` | ✅ (ses notes) | ✅ | ✅ |
| `PATCH /notes/{id}` | ❌ | ✅ | ✅ |
| `DELETE /notes/{id}` | ❌ | ❌ | ✅ |

---

## 📝 Validation des Données

### **NoteCreate**
- `content_raw` : 
  - Type : `string`
  - Min : 10 caractères
  - Max : 5000 caractères
  - Requis : ✅

- `user_id` :
  - Type : `UUID`
  - Requis : ✅

### **NoteUpdate**
- `status` :
  - Type : `string`
  - Valeurs : `"draft"`, `"processing"`, `"processed"`, `"review"`, `"approved"`, `"refused"`
  - Optionnel : ✅

- `cluster_id` :
  - Type : `UUID`
  - Optionnel : ✅

---

## 🚀 Performance

### **Temps de traitement moyen**
- Insertion en DB : ~50ms
- Traitement IA complet : ~5-10 secondes
  - Analyse OpenAI : ~2-3s
  - Génération embedding : ~1-2s
  - Recherche similarité : ~500ms
  - Mise à jour DB : ~100ms
  - Génération snapshot : ~2-3s (async)

### **Optimisations**
- Index sur `user_id`, `status`, `cluster_id`
- Index vectoriel (ivfflat) sur `embedding`
- Traitement asynchrone avec Celery
- Retry automatique (max 3 tentatives)

---

**Dernière mise à jour :** 2 décembre 2025
