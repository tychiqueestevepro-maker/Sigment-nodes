'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { Comment } from '@/types/comments';
import { CommentForm } from './CommentForm';

interface CommentItemProps {
    comment: Comment;
    depth?: number;
    onReply: (parentId: string, content: string) => Promise<void>;
    onLike: (commentId: string) => Promise<void>;
    maxDepth?: number; // Maximum depth for inline display, after that it becomes "View more replies"
}

// Palette de couleurs pour les avatars
const avatarColors = [
    'bg-blue-500',
    'bg-orange-500',
    'bg-purple-500',
    'bg-teal-500',
    'bg-pink-500',
    'bg-indigo-500',
];

export const CommentItem: React.FC<CommentItemProps> = ({
    comment,
    depth = 0,
    onReply,
    onLike,
    maxDepth = 10 // Permettre beaucoup plus de niveaux
}) => {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [showReplies, setShowReplies] = useState(true); // Réponses visibles par défaut
    const [isLiked, setIsLiked] = useState(comment.is_liked);
    const [likesCount, setLikesCount] = useState(comment.likes_count);
    const [isLiking, setIsLiking] = useState(false);

    const userInfo = comment.user_info || {};
    const firstName = userInfo.first_name || '';
    const lastName = userInfo.last_name || '';
    const email = userInfo.email || 'Unknown';

    const userInitials = (firstName?.[0] || email?.[0] || 'U').toUpperCase() +
        (lastName?.[0] || firstName?.[1] || '').toUpperCase();

    const userName = firstName
        ? `${firstName} ${lastName}`.trim()
        : email !== 'Unknown' ? email : 'Anonymous';

    // Couleur d'avatar basée sur l'ID du user
    const avatarColorIndex = comment.user_id
        ? comment.user_id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % avatarColors.length
        : 0;
    const avatarColor = avatarColors[avatarColorIndex];

    const handleLike = async () => {
        if (isLiking) return;

        // Optimistic update
        setIsLiking(true);
        setIsLiked(!isLiked);
        setLikesCount((prev: number) => isLiked ? prev - 1 : prev + 1);

        try {
            await onLike(comment.id);
        } catch (error) {
            // Rollback
            setIsLiked(isLiked);
            setLikesCount(comment.likes_count);
        } finally {
            setIsLiking(false);
        }
    };

    const handleReplySubmit = async (content: string) => {
        await onReply(comment.id, content);
        setShowReplyForm(false);
        setShowReplies(true); // S'assurer que les réponses sont visibles après avoir répondu
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(
                `${window.location.origin}/comment/${comment.id}`
            );
            // TODO: Toast notification
        } catch (error) {
            console.error('Failed to copy link');
        }
    };

    const repliesCount = comment.replies?.length || comment.replies_count || 0;
    const hasReplies = repliesCount > 0;

    // Calcul de l'indentation avec limite pour éviter trop d'indentation
    const marginLeft = Math.min(depth * 16, 64); // Max 64px d'indentation

    return (
        <div className="relative" style={{ marginLeft: depth > 0 ? marginLeft : 0 }}>
            {/* Ligne verticale de connexion pour les réponses */}
            {depth > 0 && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 hover:bg-blue-300 transition-colors cursor-pointer"
                    style={{ marginLeft: -12 }}
                    onClick={() => setShowReplies(!showReplies)}
                    title={showReplies ? "Cliquer pour rétracter" : "Cliquer pour afficher"}
                />
            )}

            <div className="flex gap-3">
                {/* Avatar */}
                <div className={`w-8 h-8 ${avatarColor} rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0`}>
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

                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{userName}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }).replace('about ', '')}
                        </span>
                    </div>

                    {/* Content */}
                    <div className="text-gray-800 text-sm leading-relaxed mb-2 whitespace-pre-wrap">
                        {comment.content}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-4 text-gray-500">
                        {/* Like */}
                        <button
                            onClick={handleLike}
                            disabled={isLiking}
                            className={`flex items-center gap-1 text-xs transition-colors ${isLiked ? 'text-red-500' : 'hover:text-red-500'
                                }`}
                        >
                            <Heart
                                size={14}
                                strokeWidth={2}
                                fill={isLiked ? 'currentColor' : 'none'}
                            />
                            {likesCount > 0 && <span>{likesCount}</span>}
                        </button>

                        {/* Reply - Toujours disponible */}
                        <button
                            onClick={() => setShowReplyForm(!showReplyForm)}
                            className={`flex items-center gap-1 text-xs hover:text-gray-900 transition-colors ${showReplyForm ? 'text-gray-900' : ''}`}
                        >
                            <MessageCircle size={14} strokeWidth={2} />
                            <span>Reply</span>
                        </button>

                        {/* Share */}
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-1 text-xs hover:text-gray-900 transition-colors"
                        >
                            <Share2 size={14} strokeWidth={2} />
                            <span>Share</span>
                        </button>

                        {/* Toggle Replies - Seulement si il y a des réponses */}
                        {hasReplies && (
                            <button
                                onClick={() => setShowReplies(!showReplies)}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors ml-auto"
                            >
                                {showReplies ? (
                                    <>
                                        <ChevronUp size={14} />
                                        <span>Hide {repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={14} />
                                        <span>Show {repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Reply Form */}
                    {showReplyForm && (
                        <div className="mt-3">
                            <CommentForm
                                onSubmit={handleReplySubmit}
                                onCancel={() => setShowReplyForm(false)}
                                placeholder={`Reply to ${firstName || userName}...`}
                                autoFocus
                                compact
                            />
                        </div>
                    )}

                    {/* Nested Replies - Collapsible */}
                    {hasReplies && showReplies && comment.replies && (
                        <div className="mt-4 space-y-4">
                            {comment.replies.map((reply: Comment) => (
                                <CommentItem
                                    key={reply.id}
                                    comment={reply}
                                    depth={depth + 1}
                                    onReply={onReply}
                                    onLike={onLike}
                                    maxDepth={maxDepth}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
