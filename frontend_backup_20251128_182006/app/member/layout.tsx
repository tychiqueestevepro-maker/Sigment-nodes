'use client';

import React from 'react';
import { MemberSidebar } from '@/components/member/MemberSidebar';

export default function MemberLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
            <MemberSidebar />
            <main className="flex-1 bg-white h-full relative flex flex-col overflow-hidden">
                {children}
            </main>
        </div>
    );
}
