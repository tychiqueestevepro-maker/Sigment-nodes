'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Calendar, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useApiClient } from '@/hooks/useApiClient';
import toast from 'react-hot-toast';

interface ScheduledPostsListProps {
    onClose: () => void;
    onEdit: (post: ScheduledPost) => void;
}

export interface ScheduledPost {
    id: string;
    content: string;
    media_urls?: string[];
    scheduled_at?: string;
    status: string;
    created_at: string;
}

export const ScheduledPostsList: React.FC<ScheduledPostsListProps> = ({ onClose, onEdit }) => {
    const api = useApiClient();

    const { data: posts, isLoading, error, refetch } = useQuery({
        queryKey: ['scheduledPosts'],
        queryFn: async () => {
            return await api.get<ScheduledPost[]>('/feed/posts/scheduled');
        }
    });

    const handleDelete = async (e: React.MouseEvent, postId: string) => {
        e.stopPropagation(); // Prevent triggering onEdit
        if (!confirm('Cancel this scheduled post?')) return;

        try {
            await api.delete(`/feed/posts/${postId}`);
            toast.success('Scheduled post cancelled');
            refetch();
        } catch (e) {
            toast.error('Failed to cancel post');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="bg-black text-white p-1.5 rounded-lg">
                            <Clock size={16} />
                        </div>
                        <h3 className="font-semibold text-lg text-gray-900">Scheduled Posts</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">
                            Failed to load scheduled posts
                        </div>
                    ) : !posts || posts.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar className="text-gray-300" size={32} />
                            </div>
                            <p className="text-gray-500 font-medium">No posts scheduled</p>
                            <p className="text-sm text-gray-400 mt-1">Posts scheduled for the future will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {posts.map((post) => (
                                <div
                                    key={post.id}
                                    onClick={() => onEdit(post)}
                                    className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all group cursor-pointer ring-2 ring-transparent hover:ring-black/5"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                                            <Calendar size={12} />
                                            {post.scheduled_at && format(new Date(post.scheduled_at), 'MMM d, h:mm a')}
                                        </div>
                                        {/* Delete action */}
                                        <button
                                            onClick={(e) => handleDelete(e, post.id)}
                                            className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Cancel post"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="flex gap-4">
                                        <p className="text-gray-800 text-sm line-clamp-3 flex-1 font-medium">{post.content}</p>
                                        {post.media_urls && post.media_urls.length > 0 && (
                                            <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-gray-100 shrink-0">
                                                <img src={post.media_urls[0]} alt="Media" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Click to edit
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
