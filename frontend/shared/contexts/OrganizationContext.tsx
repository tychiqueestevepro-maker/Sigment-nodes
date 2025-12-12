'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '../lib/api-client';

interface Organization {
    id: string;
    slug: string;
    name: string;
    logo_url?: string;
}

interface OrganizationContextType {
    organizationId: string | null;
    orgSlug: string | null;
    organization: Organization | null;
    userRole: string | null;
    isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType>({
    organizationId: null,
    orgSlug: null,
    organization: null,
    userRole: null,
    isLoading: true,
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const orgSlug = params?.orgSlug as string | undefined;

    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const router = useRouter();

    useEffect(() => {
        if (!orgSlug) {
            setIsLoading(false);
            return;
        }

        // --- CACHE FIRST STRATEGY ---
        // Try to load from cache immediately to bypass loading screen
        const cachedSlug = localStorage.getItem('sigment_org_slug');
        const cachedId = localStorage.getItem('sigment_org_id');
        const cachedRole = localStorage.getItem('sigment_user_role');

        let loadedFromCache = false;

        // Verify cache matches current slug
        if (cachedSlug === orgSlug && cachedId) {
            setOrganizationId(cachedId);
            // Construct minimal org object from cache so app can render
            setOrganization({
                id: cachedId,
                slug: orgSlug,
                name: orgSlug, // Placeholder until fetch
                logo_url: undefined
            });
            if (cachedRole) {
                setUserRole(cachedRole);
            }
            // If we have minimal data, stop loading immediately!
            setIsLoading(false);
            loadedFromCache = true;
        }

        const fetchOrganizationData = async () => {
            try {
                // 1. Always fetch public organization details first
                const orgData = await apiClient.get<Organization>(
                    `/organizations/${orgSlug}/public`
                );

                if (orgData && orgData.id) {
                    setOrganizationId(orgData.id);
                    setOrganization(orgData);

                    // Update cache
                    localStorage.setItem('sigment_org_id', orgData.id);
                    localStorage.setItem('sigment_org_slug', orgSlug);
                } else {
                    throw new Error('Organization not found');
                }

                // 2. If we have a user, fetch their role
                const userId = localStorage.getItem('sigment_user_id');
                if (userId) {
                    try {
                        const accessData = await apiClient.get<any>(
                            `/organizations/${orgSlug}/me`
                        );

                        if (accessData && accessData.role) {
                            setUserRole(accessData.role);
                            localStorage.setItem('sigment_user_role', accessData.role);
                        }
                    } catch (err: any) {
                        // Silently handle temporary server errors (500)
                        // Don't log 500 errors during server startup/restart
                        if (err.response?.status !== 500 && !err.message?.includes('500')) {
                            console.error("Error fetching user role", err);
                        }
                    }
                }
            } catch (error: any) {
                // Only log unexpected errors (not 500 or 404)
                const isExpectedError = error.message?.includes('500') ||
                    error.message?.includes('404') ||
                    error.response?.status === 500 ||
                    error.response?.status === 404;

                if (!isExpectedError) {
                    console.error("Error fetching organization data", error);
                }

                // Only redirect on 404 if we didn't load from cache
                if (error instanceof Error && error.message.includes('404')) {
                    if (!loadedFromCache) {
                        router.push('/404');
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrganizationData();
    }, [orgSlug, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <OrganizationContext.Provider value={{
            organizationId,
            orgSlug: orgSlug || null,
            organization,
            userRole,
            isLoading
        }}>
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization() {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error('useOrganization must be used within OrganizationProvider');
    }
    return context;
}
