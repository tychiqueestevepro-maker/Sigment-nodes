'use client'

import { withOrgAccess } from '@/guards'
import { ReactNode } from 'react'

/**
 * OrganizationLayout - Niveau 2 du sandwich
 * Protected par withOrgAccess() qui enveloppe avec OrganizationProvider
 * Vérifie l'appartenance de l'user à l'org
 * Charge le contexte de l'organisation
 */
function OrganizationLayout({ children }: { children: ReactNode }) {
    return <>{children}</>
}

export default withOrgAccess(OrganizationLayout)
