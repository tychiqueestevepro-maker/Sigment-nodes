'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Heart, MessageCircle, Share2, Layers, Eye, CheckCircle2, XCircle, Loader2, Search, Folder, ChevronRight } from 'lucide-react';
import { useApiClient } from '@/hooks/useApiClient';
import { CommentSection } from '@/components/feed/comments';
import { useOrganization } from '@/contexts/OrganizationContext';

// Types
interface IdeaDetail {
    id: string;
    title?: string;
    content: string;
    content_raw?: string;
    content_clarified?: string;
    status: string;
    pillar_id?: string;
    pillar_name?: string;
    pillar_color?: string;
    cluster_id?: string;
    ai_relevance_score?: number;
    user_id: string;
    user_info?: {
        email?: string;
        first_name?: string;
        last_name?: string;
        avatar_url?: string;
    };
    likes_count?: number;
    comments_count?: number;
    is_liked?: boolean;
    created_at: string;
    processed_at?: string;
}

interface Pillar {
    id: string;
    name: string;
    count?: number;
}

interface GalaxyFolder {
    id: string;
    name: string;
    count: number;
    color: string;
}

// Status badge configuration
function getStatusConfig(status: string): { label: string; color: string; bg: string; icon: React.ReactNode } | null {
    switch (status) {
        case 'review':
            return { label: 'In Review', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <Eye size={12} /> };
        case 'approved':
            return { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <CheckCircle2 size={12} /> };
        case 'refused':
            return { label: 'Refused', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: <XCircle size={12} /> };
        default:
            return null;
    }
}

// Helper function to get color for pillar
function getColorForPillar(pillarName: string): string {
    const name = pillarName.toLowerCase();
    if (name.includes('product')) return 'bg-blue-100 text-blue-600';
    if (name.includes('marketing')) return 'bg-red-100 text-red-600';
    if (name.includes('operations')) return 'bg-green-100 text-green-600';
    if (name.includes('finance')) return 'bg-yellow-100 text-yellow-600';
    if (name.includes('people') || name.includes('hr')) return 'bg-purple-100 text-purple-600';
    if (name.includes('uncategorized')) return 'bg-gray-100 text-gray-500';
    return 'bg-gray-100 text-gray-500';
}

export default function IdeaDetailPage() {
    const params = useParams();
    const router = useRouter();
    const apiClient = useApiClient();
    const ideaId = params.ideaId as string;
    const { organizationId } = useOrganization();

    const [idea, setIdea] = useState<IdeaDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);

    // Fetch pillars for sidebar
    const { data: pillarsData = [] } = useQuery<Pillar[]>({
        queryKey: ['pillars', organizationId],
        queryFn: async () => {
            if (!organizationId) return [];
            return await apiClient.get<Pillar[]>('/board/pillars');
        },
        enabled: !!organizationId,
    });

    const galaxyFolders: GalaxyFolder[] = pillarsData.map((pillar) => ({
        id: pillar.id,
        name: pillar.name,
        count: pillar.count || 0,
        color: getColorForPillar(pillar.name),
    }));

    // Fetch idea details
    useEffect(() => {
        const fetchIdea = async () => {
            try {
                setIsLoading(true);
                const data = await apiClient.get<IdeaDetail>(`/feed/unified/note/${ideaId}`);
                setIdea(data);
                setIsLiked(data.is_liked || false);
                setLikesCount(data.likes_count || 0);
                setCommentsCount(data.comments_count || 0);
            } catch (err) {
                console.error('Error fetching idea:', err);
                setError('Failed to load idea');
            } finally {
                setIsLoading(false);
            }
        };

        if (ideaId) {
            fetchIdea();
        }
    }, [ideaId]);

    const handleLike = async () => {
        if (!idea) return;

        setIsLiked(!isLiked);
        setLikesCount((prev: number) => isLiked ? prev - 1 : prev + 1);

        try {
            const data = await apiClient.post<{ success: boolean; action: string; new_count: number }>(
                `/feed/unified/notes/${idea.id}/like`,
                {}
            );
            setLikesCount(data.new_count);
            setIsLiked(data.action === 'liked');
        } catch (error) {
            setIsLiked(idea.is_liked || false);
            setLikesCount(idea.likes_count || 0);
            console.error('Error liking idea:', error);
        }
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
        } catch (error) {
            console.error('Failed to copy link');
        }
    };

    const handleBack = () => {
        router.back();
    };

    if (isLoading) {
        return (
            <div className="h-full w-full bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error || !idea) {
        return (
            <div className="h-full w-full bg-gray-50 flex flex-col items-center justify-center gap-4">
                <p className="text-gray-500">{error || 'Idea not found'}</p>
                <button
                    onClick={handleBack}
                    className="text-gray-500 hover:text-gray-900 hover:underline flex items-center gap-2"
                >
                    <ArrowLeft size={16} />
                    Back to feed
                </button>
            </div>
        );
    }

    const pillarColor = idea.pillar_color || '#6B7280';
    const statusConfig = getStatusConfig(idea.status);
    const displayTitle = idea.title || (idea.content_clarified ? idea.content_clarified.slice(0, 80) : idea.content.slice(0, 80));
    const displayContent = idea.content_clarified || idea.content_raw || idea.content;

    return (
        <div className="h-full w-full bg-gray-50 flex overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto py-8 px-4 pb-32">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6 sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 py-2">
                        <h2 className="text-xl font-extrabold text-gray-900">Post</h2>
                        <button
                            onClick={handleBack}
                            className="px-4 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                        >
                            Back <span className="text-lg">→</span>
                        </button>
                    </div>

                    {/* Idea Card - Expanded */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                                        {displayTitle}
                                    </h2>
                                    <div className="text-sm text-gray-500">
                                        {idea.created_at
                                            ? formatDistanceToNow(new Date(idea.created_at), { addSuffix: true }).replace('about ', '')
                                            : 'Just now'}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {statusConfig && (
                                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border ${statusConfig.bg} ${statusConfig.color}`}>
                                            {statusConfig.icon}
                                            {statusConfig.label}
                                        </span>
                                    )}
                                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-gray-200">
                                        <Layers size={14} /> Node
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap mb-6">
                                {displayContent}
                            </div>

                            {/* Pillar Tag */}
                            {idea.pillar_name && (
                                <div className="mb-4">
                                    <span
                                        className="text-sm font-medium px-3 py-1.5 rounded-full border inline-block"
                                        style={{
                                            backgroundColor: `${pillarColor}10`,
                                            color: pillarColor,
                                            borderColor: `${pillarColor}30`
                                        }}
                                    >
                                        {idea.pillar_name}
                                    </span>
                                </div>
                            )}

                            {/* Engagement Stats */}
                            <div className="py-3 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                                {likesCount > 0 && (
                                    <span><strong className="text-gray-900">{likesCount}</strong> {likesCount === 1 ? 'Like' : 'Likes'}</span>
                                )}
                                {commentsCount > 0 && (
                                    <span><strong className="text-gray-900">{commentsCount}</strong> {commentsCount === 1 ? 'Comment' : 'Comments'}</span>
                                )}
                            </div>

                            {/* Action Bar */}
                            <div className="py-3 border-t border-gray-100 flex items-center justify-around">
                                <button
                                    onClick={handleLike}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${isLiked
                                        ? 'text-red-500 bg-red-50 hover:bg-red-100'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    <Heart size={20} strokeWidth={2} fill={isLiked ? 'currentColor' : 'none'} />
                                    <span className="font-medium">Like</span>
                                </button>

                                <button
                                    onClick={() => document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    <MessageCircle size={20} strokeWidth={2} />
                                    <span className="font-medium">Comment</span>
                                </button>

                                <button
                                    onClick={handleShare}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    <Share2 size={20} strokeWidth={2} />
                                    <span className="font-medium">Share</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Comments Section - Always visible */}
                    <div id="comments-section" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Comments</h2>
                        <CommentSection
                            postId={idea.id}
                            initialCount={commentsCount}
                            isOpen={true}
                            onToggle={() => { }}
                        />
                    </div>

                    {/* Extra padding at bottom to ensure everything is scrollable */}
                    <div className="h-24"></div>
                </div>
            </div>

            {/* Right Sidebar - Galaxy Folders */}
            <div className="w-[350px] hidden xl:block p-6 overflow-y-auto">
                <div className="sticky top-6 space-y-6">
                    {/* Search */}
                    <div className="bg-white rounded-full p-3 shadow-sm border border-gray-100 flex items-center gap-3 px-5">
                        <Search size={18} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search ideas, tags..."
                            className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder-gray-400 outline-none"
                        />
                    </div>

                    {/* Galaxy Folders */}
                    <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-extrabold text-xl text-gray-900 flex items-center gap-2">
                                Galaxy Folders
                            </h3>
                        </div>
                        <div className="space-y-4">
                            {galaxyFolders.map((folder, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${folder.color} relative`}>
                                            <Folder size={20} fill="currentColor" className="opacity-20 absolute" />
                                            <Folder size={20} className="z-10" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 text-sm group-hover:text-black transition-colors">
                                                {folder.name}
                                            </div>
                                            <div className="text-xs text-gray-400">{folder.count} nodes</div>
                                        </div>
                                    </div>
                                    <button className="p-2 text-gray-300 group-hover:text-gray-600 transition-colors">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
