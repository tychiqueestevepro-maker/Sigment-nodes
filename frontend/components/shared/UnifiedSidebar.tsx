"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/useApiClient';
import { useUser } from '@/contexts'; // Assurez-vous que useUser expose le 'role' ou 'membership'
import {
    Home, Orbit, FileCheck, BarChart2, MessageCircle, Users,
    Archive, User, MoreHorizontal, PanelLeftClose, PanelLeftOpen,
    LayoutDashboard, Edit3, Settings, HelpCircle, LogOut, UserCircle
} from 'lucide-react';
import { SigmentLogo } from './SigmentLogo';
import { SettingsModal } from './SettingsModal';
import { ProfileModal } from './ProfileModal';

// Définition des types de menu avec restriction par rôle
interface MenuItem {
    label: string;
    icon: React.ReactNode;
    href: string;
    roles?: string[]; // Si non défini, accessible à tous
}

export const UnifiedSidebar: React.FC = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [activeMenu, setActiveMenu] = useState<'profile' | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const pathname = usePathname();
    const params = useParams();
    const router = useRouter();
    const { user, logout } = useUser();

    const orgSlug = params?.orgSlug as string;
    // Récupération du rôle (ajustez selon votre structure UserContext)
    // Récupération du rôle (ajustez selon votre structure UserContext)
    const userRole = user?.role || 'MEMBER';
    const api = useApiClient();

    // Fetch unread status for chat
    const { data: unreadStatus } = useQuery({
        queryKey: ['chatUnreadStatus', user?.id],
        queryFn: async () => {
            if (!user) return { has_unread: false };
            return api.get<{ has_unread: boolean }>('/chat/unread-status');
        },
        // Poll every 1 minute to keep it relatively fresh without overloading
        refetchInterval: 60000,
        enabled: !!user,
    });

    // Configuration centralisée des menus
    const menuConfig: MenuItem[] = useMemo(() => [
        { label: "Home", icon: <Home size={18} />, href: `/${orgSlug}/home` },
        // Items Owner/Board
        { label: "Galaxy View", icon: <Orbit size={18} />, href: `/${orgSlug}/galaxy`, roles: ['OWNER', 'BOARD'] },
        { label: "Review", icon: <FileCheck size={18} />, href: `/${orgSlug}/review`, roles: ['OWNER', 'BOARD'] },
        { label: "Analytics", icon: <BarChart2 size={18} />, href: `/${orgSlug}/analytics`, roles: ['OWNER', 'BOARD'] },
        // Items Member
        { label: "Node", icon: <Edit3 size={18} />, href: `/${orgSlug}/node`, roles: ['MEMBER'] },
        { label: "Track", icon: <FileCheck size={18} />, href: `/${orgSlug}/tracking`, roles: ['MEMBER'] },
        // Items Communs
        { label: "Chat", icon: <MessageCircle size={18} />, href: `/${orgSlug}/chat` },
        { label: "Groups", icon: <Users size={18} />, href: `/${orgSlug}/groups` },
    ], [orgSlug]);

    // Filtrage des items basé sur le rôle
    const filteredMenu = menuConfig.filter(item =>
        !item.roles || item.roles.includes(userRole)
    );

    const handleOpenProfile = () => {
        setActiveMenu(null);
        setIsProfileOpen(true);
    };

    const handleOpenSettings = () => {
        setActiveMenu(null);
        setIsSettingsOpen(true);
    };

    return (
        <>
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

            <aside className={`flex flex-col h-full bg-white border-r border-gray-100 transition-all duration-300 relative ${isOpen ? 'w-[260px]' : 'w-[70px]'}`}>
                {/* Header Logo */}
                <div className={`h-16 flex items-center ${isOpen ? '' : 'justify-center'}`}>
                    {isOpen ? (
                        <div className="flex items-center justify-between w-full px-4">
                            <div className="flex items-center gap-2">
                                <SigmentLogo />
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-black p-1">
                                <PanelLeftClose size={18} />
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setIsOpen(true)} className="text-black p-1 hover:bg-gray-100 rounded-lg transition-colors">
                            <SigmentLogo />
                        </button>
                    )}
                </div>

                {/* Menu Items */}
                <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
                    {filteredMenu.map((item) => {
                        // Correspondance exacte ou partielle pour les sous-routes
                        const isActive = item.href === `/${orgSlug}`
                            ? pathname === item.href
                            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-md transition-all ${isActive ? 'bg-gray-100 text-black font-semibold' : 'text-gray-600 hover:bg-gray-50'} ${!isOpen ? 'justify-center' : ''}`}
                            >
                                <div className="relative">
                                    <span className={isActive ? 'text-black' : 'text-gray-500'}>{item.icon}</span>
                                    {item.label === 'Chat' && unreadStatus?.has_unread && (
                                        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-black rounded-full border-2 border-white translate-x-1/3 -translate-y-1/3" />
                                    )}
                                </div>
                                {isOpen && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </div>

                {/* User Profile Section */}
                <div className="p-4 border-t border-gray-100 mt-2 relative">
                    {activeMenu === 'profile' && isOpen && (
                        <div className="absolute bottom-full left-2 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-1">
                            <button onClick={handleOpenProfile} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded-lg">
                                <UserCircle size={16} /> Profile
                            </button>
                            <button onClick={handleOpenSettings} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded-lg">
                                <Settings size={16} /> Settings
                            </button>
                            {/* Lien Admin conditionnel */}
                            {['OWNER', 'BOARD'].includes(userRole) && (
                                <button onClick={() => router.push(`/${orgSlug}/admin`)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded-lg">
                                    <LayoutDashboard size={16} /> Admin Panel
                                </button>
                            )}
                            <div className="h-px bg-gray-100 my-1" />
                            <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                                <LogOut size={16} /> Log out
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => setActiveMenu(activeMenu ? null : 'profile')}
                        className={`flex items-center gap-2 w-full p-1 hover:bg-gray-50 rounded-lg ${!isOpen ? 'justify-center' : ''}`}
                    >
                        <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                            {user?.avatar_url ? (
                                <img src={user.avatar_url} alt={user.name || 'User'} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-white text-xs font-bold">
                                    {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : <User size={14} />}
                                </span>
                            )}
                        </div>
                        {isOpen && (
                            <div className="flex flex-col items-start overflow-hidden">
                                <span className="text-sm font-semibold truncate w-full text-left">{user?.name || 'User'}</span>
                                <span className="text-xs text-gray-500">{userRole} Space</span>
                            </div>
                        )}
                        {isOpen && <MoreHorizontal size={16} className="ml-auto text-gray-400" />}
                    </button>
                </div>
            </aside>
        </>
    );
};

