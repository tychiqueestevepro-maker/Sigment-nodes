# 🔐 Production-Ready API Client - Multi-Tenant Architecture

## 📋 Architecture Overview

Ce système fournit une gestion centralisée et robuste des appels API avec support Multi-Tenant, authentification automatique, et gestion d'erreurs.

### 🏗️ Structure

```
frontend/shared/
├── contexts/
│   └── OrganizationContext.tsx    # Gère l'org_id depuis l'URL [orgSlug]
├── hooks/
│   ├── useAuth.ts                 # Hook d'authentification centralisé
│   └── useApiClient.ts            # Hook pour requêtes API authentifiées
└── lib/
    └── api-client.ts              # Client API singleton (core)
```

---

## 🚀 Usage dans vos composants

### Méthode Recommandée : Hook `useApiClient`

```typescript
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/shared/hooks/useApiClient';

export default function MyPage() {
  const api = useApiClient();  // ✅ Auto-injected auth headers!
  const queryClient = useQueryClient();

  // GET Request
  const { data, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.get<{ items: any[] }>('/feed/unified/'),
  });

  // POST Request
  const handleSubmit = async (content: string) => {
    try {
      await api.post('/feed/posts', {
        content,
        post_type: 'standard',
      });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (error) {
      console.error(error);
    }
  };

  return <div>...</div>;
}
```

---

## 🔑 Ce qui est géré automatiquement

1. **Base URL** : `http://localhost:8000/api/v1` (configurable via `NEXT_PUBLIC_API_URL`)
2. **Headers d'authentification** :
   - `Authorization: Bearer <token>` (si disponible)
   - `X-User-Id: <uuid>` ✅ **OBLIGATOIRE**
   - `X-Organization-Id: <uuid>` ✅ **OBLIGATOIRE**
   - `Content-Type: application/json`
3. **Gestion d'erreurs** :
   - 401 Unauthorized → Redirection automatique vers `/login`
   - Autres erreurs → Parse du message d'erreur depuis le backend
4. **TypeScript** : Support complet avec génériques

---

## 📦 Setup Requis

### 1. Wrappez votre app avec `OrganizationProvider`

```typescript
// app/[orgSlug]/layout.tsx
import { OrganizationProvider } from '@/shared/contexts/OrganizationContext';

export default function OrgLayout({ children }: { children: React.Node }) {
  return (
    <OrganizationProvider>
      {children}
    </OrganizationProvider>
  );
}
```

### 2. Assurez-vous que le localStorage contient :
- `sigment_user_id` → UUID de l'utilisateur (setté au login)
- `sigment_org_id` → UUID de l'organisation (setté au login)
- `sigment_token` → JWT token (optionnel, pour Bearer auth)

---

## 🛠️ Méthodes Disponibles

| Méthode | Signature | Exemple |
|---------|-----------|---------|
| `get` | `get<T>(endpoint, config?)` | `api.get<User>('/users/me')` |
| `post` | `post<T>(endpoint, body, config?)` | `api.post('/posts', { content })` |
| `put` | `put<T>(endpoint, body, config?)` | `api.put('/posts/123', { content })` |
| `patch` | `patch<T>(endpoint, body, config?)` | `api.patch('/users/me', { name })` |
| `delete` | `delete<T>(endpoint, config?)` | `api.delete('/posts/123')` |

---

## 🔍 Debug

### Si vous avez des erreurs 401 :

```javascript
// Dans la console du navigateur
console.log('User ID:', localStorage.getItem('sigment_user_id'));
console.log('Org ID:', localStorage.getItem('sigment_org_id'));
console.log('Token:', localStorage.getItem('sigment_token'));
```

Si ces valeurs sont `null`, vous devez vous **reconnecter**.

---

## ✅ Checklist Migration

- [ ] Remplacer tous les `fetch(...)` par `api.get(...)`
- [ ] Wrappé les routes `[orgSlug]` avec `OrganizationProvider`
- [ ] Testé le login et vérifié le localStorage
- [ ] Invalidé les queries après mutations (`invalidateQueries`)

---

## 🎯 Next Steps

1. **Migrer toutes les pages** : Board, Member, etc.
2. **Ajouter un AuthGuard** : Redirections automatiques si non authentifié
3. **Améliorer le Context** : Récupérer l'org_id depuis une API plutôt que localStorage

---

**Questions ? Contactez votre Senior Frontend Engineer 🚀**
