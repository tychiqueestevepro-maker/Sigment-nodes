'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Target,
    TrendingUp,
    Heart,
    MessageSquare,
    CornerUpRight,
    Paperclip,
    ArrowUpRight,
    MoreVertical,
    Folder,
} from 'lucide-react';
import { api } from '@/lib/api';

interface PageProps {
    params: {
        pillarId: string;
    };
}

interface Cluster {
    id: string;
    title: string;
    description?: string;
    impact_score: number;
    volume: number;
    last_updated: string;
    pillar: string;
}

interface Pillar {
    id: string;
    name: string;
    description: string;
}

export default function PillarPage({ params }: PageProps) {
    const { pillarId } = params;

    // Fetch pillar details
    const { data: pillar } = useQuery<Pillar>({
        queryKey: ['pillar', pillarId],
        queryFn: async () => {
            // We can fetch from the list endpoint and filter, or use a specific endpoint if available
            // For now, let's fetch all pillars and find the one we need
            const response = await fetch(`${api.baseURL}/board/pillars`);
            if (!response.ok) throw new Error('Failed to fetch pillars');
            const pillars = await response.json();
            return pillars.find((p: Pillar) => p.id === pillarId);
        },
    });

    // Fetch clusters for this pillar
    const { data: clusters = [], isLoading } = useQuery<Cluster[]>({
        queryKey: ['clusters', pillarId],
        queryFn: async () => {
            const response = await fetch(`${api.baseURL}/board/galaxy?pillar_id=${pillarId}`);
            if (!response.ok) throw new Error('Failed to fetch clusters');
            return response.json();
        },
    });

    if (!pillar) return <div className="p-8">Loading pillar...</div>;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="h-20 border-b border-gray-100 flex items-center justify-between px-8 bg-white flex-shrink-0">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                        <Folder size={12} /> {pillar.name} Folder
                    </div>
                    <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                        # Strategic Board{' '}
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">
                            Confidential
                        </span>
                    </h1>
                </div>
                <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-pink-100 flex items-center justify-center text-xs font-bold text-pink-600">
                        EM
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-800 flex items-center justify-center text-xs font-bold text-white">
                        JB
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-bold">
                        +2
                    </div>
                    <button className="ml-4 text-gray-400 hover:text-gray-600">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Feed Content */}
            <div className="flex-1 bg-white overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto space-y-8">
                    {/* Pillar Description Card */}
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm text-black">
                                <Target size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 mb-1">Strategic Focus</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {pillar.description}
                                </p>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                        </div>
                    ) : clusters.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            No ideas in this pillar yet.
                        </div>
                    ) : (
                        clusters.map((cluster) => (
                            <div key={cluster.id} className="flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                                    AI
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-bold text-gray-900">Sigment AI</span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(cluster.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <div className="bg-white rounded-[2rem] rounded-tl-none p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer w-full max-w-lg">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-green-100 text-green-600 p-1.5 rounded-full">
                                                    <TrendingUp size={12} />
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                    New Cluster
                                                </span>
                                            </div>
                                            <CornerUpRight size={14} className="text-gray-300" />
                                        </div>

                                        <h4 className="font-bold text-gray-900 text-base mb-2 leading-tight">
                                            {cluster.title}
                                        </h4>
                                        <p className="text-xs text-gray-500 mb-4 line-clamp-3">
                                            {cluster.description || "No description available."}
                                        </p>

                                        <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
                                            <div className="flex items-center gap-1 text-gray-400 text-xs font-medium">
                                                <Heart size={12} /> {Math.floor(cluster.volume)}
                                            </div>
                                            <div className="flex items-center gap-1 text-gray-400 text-xs font-medium">
                                                <MessageSquare size={12} /> {Math.floor(cluster.impact_score / 10)}
                                            </div>
                                            <div className="ml-auto text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                IMPACT: {Math.floor(cluster.impact_score)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Reply Input */}
            <div className="p-6 bg-white border-t border-gray-100 flex-shrink-0">
                <div className="max-w-3xl mx-auto relative">
                    <div className="absolute left-4 top-3 text-gray-400 hover:text-gray-600 cursor-pointer">
                        <Paperclip size={20} />
                    </div>
                    <textarea
                        placeholder="Reply to the board..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-12 text-sm focus:ring-2 focus:ring-black focus:border-transparent resize-none outline-none"
                        rows={1}
                    />
                    <div className="absolute right-3 top-2 bg-black text-white p-1.5 rounded-lg cursor-pointer hover:bg-gray-800">
                        <ArrowUpRight size={16} />
                    </div>
                </div>
            </div>
        </div>
    );
}
