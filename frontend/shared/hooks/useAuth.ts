'use client';

import { useOrganization } from '../contexts/OrganizationContext';

interface UseAuthReturn {
    userId: string | null;
    organizationId: string | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

export function useAuth(): UseAuthReturn {
    const { organizationId, isLoading: isOrgLoading } = useOrganization();

    // Get from localStorage (set during login)
    const userId = typeof window !== 'undefined' ? localStorage.getItem('sigment_user_id') : null;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    return {
        userId,
        organizationId,
        token,
        isAuthenticated: !!(userId && organizationId),
        isLoading: isOrgLoading,
    };
}
