"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import {
    Home,
    Orbit,
    FileCheck,
    BarChart2,
    MessageCircle,
    Users,
    Archive,
    User,
    MoreHorizontal,
    PanelLeftClose,
    PanelLeftOpen,
    LayoutDashboard,
    HelpCircle,
    LogOut,
    Settings
} from 'lucide-react';
import { SigmentLogo } from './SigmentLogo';

interface MenuItem {
    label: string;
    icon: React.ReactNode;
    href: string;
}

import { useUser } from '@/contexts';
import { SettingsModal } from './SettingsModal';

export const Sidebar: React.FC = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [isHeaderHovered, setIsHeaderHovered] = useState(false);
    const [activeMenu, setActiveMenu] = useState<'profile' | 'settings' | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const pathname = usePathname();
    const params = useParams();
    const router = useRouter();
    const { user, logout } = useUser();
    const profileRef = useRef<HTMLDivElement>(null);

    const orgSlug = params?.orgSlug as string;

    const menuItems: MenuItem[] = [
        { label: "Home", icon: <Home size={18} />, href: `/${orgSlug}/board` },
        { label: "Galaxy View", icon: <Orbit size={18} />, href: `/${orgSlug}/board/galaxy` },
        { label: "Review", icon: <FileCheck size={18} />, href: `/${orgSlug}/board/review` },
        { label: "Analytics", icon: <BarChart2 size={18} />, href: `/${orgSlug}/board/analytics` },
        { label: "Chat", icon: <MessageCircle size={18} />, href: `/${orgSlug}/board/chat` },
        { label: "Groups", icon: <Users size={18} />, href: `/${orgSlug}/board/groups` },
    ];

    const handleLogout = async () => {
        await logout();
    };

    return (
        <>
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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

                    {/* Archived */}
                    <div className="mt-auto pt-6">
                        {isOpen && (
                            <div className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Storage
                            </div>
                        )}
                        <Link
                            href={`/${orgSlug}/board/archived`}
                            className={`flex items-center gap-3 w-full px-3 py-2 text-[14px] font-medium rounded-md transition-all duration-200 ${pathname === `/${orgSlug}/board/archived`
                                ? 'bg-black text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                                } ${!isOpen ? 'justify-center' : ''}`}
                            title={!isOpen ? 'Archived' : ''}
                        >
                            <span className={pathname === `/${orgSlug}/board/archived` ? 'text-white' : 'text-gray-500'}>
                                <Archive size={18} />
                            </span>
                            {isOpen && <span>Archived</span>}
                        </Link>
                    </div>
                </div>

                {/* User Profile */}
                <div
                    className={`p-4 border-t border-gray-100 mt-2 flex-shrink-0 relative ${!isOpen ? 'flex justify-center' : ''
                        }`}
                    ref={profileRef}
                >
                    {/* Compact Profile Popover */}
                    {activeMenu === 'profile' && isOpen && (
                        <div className="absolute bottom-full left-2 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
                            <div className="p-3 bg-gray-50/50 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
                                        {user?.first_name?.[0] || user?.email?.[0] || 'U'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-gray-900 truncate">
                                            {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || user.email : 'Loading...'}
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate">
                                            {user?.job_title || 'Board Member'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-1 space-y-0.5">
                                <button
                                    onClick={() => {
                                        router.push(`/${orgSlug}/board/panel`);
                                        setActiveMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-left"
                                >
                                    <LayoutDashboard size={16} /> Board Panel
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSettingsOpen(true);
                                        setActiveMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-left"
                                >
                                    <Settings size={16} /> Settings
                                </button>
                                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-left">
                                    <HelpCircle size={16} /> Help & Support
                                </button>
                                <div className="h-px bg-gray-100 mx-2 my-1"></div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left font-medium"
                                >
                                    <LogOut size={16} /> Log out
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Main User Button Wrapper */}
                    <div className={`flex items-center gap-2 w-full p-1 rounded-lg hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200 ${!isOpen ? 'justify-center' : ''}`}>
                        {/* Profile Click Area */}
                        <button
                            onClick={() => setActiveMenu(activeMenu === 'profile' ? null : 'profile')}
                            className="flex items-center gap-2 flex-1 text-left"
                        >
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 border border-gray-200 shrink-0">
                                <User size={14} />
                            </div>
                            {isOpen && (
                                <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-sm font-semibold text-gray-900 truncate">
                                        {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || user.email : 'Loading...'}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate">
                                        {user?.job_title || 'Board Member'}
                                    </span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
                                        Board Space
                                    </span>
                                </div>
                            )}
                        </button>

                        {/* Settings Dots Click Area */}
                        {isOpen && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(activeMenu === 'profile' ? null : 'profile');
                                }}
                                className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-200 rounded-md transition-colors"
                            >
                                <MoreHorizontal size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};
