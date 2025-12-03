/**
 * Production-Ready API Client for Multi-Tenant Architecture
 * Handles authentication, organization context, and error management
 */

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';

interface RequestConfig extends RequestInit {
    skipAuth?: boolean;
}

interface AuthHeaders {
    userId?: string | null;
    organizationId?: string | null;
    token?: string | null;
}

class ApiClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    /**
     * Build request headers with authentication
     */
    private buildHeaders(authHeaders?: AuthHeaders, customHeaders?: HeadersInit): HeadersInit {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Get auth data from parameters or localStorage
        const userId = authHeaders?.userId || (typeof window !== 'undefined' ? localStorage.getItem('sigment_user_id') : null);
        const organizationId = authHeaders?.organizationId || (typeof window !== 'undefined' ? localStorage.getItem('sigment_org_id') : null);
        const token = authHeaders?.token || (typeof window !== 'undefined' ? localStorage.getItem('sigment_token') : null);

        // Add Bearer token if available
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Add Multi-Tenant headers (CRITICAL for backend)
        if (userId) {
            headers['X-User-Id'] = userId;
        }

        if (organizationId) {
            headers['X-Organization-Id'] = organizationId;
        }

        // Merge with custom headers
        return { ...headers, ...(customHeaders as Record<string, string>) };
    }

    /**
     * Make authenticated request
     */
    private async request<T>(
        endpoint: string,
        config: RequestConfig = {},
        authHeaders?: AuthHeaders
    ): Promise<T> {
        const { skipAuth, ...fetchConfig } = config;

        // Clean endpoint (remove leading slash if present)
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${this.baseUrl}${cleanEndpoint}`;

        // Build headers
        const headers = skipAuth
            ? { 'Content-Type': 'application/json', ...(config.headers as Record<string, string>) }
            : this.buildHeaders(authHeaders, config.headers);

        try {
            const response = await fetch(url, {
                ...fetchConfig,
                headers,
            });

            // Handle 401 Unauthorized - redirect to login
            if (response.status === 401) {
                console.error('🔒 Unauthorized - Redirecting to login...');
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
                throw new Error('Unauthorized');
            }

            // Handle other errors
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `API Error ${response.status}`;

                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.detail || errorMessage;
                } catch {
                    errorMessage = errorText || errorMessage;
                }

                throw new Error(errorMessage);
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return {} as T;
            }

            // Parse JSON response
            return await response.json();
        } catch (error) {
            // Re-throw with context
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Network error');
        }
    }

    /**
     * GET request
     */
    async get<T>(endpoint: string, config?: RequestConfig, authHeaders?: AuthHeaders): Promise<T> {
        return this.request<T>(endpoint, { ...config, method: 'GET' }, authHeaders);
    }

    /**
     * POST request
     */
    async post<T>(
        endpoint: string,
        body: any,
        config?: RequestConfig,
        authHeaders?: AuthHeaders
    ): Promise<T> {
        return this.request<T>(
            endpoint,
            {
                ...config,
                method: 'POST',
                body: JSON.stringify(body),
            },
            authHeaders
        );
    }

    /**
     * PUT request
     */
    async put<T>(
        endpoint: string,
        body: any,
        config?: RequestConfig,
        authHeaders?: AuthHeaders
    ): Promise<T> {
        return this.request<T>(
            endpoint,
            {
                ...config,
                method: 'PUT',
                body: JSON.stringify(body),
            },
            authHeaders
        );
    }

    /**
     * PATCH request
     */
    async patch<T>(
        endpoint: string,
        body: any,
        config?: RequestConfig,
        authHeaders?: AuthHeaders
    ): Promise<T> {
        return this.request<T>(
            endpoint,
            {
                ...config,
                method: 'PATCH',
                body: JSON.stringify(body),
            },
            authHeaders
        );
    }

    /**
     * DELETE request
     */
    async delete<T>(endpoint: string, config?: RequestConfig, authHeaders?: AuthHeaders): Promise<T> {
        return this.request<T>(endpoint, { ...config, method: 'DELETE' }, authHeaders);
    }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export type for use in components
export type { AuthHeaders };
