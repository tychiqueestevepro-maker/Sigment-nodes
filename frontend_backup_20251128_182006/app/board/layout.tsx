'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Folder, ChevronRight, ChevronDown, Hash } from 'lucide-react';
import { api } from '@/lib/api';

interface Pillar {
    id: string;
    name: string;
    description: string;
}

export default function BoardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // Fetch pillars
    const { data: pillars = [] } = useQuery<Pillar[]>({
        queryKey: ['pillars'],
        queryFn: async () => {
            const response = await fetch(`${api.baseURL}/board/pillars`);
            if (!response.ok) throw new Error('Failed to fetch pillars');
            return response.json();
        },
    });

    return (
        <div className="h-full w-full bg-white flex overflow-hidden">
            {/* Board Sidebar */}
            <div className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col pt-6 flex-shrink-0">
                <div className="px-6 mb-6">
                    <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                        <Folder size={20} /> Groups
                    </h2>
                </div>
                <div className="flex-1 px-4 space-y-2 overflow-y-auto">
                    {pillars.map((pillar) => {
                        const isActive = pathname.includes(`/board/${pillar.id}`);
                        return (
                            <div key={pillar.id}>
                                <Link
                                    href={`/board/${pillar.id}`}
                                    className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${isActive
                                            ? 'bg-white shadow-sm ring-1 ring-gray-200'
                                            : 'hover:bg-gray-100 text-gray-500'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Folder
                                            size={16}
                                            className={isActive ? 'text-black' : 'text-gray-400'}
                                        />
                                        <span
                                            className={`font-bold text-sm ${isActive ? 'text-gray-900' : 'text-gray-500'
                                                }`}
                                        >
                                            {pillar.name}
                                        </span>
                                    </div>
                                    {isActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </Link>

                                {isActive && (
                                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-3 animate-in slide-in-from-top-2 duration-200">
                                        <div className="py-2 px-2 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2 text-black bg-gray-100">
                                            <Hash size={14} />
                                            Strategic Board
                                        </div>
                                        {/* Placeholder for other channels */}
                                        <div className="py-2 px-2 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2 text-gray-500 hover:text-gray-700">
                                            <Hash size={14} />
                                            General
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {children}
            </div>
        </div>
    );
}
