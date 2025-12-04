'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    CreditCard,
    Shield
} from 'lucide-react';
import { AdminSidebar } from '@/components/shared/AdminSidebar';
import { useUser } from '@/contexts';

export function UnifiedAdminSidebar() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const { user } = useUser();
    const isOwner = user?.role === 'OWNER';

    const menuItems = [
        {
            label: 'Workspace',
            icon: <LayoutDashboard size={20} />,
            href: `/${orgSlug}/admin`
        },
        {
            label: 'Members',
            icon: <Users size={20} />,
            href: `/${orgSlug}/admin/members`
        },
        // Billing is typically Owner only
        ...(isOwner ? [{
            label: 'Billing',
            icon: <CreditCard size={20} />,
            href: `/${orgSlug}/admin/billing`
        }] : []),
        {
            label: 'Security',
            icon: <Shield size={20} />,
            href: `/${orgSlug}/admin/security`
        },
    ];

    return (
        <AdminSidebar
            title="Admin Panel"
            menuItems={menuItems}
        />
    );
}
