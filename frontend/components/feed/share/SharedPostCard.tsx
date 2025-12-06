'use client';

import React from 'react';
import { Heart, MessageSquare, Zap, ArrowUpRight, BarChart2, Image as ImageIcon } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

interface SharedPostCardProps {
    post: {
        id: string;
        content: string;
        media_urls?: string[];
        likes_count?: number;
        comments_count?: number;
        post_type?: string;
        poll?: {
            question?: string;
            options?: { text: string }[];
        };
        user_info?: {
            first_name?: string;
            last_name?: string;
            avatar_url?: string;
        };
    };
}

export const SharedPostCard: React.FC<SharedPostCardProps> = ({ post }) => {
    const router = useRouter();
    const params = useParams();
    const orgSlug = params.orgSlug as string;

    const handleClick = () => {
        router.push(`/${orgSlug}/post/${post.id}`);
    };

    const content = post.content || '';
    const isPoll = post.post_type === 'poll';
    const hasMedia = post.media_urls && post.media_urls.length > 0;

    // Get title and description
    const lines = content.split('\n').filter(l => l.trim());
    const title = lines[0]?.substring(0, 50) || (isPoll ? post.poll?.question?.substring(0, 50) : 'Shared Post');
    const description = content.length > 50 ? content.substring(0, 100) + '...' : '';

    // Determine badge
    const getBadge = () => {
        if (isPoll) return 'POLL';
        if (hasMedia) return 'POST';
        return 'NEW IDEA';
    };

    return (
        <div
            onClick={handleClick}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all"
            style={{ width: '280px' }}
        >
            {/* Header with badge and share icon */}
            <div className="px-4 pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Icon circle - noir/gris */}
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        {isPoll ? (
                            <BarChart2 size={14} className="text-gray-700" />
                        ) : hasMedia ? (
                            <ImageIcon size={14} className="text-gray-700" />
                        ) : (
                            <Zap size={14} className="text-gray-700" />
                        )}
                    </div>
                    {/* Badge text - noir */}
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        {getBadge()}
                    </span>
                </div>
                {/* Share arrow */}
                <ArrowUpRight size={16} className="text-gray-300" />
            </div>

            {/* Title */}
            <div className="px-4 pt-3">
                <h3 className="font-bold text-gray-900 text-base leading-snug">
                    {title}
                </h3>
            </div>

            {/* Description */}
            {description && (
                <div className="px-4 pt-1">
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                        {description}
                    </p>
                </div>
            )}

            {/* Media preview */}
            {hasMedia && (
                <div className="px-4 pt-3">
                    <div className="h-28 rounded-lg overflow-hidden bg-gray-100">
                        <img
                            src={post.media_urls![0]}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
            )}

            {/* Poll preview */}
            {isPoll && post.poll && post.poll.options && (
                <div className="px-4 pt-3">
                    <div className="space-y-1.5">
                        {post.poll.options.slice(0, 2).map((opt, i) => (
                            <div
                                key={i}
                                className="text-xs text-gray-600 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100"
                            >
                                {opt.text}
                            </div>
                        ))}
                        {post.poll.options.length > 2 && (
                            <p className="text-[10px] text-gray-400 pl-1">
                                +{post.poll.options.length - 2} more options
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 mt-2 flex items-center justify-between">
                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5">
                        <Heart size={14} />
                        {post.likes_count || 0}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <MessageSquare size={14} />
                        {post.comments_count || 0}
                    </span>
                </div>

                {/* Badge - noir/blanc */}
                <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-full uppercase tracking-wide">
                    {isPoll ? 'Poll' : hasMedia ? 'Media' : 'Post'}
                </span>
            </div>
        </div>
    );
};
