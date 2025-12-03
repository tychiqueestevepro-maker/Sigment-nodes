'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  BarChart2,
  Calendar,
  MessageSquare,
  Heart,
  Share2,
  MoreHorizontal,
  Search,
  Folder,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { apiClient } from '../../../../shared/lib/api-client';
import { useApiClient } from '../../../../shared/hooks/useApiClient';

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
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M9 5H5" />
    <path d="M19 18v4" />
    <path d="M19 20h4" />
  </svg>
);

interface Post {
  id: string;
  author: string;
  role: string;
  avatar: string;
  color: string;
  time: string;
  category: string;
  content: string;
  likes: number;
  comments: number;
  impact: string;
}

interface GalaxyFolder {
  id: string;
  name: string;
  count: number;
  color: string;
}

export default function HomePage() {
  const [noteContent, setNoteContent] = useState('');
  const queryClient = useQueryClient();
  const api = useApiClient();

  // Fetch unified feed (posts + clusters + notes)
  const { data: feedData, isLoading, error } = useQuery({
    queryKey: ['unifiedFeed'],
    queryFn: async () => {
      return await api.get<{ items: any[]; total_count: number }>('/feed/unified/');
    },
    refetchInterval: 30000,
    retry: 1,
  });

  // Fetch pillars for sidebar
  const { data: pillarsData = [] } = useQuery({
    queryKey: ['pillars'],
    queryFn: async () => {
      return await api.get<any[]>('/board/pillars');
    },
  });

  // Helper function for avatar colors (assuming a simple rotating scheme)
  const getAvatarColor = (idx: number) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700',
      'bg-purple-100 text-purple-700',
      'bg-yellow-100 text-yellow-700',
      'bg-red-100 text-red-700',
    ];
    return colors[idx % colors.length];
  };

  // Transform unified feed items to posts format for UI
  const posts: Post[] = (feedData?.items || []).map((item: any, idx: number) => {
    if (item.type === 'POST') {
      // Standard post from feed
      return {
        id: item.id,
        author: item.user_info?.first_name || 'Anonymous',
        role: 'Team Member',
        avatar: (item.user_info?.first_name?.[0] || 'U').toUpperCase(),
        color: getAvatarColor(idx),
        time: new Date(item.created_at).toLocaleDateString(),
        category: 'UPDATE',
        content: item.content,
        likes: item.likes_count || 0,
        comments: item.comments_count || 0,
        impact: 'Posted',
      };
    } else if (item.type === 'CLUSTER') {
      // Cluster (group of ideas)
      return {
        id: item.id,
        author: 'Board Member',
        role: 'Strategic Team',
        avatar: 'BM',
        color: 'bg-blue-100 text-blue-700',
        time: new Date(item.last_updated_at).toLocaleDateString(),
        category: item.pillar_name || 'GENERAL',
        content: item.title,
        likes: Math.floor(item.note_count || 0),
        comments: Math.floor(item.velocity_score || 0) % 20,
        impact: item.velocity_score > 75 ? 'High Impact' : item.velocity_score > 50 ? 'Medium Impact' : 'Low Impact',
      };
    } else if (item.type === 'NOTE') {
      // Orphan note (idea not yet clustered)
      return {
        id: item.id,
        author: item.is_mine ? 'You' : 'Team Member',
        role: 'Contributor',
        avatar: 'N',
        color: 'bg-purple-100 text-purple-700',
        time: new Date(item.created_at).toLocaleDateString(),
        category: item.pillar_name || 'UNCATEGORIZED',
        content: item.content_clarified || item.content,
        likes: 0,
        comments: 0,
        impact: 'New Idea',
      };
    }
    return null;
  }).filter(Boolean) as Post[];

  // Transform pillars to galaxy folders
  const galaxyFolders: GalaxyFolder[] = pillarsData.map((pillar: any) => ({
    id: pillar.id,
    name: pillar.name,
    count: (feedData?.items || []).filter((item: any) => item.pillar_id === pillar.id).length,
    color: getColorForPillar(pillar.name),
  }));

  const handleSubmitNote = async () => {
    if (!noteContent.trim()) {
      toast.error('Please enter some content');
      return;
    }

    try {
      // Utilisation du nouveau client API centralisé
      // Plus besoin de gérer manuellement les headers ou les IDs !
      await api.post('/feed/posts', {
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
              <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                BM
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
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-[2.5rem] p-1 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300"
                >
                  <div className="p-6 pb-2">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${post.color}`}>
                          {post.avatar}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900">{post.author}</h3>
                            <span className="text-gray-400 text-xs">• {post.time}</span>
                          </div>
                          <p className="text-xs text-gray-500 font-medium">{post.role}</p>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-900">
                        <MoreHorizontal size={20} />
                      </button>
                    </div>
                    <div className="pl-16 pr-4 mb-4">
                      <div className="inline-block px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-2">
                        {post.category}
                      </div>
                      <p className="text-gray-800 text-lg font-medium leading-relaxed">
                        {post.content}
                      </p>
                    </div>
                  </div>
                  <div className="mx-2 mb-2 bg-gray-50 rounded-[2rem] px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <button className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors group">
                        <div className="p-2 group-hover:bg-blue-100 rounded-full transition-colors">
                          <MessageSquare size={18} />
                        </div>
                        <span className="text-sm font-medium">{post.comments}</span>
                      </button>
                      <button className="flex items-center gap-2 text-gray-500 hover:text-pink-600 transition-colors group">
                        <div className="p-2 group-hover:bg-pink-100 rounded-full transition-colors">
                          <Heart size={18} />
                        </div>
                        <span className="text-sm font-medium">{post.likes}</span>
                      </button>
                      <button className="flex items-center gap-2 text-gray-500 hover:text-green-600 transition-colors group">
                        <div className="p-2 group-hover:bg-green-100 rounded-full transition-colors">
                          <BarChart2 size={18} />
                        </div>
                        <span className="text-xs font-bold uppercase">{post.impact}</span>
                      </button>
                    </div>
                    <button className="text-gray-400 hover:text-gray-900 p-2 hover:bg-gray-200 rounded-full transition-colors">
                      <Share2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
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
  const colors: Record<string, string> = {
    'Customer Experience': 'bg-pink-100 text-pink-500',
    'Operations': 'bg-orange-100 text-orange-500',
    'Innovation Strategy': 'bg-purple-100 text-purple-500',
    'Workplace Environment': 'bg-blue-100 text-blue-500',
    'ESG': 'bg-teal-100 text-teal-500',
  };
  return colors[pillarName] || 'bg-gray-100 text-gray-500';
}
