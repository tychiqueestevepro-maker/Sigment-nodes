'use client';

import { useAuth } from './useAuth';
import { apiClient, type AuthHeaders } from '../lib/api-client';

/**
 * Hook for making authenticated API requests
 * Automatically includes user and organization context
 */
export function useApiClient() {
    const { userId, organizationId, token } = useAuth();

    const authHeaders: AuthHeaders = {
        userId,
        organizationId,
        token,
    };

    return {
        get: <T>(endpoint: string, config?: RequestInit) =>
            apiClient.get<T>(endpoint, config, authHeaders),

        post: <T>(endpoint: string, body: any, config?: RequestInit) =>
            apiClient.post<T>(endpoint, body, config, authHeaders),

        put: <T>(endpoint: string, body: any, config?: RequestInit) =>
            apiClient.put<T>(endpoint, body, config, authHeaders),

        patch: <T>(endpoint: string, body: any, config?: RequestInit) =>
            apiClient.patch<T>(endpoint, body, config, authHeaders),

        delete: <T>(endpoint: string, config?: RequestInit) =>
            apiClient.delete<T>(endpoint, config, authHeaders),

        // Expose auth state
        auth: { userId, organizationId, token },
    };
}
