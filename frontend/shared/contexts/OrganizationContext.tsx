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
        // 1. Si pas de slug, on ne fait rien
        if (!orgSlug) {
            setIsLoading(false);
            return;
        }

        const fetchOrganizationData = async () => {
            try {
                // 2. Stratégie Cache : On regarde si on l'a déjà
                const cachedSlug = localStorage.getItem('sigment_org_slug');
                const cachedId = localStorage.getItem('sigment_org_id');
                const cachedRole = localStorage.getItem('sigment_user_role');

                if (cachedId && cachedSlug === orgSlug && cachedRole) {
                    setOrganizationId(cachedId);
                    setUserRole(cachedRole);
                    // On set une org partielle pour que withRole ne plante pas
                    setOrganization({ id: cachedId, slug: orgSlug, name: orgSlug });
                    setIsLoading(false);
                    // On continue quand même pour rafraîchir les données fraîches (SWR)
                }

                const userId = localStorage.getItem('sigment_user_id');
                if (!userId) {
                    // Si pas de user, on ne peut pas récupérer le rôle.
                    setIsLoading(false);
                    return;
                }

                // 3. Stratégie Réseau : On appelle l'API pour avoir Org + Role
                const data = await apiClient.get<any>(
                    `/organizations/${orgSlug}/me?user_id=${userId}`,
                    {},
                    { userId } // Auth headers
                );

                if (data && data.organization) {
                    setOrganizationId(data.organization.id);
                    setOrganization(data.organization);
                    setUserRole(data.role);

                    // Mise à jour du cache
                    localStorage.setItem('sigment_org_id', data.organization.id);
                    localStorage.setItem('sigment_org_slug', orgSlug);
                    localStorage.setItem('sigment_user_role', data.role);
                }
            } catch (error) {
                console.error("Error fetching organization data", error);
                // En cas d'erreur critique (404), on redirige
                if (error instanceof Error) {
                    if (error.message.includes('404')) {
                        router.push('/404');
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrganizationData();
    }, [orgSlug, router]);

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
