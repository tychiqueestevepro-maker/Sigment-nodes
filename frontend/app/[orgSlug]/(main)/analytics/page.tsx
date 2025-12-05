'use client';

import React from 'react';
import { BarChart2 } from 'lucide-react';
import RoleGuard from '@/guards/RoleGuard';

export default function AnalyticsPage() {
    return (
        <RoleGuard allowedRoles={['OWNER', 'BOARD']}>
            <div className="h-full w-full flex items-center justify-center p-10 animate-in fade-in duration-300">
                <div className="text-center max-w-md">
                    <div className="inline-flex items-center justify-center p-4 bg-gray-50 rounded-full mb-6">
                        <BarChart2 size={32} className="text-gray-900" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics</h2>
                    <p className="text-gray-500">
                        Engagement metrics and insights. Coming soon...
                    </p>
                </div>
            </div>
        </RoleGuard>
    );
}
