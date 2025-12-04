"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { useUser } from '@/contexts'; // Assurez-vous que useUser expose le 'role' ou 'membership'
import {
    Home, Orbit, FileCheck, BarChart2, MessageCircle, Users,
    Archive, User, MoreHorizontal, PanelLeftClose, PanelLeftOpen,
    LayoutDashboard, Edit3, Settings, HelpCircle, LogOut
} from 'lucide-react';
import { SigmentLogo } from './SigmentLogo';
import { SettingsModal } from './SettingsModal';

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

    const pathname = usePathname();
    const params = useParams();
    const router = useRouter();
    const { user, logout } = useUser();

    const orgSlug = params?.orgSlug as string;
    // Récupération du rôle (ajustez selon votre structure UserContext)
    const userRole = user?.role || 'MEMBER';

    // Configuration centralisée des menus
    const menuConfig: MenuItem[] = useMemo(() => [
        { label: "Home", icon: <Home size={18} />, href: `/${orgSlug}` },
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

    return (
        <>
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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
                                <span className={isActive ? 'text-black' : 'text-gray-500'}>{item.icon}</span>
                                {isOpen && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </div>

                {/* User Profile Section */}
                <div className="p-4 border-t border-gray-100 mt-2 relative">
                    {activeMenu === 'profile' && isOpen && (
                        <div className="absolute bottom-full left-2 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-1">
                            <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded-lg">
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
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><User size={14} /></div>
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
