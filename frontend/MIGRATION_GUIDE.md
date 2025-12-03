# 🎯 Guide Complet de Migration API Client

## ✅ État Actuel de la Migration

### Pages Migrées
- ✅ **Owner** (`/[orgSlug]/owner/(main)/page.tsx`) - Complètement migré
- ✅ **Board** (`/[orgSlug]/board/(main)/page.tsx`) - Complètement migré
- ⏳ **Member** (`/[orgSlug]/member/page.tsx`) - Partiellement migré (imports ajoutés)

### Composants Créés
- ✅ `OrganizationContext.tsx` - Récupère org_id depuis API
- ✅ `useAuth.ts` - Hook d'authentification
- ✅ `useApiClient.ts` - Hook pour requêtes API
- ✅ `api-client.ts` - Client API core
- ✅ `AuthGuard.tsx` - Composant de protection de routes

---

## 📝 TODO : Finaliser la Migration Member

### Étape 1 : Modifier le composant Member

Remplacez les sections suivantes dans `/[orgSlug]/member/page.tsx` :

**Avant :**
```typescript
export default function MemberHomePage() {
    const [noteContent, setNoteContent] = useState('');

    // Fetch galaxy data
    const { data: clusters = [], isLoading } = useQuery({
        queryKey: ['galaxy'],
        queryFn: async () => {
            const response = await fetch(`${api.baseURL}/board/galaxy`);
            // ...
        },
    });
```

**Après :**
```typescript
export default function MemberHomePage() {
    const [noteContent, setNoteContent] = useState('');
    const queryClient = useQueryClient();
    const apiClient = useApiClient();

    // Fetch unified feed (posts + clusters + notes)
    const { data: feedData, isLoading } = useQuery({
        queryKey: ['unifiedFeed'],
        queryFn: async () => {
            return await apiClient.get<{ items: any[]; total_count: number }>('/feed/unified/');
        },
        refetchInterval: 30000,
        retry: 1,
    });
```

### Étape 2 : Update handleSubmitNote

**Avant :**
```typescript
const handleSubmitNote = async () => {
    // ...
    const userId = localStorage.getItem('sigment_user_id');
    const orgId = localStorage.getItem('sigment_org_id');
    
    const response = await fetch(`${api.baseURL}/feed/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId,
            'X-Organization-Id': orgId
        },
        body: JSON.stringify({ content: noteContent, post_type: 'standard' }),
    });
};
```

**Après :**
```typescript
const handleSubmitNote = async () => {
    if (!noteContent.trim()) {
        toast.error('Please enter some content');
        return;
    }

    try {
        await apiClient.post('/feed/posts', {
            content: noteContent,
            post_type: 'standard',
        });

        toast.success('Post published successfully!');
        setNoteContent('');
        
        queryClient.invalidateQueries({ queryKey: ['unifiedFeed'] });
    } catch (error) {
        console.error('Error publishing post:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to publish post');
    }
};
```

---

## 🛡️ Étape 3 : Ajouter AuthGuard aux Layouts

### `/app/[orgSlug]/layout.tsx`

```typescript
import { OrganizationProvider } from '@/shared/contexts/OrganizationContext';
import { AuthGuard } from '@/shared/components/AuthGuard';

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizationProvider>
      <AuthGuard requireAuth>
        {children}
      </AuthGuard>
    </OrganizationProvider>
  );
}
```

---

##  🔧 Étape 4 : Créer l'endpoint backend pour récupérer org par slug

### `backend/app/api/routes/organizations.py`

Ajoutez cet endpoint si ce n'est pas déjà fait :

```python
@router.get("/by-slug/{org_slug}")
async def get_organization_by_slug(org_slug: str, supabase=Depends(get_supabase_client)):
    """Get organization by slug"""
    try:
        org_response = supabase.table("organizations").select("*").eq("slug", org_slug).single().execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        return org_response.data
    except Exception as e:
        logger.error(f"Error fetching organization by slug: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

## ✅ Checklist Finale

- [ ] Terminer migration Member page
- [ ] Wrapper tous les layouts `[orgSlug]` avec `OrganizationProvider` et `AuthGuard`
- [ ] Créer l'endpoint backend `/organizations/by-slug/{slug}`
- [ ] Tester le login et vérifier localStorage
- [ ] Tester la création de posts dans Owner, Board, Member
- [ ] Vérifier que le feed se rafraîchit automatiquement après POST

---

## 🚨 Debugging

### Si vous avez des erreurs 401 :

```bash
# Dans la console du navigateur
localStorage.getItem('sigment_user_id');  // Doit être UUID
localStorage.getItem('sigment_org_id');    // Doit être UUID
localStorage.getItem('sigment_org_slug');  // Doit être le slug de l'URL
```

### Si le feed est vide :

1. Vérifiez que `/api/v1/feed/unified/` retourne bien des données avec Postman/curl
2. Vérifiez que les headers `X-User-Id` et `X-Organization-Id` sont envoyés
3. Regardez la console Network → Headers de la requête

---

## 📞 Support

Si vous rencontrez des problèmes, vérifiez :
1. Les imports sont corrects
2. `OrganizationProvider` est bien au-dessus dans la hiérarchie
3. Le backend a bien l'endpoint `/organizations/by-slug/{slug}`
4. Les migrations de base de données sont appliquées

**Questions ? Consultez le README_API_CLIENT.md** 
