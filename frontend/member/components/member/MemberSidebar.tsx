'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    PanelLeftClose,
    PanelLeftOpen,
    Home,
    Edit3,
    FileCheck,
    MessageCircle,
    Users,
    User,
    MoreHorizontal,
} from 'lucide-react';
import { SigmentLogo } from '../shared/SigmentLogo';

interface MenuItem {
    label: string;
    icon: React.ReactNode;
    href: string;
}

const menuItems: MenuItem[] = [
    { label: 'Home', icon: <Home size={18} />, href: '/' },
    { label: 'Node', icon: <Edit3 size={18} />, href: '/node' },
    { label: 'Track', icon: <FileCheck size={18} />, href: '/track' },
    { label: 'Chat', icon: <MessageCircle size={18} />, href: '/chat' },
    { label: 'Groups', icon: <Users size={18} />, href: '/groups' },
];

export const MemberSidebar: React.FC = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [isHeaderHovered, setIsHeaderHovered] = useState(false);
    const pathname = usePathname();

    return (
        <aside
            className={`flex flex-col h-full bg-white border-r border-gray-100 flex-shrink-0 transition-all duration-300 ease-in-out relative ${isOpen ? 'w-[260px]' : 'w-[80px]'
                }`}
        >
            {/* Header */}
            <div
                className={`h-16 flex items-center ${isOpen ? 'justify-between px-4 pl-5' : 'justify-center'
                    } flex-shrink-0`}
            >
                {isOpen ? (
                    <>
                        <div className="flex items-center text-black">
                            <SigmentLogo />
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-black transition-colors p-1 rounded-md hover:bg-gray-100"
                        >
                            <PanelLeftClose size={18} />
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => setIsOpen(true)}
                        onMouseEnter={() => setIsHeaderHovered(true)}
                        onMouseLeave={() => setIsHeaderHovered(false)}
                        className="w-10 h-10 flex items-center justify-center rounded-md transition-colors hover:bg-gray-100"
                        title="Expand Menu"
                    >
                        {isHeaderHovered ? (
                            <PanelLeftOpen size={24} className="text-gray-600 animate-in fade-in duration-200" />
                        ) : (
                            <div className="text-black animate-in fade-in duration-200">
                                <SigmentLogo />
                            </div>
                        )}
                    </button>
                )}
            </div>

            {/* Main Menu */}
            <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={`flex items-center gap-3 w-full px-3 py-2 text-[14px] font-medium rounded-md transition-all duration-200 group ${isActive
                                ? 'bg-black text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                                } ${!isOpen ? 'justify-center' : ''}`}
                            title={!isOpen ? item.label : ''}
                        >
                            <span
                                className={`${isActive ? 'text-white' : 'text-gray-500 group-hover:text-black'
                                    }`}
                            >
                                {item.icon}
                            </span>
                            {isOpen && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </div>

            {/* User Profile */}
            <div
                className={`p-4 border-t border-gray-100 mt-2 flex-shrink-0 ${!isOpen ? 'flex justify-center' : ''
                    }`}
            >
                <button
                    className={`flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors text-left group border border-transparent hover:border-gray-200 ${!isOpen ? 'justify-center' : ''
                        }`}
                >
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 border border-gray-200 shrink-0">
                        <User size={14} />
                    </div>
                    {isOpen && (
                        <>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-sm font-semibold text-gray-900 truncate">John Doe</span>
                                <span className="text-xs text-gray-500 truncate">Workspace Member</span>
                            </div>
                            <MoreHorizontal size={16} className="text-gray-400 group-hover:text-black" />
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
};
