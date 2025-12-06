'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, MoreHorizontal, X } from 'lucide-react';
import { PostItem } from '@/types/feed';
import { Poll } from '@/types/poll';
import { CommentSection } from '@/components/feed/comments';
import { PollCard } from '@/components/feed/poll';
import { SharePostModal } from '@/components/feed/share';
import { useApiClient } from '@/hooks/useApiClient';

interface PostCardProps {
    item: PostItem;
}

// Palette de couleurs pour les avatars (comme dans l'image de référence)
const avatarColors = [
    'bg-blue-500',
    'bg-orange-500',
    'bg-purple-500',
    'bg-teal-500',
    'bg-pink-500',
    'bg-indigo-500',
];

export const PostCard: React.FC<PostCardProps> = ({ item }) => {
    const router = useRouter();
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const apiClient = useApiClient();
    const [showComments, setShowComments] = useState(false);
    const [isLiked, setIsLiked] = useState(item.is_liked || false);
    const [likesCount, setLikesCount] = useState(item.likes_count || 0);
    const [commentsCount, setCommentsCount] = useState(item.comments_count || 0);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [poll, setPoll] = useState<Poll | null>(null);
    const [loadingPoll, setLoadingPoll] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    // Load poll if post has one
    useEffect(() => {
        if (item.has_poll && !poll && !loadingPoll) {
            setLoadingPoll(true);
            apiClient.get<Poll>(`/feed/posts/${item.id}/poll`)
                .then(setPoll)
                .catch(console.error)
                .finally(() => setLoadingPoll(false));
        }
    }, [item.has_poll, item.id]);

    const userInfo = item.user_info || {};
    const firstName = userInfo.first_name || '';
    const lastName = userInfo.last_name || '';
    const email = userInfo.email || 'Unknown';

    const userInitials = (firstName?.[0] || email?.[0] || 'U').toUpperCase() +
        (lastName?.[0] || firstName?.[1] || '').toUpperCase();

    const userName = firstName
        ? `${firstName} ${lastName}`.trim()
        : email !== 'Unknown' ? email : 'Anonymous User';

    // Couleur d'avatar basée sur l'ID du user (consistente)
    const avatarColorIndex = item.user_id
        ? item.user_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length
        : 0;
    const avatarColor = avatarColors[avatarColorIndex];

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Empêcher la navigation vers le détail

        // Optimistic update
        setIsLiked(!isLiked);
        setLikesCount(prev => isLiked ? prev - 1 : prev + 1);

        try {
            const data = await apiClient.post<{ success: boolean; action: string; new_count: number }>(
                `/feed/posts/${item.id}/like`,
                {}
            );
            setLikesCount(data.new_count);
            setIsLiked(data.action === 'liked');
        } catch (error) {
            // Rollback
            setIsLiked(isLiked);
            setLikesCount(item.likes_count || 0);
            console.error('Error liking post:', error);
        }
    };

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowShareModal(true);
    };

    const handleCommentClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Empêcher la navigation vers le détail
        setShowComments(!showComments);
    };

    const handleCardClick = () => {
        // Naviguer vers la page de détail du post
        router.push(`/${orgSlug}/post/${item.id}`);
    };

    const handleStopPropagation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div
            onClick={handleCardClick}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        >
            {/* Card Content */}
            <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className={`w-10 h-10 ${avatarColor} rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
                            {userInfo.avatar_url ? (
                                <img
                                    src={userInfo.avatar_url}
                                    alt={userName}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            ) : (
                                userInitials
                            )}
                        </div>

                        {/* User Info */}
                        <div>
                            <div className="font-semibold text-gray-900 text-sm">{userName}</div>
                            <div className="text-xs text-gray-500">
                                {item.created_at
                                    ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }).replace('about ', '')
                                    : 'Just now'}
                            </div>
                        </div>
                    </div>

                    {/* More Menu */}
                    <button
                        onClick={handleStopPropagation}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                        <MoreHorizontal size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="text-gray-800 text-[15px] leading-relaxed whitespace-pre-wrap mb-4">
                    {item.content || ''}
                </div>

                {/* Media Images */}
                {item.media_urls && item.media_urls.length > 0 && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-gray-100">
                        {item.media_urls.length === 1 ? (
                            <img
                                src={item.media_urls[0]}
                                alt="Post media"
                                className="w-full max-h-[400px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                loading="lazy"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxImage(item.media_urls![0]);
                                }}
                            />
                        ) : (
                            <div className="grid grid-cols-2 gap-1">
                                {item.media_urls.slice(0, 4).map((url, index) => (
                                    <img
                                        key={index}
                                        src={url}
                                        alt={`Post media ${index + 1}`}
                                        className="w-full h-48 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                        loading="lazy"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLightboxImage(url);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Poll */}
                {item.has_poll && (
                    <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                        {loadingPoll ? (
                            <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400">
                                Loading poll...
                            </div>
                        ) : poll ? (
                            <PollCard poll={poll} onVote={setPoll} />
                        ) : null}
                    </div>
                )}

                {/* Action Bar */}
                <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
                    {/* Likes */}
                    <button
                        onClick={handleLike}
                        className={`flex items-center gap-1.5 transition-colors group ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                            }`}
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
                        className={`flex items-center gap-1.5 transition-colors group ${showComments ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
                            }`}
                    >
                        <MessageCircle
                            size={18}
                            strokeWidth={2}
                            className="group-hover:scale-105 transition-transform"
                        />
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

                {/* Comment Section - Click on this shouldn't navigate */}
                <div onClick={handleStopPropagation}>
                    <CommentSection
                        postId={item.id}
                        initialCount={commentsCount}
                        isOpen={showComments}
                        onToggle={() => setShowComments(!showComments)}
                    />
                </div>
            </div>

            {/* Image Lightbox Modal */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
                    onClick={(e) => {
                        e.stopPropagation();
                        setLightboxImage(null);
                    }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage(null);
                        }}
                        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X size={28} />
                    </button>
                    <img
                        src={lightboxImage}
                        alt="Full size"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Share Post Modal */}
            {showShareModal && (
                <SharePostModal
                    postId={item.id}
                    postContent={item.content || ''}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
};
