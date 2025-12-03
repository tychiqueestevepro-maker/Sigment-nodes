/**
 * API Fetch Wrapper with Authentication Headers
 * Automatically adds X-User-Id and X-Organization-Id headers to all requests
 */

/**
 * Get authentication headers from localStorage
 */
export function getAuthHeaders(): Record<string, string> {
    const userId = localStorage.getItem('sigment_user_id');
    const orgId = localStorage.getItem('sigment_org_id');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // X-User-Id is no longer needed as we use JWT for identity
    // if (userId) {
    //     headers['X-User-Id'] = userId;
    // }

    if (orgId) {
        headers['X-Organization-Id'] = orgId;
    }

    return headers;
}

/**
 * Authenticated fetch wrapper
 * Automatically includes authentication headers
 */
export async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const authHeaders = getAuthHeaders();

    const mergedOptions: RequestInit = {
        ...options,
        headers: {
            ...authHeaders,
            ...(options.headers || {}),
        },
    };

    return fetch(url, mergedOptions);
}
