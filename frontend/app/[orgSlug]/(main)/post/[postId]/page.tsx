'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Heart, MessageCircle, Share2, MoreHorizontal, Loader2, Search, Folder, ChevronRight, X } from 'lucide-react';
import { useApiClient } from '@/hooks/useApiClient';
import { CommentSection } from '@/components/feed/comments';
import { useOrganization } from '@/contexts/OrganizationContext';
import { PollCard } from '@/components/feed/poll';
import { SharePostModal } from '@/components/feed/share';

// Types
interface PostUser {
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
}

interface PostDetail {
    id: string;
    content: string;
    post_type: string;
    media_urls?: string[];
    user_id: string;
    user_info?: PostUser;
    likes_count: number;
    comments_count: number;
    saves_count: number;
    shares_count: number;
    is_liked: boolean;
    is_saved: boolean;
    created_at: string;
    updated_at: string;
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

// Avatar colors
const avatarColors = [
    'bg-blue-500',
    'bg-orange-500',
    'bg-purple-500',
    'bg-teal-500',
    'bg-pink-500',
    'bg-indigo-500',
];

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

export default function PostDetailPage() {
    const params = useParams();
    const router = useRouter();
    const apiClient = useApiClient();
    const postId = params.postId as string;
    const { organizationId } = useOrganization();

    const [post, setPost] = useState<PostDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);

    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [poll, setPoll] = useState<any>(null);
    const [showShareModal, setShowShareModal] = useState(false);

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

    // Fetch post details
    useEffect(() => {
        const fetchPost = async () => {
            try {
                setIsLoading(true);
                const data = await apiClient.get<PostDetail>(`/feed/posts/${postId}`);
                setPost(data);
                setIsLiked(data.is_liked || false);
                setLikesCount(data.likes_count || 0);
                setCommentsCount(data.comments_count || 0);

                if (data.post_type === 'poll') {
                    try {
                        const pollData = await apiClient.get<any>(`/feed/posts/${postId}/poll`);
                        setPoll(pollData);
                    } catch (e: any) {
                        // Silently handle expected errors (404, 500 for missing polls)
                        const isExpectedError = e.message?.includes('500') ||
                            e.message?.includes('404') ||
                            e.response?.status === 404 ||
                            e.response?.status === 500;
                        if (!isExpectedError) {
                            console.error("Failed to load poll", e);
                        }
                    }
                }

            } catch (err) {
                console.error('Error fetching post:', err);
                setError('Failed to load post');
            } finally {
                setIsLoading(false);
            }
        };

        if (postId) {
            fetchPost();
        }
    }, [postId]);

    const handleLike = async () => {
        if (!post) return;

        setIsLiked(!isLiked);
        setLikesCount((prev: number) => isLiked ? prev - 1 : prev + 1);

        try {
            const data = await apiClient.post<{ success: boolean; action: string; new_count: number }>(
                `/feed/posts/${post.id}/like`,
                {}
            );
            setLikesCount(data.new_count);
            setIsLiked(data.action === 'liked');
        } catch (error) {
            setIsLiked(post.is_liked || false);
            setLikesCount(post.likes_count || 0);
            console.error('Error liking post:', error);
        }
    };

    const handleShare = () => {
        setShowShareModal(true);
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

    if (error || !post) {
        return (
            <div className="h-full w-full bg-gray-50 flex flex-col items-center justify-center gap-4">
                <p className="text-gray-500">{error || 'Post not found'}</p>
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

    const userInfo: PostUser = post.user_info || {};
    const firstName = userInfo.first_name || '';
    const lastName = userInfo.last_name || '';
    const email = userInfo.email || 'Unknown';

    const userInitials = (firstName?.[0] || email?.[0] || 'U').toUpperCase() +
        (lastName?.[0] || firstName?.[1] || '').toUpperCase();

    const userName = firstName
        ? `${firstName} ${lastName}`.trim()
        : email !== 'Unknown' ? email : 'Anonymous User';

    const avatarColorIndex = post.user_id
        ? post.user_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length
        : 0;
    const avatarColor = avatarColors[avatarColorIndex];

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

                    {/* Post Card - Expanded */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 ${avatarColor} rounded-full flex items-center justify-center text-white font-bold text-base shrink-0`}>
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
                                    <div>
                                        <div className="font-bold text-gray-900">{userName}</div>
                                        <div className="text-sm text-gray-500">
                                            {post.created_at
                                                ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }).replace('about ', '')
                                                : 'Just now'}
                                        </div>
                                    </div>
                                </div>
                                <button className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full">
                                    <MoreHorizontal size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="text-gray-900 text-lg leading-relaxed whitespace-pre-wrap">
                                {post.content || ''}
                            </div>

                            {/* Poll */}
                            {poll && (
                                <div className="mt-4">
                                    <PollCard poll={poll} />
                                </div>
                            )}

                            {/* Media Images */}
                            {post.media_urls && post.media_urls.length > 0 && (
                                <div className="mt-4 rounded-xl overflow-hidden">
                                    {post.media_urls.map((url, index) => (
                                        <img
                                            key={index}
                                            src={url}
                                            alt={`Post media ${index + 1}`}
                                            className="w-full max-h-[500px] object-contain bg-gray-100 cursor-pointer hover:opacity-95 transition-opacity"
                                            loading="lazy"
                                            onClick={() => setLightboxImage(url)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Engagement Stats */}
                        <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                            {likesCount > 0 && (
                                <span><strong className="text-gray-900">{likesCount}</strong> {likesCount === 1 ? 'Like' : 'Likes'}</span>
                            )}
                            {commentsCount > 0 && (
                                <span><strong className="text-gray-900">{commentsCount}</strong> {commentsCount === 1 ? 'Comment' : 'Comments'}</span>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-around">
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

                    {/* Comments Section - Always Open */}
                    <div id="comments-section" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Comments</h2>
                        <CommentSection
                            postId={post.id}
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

            {/* Image Lightbox Modal */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        onClick={() => setLightboxImage(null)}
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
            {showShareModal && post && (
                <SharePostModal
                    postId={post.id}
                    postContent={post.content || ''}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
}
