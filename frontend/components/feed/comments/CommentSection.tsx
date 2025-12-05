'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { Comment } from '@/types/comments';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useApiClient } from '@/hooks/useApiClient';

interface CommentSectionProps {
    postId: string;
    initialCount?: number;
    isOpen?: boolean;
    onToggle?: () => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
    postId,
    initialCount = 0,
    isOpen = false,
    onToggle
}) => {
    const apiClient = useApiClient();
    const [comments, setComments] = useState<Comment[]>([]);
    const [totalCount, setTotalCount] = useState(initialCount);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch comments when section opens
    useEffect(() => {
        if (isOpen && comments.length === 0) {
            fetchComments();
        }
    }, [isOpen]);

    const fetchComments = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await apiClient.get<{
                comments: Comment[];
                total_count: number;
                has_more: boolean;
            }>(`/feed/posts/${postId}/comments?limit=20`);

            setComments(data.comments || []);
            setTotalCount(data.total_count || 0);
            setHasMore(data.has_more || false);
        } catch (err) {
            console.error('Error fetching comments:', err);
            setError('Failed to load comments');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateComment = async (content: string) => {
        try {
            const newComment = await apiClient.post<Comment>(
                `/feed/posts/${postId}/comments`,
                { content }
            );

            // Add new comment at the top
            setComments(prev => [newComment, ...prev]);
            setTotalCount(prev => prev + 1);
        } catch (error) {
            console.error('Error creating comment:', error);
            throw error;
        }
    };

    const handleReply = async (parentId: string, content: string) => {
        try {
            const newReply = await apiClient.post<Comment>(
                `/feed/posts/${postId}/comments`,
                { content, parent_comment_id: parentId }
            );

            // Find parent and add reply
            setComments(prev => addReplyToComment(prev, parentId, newReply));
            setTotalCount(prev => prev + 1);
        } catch (error) {
            console.error('Error creating reply:', error);
            throw error;
        }
    };

    const handleLikeComment = async (commentId: string) => {
        try {
            await apiClient.post(`/feed/comments/${commentId}/like`, {});
        } catch (error) {
            console.error('Error liking comment:', error);
            throw error;
        }
    };

    // Helper to add reply to nested comment structure
    const addReplyToComment = (comments: Comment[], parentId: string, reply: Comment): Comment[] => {
        return comments.map(comment => {
            if (comment.id === parentId) {
                return {
                    ...comment,
                    replies: [...(comment.replies || []), reply],
                    replies_count: (comment.replies_count || 0) + 1
                };
            }
            if (comment.replies && comment.replies.length > 0) {
                return {
                    ...comment,
                    replies: addReplyToComment(comment.replies, parentId, reply)
                };
            }
            return comment;
        });
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="border-t border-gray-100 pt-4 mt-4">
            {/* Comment Form */}
            <div className="mb-4">
                <CommentForm
                    onSubmit={handleCreateComment}
                    placeholder="Write a comment..."
                />
            </div>

            {/* Comments List */}
            {isLoading && comments.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 size={20} className="animate-spin mr-2" />
                    <span className="text-sm">Loading comments...</span>
                </div>
            ) : error ? (
                <div className="text-center py-8 text-red-500 text-sm">
                    {error}
                    <button
                        onClick={fetchComments}
                        className="ml-2 underline hover:no-underline"
                    >
                        Retry
                    </button>
                </div>
            ) : comments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                    No comments yet. Be the first to comment!
                </div>
            ) : (
                <div className="space-y-4">
                    {comments.map(comment => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            onReply={handleReply}
                            onLike={handleLikeComment}
                        />
                    ))}

                    {/* Load More */}
                    {hasMore && (
                        <button
                            onClick={fetchComments}
                            disabled={isLoading}
                            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-1"
                        >
                            {isLoading ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <>
                                    <ChevronDown size={14} />
                                    Load more comments
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
