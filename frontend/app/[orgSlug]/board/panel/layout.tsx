'use client';

import React from 'react';
import { BoardAdminSidebar } from '@/components/board/BoardAdminSidebar';
import { withRole } from '@/guards';

function BoardPanelLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full bg-gray-50 font-sans text-gray-900 overflow-hidden">
            <BoardAdminSidebar />
            <main className="flex-1 h-full overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

export default withRole(BoardPanelLayout, 'BOARD');
