'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ChevronLeft } from 'lucide-react';

export interface AdminMenuItem {
    label: string;
    icon: React.ReactNode;
    href: string;
}

interface AdminSidebarProps {
    title: string;
    menuItems: AdminMenuItem[];
    backLink?: string;
    backLabel?: string;
}

export function AdminSidebar({
    title,
    menuItems,
    backLink,
    backLabel = "Back to Workspace"
}: AdminSidebarProps) {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-black text-white flex flex-col h-full flex-shrink-0">
            {/* Header */}
            <div className="h-16 flex items-center px-6 border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                        <LayoutDashboard size={18} />
                    </div>
                    <span className="font-bold text-lg tracking-tight">{title}</span>
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 py-6 px-3 space-y-1">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                ? 'bg-white text-black'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            {backLink && (
                <div className="p-4 border-t border-gray-800">
                    <Link
                        href={backLink}
                        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        <ChevronLeft size={16} />
                        {backLabel}
                    </Link>
                </div>
            )}
        </aside>
    );
}
