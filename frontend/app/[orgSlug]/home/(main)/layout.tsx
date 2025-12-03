'use client'

import { Sidebar as OwnerSidebar } from '@/components/owner/OwnerSidebar'
import { withRole } from '@/guards'

/**
 * OwnerLayout - Niveau 3 du sandwich
 * Protected par withRole('OWNER')
 * Affiche la Sidebar Owner
 */
function OwnerLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
            <OwnerSidebar />
            <main className="flex-1 bg-white h-full relative flex flex-col overflow-hidden">
                {children}
            </main>
        </div>
    )
}

export default withRole(OwnerLayout, 'OWNER')
