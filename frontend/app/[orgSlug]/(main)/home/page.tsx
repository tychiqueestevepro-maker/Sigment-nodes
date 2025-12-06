'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Send,
    BarChart2,
    Calendar,
    Search,
    Folder,
    ChevronRight,
    Layers,
    X,
    Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useApiClient } from '@/hooks/useApiClient';
import { FeedItem } from '@/types/feed';
import { FeedItemRenderer } from '@/components/feed/FeedItemRenderer';
import { useFeed } from '@/hooks/useFeed';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUser } from '@/contexts';
import { PollCreator } from '@/components/feed/poll';
import { CreatePollOption } from '@/types/poll';

// Image Plus icon inline
const ImagePlus = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
);

const SparklesIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M9 5H5" />
        <path d="M19 18v4" />
        <path d="M19 20h4" />
    </svg>
);

interface Pillar {
    id: string;
    name: string;
    description?: string;
    color?: string;
    count?: number;
}

interface GalaxyFolder {
    id: string;
    name: string;
    count: number;
    color: string;
}

export default function HomePage() {
    const [noteContent, setNoteContent] = useState('');
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollData, setPollData] = useState<{
        question: string;
        options: CreatePollOption[];
        allow_multiple: boolean;
        expires_in_hours?: number;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const api = useApiClient();
    const { user } = useUser();

    const { items: feedItems, isLoading, error } = useFeed();

    const { organizationId } = useOrganization();

    // Fetch pillars for sidebar
    const { data: pillarsData = [] } = useQuery<Pillar[]>({
        queryKey: ['pillars', organizationId], // Add organizationId to key to refetch on change
        queryFn: async () => {
            if (!organizationId) return [];
            console.log('Fetching pillars for org:', organizationId);
            const data = await api.get<Pillar[]>('/board/pillars');
            console.log('Pillars fetched:', data);
            return data;
        },
        enabled: !!organizationId, // Only run when organizationId is available
    });

    // Transform pillars to galaxy folders
    const galaxyFolders: GalaxyFolder[] = pillarsData.map((pillar: any) => ({
        id: pillar.id,
        name: pillar.name,
        count: pillar.count || 0, // Use backend-provided count
        color: getColorForPillar(pillar.name),
    }));

    // Handle image selection
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Please select a valid image (JPEG, PNG, GIF, or WebP)');
            return;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image is too large. Maximum size is 10MB');
            return;
        }

        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
    };

    // Remove selected image
    const handleRemoveImage = () => {
        setSelectedImage(null);
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmitNote = async () => {
        // Allow post if: has text, has image, OR has valid poll
        if (!noteContent.trim() && !selectedImage && !pollData) {
            toast.error('Please enter some content, add an image, or create a poll');
            return;
        }

        setIsUploading(true);
        try {
            let mediaUrls: string[] = [];

            // Upload image if selected
            if (selectedImage) {
                const formData = new FormData();
                formData.append('file', selectedImage);

                const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const token = localStorage.getItem('access_token');
                const orgId = localStorage.getItem('sigment_org_id');

                const uploadResponse = await fetch(`${apiBaseUrl}/api/v1/feed/media/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        ...(orgId && { 'X-Organization-Id': orgId }),
                    },
                    body: formData,
                });

                if (!uploadResponse.ok) {
                    const errorData = await uploadResponse.json();
                    throw new Error(errorData.detail || 'Failed to upload image');
                }

                const uploadData = await uploadResponse.json();
                mediaUrls = [uploadData.url];
            }

            // Create post with media_urls
            const postResponse = await api.post<{ id: string }>('/feed/posts', {
                content: noteContent || (pollData ? pollData.question : 'Check out this image!'),
                post_type: pollData ? 'poll' : 'standard',
                media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
            });

            // If poll data exists, create the poll
            if (pollData && postResponse.id) {
                try {
                    await api.post(`/feed/posts/${postResponse.id}/poll`, pollData);
                } catch (pollError) {
                    console.error('Error creating poll:', pollError);
                    // Post was created, but poll failed - still show success
                }
            }

            toast.success('Post published successfully!');
            setNoteContent('');
            handleRemoveImage();
            setShowPollCreator(false);
            setPollData(null);

            // Invalidate query to refresh the feed
            queryClient.invalidateQueries({ queryKey: ['unifiedFeed'] });
        } catch (error) {
            console.error('Error publishing post:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to publish post');
        } finally {
            setIsUploading(false);
        }
    };

    const userInitials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : 'U';

    return (
        <div className="h-full w-full bg-gray-50 flex overflow-hidden">
            {/* Main Feed */}
            <div className="flex-1 overflow-y-auto border-r border-gray-200">
                <div className="max-w-2xl mx-auto py-8 px-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8 sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 py-2">
                        <h2 className="text-xl font-extrabold text-gray-900">Home Feed</h2>
                        <div className="p-2 bg-white rounded-full border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-100">
                            <SparklesIcon />
                        </div>
                    </div>

                    {/* Post Composer */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mb-8 transform hover:scale-[1.01] transition-transform duration-200">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                {user?.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.name || 'User'} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-white">{userInitials}</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <textarea
                                    placeholder="What's your next big idea?"
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder-gray-400 resize-none min-h-[80px] outline-none"
                                />

                                {/* Poll Creator */}
                                {showPollCreator && (
                                    <PollCreator
                                        onPollChange={setPollData}
                                        onClose={() => {
                                            setShowPollCreator(false);
                                            setPollData(null);
                                        }}
                                    />
                                )}

                                {/* Image Preview */}
                                {imagePreview && (
                                    <div className="relative mt-3 rounded-xl overflow-hidden border border-gray-200">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="w-full max-h-64 object-cover"
                                        />
                                        <button
                                            onClick={handleRemoveImage}
                                            className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black rounded-full text-white transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-50">
                                    <div className="flex gap-2 text-gray-600">
                                        {/* Hidden file input */}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageSelect}
                                            accept="image/jpeg,image/png,image/gif,image/webp"
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={showPollCreator}
                                            className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${selectedImage ? 'text-green-600 bg-green-50' : ''} ${showPollCreator ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            title="Add image"
                                        >
                                            <ImagePlus size={20} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowPollCreator(!showPollCreator);
                                                if (!showPollCreator) {
                                                    // Clear image when opening poll
                                                    handleRemoveImage();
                                                } else {
                                                    setPollData(null);
                                                }
                                            }}
                                            className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${showPollCreator ? 'text-blue-600 bg-blue-50' : ''}`}
                                            title="Add poll"
                                        >
                                            <BarChart2 size={20} />
                                        </button>
                                        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Schedule (coming soon)">
                                            <Calendar size={20} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSubmitNote}
                                        disabled={isUploading}
                                        className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                Posting...
                                            </>
                                        ) : (
                                            <>
                                                Post <Send size={14} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Posts Feed */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-96">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <div className="text-red-500 font-medium mb-2">Unable to load feed</div>
                            <div className="text-sm text-gray-500 bg-gray-100 p-2 rounded inline-block">
                                {error instanceof Error ? error.message : 'Unknown error'}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {feedItems.map((item) => (
                                <FeedItemRenderer key={item.id} item={item} />
                            ))}

                            {(!feedItems || feedItems.length === 0) && (
                                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Layers className="text-gray-400" size={32} />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900">Your feed is empty</h3>
                                    <p className="text-gray-500 mt-1">Start by creating notes or clusters.</p>
                                </div>
                            )}
                        </div>
                    )}
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

// Helper function to get color for pillar
function getColorForPillar(pillarName: string): string {
    const name = pillarName.toLowerCase();

    if (name.includes('product')) return 'bg-blue-100 text-blue-600';
    if (name.includes('marketing')) return 'bg-red-100 text-red-600';
    if (name.includes('operations')) return 'bg-green-100 text-green-600';
    if (name.includes('finance')) return 'bg-yellow-100 text-yellow-600';
    if (name.includes('people') || name.includes('hr')) return 'bg-purple-100 text-purple-600';
    if (name.includes('uncategorized')) return 'bg-gray-100 text-gray-500';

    // Legacy mappings
    const colors: Record<string, string> = {
        'Customer Experience': 'bg-pink-100 text-pink-500',
        'Innovation Strategy': 'bg-purple-100 text-purple-500',
        'Workplace Environment': 'bg-blue-100 text-blue-500',
        'ESG': 'bg-teal-100 text-teal-500',
    };
    return colors[pillarName] || 'bg-gray-100 text-gray-500';
}
