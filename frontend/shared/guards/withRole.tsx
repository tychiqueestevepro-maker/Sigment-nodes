'use client'

import { useEffect, ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '../contexts/OrganizationContext'
import { UserRole } from '@/types/organization'

/**
 * Higher-Order Component (HOC) for role-based access control
 * Redirects to appropriate space if user doesn't have required role
 */
export function withRole<P extends object>(
    Component: ComponentType<P>,
    requiredRole: UserRole
) {
    return function RoleGuard(props: P) {
        const { userRole, organization, isLoading } = useOrganization()
        const router = useRouter()

        useEffect(() => {
            if (!isLoading) {
                if (!userRole) {
                    // Si pas de rôle après chargement, on redirige vers login ou 403
                    // Mais on laisse AuthGuard gérer si c'est un problème d'auth
                    return;
                }

                if (userRole !== requiredRole) {
                    // Redirect to user's correct space based on their role
                    let redirectPath: string;

                    if (userRole === 'OWNER') {
                        redirectPath = `/${organization?.slug}/owner`;
                    } else if (userRole === 'BOARD') {
                        redirectPath = `/${organization?.slug}/board`;
                    } else {
                        redirectPath = `/${organization?.slug}/member`;
                    }

                    console.warn(`Access denied. Required role: ${requiredRole}, User role: ${userRole}`);
                    router.push(redirectPath);
                }
            }
        }, [userRole, isLoading, organization, router])

        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                </div>
            )
        }

        // Si pas de rôle, on n'affiche rien ou un message d'erreur, pour éviter de flasher le contenu protégé
        if (!userRole) {
            return null; // Ou <div className="p-8 text-center">Checking permissions...</div>
        }

        if (userRole !== requiredRole) {
            return <div className="p-8 text-center">Redirecting to your workspace...</div>
        }

        return <Component {...props} />
    }
}
