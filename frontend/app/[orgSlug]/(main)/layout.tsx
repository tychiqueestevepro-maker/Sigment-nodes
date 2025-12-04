'use client'

import { UnifiedSidebar } from '@/components/shared/UnifiedSidebar'
// Note: withRole est supprimé ici car le routing est géré par page ou dynamiquement
// Nous gardons withOrgAccess au niveau supérieur ([orgSlug]/layout.tsx)

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
            <UnifiedSidebar />
            <main className="flex-1 bg-white h-full relative flex flex-col overflow-hidden">
                {children}
            </main>
        </div>
    )
}
