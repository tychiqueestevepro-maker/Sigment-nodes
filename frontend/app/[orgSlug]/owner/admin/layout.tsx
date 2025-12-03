'use client';

import React from 'react';
import { OwnerAdminSidebar } from '@/components/owner/OwnerAdminSidebar';
import { withRole } from '@/guards';

function OwnerAdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full bg-gray-50 font-sans text-gray-900 overflow-hidden">
            <OwnerAdminSidebar />
            <main className="flex-1 h-full overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

export default withRole(OwnerAdminLayout, 'OWNER');
