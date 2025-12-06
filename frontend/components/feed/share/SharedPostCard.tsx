'use client';

import React from 'react';
import { Heart, MessageCircle, ExternalLink, Sparkles } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

interface SharedPostCardProps {
    post: {
        id: string;
        content: string;
        media_urls?: string[];
        likes_count?: number;
        comments_count?: number;
        post_type?: string;
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

    const authorName = post.user_info
        ? `${post.user_info.first_name || ''} ${post.user_info.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown';

    const truncatedContent = post.content?.length > 100
        ? `${post.content.substring(0, 100)}...`
        : post.content || '';

    const isPoll = post.post_type === 'poll';
    const hasMedia = post.media_urls && post.media_urls.length > 0;

    return (
        <div
            onClick={handleClick}
            className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all hover:scale-[1.01] max-w-[280px]"
        >
            {/* Header Badge */}
            <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium">
                    <Sparkles size={12} />
                    SHARED POST
                </div>
            </div>

            {/* Content Preview */}
            {truncatedContent && (
                <h4 className="font-semibold text-gray-900 text-sm leading-snug mb-2">
                    {truncatedContent}
                </h4>
            )}

            {/* Mini Description or Poll indicator */}
            {isPoll && (
                <p className="text-xs text-gray-500 mb-3">
                    📊 This post contains a poll
                </p>
            )}

            {/* Media Preview */}
            {hasMedia && (
                <div className="mb-3 rounded-lg overflow-hidden h-24 bg-gray-200">
                    <img
                        src={post.media_urls![0]}
                        alt="Post media"
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Stats */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                        <Heart size={12} />
                        {post.likes_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                        <MessageCircle size={12} />
                        {post.comments_count || 0}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                    <ExternalLink size={12} />
                    View
                </div>
            </div>
        </div>
    );
};
