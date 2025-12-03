'use client'

import { MemberSidebar } from '@/components/member/MemberSidebar'

/**
 * MemberLayout - Niveau 3 du sandwich
 * Affiche la navigation Member standard
 * Pas de guard ici car tous les membres de l'org peuvent accéder
 */
import { withRole } from '@/guards'

/**
 * MemberLayout - Niveau 3 du sandwich
 * Affiche la navigation Member standard
 * Protected par withRole('MEMBER') pour redirection stricte
 */
function MemberLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
            <MemberSidebar />
            <main className="flex-1 bg-white h-full relative flex flex-col overflow-hidden">
                {children}
            </main>
        </div>
    )
}

export default withRole(MemberLayout, 'MEMBER')
