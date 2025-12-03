'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useOrganization } from '@/contexts'

/**
 * Organization root page - Smart redirect
 * Redirects to /board or /member based on user role
 */
export default function OrganizationRootPage() {
    const { userRole, organization } = useOrganization()
    const router = useRouter()
    const params = useParams()
    const orgSlug = params?.orgSlug as string

    useEffect(() => {
        if (userRole && organization) {
            const targetPath = userRole === 'BOARD'
                ? `/${orgSlug}/board`
                : `/${orgSlug}/member`

            router.push(targetPath)
        }
    }, [userRole, organization, orgSlug, router])

    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="text-gray-600">Redirecting to your workspace...</p>
            </div>
        </div>
    )
}
