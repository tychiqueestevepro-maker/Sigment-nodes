'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UnifiedAdminSidebar } from '@/components/shared/UnifiedAdminSidebar';
import { useUser } from '@/contexts';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && user) {
            if (!['OWNER', 'BOARD'].includes(user.role || '')) {
                router.push('/'); // Redirect unauthorized users
            }
        }
    }, [user, isLoading, router]);

    if (isLoading) return null;

    return (
        <div className="flex h-screen w-full bg-gray-50 font-sans text-gray-900 overflow-hidden">
            <UnifiedAdminSidebar />
            <main className="flex-1 h-full overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
