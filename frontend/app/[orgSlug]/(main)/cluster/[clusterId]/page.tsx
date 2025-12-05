'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Heart, MessageCircle, Share2, Layers, Loader2, Search, Folder, ChevronRight } from 'lucide-react';
import { useApiClient } from '@/hooks/useApiClient';
import { CommentSection } from '@/components/feed/comments';
import { useOrganization } from '@/contexts/OrganizationContext';

// Types
interface PreviewNote {
    id: string;
    content: string;
    user_id?: string;
    created_at?: string;
}

interface ClusterDetail {
    id: string;
    title: string;
    note_count: number;
    velocity_score?: number;
    pillar_id?: string;
    pillar_name?: string;
    pillar_color?: string;
    preview_notes?: PreviewNote[];
    likes_count?: number;
    comments_count?: number;
    is_liked?: boolean;
    created_at: string;
    last_updated_at: string;
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

export default function ClusterDetailPage() {
    const params = useParams();
    const router = useRouter();
    const apiClient = useApiClient();
    const clusterId = params.clusterId as string;
    const { organizationId } = useOrganization();

    const [cluster, setCluster] = useState<ClusterDetail | null>(null);
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

    // Fetch cluster details
    useEffect(() => {
        const fetchCluster = async () => {
            try {
                setIsLoading(true);
                const data = await apiClient.get<ClusterDetail>(`/feed/unified/cluster/${clusterId}`);
                setCluster(data);
                setIsLiked(data.is_liked || false);
                setLikesCount(data.likes_count || 0);
                setCommentsCount(data.comments_count || 0);
            } catch (err) {
                console.error('Error fetching cluster:', err);
                setError('Failed to load cluster');
            } finally {
                setIsLoading(false);
            }
        };

        if (clusterId) {
            fetchCluster();
        }
    }, [clusterId]);

    const handleLike = async () => {
        if (!cluster) return;

        setIsLiked(!isLiked);
        setLikesCount((prev: number) => isLiked ? prev - 1 : prev + 1);

        try {
            const data = await apiClient.post<{ success: boolean; action: string; new_count: number }>(
                `/feed/unified/clusters/${cluster.id}/like`,
                {}
            );
            setLikesCount(data.new_count);
            setIsLiked(data.action === 'liked');
        } catch (error) {
            setIsLiked(cluster.is_liked || false);
            setLikesCount(cluster.likes_count || 0);
            console.error('Error liking cluster:', error);
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

    if (error || !cluster) {
        return (
            <div className="h-full w-full bg-gray-50 flex flex-col items-center justify-center gap-4">
                <p className="text-gray-500">{error || 'Cluster not found'}</p>
                <button
                    onClick={handleBack}
                    className="text-blue-500 hover:underline flex items-center gap-2"
                >
                    <ArrowLeft size={16} />
                    Back to feed
                </button>
            </div>
        );
    }

    const pillarColor = cluster.pillar_color || '#3B82F6';

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

                    {/* Cluster Card - Expanded */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-700 text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-blue-200">
                                        <Layers size={14} /> CLUSTER
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        Updated {formatDistanceToNow(new Date(cluster.last_updated_at), { addSuffix: true })}
                                    </span>
                                </div>

                                {cluster.pillar_name && (
                                    <span
                                        className="text-sm font-medium px-3 py-1.5 rounded-full border"
                                        style={{
                                            backgroundColor: `${pillarColor}10`,
                                            color: pillarColor,
                                            borderColor: `${pillarColor}30`
                                        }}
                                    >
                                        {cluster.pillar_name}
                                    </span>
                                )}
                            </div>

                            {/* Title */}
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                {cluster.title}
                            </h2>

                            {/* Stats */}
                            <div className="flex items-center gap-4 text-gray-500 mb-6">
                                <div className="flex items-center gap-2">
                                    <Layers size={16} />
                                    <span className="font-medium">{cluster.note_count} notes</span>
                                </div>
                            </div>

                            {/* Preview Notes */}
                            {cluster.preview_notes && cluster.preview_notes.length > 0 && (
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-6">
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                        Related Ideas
                                    </div>
                                    <div className="space-y-3">
                                        {cluster.preview_notes.map((note) => (
                                            <div key={note.id} className="flex items-start gap-3 group">
                                                <div className="mt-1.5 w-2 h-2 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors shrink-0" />
                                                <p className="text-gray-700 leading-relaxed group-hover:text-gray-900 transition-colors">
                                                    {note.content}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
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
                            postId={cluster.id}
                            initialCount={commentsCount}
                            isOpen={true}
                            onToggle={() => { }}
                        />
                    </div>

                    {/* Extra padding at bottom */}
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
