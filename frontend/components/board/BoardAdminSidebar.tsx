'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Shield
} from 'lucide-react';
import { AdminSidebar } from '@/components/shared/AdminSidebar';

export function BoardAdminSidebar() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    const menuItems = [
        {
            label: 'Workspace',
            icon: <LayoutDashboard size={20} />,
            href: `/${orgSlug}/board/panel`
        },
        {
            label: 'Members',
            icon: <Users size={20} />,
            href: `/${orgSlug}/board/panel/members`
        },
        {
            label: 'Security',
            icon: <Shield size={20} />,
            href: `/${orgSlug}/board/panel/security`
        },
    ];

    return (
        <AdminSidebar
            title="Board Panel"
            menuItems={menuItems}
        />
    );
}
