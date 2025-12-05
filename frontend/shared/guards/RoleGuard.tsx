'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '../contexts/OrganizationContext'

interface RoleGuardProps {
    children: ReactNode
    allowedRoles: string[]
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const { userRole, orgSlug, isLoading } = useOrganization()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && userRole) {
            if (!allowedRoles.includes(userRole)) {
                // Redirect to the main dashboard if not allowed
                // If orgSlug is available, go to org root, else go to home
                const target = orgSlug ? `/${orgSlug}` : '/'
                router.push(target)
            }
        }
    }, [userRole, isLoading, allowedRoles, orgSlug, router])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    // If no role (not logged in or error) or role not allowed, don't render children
    if (!userRole || !allowedRoles.includes(userRole)) {
        return null
    }

    return <>{children}</>
}
