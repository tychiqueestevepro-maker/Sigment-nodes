'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './shared/Sidebar';
import { useEffect, useState } from 'react';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isBoardMode, setIsBoardMode] = useState(true); // Default to board mode
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Check if we're on port 8001 (Board) or if pathname doesn't start with /member
        const port = window.location.port;
        const isBoardPort = port === '8001';
        const isMemberRoute = pathname?.startsWith('/member');
        const isMemberPort = port === '3000';

        // Board mode if on port 8001, OR if not member route and not on member port
        setIsBoardMode(isBoardPort || (!isMemberRoute && !isMemberPort));
    }, [pathname]);

    // For member routes or member port, don't render the Board sidebar
    if (!isBoardMode && isMounted) {
        return <>{children}</>;
    }

    // For Board routes, render with Board sidebar
    return (
        <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
            <Sidebar />
            <main className="flex-1 bg-white h-full relative flex flex-col overflow-hidden">
                {children}
            </main>
        </div>
    );
}
