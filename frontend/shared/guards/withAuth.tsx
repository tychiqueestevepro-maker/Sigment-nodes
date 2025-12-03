'use client'

import { useEffect, ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '../contexts/UserContext'

/**
 * Higher-Order Component (HOC) for authentication guard
 * Redirects to /login if user is not authenticated
 */
export function withAuth<P extends object>(
    Component: ComponentType<P>
) {
    return function AuthGuard(props: P) {
        const { isAuthenticated, isLoading } = useUser()
        const router = useRouter()

        useEffect(() => {
            if (!isLoading && !isAuthenticated) {
                router.push('/login')
            }
        }, [isAuthenticated, isLoading, router])

        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                </div>
            )
        }

        if (!isAuthenticated) {
            return null
        }

        return <Component {...props} />
    }
}
