'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Layers, Heart, MessageCircle, Share2 } from 'lucide-react';
import { ClusterItem } from '@/types/feed';
import { CommentSection } from '@/components/feed/comments';
import { useApiClient } from '@/hooks/useApiClient';

interface ClusterCardProps {
    item: ClusterItem;
}

export const ClusterCard: React.FC<ClusterCardProps> = ({ item }) => {
    const router = useRouter();
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const apiClient = useApiClient();
    const [showComments, setShowComments] = useState(false);
    const [isLiked, setIsLiked] = useState(item.is_liked || false);
    const [likesCount, setLikesCount] = useState(item.likes_count || 0);
    const [commentsCount, setCommentsCount] = useState(item.comments_count || 0);

    const pillarColor = item.pillar_color || '#3B82F6'; // Default blue

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();

        // Optimistic update
        setIsLiked(!isLiked);
        setLikesCount((prev: number) => isLiked ? prev - 1 : prev + 1);

        try {
            const data = await apiClient.post<{ success: boolean; action: string; new_count: number }>(
                `/feed/unified/clusters/${item.id}/like`,
                {}
            );
            setLikesCount(data.new_count);
            setIsLiked(data.action === 'liked');
        } catch (error) {
            // Rollback
            setIsLiked(item.is_liked || false);
            setLikesCount(item.likes_count || 0);
            console.error('Error liking cluster:', error);
        }
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            await navigator.clipboard.writeText(
                `${window.location.origin}/${orgSlug}/cluster/${item.id}`
            );
        } catch (error) {
            console.error('Failed to copy link');
        }
    };

    const handleCommentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowComments(!showComments);
    };

    const handleCardClick = () => {
        router.push(`/${orgSlug}/cluster/${item.id}`);
    };

    const handleStopPropagation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div
            onClick={handleCardClick}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
        >
            {/* Header / Title Area */}
            <div className="p-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-gray-200">
                            <Layers size={12} /> CLUSTER
                        </span>
                        <span className="text-xs text-gray-500">
                            Updated {formatDistanceToNow(new Date(item.last_updated_at), { addSuffix: true })}
                        </span>
                    </div>

                    {item.pillar_name && (
                        <span
                            className="text-xs font-medium px-2 py-1 rounded-full border"
                            style={{
                                backgroundColor: `${pillarColor}10`,
                                color: pillarColor,
                                borderColor: `${pillarColor}30`
                            }}
                        >
                            {item.pillar_name}
                        </span>
                    )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                    {item.title}
                </h3>

                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Layers size={14} />
                    <span>{item.note_count} notes</span>
                </div>
            </div>

            {/* Preview Notes (Stacked Look) */}
            {(item.preview_notes || []).length > 0 && (
                <div className="px-5 pb-5">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2.5">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Latest Updates
                        </div>
                        {(item.preview_notes || []).map((note: { id: string; content: string }) => (
                            <div key={note.id} className="flex items-start gap-2.5 group/note">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-300 group-hover/note:bg-blue-400 transition-colors shrink-0"></div>
                                <span className="text-sm text-gray-600 line-clamp-1 group-hover/note:text-gray-900 transition-colors">
                                    {note.content}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Bar */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-6">
                {/* Likes */}
                <button
                    onClick={handleLike}
                    className={`flex items-center gap-1.5 transition-colors group ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                >
                    <Heart
                        size={18}
                        strokeWidth={2}
                        className="group-hover:scale-105 transition-transform"
                        fill={isLiked ? 'currentColor' : 'none'}
                    />
                    <span className="text-sm font-medium">{likesCount}</span>
                </button>

                {/* Comments */}
                <button
                    onClick={handleCommentClick}
                    className={`flex items-center gap-1.5 transition-colors group ${showComments ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <MessageCircle size={18} strokeWidth={2} className="group-hover:scale-105 transition-transform" />
                    <span className="text-sm font-medium">{commentsCount}</span>
                </button>

                {/* Share - aligné à droite */}
                <button
                    onClick={handleShare}
                    className="ml-auto text-gray-500 hover:text-gray-900 transition-colors"
                >
                    <Share2 size={18} strokeWidth={2} />
                </button>
            </div>

            {/* Comment Section */}
            <div className="px-5 pb-4" onClick={handleStopPropagation}>
                <CommentSection
                    postId={item.id}
                    initialCount={commentsCount}
                    isOpen={showComments}
                    onToggle={() => setShowComments(!showComments)}
                />
            </div>
        </div>
    );
};
