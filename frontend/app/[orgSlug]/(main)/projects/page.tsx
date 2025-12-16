'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import {
    Plus, Search, LayoutGrid, List, Filter, Users, FolderOpen,
    MoreVertical, ArrowRight, Clock, Star, Sparkles, Zap, Target
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useApiClient } from '@/hooks/useApiClient';
import CreateGroupModal from './CreateGroupModal';
import toast from 'react-hot-toast';

// --- Types ---
interface ProjectMember {
    id: string;
    user_id: string;
    project_id: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
}

interface Project {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
    color: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    member_count: number;
    item_count: number;
    is_lead: boolean;
    has_unread?: boolean;
    status: string;
    members?: ProjectMember[];
}

export default function ProjectsListPage() {
    const { user } = useUser();
    const { organization } = useOrganization();
    const apiClient = useApiClient();
    const router = useRouter();
    const params = useParams();
    const orgSlug = params.orgSlug as string;

    // View State
    const [groups, setGroups] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'grid' | 'list'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'my' | 'active'>('all');

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Prevent multiple fetches
    const hasFetchedRef = useRef(false);

    // --- Data Fetching ---
    const fetchGroups = useCallback(async (silent: boolean = false) => {
        if (!organization?.id || !user?.id) {
            setIsLoading(false);
            return;
        }
        if (hasFetchedRef.current && !silent) return; // Prevent duplicate fetches (allow silent polling)

        if (!silent) {
            hasFetchedRef.current = true;
        }

        if (!silent) {
            setIsLoading(true);
        }

        try {
            const data = await apiClient.get<Project[]>(`/projects/`);
            // Sort by has_unread (true first), then updated_at desc
            const sorted = data.sort((a, b) => {
                if (a.has_unread && !b.has_unread) return -1;
                if (!a.has_unread && b.has_unread) return 1;
                return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            });
            setGroups(sorted);

            // Cache for instant load next time
            if (user && organization) {
                localStorage.setItem(`cached_projects_${organization.id}_${user.id}`, JSON.stringify(sorted));
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
            if (!silent) {
                // toast.error('Failed to load projects'); // Optional to avoid spam on initial load errors
            }
        } finally {
            if (!silent) {
                setIsLoading(false);
            }
        }
    }, [organization?.id, user?.id, apiClient]);

    // Load from cache immediately on mount
    useEffect(() => {
        if (user?.id && organization?.id) {
            const cached = localStorage.getItem(`cached_projects_${organization.id}_${user.id}`);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        setGroups(parsed);
                        setIsLoading(false); // Show content immediately
                    }
                } catch (e) {
                    console.error('Error parsing cached projects', e);
                }
            }
        }
    }, [user?.id, organization?.id]);

    useEffect(() => {
        if (organization?.id && user?.id && !hasFetchedRef.current) {
            fetchGroups(false);

            // Poll every 30 seconds to update unread indicators (SILENT - no toasts)
            const pollInterval = setInterval(() => {
                fetchGroups(true);
            }, 30000);

            return () => clearInterval(pollInterval);
        } else if (!organization?.id || !user?.id) {
            setIsLoading(false);
        }
    }, [organization?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Actions ---
    const handleCreateGroup = async (name: string, description: string, color: string, memberIds: string[]) => {
        if (!organization?.id) return;
        try {
            const newProject = await apiClient.post<Project>('/projects/', {
                organization_id: organization.id,
                name,
                description,
                color
            });

            // Just refresh list for now, members adding would be separate calls usually or handled by backend
            toast.success('Project created successfully');
            fetchGroups();

            // Navigate to new project
            router.push(`/${orgSlug}/projects/${newProject.id}/overview`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to create project');
        }
    };

    const handleProjectClick = (projectId: string) => {
        router.push(`/${orgSlug}/projects/${projectId}`);
    };

    // --- Filtering ---
    const filteredGroups = groups.filter(group => {
        const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (group.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesFilter =
            filter === 'all' ? true :
                filter === 'my' ? (group.created_by === user?.id || group.is_lead) : // inferring membership if is_lead or created_by
                    filter === 'active' ? group.status !== 'archived' : true;

        return matchesSearch && matchesFilter;
    });

    // --- Render ---
    return (
        <div className="h-full w-full bg-white flex flex-col p-8 animate-in fade-in duration-500 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Projects</h1>
                    <p className="text-gray-500 text-lg">Manage your team's initiatives and workspace.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="group relative inline-flex items-center justify-center px-6 py-3 text-base font-bold text-white transition-all duration-200 bg-gray-900 border border-transparent rounded-full hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                    <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                    New Project
                </button>
            </div>

            {/* Filters & Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between bg-gray-50 p-2 rounded-2xl border border-gray-100">
                {/* Search */}
                <div className="relative w-full md:w-96">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2.5 border-none rounded-xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black sm:text-sm"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Status Filter */}
                    <div className="flex bg-white rounded-xl shadow-sm p-1 border border-gray-100">
                        {['all', 'my', 'active'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f
                                    ? 'bg-gray-100 text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-white rounded-xl shadow-sm p-1 border border-gray-100 ml-auto md:ml-0">
                        <button
                            onClick={() => setView('grid')}
                            className={`p-2 rounded-lg transition-all ${view === 'grid' ? 'bg-gray-100 text-black' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-gray-100 text-black' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <List size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
                    <p className="text-gray-500 animate-pulse">Loading workspace...</p>
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                        <FolderOpen className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No projects found</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-8">
                        {searchQuery
                            ? `No projects matching "${searchQuery}"`
                            : "Create your first project to get started with your team."}
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-2.5 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
                    >
                        Create Project
                    </button>
                </div>
            ) : view === 'grid' ? (
                // Grid View
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-10">
                    {filteredGroups.map(group => (
                        <div
                            key={group.id}
                            onClick={() => handleProjectClick(group.id)}
                            className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-gray-200 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-[280px]"
                        >
                            {/* Card Color Strip */}
                            <div className="h-2 w-full" style={{ backgroundColor: group.color }}></div>

                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md transform group-hover:scale-110 transition-transform duration-300`} style={{ backgroundColor: group.color }}>
                                        <b className="text-xl">{group.name.substring(0, 2).toUpperCase()}</b>
                                    </div>
                                    {group.has_unread && (
                                        <span className="w-3 h-3 bg-red-500 rounded-full ring-4 ring-white"></span>
                                    )}
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                    {group.name}
                                </h3>
                                <p className="text-gray-500 text-sm line-clamp-2 mb-4 flex-1">
                                    {group.description || "No description"}
                                </p>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
                                    <div className="flex -space-x-2">
                                        {[1, 2, 3].slice(0, Math.min(3, group.member_count)).map((_, i) => (
                                            <div key={i} className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] text-gray-500 font-bold">
                                                ?
                                            </div>
                                        ))}
                                        {group.member_count > 3 && (
                                            <div className="w-8 h-8 rounded-full bg-gray-50 border-2 border-white flex items-center justify-center text-[10px] text-gray-400 font-medium">
                                                +{group.member_count - 3}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center text-xs text-gray-400 font-medium bg-gray-50 px-3 py-1 rounded-full group-hover:bg-black group-hover:text-white transition-colors">
                                        {group.item_count} items
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // List View
                <div className="space-y-3 pb-10">
                    {filteredGroups.map(group => (
                        <div
                            key={group.id}
                            onClick={() => handleProjectClick(group.id)}
                            className="group flex items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
                        >
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white mr-4 shadow-sm`} style={{ backgroundColor: group.color }}>
                                <b className="text-lg">{group.name.substring(0, 2).toUpperCase()}</b>
                            </div>

                            <div className="flex-1 min-w-0 mr-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{group.name}</h3>
                                    {group.has_unread && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
                                </div>
                                <p className="text-sm text-gray-500 truncate">{group.description || "No description"}</p>
                            </div>

                            <div className="flex items-center gap-6 text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                    <Users size={16} />
                                    <span>{group.member_count}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <FolderOpen size={16} />
                                    <span>{group.item_count}</span>
                                </div>
                                <div className="flex items-center gap-2 w-24 justify-end">
                                    <Clock size={16} />
                                    <span>{new Date(group.updated_at).toLocaleDateString()}</span>
                                </div>
                                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-black group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Group Modal */}
            {showCreateModal && (
                <CreateGroupModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateGroup}
                />
            )}
        </div>
    );
}
