'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Layers, CheckCircle2, XCircle, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import { NoteItem } from '@/types/feed';
import { CommentSection } from '@/components/feed/comments';
import { useApiClient } from '@/hooks/useApiClient';

interface IdeaCardProps {
    item: NoteItem;
}

// Status badge configuration
function getStatusConfig(status: string): { label: string; color: string; bg: string; icon: React.ReactNode } | null {
    switch (status) {
        case 'review':
            return { label: 'In Review', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <Eye size={10} /> };
        case 'approved':
            return { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <CheckCircle2 size={10} /> };
        case 'refused':
            return { label: 'Refused', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: <XCircle size={10} /> };
        default:
            return null; // No badge for 'processed'
    }
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ item }) => {
    const router = useRouter();
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const apiClient = useApiClient();
    const [showComments, setShowComments] = useState(false);
    const [isLiked, setIsLiked] = useState(item.is_liked || false);
    const [likesCount, setLikesCount] = useState(item.likes_count || 0);
    const [commentsCount, setCommentsCount] = useState(item.comments_count || 0);

    const pillarColor = item.pillar_color || '#6B7280'; // Default gray
    const statusConfig = getStatusConfig(item.status);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();

        // Optimistic update
        setIsLiked(!isLiked);
        setLikesCount((prev: number) => isLiked ? prev - 1 : prev + 1);

        try {
            const data = await apiClient.post<{ success: boolean; action: string; new_count: number }>(
                `/feed/unified/notes/${item.id}/like`,
                {}
            );
            setLikesCount(data.new_count);
            setIsLiked(data.action === 'liked');
        } catch (error) {
            // Rollback
            setIsLiked(item.is_liked || false);
            setLikesCount(item.likes_count || 0);
            console.error('Error liking idea:', error);
        }
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            await navigator.clipboard.writeText(
                `${window.location.origin}/${orgSlug}/idea/${item.id}`
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
        router.push(`/${orgSlug}/idea/${item.id}`);
    };

    const handleStopPropagation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div
            onClick={handleCardClick}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
        >
            {/* Pillar Strip */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: pillarColor }}
            />

            {/* Header */}
            <div className="flex items-start justify-between mb-3 pl-2">
                <div>
                    <div className="text-base font-bold text-gray-900 line-clamp-1 mb-0.5">
                        {item.title || (item.content_clarified ? item.content_clarified.slice(0, 80) : item.content.slice(0, 80))}
                    </div>
                    <div className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Status Badge */}
                    {statusConfig && (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 border ${statusConfig.bg} ${statusConfig.color}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                        </span>
                    )}

                    {/* Node Badge */}
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-gray-200 h-fit">
                        <Layers size={12} /> Node
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="pl-2 mb-4">
                <p className="text-gray-800 whitespace-pre-wrap text-[15px] leading-relaxed line-clamp-4">
                    {item.content}
                </p>
            </div>

            {/* Pillar Tag */}
            {item.pillar_name && (
                <div className="pl-2 mb-3">
                    <span
                        className="text-xs font-medium px-2 py-1 rounded-full border inline-block"
                        style={{
                            backgroundColor: `${pillarColor}10`,
                            color: pillarColor,
                            borderColor: `${pillarColor}30`
                        }}
                    >
                        {item.pillar_name}
                    </span>
                </div>
            )}

            {/* Action Bar */}
            <div className="pl-2 flex items-center gap-6 pt-3 border-t border-gray-100">
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
            <div className="pl-2" onClick={handleStopPropagation}>
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
