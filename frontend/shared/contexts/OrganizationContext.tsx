'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface OrganizationContextType {
    organizationId: string | null;
    orgSlug: string | null;
    isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType>({
    organizationId: null,
    orgSlug: null,
    isLoading: true,
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const orgSlug = params?.orgSlug as string | undefined;
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!orgSlug) {
            setIsLoading(false);
            return;
        }

        // Try to get from localStorage first (cached)
        const cachedOrgId = localStorage.getItem('sigment_org_id');
        const cachedSlug = localStorage.getItem('sigment_org_slug');

        if (cachedOrgId && cachedSlug === orgSlug) {
            setOrganizationId(cachedOrgId);
            setIsLoading(false);
            return;
        }

        // Otherwise, use cached user data from localStorage
        const storedOrgId = localStorage.getItem('sigment_org_id');
        if (storedOrgId) {
            setOrganizationId(storedOrgId);
            localStorage.setItem('sigment_org_slug', orgSlug);
        }

        setIsLoading(false);
    }, [orgSlug]);

    return (
        <OrganizationContext.Provider value={{ organizationId, orgSlug: orgSlug || null, isLoading }}>
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
