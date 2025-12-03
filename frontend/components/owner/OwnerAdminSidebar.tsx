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

export function OwnerAdminSidebar() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    const menuItems = [
        {
            label: 'Workspace',
            icon: <LayoutDashboard size={20} />,
            href: `/${orgSlug}/owner/admin`
        },
        {
            label: 'Members',
            icon: <Users size={20} />,
            href: `/${orgSlug}/owner/admin/members`
        },
        {
            label: 'Billing',
            icon: <CreditCard size={20} />,
            href: `/${orgSlug}/owner/admin/billing`
        },
        {
            label: 'Security',
            icon: <Shield size={20} />,
            href: `/${orgSlug}/owner/admin/security`
        },
    ];

    return (
        <AdminSidebar
            title="Owner Panel"
            menuItems={menuItems}
        />
    );
}
