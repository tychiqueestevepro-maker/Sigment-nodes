'use client'

import { Sidebar as BoardSidebar } from '@/components/board/BoardSidebar'
import { withRole } from '@/guards'

/**
 * BoardLayout - Niveau 3 du sandwich
 * Protected par withRole('BOARD')
 * Affiche la Sidebar Admin/Board
 */
function BoardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
            <BoardSidebar />
            <main className="flex-1 bg-white h-full relative flex flex-col overflow-hidden">
                {children}
            </main>
        </div>
    )
}

export default withRole(BoardLayout, 'BOARD')
