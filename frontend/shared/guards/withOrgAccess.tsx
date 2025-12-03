'use client'

import { ComponentType } from 'react'
import { OrganizationProvider } from '../contexts/OrganizationContext'

/**
 * Higher-Order Component (HOC) for organization access guard
 * Wraps component with OrganizationProvider
 * The provider itself handles verification and redirects
 */
export function withOrgAccess<P extends object>(
    Component: ComponentType<P>
) {
    return function OrgAccessGuard(props: P) {
        return (
            <OrganizationProvider>
                <Component {...props} />
            </OrganizationProvider>
        )
    }
}
