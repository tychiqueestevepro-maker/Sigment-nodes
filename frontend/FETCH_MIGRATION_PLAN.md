# 🔄 Migration Complète : fetch → useApiClient

## 📊 État de Migration

### ✅ Pages Déjà Migrées
- `/[orgSlug]/owner/(main)/page.tsx` - ✅ DONE
- `/[orgSlug]/board/(main)/page.tsx` - ✅ DONE

### ⏳ Pages À Migrer (16 fichiers)

#### 🔴 Priorité HAUTE (Pages Protégées - Nécessitent Auth)

1. **`/[orgSlug]/member/page.tsx`**
   - Ligne 83: `fetch(api.baseURL}/board/galaxy)` → `apiClient.get('/board/galaxy')`
   - Ligne 94: `fetch(${api.baseURL}/board/pillars)` → `apiClient.get('/board/pillars')`
   - Ligne 138: `fetch(${api.baseURL}/feed/posts)` → `apiClient.post('/feed/posts', body)`
   - **Action**: Migrer vers unified feed comme Owner/Board

2. **`/[orgSlug]/member/node/page.tsx`**
   - Ligne 101: `fetch(${api.baseURL}/notes)` → `apiClient.post('/notes', body)`
   - **Action**: Utiliser useApiClient pour créer une note

3. **`/[orgSlug]/member/track/page.tsx`**
   - Ligne 91: `fetch(${api.baseURL}/notes/user/${userId})` → `apiClient.get(\`/notes/user/\${userId}\`)`
   - **Action**: Remplacer par useApiClient

4. **`/[orgSlug]/board/(main)/review/page.tsx`**
   - Ligne 69: `fetch(${api.baseURL}/board/review-notes)` → `apiClient.get('/board/review-notes')`
   - **Action**: Remplacer par useApiClient

5. **`/[orgSlug]/owner/(main)/review/page.tsx`**
   - Ligne 69: `fetch(${api.baseURL}/board/review-notes)` → `apiClient.get('/board/review-notes')`
   - **Action**: Remplacer par useApiClient

6. **`/[orgSlug]/owner/admin/members/page.tsx`**
   - Ligne 50: `fetch(\`http://localhost:8000/api/v1/organizations/\${orgSlug}/members\`)` → `apiClient.get(\`/organizations/\${orgSlug}/members\`)`
   - Ligne 56: `fetch(\`http://localhost:8000/api/invitations?organization_id=...\`)` → `apiClient.get(\`/invitations?organization_id=...\`)`
   - **Action**: Remplacer par useApiClient

7. **`/[orgSlug]/owner/admin/members/invitations/page.tsx`**
   - Ligne 35: `fetch(\`http://localhost:8000/api/invitations?organization_id=...\`)` → `apiClient.get(\`/invitations?organization_id=...\`)`
   - **Action**: Remplacer par useApiClient

8. **`/[orgSlug]/board/panel/members/page.tsx`**
   - Ligne 49: `fetch(\`http://localhost:8000/api/v1/organizations/\${orgSlug}/members\`)` → `apiClient.get(\`/organizations/\${orgSlug}/members\`)`
   - Ligne 55: `fetch(\`http://localhost:8000/api/invitations?organization_id=...\`)` → `apiClient.get(\`/invitations?organization_id=...\`)`
   - **Action**: Remplacer par useApiClient

9. **`/[orgSlug]/board/panel/members/invitations/page.tsx`**
   - Ligne 35: `fetch(\`http://localhost:8000/api/invitations?organization_id=...\`)` → `apiClient.get(\`/invitations?organization_id=...\`)`
   - **Action**: Remplacer par useApiClient

#### 🟡 Priorité MOYENNE (Pages Publiques - Ne nécessitent PAS Auth)

10. **`/signup/page.tsx`**
    - Ligne 53: `fetch('http://localhost:8000/api/v1/auth/signup')` 
    - **Action**: Utiliser `apiClient` mais avec `skipAuth: true`

11. **`/join/page.tsx`**
    - Ligne 38: `fetch(\`http://localhost:8000/api/invitations/\${token}\`)` 
    - Ligne 69: `fetch('http://localhost:8000/api/invitations/accept')`
    - **Action**: Utiliser `apiClient` mais avec `skipAuth: true`

---

## 🛠️ Template de Migration

### Avant (❌):
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['notes'],
  queryFn: async () => {
    const response = await fetch(`${api.baseURL}/notes/user/${userId}`);
    if (!response.ok) throw new Error('Failed');
    return response.json();
  },
});
```

### Après (✅):
```typescript
import { useApiClient } from '../../../shared/hooks/useApiClient';

const apiClient = useApiClient();

const { data, isLoading } = useQuery({
  queryKey: ['notes'],
  queryFn: async () => {
    return await apiClient.get(`/notes/user/${userId}`);
  },
});
```

---

## 🚀 Ordre de Migration Recommandé

1. ✅ `/[orgSlug]/member/page.tsx` - Highest priority (feed principal)
2. ✅ `/[orgSlug]/member/node/page.tsx` - Création de notes
3. ✅ `/[orgSlug]/member/track/page.tsx` - Track queue
4. `/[orgSlug]/owner/admin/members/page.tsx` - Admin panel
5. `/[orgSlug]/board/panel/members/page.tsx` - Board panel
6. `/[orgSlug]/owner/(main)/review/page.tsx` - Review
7. `/[orgSlug]/board/(main)/review/page.tsx` - Review
8. Invitations pages (can use skipAuth if needed)
9. Public pages (signup, join) - Use skipAuth

---

## ⚙️ Configuration pour Pages Publiques

Pour les pages qui n'ont pas besoin d'auth (signup, join), utilisez :

```typescript
import { apiClient } from '@/shared/lib/api-client';

// Direct usage without hook (no auth headers)
const response = await apiClient.get('/public-endpoint', { skipAuth: true });
```

---

## ✅ Checklist de Migration par Fichier

- [ ] `/[orgSlug]/member/page.tsx`
- [ ] `/[orgSlug]/member/node/page.tsx`
- [ ] `/[orgSlug]/member/track/page.tsx`
- [ ] `/[orgSlug]/board/(main)/review/page.tsx`
- [ ] `/[orgSlug]/owner/(main)/review/page.tsx`
- [ ] `/[orgSlug]/owner/admin/members/page.tsx`
- [ ] `/[orgSlug]/owner/admin/members/invitations/page.tsx`
- [ ] `/[orgSlug]/board/panel/members/page.tsx`
- [ ] `/[orgSlug]/board/panel/members/invitations/page.tsx`
- [ ] `/signup/page.tsx` (skipAuth)
- [ ] `/join/page.tsx` (skipAuth)

---

## 🎯 Bénéfices Attendus

Après migration complète :
- ✅ Headers `X-User-Id` et `X-Organization-Id` automatiques
- ✅ Gestion d'erreur centralisée
- ✅ Redirection auto sur 401
- ✅ Type-safety avec TypeScript
- ✅ Code DRY (Don't Repeat Yourself)
- ✅ Aucune erreur 500 due aux headers manquants

---

**Prochaine Étape**: Migrer `/[orgSlug]/member/page.tsx` (EN COURS) 🚀
