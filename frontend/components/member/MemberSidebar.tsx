'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/useApiClient';
import { useUser } from '@/contexts';
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
    Settings,
    HelpCircle,
    LogOut,
} from 'lucide-react';
import { SigmentLogo } from '../shared/SigmentLogo';
import { SettingsModal } from '../shared/SettingsModal';

interface MenuItem {
    label: string;
    icon: React.ReactNode;
    href: string;
    badge?: number;
}

export const MemberSidebar: React.FC = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [isHeaderHovered, setIsHeaderHovered] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const pathname = usePathname();
    const params = useParams();
    const { user, logout } = useUser();
    const apiClient = useApiClient();

    const orgSlug = params?.orgSlug as string;

    // Fetch unread count for Chat
    const { data: unreadData } = useQuery({
        queryKey: ['unread-status', orgSlug],
        queryFn: async () => {
            return apiClient.get<{ unread_conversations_count: number }>('/chat/unread-status');
        },
        refetchInterval: 15000,
        enabled: !!user
    });

    const unreadCount = unreadData?.unread_conversations_count || 0;

    const menuItems: MenuItem[] = [
        { label: 'Home', icon: <Home size={18} />, href: `/${orgSlug}/member` },
        { label: 'Node', icon: <Edit3 size={18} />, href: `/${orgSlug}/member/node` },
        { label: 'Track', icon: <FileCheck size={18} />, href: `/${orgSlug}/tracking` },
        {
            label: 'Chat',
            icon: <MessageCircle size={18} />,
            href: `/${orgSlug}/member/chat`,
            badge: unreadCount > 0 ? unreadCount : undefined
        },
        { label: 'Groups', icon: <Users size={18} />, href: `/${orgSlug}/member/groups` },
    ];

    return (
        <>
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
                                {isOpen && (
                                    <span className="flex-1 flex justify-between items-center">
                                        {item.label}
                                        {item.badge && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white text-black' : 'bg-black text-white'
                                                }`}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* User Profile */}
                <div
                    className={`p-4 border-t border-gray-100 mt-2 flex-shrink-0 relative ${!isOpen ? 'flex justify-center' : ''
                        }`}
                >
                    {/* Profile Popover */}
                    {isProfileOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setIsProfileOpen(false)}
                            />
                            <div className={`absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 animate-in slide-in-from-bottom-2 duration-200 ${!isOpen ? 'left-16 w-56' : ''}`}>
                                <div className="px-1 py-1">
                                    <button
                                        onClick={() => {
                                            setIsSettingsOpen(true);
                                            setIsProfileOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-black rounded-lg transition-colors"
                                    >
                                        <Settings size={16} />
                                        Settings
                                    </button>
                                    <button
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-black rounded-lg transition-colors"
                                    >
                                        <HelpCircle size={16} />
                                        Help & Support
                                    </button>
                                </div>
                                <div className="h-px bg-gray-100 my-1" />
                                <div className="px-1 py-1">
                                    <button
                                        onClick={logout}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <LogOut size={16} />
                                        Log out
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className={`flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors text-left group border border-transparent hover:border-gray-200 ${!isOpen ? 'justify-center' : ''
                            } ${isProfileOpen ? 'bg-gray-50 border-gray-200' : ''}`}
                    >
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 border border-gray-200 shrink-0">
                            <User size={14} />
                        </div>
                        {isOpen && (
                            <>
                                <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-sm font-semibold text-gray-900 truncate">
                                        {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || user.email : 'Loading...'}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate">
                                        {user?.job_title || 'Member'}
                                    </span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
                                        Member Space
                                    </span>
                                </div>
                                <MoreHorizontal size={16} className="text-gray-400 group-hover:text-black" />
                            </>
                        )}
                    </button>
                </div>
            </aside>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </>
    );
};
