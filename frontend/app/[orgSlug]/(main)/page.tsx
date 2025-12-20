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
import { SchedulePicker, ScheduledPostsList } from '@/components/feed/schedule';
import { CreatePollOption } from '@/types/poll';
import { format } from 'date-fns';

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
    const [showSchedulePicker, setShowSchedulePicker] = useState(false);
    const [showScheduledList, setShowScheduledList] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
    const [pollData, setPollData] = useState<{
        question: string;
        options: CreatePollOption[];
        allow_multiple: boolean;
        expires_in_hours?: number;
    } | null>(null);
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const api = useApiClient();
    const { user } = useUser();

    const { items: feedItems, isLoading, error } = useFeed();

    // Filter feed items based on search query and selected pillar
    const filteredFeedItems = React.useMemo(() => {
        let items = feedItems;

        // First filter by pillar if one is selected
        if (selectedPillar) {
            items = items.filter((item) => {
                const pillarId = (item as any).pillar_id;
                return pillarId === selectedPillar;
            });
        }

        // Then filter by search query if one exists
        if (!searchQuery.trim()) return items;

        const query = searchQuery.toLowerCase();
        return items.filter((item) => {
            // Search in author name and post content
            if (item.type === 'POST') {
                const userInfo = (item as any).user_info || {};
                const firstName = userInfo.first_name?.toLowerCase() || '';
                const lastName = userInfo.last_name?.toLowerCase() || '';
                const fullName = `${firstName} ${lastName}`.trim();
                const email = userInfo.email?.toLowerCase() || '';

                // Check author name
                if (firstName.includes(query) || lastName.includes(query) || fullName.includes(query) || email.includes(query)) {
                    return true;
                }

                // Check post content
                const content = (item as any).content?.toLowerCase() || '';
                if (content.includes(query)) {
                    return true;
                }
            }

            // Search in note title and content
            if (item.type === 'NOTE') {
                const title = (item as any).title?.toLowerCase() || '';
                const summary = (item as any).summary?.toLowerCase() || '';
                if (title.includes(query) || summary.includes(query)) {
                    return true;
                }
            }

            // Search in cluster title and summary
            if (item.type === 'CLUSTER') {
                const title = (item as any).title?.toLowerCase() || '';
                const summary = (item as any).summary?.toLowerCase() || '';
                if (title.includes(query) || summary.includes(query)) {
                    return true;
                }
            }

            return false;
        });
    }, [feedItems, searchQuery, selectedPillar]);

    const { organizationId } = useOrganization();

    // Fetch pillars for sidebar
    const { data: pillarsData = [] } = useQuery<Pillar[]>({
        queryKey: ['pillars', organizationId], // Add organizationId to key to refetch on change
        queryFn: async () => {
            if (!organizationId) return [];
            const data = await api.get<Pillar[]>('/board/pillars');
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
        if (!noteContent.trim() && !selectedImage && !pollData) {
            toast.error('Please enter some content, add an image, or create a poll');
            return;
        }

        if (!user) {
            toast.error('Please log in to post');
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

            if (editingPostId) {
                // UPDATE existing scheduled post
                const updatePayload: any = {
                    content: noteContent,
                    scheduled_at: scheduledDate ? scheduledDate.toISOString() : null,
                };

                // Handle media update
                if (selectedImage) {
                    // New image uploaded
                    updatePayload.media_urls = mediaUrls;
                } else if (imagePreview) {
                    // Existing image kept
                    updatePayload.media_urls = [imagePreview];
                } else {
                    // No image (removed or never existed)
                    updatePayload.media_urls = [];
                }

                await api.patch(`/feed/posts/${editingPostId}`, updatePayload);

                if (pollData) {
                    // Poll update logic would go here
                }

                toast.success('Scheduled post updated');
            } else {
                // CREATE new post
                const postPayload = {
                    content: noteContent || '',
                    post_type: pollData ? 'poll' : 'standard',
                    media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
                    scheduled_at: scheduledDate ? scheduledDate.toISOString() : undefined,
                    status: scheduledDate ? 'scheduled' : 'published',
                    poll_data: pollData
                };

                const response = await api.post<{ id: string }>('/feed/posts', postPayload);

                if (pollData && response.id) {
                    try {
                        await api.post(`/feed/posts/${response.id}/poll`, pollData);
                    } catch (pollError) {
                        console.error('Error creating poll:', pollError);
                    }
                }

                if (scheduledDate) {
                    toast.success(`Post scheduled for ${format(scheduledDate, 'MMM d, h:mm a')}`);
                } else {
                    toast.success('Post published successfully');
                }
            }

            // Reset all states
            setNoteContent('');
            setSelectedImage(null);
            setImagePreview(null);
            setPollData(null);
            setShowPollCreator(false);
            setScheduledDate(null);
            setEditingPostId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['unifiedFeed'] });
            queryClient.invalidateQueries({ queryKey: ['scheduledPosts'] });

        } catch (error) {
            console.error('Error creating/updating post:', error);
            toast.error('Failed to post. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleEditScheduledPost = (post: any) => {
        setShowScheduledList(false); // Close modal immediately

        if (!post) return;

        setNoteContent(post.content || '');
        if (post.scheduled_at) {
            try {
                setScheduledDate(new Date(post.scheduled_at));
            } catch (e) {
                console.error("Invalid date", e);
            }
        }

        // Handle Media
        if (post.media_urls && post.media_urls.length > 0) {
            setImagePreview(post.media_urls[0]);
            setSelectedImage(null); // It's an existing remote image, not a new file
        } else {
            setImagePreview(null);
            setSelectedImage(null);
        }

        // Handle Poll
        if (post.post_type === 'poll' && post.poll) {
            const p = post.poll;
            setPollData({
                question: p.question,
                options: p.options.map((o: any) => ({ text: o.text || o.option_text || '' })),
                allow_multiple: p.allow_multiple,
                expires_in_hours: 24 // Default fallback
            });
            setShowPollCreator(true);
        } else {
            setPollData(null);
            setShowPollCreator(false);
        }

        setEditingPostId(post.id);

        // Scroll to top or composer if needed
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setNoteContent('');
        setScheduledDate(null);
        setEditingPostId(null);
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
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-extrabold text-gray-900">Home Feed</h2>
                            {selectedPillar && (
                                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
                                    <span className="text-sm font-medium text-gray-700">
                                        {galaxyFolders.find(f => f.id === selectedPillar)?.name}
                                    </span>
                                    <button
                                        onClick={() => setSelectedPillar(null)}
                                        className="hover:bg-gray-100 rounded-full p-0.5 transition-colors"
                                    >
                                        <X size={14} className="text-gray-500" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="p-2 bg-white rounded-full border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-100">
                            <SparklesIcon />
                        </div>
                    </div>

                    {/* Post Composer */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mb-8 transform hover:scale-[1.01] transition-transform duration-200 relative z-20">
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

                                {/* Schedule Badge */}
                                {scheduledDate && (
                                    <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                                        <div className="p-1 bg-black rounded-md">
                                            <Calendar size={12} className="text-white" />
                                        </div>
                                        <span className="text-sm text-gray-700">
                                            Scheduled for <strong>{format(scheduledDate, 'MMM d, yyyy')}</strong> at <strong>{format(scheduledDate, 'h:mm a')}</strong>
                                        </span>
                                        <button
                                            onClick={() => setScheduledDate(null)}
                                            className="ml-auto p-1 text-gray-400 hover:text-black hover:bg-gray-200 rounded-full transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-50 relative">
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
                                            className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${selectedImage ? 'text-green-600 bg-green-50' : ''}`}
                                            title="Add image"
                                        >
                                            <ImagePlus size={20} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowPollCreator(!showPollCreator);
                                                if (showPollCreator) {
                                                    setPollData(null);
                                                }
                                            }}
                                            className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${showPollCreator ? 'text-blue-600 bg-blue-50' : ''}`}
                                            title="Add poll"
                                        >
                                            <BarChart2 size={20} />
                                        </button>
                                        <button
                                            onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                                            className={`p-2 hover:bg-gray-100 rounded-full transition-colors relative ${scheduledDate || showSchedulePicker ? 'text-black bg-gray-100' : ''}`}
                                            title="Schedule post"
                                        >
                                            <Calendar size={20} />
                                            {scheduledDate && (
                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-black rounded-full border-2 border-white" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Schedule Picker Dropdown - positioned outside the flex */}
                                    {showSchedulePicker && (
                                        <div className="absolute top-full mt-2 left-0 z-50">
                                            <SchedulePicker
                                                onSchedule={(date: Date | null) => {
                                                    setScheduledDate(date);
                                                    setShowSchedulePicker(false);
                                                }}
                                                onClose={() => setShowSchedulePicker(false)}
                                                initialDate={scheduledDate}
                                                onViewScheduled={() => {
                                                    setShowSchedulePicker(false);
                                                    setShowScheduledList(true);
                                                }}
                                            />
                                        </div>
                                    )}
                                    <button
                                        onClick={handleSubmitNote}
                                        disabled={isUploading}
                                        className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                {scheduledDate ? 'Scheduling...' : 'Posting...'}
                                            </>
                                        ) : scheduledDate ? (
                                            <>
                                                Schedule <Calendar size={14} />
                                            </>
                                        ) : (
                                            <>
                                                {editingPostId ? 'Update' : 'Post'} <Send size={14} />
                                            </>
                                        )}
                                    </button>
                                </div>
                                {editingPostId && (
                                    <div className="absolute top-2 right-2">
                                        <button
                                            onClick={cancelEdit}
                                            className="text-xs text-gray-400 hover:text-black hover:underline"
                                        >
                                            Cancel Editing
                                        </button>
                                    </div>
                                )}
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
                            {searchQuery && (
                                <div className="text-sm text-gray-500 px-2">
                                    {filteredFeedItems.length} result{filteredFeedItems.length !== 1 ? 's' : ''} for "{searchQuery}"
                                </div>
                            )}

                            {filteredFeedItems.map((item) => (
                                <FeedItemRenderer key={item.id} item={item} />
                            ))}

                            {filteredFeedItems.length === 0 && (
                                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Layers className="text-gray-400" size={32} />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900">
                                        {searchQuery ? 'No results found' : 'Your feed is empty'}
                                    </h3>
                                    <p className="text-gray-500 mt-1">
                                        {searchQuery ? `No items match "${searchQuery}"` : 'Start by creating notes or clusters.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Scheduled Posts Modal */}
            {showScheduledList && (
                <ScheduledPostsList
                    onClose={() => setShowScheduledList(false)}
                    onEdit={handleEditScheduledPost}
                />
            )}

            {/* Right Sidebar - Galaxy Folders */}
            <div className="w-[350px] hidden xl:block p-6 overflow-y-auto">
                <div className="sticky top-6 space-y-6">
                    {/* Search */}
                    <div className="bg-white rounded-full p-3 shadow-sm border border-gray-100 flex items-center gap-3 px-5">
                        <Search size={18} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search posts, ideas, members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder-gray-400 outline-none"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                                title="Clear search"
                            >
                                <X size={14} className="text-gray-400" />
                            </button>
                        )}
                    </div>

                    {/* Galaxy Folders */}
                    <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-extrabold text-xl text-gray-900 flex items-center gap-2">
                                Galaxy Folders
                            </h3>
                        </div>
                        <div className="space-y-4">
                            {galaxyFolders.map((folder, idx) => {
                                const isSelected = selectedPillar === folder.id;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            // Toggle: if already selected, deselect (show all), otherwise select this folder
                                            setSelectedPillar(isSelected ? null : folder.id);
                                        }}
                                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${isSelected
                                            ? 'bg-gray-100 shadow-sm'
                                            : 'hover:bg-gray-50'
                                            } group`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${folder.color} relative ${isSelected ? 'scale-110' : ''
                                                } transition-transform`}>
                                                <Folder size={20} fill="currentColor" className="opacity-20 absolute" />
                                                <Folder size={20} className="z-10" />
                                            </div>
                                            <div>
                                                <div className={`font-bold text-sm transition-colors ${isSelected ? 'text-black' : 'text-gray-900 group-hover:text-black'
                                                    }`}>
                                                    {folder.name}
                                                </div>
                                                <div className="text-xs text-gray-400">{folder.count} nodes</div>
                                            </div>
                                        </div>
                                        <div className={`transition-transform ${isSelected ? 'rotate-90' : ''}`}>
                                            <ChevronRight size={16} className={`transition-colors ${isSelected ? 'text-gray-600' : 'text-gray-300 group-hover:text-gray-600'
                                                }`} />
                                        </div>
                                    </div>
                                );
                            })}
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
