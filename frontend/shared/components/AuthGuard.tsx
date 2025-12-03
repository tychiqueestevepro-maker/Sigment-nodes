'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

interface AuthGuardProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    redirectTo?: string;
}

/**
 * AuthGuard component - Protects routes based on authentication status
 * 
 * Usage:
 * ```tsx
 * <AuthGuard requireAuth>
 *   <YourProtectedComponent/>
 * </AuthGuard>
 * ```
 */
export function AuthGuard({
    children,
    requireAuth = true,
    redirectTo = '/login',
}: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, userId, organizationId, isLoading } = useAuth();

    useEffect(() => {
        // Wait for loading to finish before redirecting
        if (isLoading) return;

        // If authentication is required but user is not authenticated
        if (requireAuth && !isAuthenticated) {
            console.warn('🔒 User not authenticated - Redirecting to login');

            // Save the intended destination
            const returnUrl = encodeURIComponent(pathname || '/');
            router.push(`${redirectTo}?returnUrl=${returnUrl}`);
            return;
        }

        // Log auth status for debugging - REMOVED for production

    }, [isAuthenticated, requireAuth, router, redirectTo, pathname, userId, organizationId, isLoading]);

    // Show loading spinner while checking auth OR loading organization
    if (isLoading || (requireAuth && !isAuthenticated)) {
        return (
            <div className="h-screen w-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-600">
                        {isLoading ? 'Loading organization...' : 'Checking authentication...'}
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
