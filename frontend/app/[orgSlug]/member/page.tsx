'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Send,
    BarChart2,
    Calendar,
    Search,
    Folder,
    ChevronRight,
    Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useApiClient } from '../../../shared/hooks/useApiClient';
import { FeedItem } from '@/types/feed';
import { FeedItemRenderer } from '@/components/feed/FeedItemRenderer';
import { useFeed } from '../../../shared/hooks/useFeed';

// Image Plus icon inline
const ImagePlus = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
);

const SparklesIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M9 5H5" />
        <path d="M19 18v4" />
        <path d="M19 20h4" />
    </svg>
);

interface GalaxyFolder {
    id: string;
    name: string;
    count: number;
    color: string;
}

export default function MemberHomePage() {
    const [noteContent, setNoteContent] = useState('');
    const queryClient = useQueryClient();
    const apiClient = useApiClient();

    // Initialize userId in localStorage if not present
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const existingUserId = localStorage.getItem('sigment_user_id');
            if (!existingUserId) {
                // Generate a UUID v4 for this user
                const newUserId = crypto.randomUUID();
                localStorage.setItem('sigment_user_id', newUserId);
            }
        }
    }, []);

    const { items: feedItems, isLoading, error } = useFeed();
    const { organizationId } = apiClient.auth;

    // Fetch pillars for sidebar
    const { data: pillarsData = [] } = useQuery({
        queryKey: ['pillars', organizationId],
        queryFn: async () => {
            if (!organizationId) return [];
            return await apiClient.get<any[]>('/board/pillars');
        },
        enabled: !!organizationId,
    });

    // Transform pillars to galaxy folders
    const galaxyFolders: GalaxyFolder[] = pillarsData.map((pillar: any) => ({
        id: pillar.id,
        name: pillar.name,
        count: pillar.count || 0, // Use backend-provided count
        color: getColorForPillar(pillar.name),
    }));

    const handleSubmitNote = async () => {
        if (!noteContent.trim()) {
            toast.error('Please enter some content');
            return;
        }

        try {
            await apiClient.post('/feed/posts', {
                content: noteContent,
                post_type: 'standard',
            });

            toast.success('Post published successfully!');
            setNoteContent('');

            // Invalidate query to refresh the feed
            queryClient.invalidateQueries({ queryKey: ['unifiedFeed'] });
        } catch (error) {
            console.error('Error publishing post:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to publish post');
        }
    };

    return (
        <div className="h-full w-full bg-gray-50 flex overflow-hidden animate-in fade-in duration-500">
            {/* Main Feed */}
            <div className="flex-1 overflow-y-auto border-r border-gray-200 scrollbar-hide">
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
                            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                JD
                            </div>
                            <div className="flex-1">
                                <textarea
                                    placeholder="What's your next big idea?"
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder-gray-400 resize-none min-h-[80px] outline-none"
                                />
                                <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-50">
                                    <div className="flex gap-2 text-blue-500">
                                        <button className="p-2 hover:bg-blue-50 rounded-full transition-colors">
                                            <ImagePlus size={20} />
                                        </button>
                                        <button className="p-2 hover:bg-blue-50 rounded-full transition-colors">
                                            <BarChart2 size={20} />
                                        </button>
                                        <button className="p-2 hover:bg-blue-50 rounded-full transition-colors">
                                            <Calendar size={20} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSubmitNote}
                                        className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-gray-800 transition-all flex items-center gap-2"
                                    >
                                        Post <Send size={14} />
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
                        <div className="text-center py-12 text-red-500">
                            Unable to load feed. Please try again later.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {feedItems?.map((item) => (
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
            <div className="w-[350px] hidden xl:block p-6 overflow-y-auto border-l border-gray-100 bg-gray-50/50">
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

// Helper functions
function getColorForPillar(pillarName: string): string {
    const name = pillarName.toLowerCase();

    if (name.includes('product')) return 'bg-blue-100 text-blue-600';
    if (name.includes('marketing')) return 'bg-red-100 text-red-600';
    if (name.includes('operations')) return 'bg-green-100 text-green-600';
    if (name.includes('finance')) return 'bg-yellow-100 text-yellow-600';
    if (name.includes('people') || name.includes('hr')) return 'bg-purple-100 text-purple-600';
    if (name.includes('uncategorized')) return 'bg-gray-100 text-gray-500';

    const colors: Record<string, string> = {
        'Customer Experience': 'bg-pink-100 text-pink-500',
        'Innovation Strategy': 'bg-purple-100 text-purple-500',
        'Workplace Environment': 'bg-blue-100 text-blue-500',
        'ESG': 'bg-teal-100 text-teal-500',
    };
    return colors[pillarName] || 'bg-gray-100 text-gray-500';
}

function getAvatarColor(index: number): string {
    const colors = [
        'bg-blue-100 text-blue-700',
        'bg-orange-100 text-orange-700',
        'bg-purple-100 text-purple-700',
        'bg-green-100 text-green-700',
        'bg-pink-100 text-pink-700',
    ];
    return colors[index % colors.length];
}
