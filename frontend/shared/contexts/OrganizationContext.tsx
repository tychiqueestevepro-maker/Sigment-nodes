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

        const fetchOrganizationData = async () => {
            try {
                // 1. Always fetch public organization details first to ensure we have the ID
                // This is critical for the X-Organization-ID header in subsequent requests
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
                    const accessData = await apiClient.get<any>(
                        `/organizations/${orgSlug}/me?user_id=${userId}`,
                        {},
                        { userId }
                    );

                    if (accessData && accessData.role) {
                        setUserRole(accessData.role);
                        localStorage.setItem('sigment_user_role', accessData.role);
                    }
                }
            } catch (error) {
                console.error("Error fetching organization data", error);
                // Only redirect on 404 (Org not found), not on auth errors
                if (error instanceof Error && error.message.includes('404')) {
                    router.push('/404');
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
