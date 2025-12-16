'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Plus,
    Send,
    Search,
    Loader2,
    MoreVertical,
    UserPlus,
    UserMinus,
    Edit3,
    Trash2,
    LogOut,
    Eye,
    X,
    Layers, // Replaces Folder
    Lightbulb,
    Crown,
    ChevronRight,
    FileText,
    GitCommit,
    Orbit,
    Play,
    Pause,
    RefreshCw,
    MessageCircle,
    Quote,
    Calendar,
    CheckCircle2,
    Ban,
    Paperclip,
    Maximize2,
    Download,
    Clock,
    Wrench,
    ArrowLeft,
    ArrowUpRight,
    Link2,
    Check,
    LayoutGrid,
    List
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { useApiClient } from '@/hooks/useApiClient';
import { SharedNoteCard, SharedPostCard } from '@/components/feed/share';

// --- Types ---
type ApiClient = ReturnType<typeof useApiClient>;

interface ProjectMember {
    id: string;
    user_id: string; // Added user_id
    project_id: string; // Added
    first_name?: string;
    last_name?: string;
    job_title?: string;
    email: string;
    avatar_url?: string;
    role: 'lead' | 'member'; // admin changed to lead
    joined_at: string; // joined_at changed to joined_at
    last_read_at?: string;
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
    // members: ProjectMember[]; // Remove members array if not returned directly by GET /projects
    is_lead: boolean; // is_lead changed to is_lead
    has_unread?: boolean;
    status: string; // Added status
}

interface ReadReceipt {
    user_id: string;
    first_name?: string;
    last_name?: string;
    read_at: string;
}

interface ProjectMessage {
    id: string;
    project_id: string; // project_id changed to project_id
    sender_id: string;
    sender_name?: string;
    sender_avatar_url?: string;
    content: string;
    attachment_url?: string;
    attachment_type?: string;
    attachment_name?: string;
    shared_note_id?: string;
    shared_note?: any;
    shared_post_id?: string;
    shared_post?: any;
    created_at: string;
    read_by?: ReadReceipt[];
    is_system_message?: boolean;
}

interface Collaborator {
    name: string;
    avatar_url?: string;
    quote: string;
    date?: string;
}

interface ProjectItem {
    id: string;
    project_id: string;
    note_id?: string;
    cluster_id?: string;
    added_by: string;
    joined_at: string;
    // Details from join
    note?: any;
    cluster?: any;

    // Optional flattened fields used for rendering
    category?: string;
    status?: string;
    item_type?: string;
    created_date?: string;
    title?: string;
    summary?: string;
    note_count?: number;
    collaborators?: Collaborator[];
}

// --- Helpers ---
function getInitials(member: ProjectMember | null): string {
    if (!member) return '?';
    const first = member.first_name?.charAt(0) || '';
    const last = member.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
}

function getDisplayName(member: ProjectMember | null): string {
    if (!member) return 'Unknown';
    if (member.first_name) {
        return `${member.first_name} ${member.last_name || ''}`.trim();
    }
    return member.email || 'Unknown';
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getStatusStyle(status?: string): string {
    const s = (status || '').toLowerCase();
    switch (s) {
        case 'review':
        case 'in_review': return 'bg-amber-100 text-amber-700';
        case 'approved': return 'bg-green-100 text-green-700';
        case 'archived': return 'bg-gray-100 text-gray-600';
        case 'rejected': return 'bg-red-100 text-red-700';
        case 'draft': return 'bg-blue-50 text-blue-600';
        default: return 'bg-gray-100 text-gray-600';
    }
}

function getStatusLabel(status?: string, type?: string): string {
    if (!status) return type === 'cluster' ? 'Cluster' : 'Note';
    const s = status.toLowerCase();
    if (s === 'in_review') return 'In Review';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function getColorForCategory(category?: string): string {
    if (!category) return 'bg-gray-100 text-gray-600';
    const normalized = category.toLowerCase();
    if (normalized.includes('customer') || normalized.includes('experience')) return 'bg-pink-100 text-pink-600';
    if (normalized.includes('operation')) return 'bg-orange-100 text-orange-600';
    if (normalized.includes('esg') || normalized.includes('environmental')) return 'bg-teal-100 text-teal-600';
    if (normalized.includes('innovation') || normalized.includes('strategy')) return 'bg-purple-100 text-purple-600';
    if (normalized.includes('culture') || normalized.includes('workplace') || normalized.includes('hr')) return 'bg-blue-100 text-blue-600';
    if (normalized.includes('tech') || normalized.includes('digital')) return 'bg-green-100 text-green-600';
    return 'bg-gray-100 text-gray-600';
}

// --- Main Component ---
export default function GroupsPage() {
    const { user } = useUser();
    const { organization } = useOrganization();
    const apiClient = useApiClient();

    // Get selected group from URL
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const initialSelectedId = searchParams?.get('selected') || null;

    const [groups, setGroups] = useState<Project[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialSelectedId);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchGroups = useCallback(async (silent: boolean = false) => {
        try {
            const data = await apiClient.get<Project[]>('/projects');

            // Sort by updated_at DESC (most recent first)
            const sorted = [...data].sort((a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );

            setGroups(sorted);

            // Clear old cache and save new one
            if (user && organization) {
                // Remove old cache keys
                const oldCacheKeys = Object.keys(localStorage).filter(k =>
                    k.startsWith('cached_groups_') || k.startsWith('cached_projects_')
                );
                oldCacheKeys.forEach(k => localStorage.removeItem(k));

                // Save new cache
                localStorage.setItem(`cached_projects_${organization.id}_${user.id}`, JSON.stringify(sorted));
            }

            return sorted;
        } catch (error) {
            console.error('Error fetching groups:', error);
            // Only show toast on initial load error if we have no data
            if (!silent && groups.length === 0) {
                toast.error('Could not load projects');
            }
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [apiClient, user, organization]);

    // Load from cache immediately on mount
    useEffect(() => {
        if (user && organization) {
            const cached = localStorage.getItem(`cached_projects_${organization.id}_${user.id}`);
            if (cached) {
                try {
                    setGroups(JSON.parse(cached));
                    setIsLoading(false); // Show content immediately
                } catch (e) {
                    console.error('Error parsing cached groups', e);
                }
            }
        }
    }, [user, organization]);

    useEffect(() => {
        if (user) {
            fetchGroups(false).then((data) => {
                if (data.length > 0 && !initialSelectedId) {
                    setSelectedGroupId(data[0].id);
                }
            });

            // Poll every 60 seconds to update unread indicators (SILENT - no toasts)
            const pollInterval = setInterval(() => {
                fetchGroups(true);
            }, 60000);

            return () => clearInterval(pollInterval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Mark group as read when selected - update local state immediately
    useEffect(() => {
        if (selectedGroupId) {
            // Update local state to remove the unread indicator immediately
            setGroups(prev => prev.map(g =>
                g.id === selectedGroupId ? { ...g, has_unread: false } : g
            ));
            // Also notify the server
            apiClient.post(`/projects/${selectedGroupId}/mark-read`, {}).catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroupId]);



    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Removed blocking loader to allow UI shell to render immediately
    // if (isLoading) { ... }

    // If a project is selected, show full-page detail view (like Review page)
    if (selectedGroup) {
        return (
            <div className="h-full w-full bg-white flex flex-col animate-in fade-in duration-300">
                {/* Full page GroupView with back button integrated in header */}
                <GroupView
                    group={selectedGroup}
                    currentUser={user}
                    apiClient={apiClient}
                    onRefresh={fetchGroups}
                    organization={organization}
                    onBack={() => setSelectedGroupId(null)}
                />
            </div>
        );
    }

    // Grid view when no project is selected (like Review page)
    return (
        <div className="h-full w-full bg-white p-8 animate-in fade-in duration-500 overflow-y-auto">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Projects</h1>
            <p className="text-gray-500 mb-8">Manage and track your collaborative project spaces</p>

            {/* Search */}
            <div className="max-w-md mb-8">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black/10 focus:border-black/20"
                    />
                </div>
            </div>

            {/* Projects List - Long rows like Review Queue */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="p-6 bg-white rounded-2xl border border-gray-200 animate-pulse">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="h-4 bg-gray-100 rounded w-20 mb-3"></div>
                                    <div className="h-6 bg-gray-100 rounded w-48 mb-2"></div>
                                    <div className="h-4 bg-gray-50 rounded w-64"></div>
                                </div>
                                <div className="w-8 h-8 bg-gray-100 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Layers className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Projects Yet</h3>
                    <p className="text-gray-500">Projects you create or join will appear here</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredGroups.map(group => (
                        <button
                            key={group.id}
                            onClick={() => setSelectedGroupId(group.id)}
                            className="group w-full p-6 bg-white rounded-2xl border border-gray-200 text-left hover:border-black hover:shadow-lg transition-all duration-200"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    {/* Category badge row */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span
                                            className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider"
                                            style={{
                                                backgroundColor: group.color + '20',
                                                color: group.color
                                            }}
                                        >
                                            Project
                                        </span>
                                        {group.is_lead && (
                                            <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                                                <Crown size={12} /> Lead
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-black">
                                        {group.name}
                                    </h3>

                                    {/* Subtitle info */}
                                    <p className="text-sm text-gray-500 flex items-center gap-2">
                                        {group.member_count} members · {group.item_count} ideas · Updated {formatDate(group.updated_at)}
                                        {group.has_unread && (
                                            <span className="w-2 h-2 bg-black rounded-full inline-block" />
                                        )}
                                    </p>

                                    {/* Description if exists */}
                                    {group.description && (
                                        <p className="text-sm text-gray-600 mt-2 line-clamp-1">
                                            {group.description}
                                        </p>
                                    )}
                                </div>

                                {/* Arrow */}
                                <ArrowUpRight
                                    size={24}
                                    className="text-gray-300 group-hover:text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ml-4 shrink-0"
                                />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// --- Group View Component ---
interface GroupViewProps {
    group: Project;
    currentUser: any;
    apiClient: ApiClient;
    onRefresh: () => Promise<any>;
    organization: any;
    onBack?: () => void;
}

function GroupView({ group, currentUser, apiClient, onRefresh, organization, onBack }: GroupViewProps) {
    const [messages, setMessages] = useState<ProjectMessage[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [members, setMembers] = useState<ProjectMember[]>([]);

    // Fetch members when group changes
    // Fetch members when group changes
    useEffect(() => {
        let isCancelled = false;
        const cacheKey = `cached_members_project_${group.id}`;

        async function fetchMembers() {
            // 1. Try Cache First (Optimistic UI)
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed && Array.isArray(parsed)) {
                        setMembers(parsed);
                    }
                } catch (e) { console.error("Cache members parse error", e); }
            }

            try {
                const data = await apiClient.get<ProjectMember[]>(`/projects/${group.id}/members`);
                if (!isCancelled) {
                    setMembers(data);
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                }
            } catch (e) {
                console.error("Failed to load members", e);
            }
        }
        fetchMembers();
        return () => { isCancelled = true; };
    }, [group.id, apiClient]);
    const [items, setItems] = useState<ProjectItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(true);
    const [showMenu, setShowMenu] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'tools' | 'timeline'>('overview');
    const [ideaViewMode, setIdeaViewMode] = useState<'summary' | 'evolution'>('summary'); // Keep for now to avoid breaking references
    const [timelineProgress, setTimelineProgress] = useState(100);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedReviewNode, setSelectedReviewNode] = useState<any>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [toolsSubTab, setToolsSubTab] = useState<'stack' | 'connexions'>('stack');
    const [selectedToolNode, setSelectedToolNode] = useState<any>(null);
    const [showAddToolModal, setShowAddToolModal] = useState(false);

    // Library state
    const [libraryApps, setLibraryApps] = useState<any[]>([]);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [librarySearch, setLibrarySearch] = useState('');
    const [libraryCategory, setLibraryCategory] = useState<string>('all');
    const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'list'>('grid');

    // Create custom tool state
    const [showCreateToolForm, setShowCreateToolForm] = useState(false);
    const [createToolName, setCreateToolName] = useState('');
    const [createToolUrl, setCreateToolUrl] = useState('');
    const [createToolDescription, setCreateToolDescription] = useState('');
    const [createToolCategory, setCreateToolCategory] = useState('Software Engineering');
    const [createToolLoading, setCreateToolLoading] = useState(false);

    // Add tool to project modal state
    const [selectedAppToAdd, setSelectedAppToAdd] = useState<any>(null);
    const [addToolStatus, setAddToolStatus] = useState<'active' | 'planned'>('active');
    const [addToolNote, setAddToolNote] = useState('');
    const [addToolLoading, setAddToolLoading] = useState(false);

    // Categories for filter
    const categoryFilters = [
        { key: 'all', label: 'All' },
        { key: 'Software Engineering', label: 'Engineering' },
        { key: 'Cloud & Infrastructure', label: 'Cloud' },
        { key: 'Data & Analytics', label: 'Data' },
        { key: 'Product & UX', label: 'Product' },
        { key: 'Automation & AI', label: 'AI' },
        { key: 'Sales', label: 'Sales' },
        { key: 'Marketing', label: 'Marketing' },
        { key: 'Collaboration', label: 'Collaboration' },
        { key: 'Project & Operations', label: 'Project' },
    ];

    // Fetch library apps when modal opens
    useEffect(() => {
        if (showAddToolModal && libraryApps.length === 0) {
            setLibraryLoading(true);
            apiClient.get('/applications/library')
                .then((apps: any) => {
                    setLibraryApps(apps);
                })
                .catch((err) => {
                    console.error('Failed to load applications:', err);
                    toast.error('Failed to load applications library');
                })
                .finally(() => setLibraryLoading(false));
        }
    }, [showAddToolModal]);

    // Filter library apps by search AND category, then sort: CERTIFIED first, then by name
    const filteredLibraryApps = libraryApps
        .filter(app => {
            const matchesSearch =
                app.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
                app.description?.toLowerCase().includes(librarySearch.toLowerCase());
            const matchesCategory = libraryCategory === 'all' || app.category === libraryCategory;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            // CERTIFIED apps first
            if (a.status === 'CERTIFIED' && b.status !== 'CERTIFIED') return -1;
            if (a.status !== 'CERTIFIED' && b.status === 'CERTIFIED') return 1;
            // Then alphabetically by name
            return a.name.localeCompare(b.name);
        });

    // Helper to get logo URL from Google Favicon API (100% reliable, no rate limits)
    const getLogoUrl = (website: string) => {
        if (!website) return null;
        const domain = website.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    };

    // Mock tools data with websites for logos
    const projectTools = [
        { id: '1', name: 'Slack', website: 'slack.com', category: 'Communication', status: 'active', addedBy: currentUser, addedAt: '15/12/2025', note: 'Main communication channel for devs.' },
        { id: '2', name: 'Cursor', website: 'cursor.com', category: 'Development', status: 'active', addedBy: currentUser, addedAt: '15/12/2025', note: 'Main IDE.' },
        { id: '3', name: 'GitHub', website: 'github.com', category: 'Development', status: 'active', addedBy: currentUser, addedAt: '15/12/2025', note: 'Code hosting.' },
        { id: '4', name: 'Vercel', website: 'vercel.com', category: 'Infrastructure', status: 'active', addedBy: currentUser, addedAt: '15/12/2025', note: 'Deployment.' },
        { id: '5', name: 'Linear', website: 'linear.app', category: 'Development', status: 'planned', addedBy: currentUser, addedAt: '15/12/2025', note: 'Migration Q1.' },
        { id: '6', name: 'HubSpot', website: 'hubspot.com', category: 'Marketing', status: 'active', addedBy: currentUser, addedAt: '15/12/2025', note: 'CRM.' },
        { id: '7', name: 'Lemlist', website: 'lemlist.com', category: 'Marketing', status: 'active', addedBy: currentUser, addedAt: '15/12/2025', note: 'Outreach.' },
    ];

    // Graph nodes for Connexions view (x, y are percentages for responsive layout)
    const graphNodes = [
        { id: 'n1', toolName: 'Cursor', x: 15, y: 20 },
        { id: 'n2', toolName: 'GitHub', x: 40, y: 20 },
        { id: 'n3', toolName: 'Vercel', x: 65, y: 20 },
        { id: 'n4', toolName: 'HubSpot', x: 15, y: 55 },
        { id: 'n5', toolName: 'Lemlist', x: 40, y: 55 },
        { id: 'n6', toolName: 'Linear', x: 15, y: 85 },
        { id: 'n7', toolName: 'Slack', x: 40, y: 85 },
    ];

    // Graph edges (connections between tools)
    const graphEdges = [
        { id: 'e1', source: 'n1', target: 'n2', label: 'Commit & Push', active: true },
        { id: 'e2', source: 'n2', target: 'n3', label: 'Auto-Deploy', active: true },
        { id: 'e3', source: 'n4', target: 'n5', label: 'Sync Leads', active: false },
        { id: 'e4', source: 'n6', target: 'n7', label: 'Notifications', active: true },
    ];

    // Download function for lightbox images
    const handleDownload = async (url: string, filename: string) => {
        setIsDownloading(true);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast.success('Download started');
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('Download failed');
        } finally {
            setIsDownloading(false);
        }
    };
    const handleUpdateGroup = async (name: string, description: string, color: string) => {
        try {
            await apiClient.put(`/projects/${group.id}`, { name, description, color });
            toast.success('Group updated');
            setShowEditModal(false);
            onRefresh();
        } catch (error) {
            console.error('Error updating group:', error);
            toast.error('Failed to update group');
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isCreator = group.created_by === currentUser?.id;

    // Derived current item based on selection or fallback to first
    const currentItem = items.find(i => i.id === selectedItemId) || (items.length > 0 ? items[0] : null);

    // State for tracking group switch
    const [prevGroupId, setPrevGroupId] = useState<string | null>(null);

    // Fetch messages with polling
    // Since we use key={group.id} on parent, this component REMOUNTS on change.
    // So distinct state per group is guaranteed. Simple logic is best.
    useEffect(() => {
        let isCancelled = false;
        const cacheKey = `cached_messages_group_${group.id}`;

        // Check if we switched groups
        const isNewGroup = prevGroupId !== group.id;

        async function fetchMessages(isPolling = false) {
            if (isCancelled) return;

            // Logic for group switch (Instant Feedback)
            if (isNewGroup && !isPolling) {
                // Try to load cache immediately
                const cached = localStorage.getItem(cacheKey);
                let loadedFromCache = false;

                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (parsed && Array.isArray(parsed)) {
                            setMessages(parsed);
                            setIsLoadingMessages(false);
                            loadedFromCache = true;
                        }
                    } catch (e) { }
                }

                if (!loadedFromCache) {
                    setMessages([]); // Clear old messages instantly
                    setIsLoadingMessages(true);
                }

                // Update tracker - ONLY if not cancelled (safe in async 1 tick)
                if (!isCancelled) {
                    setPrevGroupId(group.id);
                }
            } else if (!isPolling && messages.length === 0) {
                // Initial load (page refresh case), try cache too
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (parsed && Array.isArray(parsed)) {
                            setMessages(parsed);
                            setIsLoadingMessages(false);
                        } else {
                            setIsLoadingMessages(true);
                        }
                    } catch (e) { setIsLoadingMessages(true); }
                } else {
                    setIsLoadingMessages(true);
                }
            }

            try {
                const data = await apiClient.get<ProjectMessage[]>(`/projects/${group.id}/messages`);

                if (!isCancelled) {
                    setMessages(data);
                    // Update Cache
                    localStorage.setItem(cacheKey, JSON.stringify(data));

                    // Specific fix for "member removed" case during polling
                    // If we get here, we are a member.
                    // If fetch failed with 403, catch block handles it.
                }
            } catch (error: any) {
                if (!isCancelled && !isPolling) {
                    console.error('Error loading messages:', error);

                    // Only show "no longer a member" for actual 403 errors, not 500 errors
                    if (error.status === 403 || (error.message?.includes('403') && !error.message?.includes('500'))) {
                        toast.error('You are no longer a member of this group');
                        onRefresh();
                    }
                }
            } finally {
                if (!isCancelled && !isPolling) {
                    setIsLoadingMessages(false);
                }
            }
        }

        // Initial fetch
        fetchMessages(false);

        // Poll every 30 seconds for new messages (reduced to avoid resource exhaustion)
        const pollInterval = setInterval(() => fetchMessages(true), 30000);

        return () => {
            isCancelled = true;
            clearInterval(pollInterval);
        };
    }, [group.id, apiClient]);

    // Fetch items
    // Fetch items with Cache
    useEffect(() => {
        let isCancelled = false;
        const cacheKey = `cached_items_group_${group.id}`;

        async function fetchItems() {
            if (isCancelled) return;

            // 1. Try Cache First for Instant Display
            const cached = localStorage.getItem(cacheKey);
            let loadedFromCache = false;

            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed && Array.isArray(parsed)) {
                        setItems(parsed);
                        // Auto-select first item if available and none selected
                        if (parsed.length > 0 && !selectedItemId) {
                            setSelectedItemId(parsed[0].id);
                        }
                        setIsLoadingItems(false);
                        loadedFromCache = true;
                    }
                } catch (e) { console.error("Cache items parse error", e); }
            }

            if (!loadedFromCache) {
                setIsLoadingItems(true);
            }

            try {
                const data = await apiClient.get<ProjectItem[]>(`/projects/${group.id}/items`);

                if (!isCancelled) {
                    setItems(data);

                    // Auto-select first if we didn't have cache, OR if we did butselection logic needs refresh? 
                    // Actually better to preserve selection if user is interacting.
                    // Only auto-select if no selection exists.
                    if (data.length > 0) {
                        // We can read the current state inside the functional update or ref, but here inside effect 'selectedItemId' is stale?
                        // Dependency array doesn't include selectedItemId.
                        // Let's just set it if we really need to. Ideally we check if 'selectedItemId' is still valid.
                        // For now, let's replicate original logic but safer.
                        // Actually original logic was: if (data.length > 0) setSelectedItemId(data[0].id); 
                        // This overwrites user selection on every poll/refresh! That's bad UX.
                        // I will only set it if NO current selection is made.
                        // Since I can't easily access current state without deps, I'll assume if loadedFromCache is false we can set it.
                        if (!loadedFromCache) {
                            setSelectedItemId(data[0].id);
                        }
                    }

                    // Update Cache
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('Error loading items:', error);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingItems(false);
                }
            }
        }

        fetchItems();

        return () => { isCancelled = true; };
    }, [group.id, apiClient]);

    const handleRemoveItem = async () => {
        if (!currentItem) return;
        if (!confirm('Are you sure you want to remove this idea from the group?')) return;

        try {
            await apiClient.delete(`/projects/${group.id}/items/${currentItem.id}`);
            toast.success('Idea removed from group');
            // Refresh items locally
            const newItems = items.filter(i => i.id !== currentItem.id);
            setItems(newItems);
            if (newItems.length > 0) {
                setSelectedItemId(newItems[0].id);
            } else {
                setSelectedItemId(null);
            }
        } catch (error: any) {
            console.error('Error removing item:', error);
            toast.error('Failed to remove idea');
        }
    };

    // Track if we should scroll to bottom (initial load or user sent message)
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const prevMessagesLengthRef = useRef(0);

    useEffect(() => {
        // Only scroll if:
        // 1. Initial load (shouldScrollToBottom is true)
        // 2. User just sent a message (messages length increased and last message is from current user)
        if (shouldScrollToBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShouldScrollToBottom(false);
        } else if (messages.length > prevMessagesLengthRef.current && messages.length > 0) {
            // Check if the new message is from current user (they just sent it)
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.sender_id === currentUser?.id) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
        prevMessagesLengthRef.current = messages.length;
    }, [messages, shouldScrollToBottom, currentUser?.id]);

    // Timeline animation
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying) {
            if (timelineProgress >= 100) {
                setTimelineProgress(0);
            }
            interval = setInterval(() => {
                setTimelineProgress(prev => {
                    if (prev >= 100) {
                        setIsPlaying(false);
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + 0.5;
                });
            }, 30);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    const handleSendMessage = async (content: string, attachments?: { url: string; type: string; name: string }[]) => {
        if (!content.trim() && (!attachments || attachments.length === 0)) return;

        try {
            // If we have attachments, send one message per attachment
            if (attachments && attachments.length > 0) {
                for (let i = 0; i < attachments.length; i++) {
                    const attachment = attachments[i];
                    const payload: any = {
                        content: i === 0 ? content : '', // First message gets text
                        attachment_url: attachment.url,
                        attachment_type: attachment.type,
                        attachment_name: attachment.name
                    };
                    const newMsg = await apiClient.post<ProjectMessage>(`/projects/${group.id}/messages`, payload);
                    setMessages(prev => [...prev, newMsg]);
                }
            } else {
                // No attachments, just text
                const newMsg = await apiClient.post<ProjectMessage>(`/projects/${group.id}/messages`, { content });
                setMessages(prev => [...prev, newMsg]);
            }
        } catch (error) {
            toast.error('Failed to send message');
        }
    };

    const handleAddMember = async (userId: string) => {
        try {
            await apiClient.post(`/projects/${group.id}/members`, { user_id: userId });
            toast.success('Member added');
            onRefresh();
        } catch (error: any) {
            toast.error(error.message || 'Failed to add member');
        }
    };

    const handleRemoveMember = async (userId: string) => {
        try {
            await apiClient.delete(`/projects/${group.id}/members/${userId}`);
            toast.success('Member removed');
            onRefresh();
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove member');
        }
    };

    const handleLeaveGroup = async () => {
        try {
            await apiClient.post(`/projects/${group.id}/leave`, {});
            toast.success('Left the group');
            onRefresh();
        } catch (error: any) {
            toast.error(error.message || 'Failed to leave group');
        }
    };

    const handleDeleteGroup = async () => {
        if (!confirm('Are you sure you want to delete this group?')) return;
        try {
            await apiClient.delete(`/projects/${group.id}`);
            toast.success('Group deleted');
            onRefresh();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete group');
        }
    };

    return (
        <>
            {/* Header - Review style with 4 tabs */}
            <div className="px-8 pt-6 pb-4 bg-white border-b border-gray-200">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tracking-wider uppercase">
                                Project
                            </span>
                            <span className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded-full">
                                <CheckCircle2 size={12} /> Active
                            </span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                            {group.name}
                            {group.is_lead && <Crown className="w-5 h-5 text-amber-500" />}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {group.member_count} members · Created {group.created_at ? new Date(group.created_at).toLocaleDateString() : 'recently'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        {/* Tab toggle - Review style */}
                        <div className="bg-gray-100 p-1 rounded-lg flex mr-2">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                            >
                                <Eye size={14} /> Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('chat')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                            >
                                <MessageCircle size={14} /> Chat
                            </button>
                            <button
                                onClick={() => setActiveTab('tools')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'tools' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                            >
                                <Wrench size={14} /> Tools
                            </button>
                            <button
                                onClick={() => setActiveTab('timeline')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'timeline' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                            >
                                <Clock size={14} /> Timeline
                            </button>
                        </div>

                        {/* Menu button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 text-gray-400 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                                        {isCreator && (
                                            <button
                                                onClick={() => {
                                                    setShowMenu(false);
                                                    setShowEditModal(true);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                            >
                                                <Edit3 size={16} /> Rename Project
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setShowMembersModal(true); setShowMenu(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            <Users size={16} /> View Members
                                        </button>
                                        {group.is_lead && (
                                            <button
                                                onClick={() => { setShowAddMemberModal(true); setShowMenu(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                            >
                                                <UserPlus size={16} /> Add Member
                                            </button>
                                        )}
                                        {!isCreator && (
                                            <button
                                                onClick={() => { handleLeaveGroup(); setShowMenu(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <LogOut size={16} /> Leave Project
                                            </button>
                                        )}
                                        {group.is_lead && (
                                            <button
                                                onClick={() => { handleDeleteGroup(); setShowMenu(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 size={16} /> Delete Project
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Back button - like Review page */}
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-gray-700 hover:text-black hover:shadow-md transition-all font-medium"
                            >
                                Back
                                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'overview' && (
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Project Description */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FileText size={14} /> Description
                            </h3>
                            <p className="text-gray-700 leading-relaxed">
                                {group.description || 'No description provided for this project.'}
                            </p>
                        </div>

                        {/* Team Members */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Users size={14} /> Team Members ({members.length})
                            </h3>
                            <div className="grid gap-3">
                                {members.map(member => (
                                    <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        {member.avatar_url ? (
                                            <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                                                {(member.first_name?.[0] || '') + (member.last_name?.[0] || '')}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-medium text-gray-900 flex items-center gap-2">
                                                {member.first_name} {member.last_name}
                                                {group.created_by === member.user_id && <Crown className="w-4 h-4 text-amber-500" />}
                                            </p>
                                            <p className="text-sm text-gray-500">{member.job_title || 'Team Member'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Linked Items */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Lightbulb size={14} /> Linked Ideas ({items.length})
                            </h3>
                            {items.length === 0 ? (
                                <p className="text-gray-500 text-sm">No ideas linked to this project yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {items.slice(0, 5).map(item => (
                                        <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                            <p className="font-medium text-gray-900">{item.title || 'Untitled'}</p>
                                            <p className="text-sm text-gray-500 mt-1">{item.status || 'Active'}</p>
                                        </div>
                                    ))}
                                    {items.length > 5 && (
                                        <p className="text-sm text-gray-500 text-center">+ {items.length - 5} more ideas</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'chat' && (
                <>
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                        {isLoadingMessages && messages.length === 0 ? (
                            <div className="space-y-4 animate-pulse">
                                {/* Skeleton: Received message */}
                                <div className="flex justify-start">
                                    <div className="max-w-[70%]">
                                        <div className="h-3 w-20 bg-gray-200 rounded mb-1.5"></div>
                                        <div className="px-4 py-3 bg-white rounded-2xl rounded-bl-md border border-gray-100 shadow-sm">
                                            <div className="h-4 w-48 bg-gray-200 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                                {/* Skeleton: Sent message */}
                                <div className="flex justify-end">
                                    <div className="max-w-[70%]">
                                        <div className="px-4 py-3 bg-gray-300 rounded-2xl rounded-br-md">
                                            <div className="h-4 w-32 bg-gray-400 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                                {/* Skeleton: Received message */}
                                <div className="flex justify-start">
                                    <div className="max-w-[70%]">
                                        <div className="h-3 w-16 bg-gray-200 rounded mb-1.5"></div>
                                        <div className="px-4 py-3 bg-white rounded-2xl rounded-bl-md border border-gray-100 shadow-sm">
                                            <div className="h-4 w-64 bg-gray-200 rounded mb-2"></div>
                                            <div className="h-4 w-40 bg-gray-200 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                                    <MessageCircle className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="text-gray-500 text-sm">No messages yet</p>
                                <p className="text-gray-400 text-xs mt-1">Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map(msg => {
                                // System messages are NEVER treated as "mine" even if sent by current user
                                const isMe = msg.is_system_message ? false : (msg.sender_id === currentUser?.id);
                                const hasOnlySharedNote = msg.shared_note && !msg.content && !msg.attachment_url;

                                return (
                                    <div key={msg.id} className={`flex gap-2 mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        {/* Avatar - Always show for non-me messages (including system) */}
                                        {!isMe && (
                                            <div className="flex-shrink-0">
                                                {msg.is_system_message ? (
                                                    // Workspace avatar for system messages
                                                    organization?.logo_url ? (
                                                        <img
                                                            src={organization.logo_url}
                                                            alt={organization.name || 'Workspace'}
                                                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-xs font-bold text-white">
                                                            {(organization?.name || 'WS').substring(0, 2).toUpperCase()}
                                                        </div>
                                                    )
                                                ) : (
                                                    // User avatar for regular messages
                                                    msg.sender_avatar_url ? (
                                                        <img
                                                            src={msg.sender_avatar_url}
                                                            alt={msg.sender_name || 'User'}
                                                            className="w-8 h-8 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                                                            {(msg.sender_name || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}

                                        <div className={`max-w-[70%] ${isMe ? 'order-2' : ''}`}>
                                            {/* Shared Note Card */}
                                            {msg.shared_note && (
                                                <div className="mb-1">
                                                    <SharedNoteCard note={msg.shared_note} />
                                                </div>
                                            )}

                                            {/* Shared Post Card */}
                                            {msg.shared_post && (
                                                <div className="mb-1">
                                                    <SharedPostCard post={msg.shared_post} />
                                                </div>
                                            )}

                                            {/* Message bubble */}
                                            {!msg.shared_note && !msg.shared_post && (msg.content || msg.attachment_url) && (
                                                <div className={`px-4 py-2.5 rounded-2xl ${isMe
                                                    ? 'bg-black text-white rounded-br-md'
                                                    : 'bg-white text-gray-900 border border-gray-100 rounded-bl-md shadow-sm'
                                                    }`}>
                                                    {msg.content && <p className="text-sm whitespace-pre-line">{msg.content}</p>}
                                                    {/* Attachment Display - Same as Chat */}
                                                    {msg.attachment_url && (
                                                        <div className={`${msg.content ? 'mt-2' : ''}`}>
                                                            {msg.attachment_type?.startsWith('image/') ? (
                                                                <div className="relative group">
                                                                    <img
                                                                        src={msg.attachment_url}
                                                                        alt={msg.attachment_name || 'Image'}
                                                                        className="rounded-xl max-w-full max-h-64 object-cover shadow-sm cursor-pointer"
                                                                        onClick={() => setLightboxImage({ url: msg.attachment_url!, name: msg.attachment_name || 'Image' })}
                                                                    />
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setLightboxImage({ url: msg.attachment_url!, name: msg.attachment_name || 'Image' }); }}
                                                                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <Maximize2 size={14} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <a
                                                                    href={msg.attachment_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isMe ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                                                >
                                                                    <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-gray-100'}`}>
                                                                        <FileText size={20} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-medium text-sm truncate">{msg.attachment_name || 'Attachment'}</p>
                                                                        <p className="text-xs opacity-70">Click to open</p>
                                                                    </div>
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className={`flex flex-col gap-0.5 mt-1 ${isMe ? 'items-end mr-1' : 'ml-1'}`}>
                                                <p className="text-[10px] text-gray-400">
                                                    {formatDate(msg.created_at)}
                                                </p>
                                                {isMe && msg.read_by && msg.read_by.length > 0 && (
                                                    <p className="text-[10px] text-gray-400">
                                                        Seen by {msg.read_by.map(r => r.first_name || 'User').join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })

                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <MessageInput onSend={handleSendMessage} />
                </>
            )}

            {activeTab === 'tools' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Sub-Nav & Action Bar */}
                    <div className="px-8 py-6 flex justify-between items-center shrink-0 bg-gray-50/80 backdrop-blur-sm z-10 border-b border-gray-100">
                        <div>
                            <div className="flex gap-1 bg-gray-200/50 p-1 rounded-lg">
                                <button
                                    onClick={() => setToolsSubTab('stack')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${toolsSubTab === 'stack' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Stack
                                </button>
                                <button
                                    onClick={() => { setToolsSubTab('connexions'); setSelectedToolNode(null); }}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${toolsSubTab === 'connexions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Link2 size={14} /> Connections
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAddToolModal(true)}
                            className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow transition-all"
                        >
                            <Plus size={16} />
                            {toolsSubTab === 'stack' ? 'Add' : 'Connect'}
                        </button>
                    </div>

                    {/* VIEW: STACK */}
                    {toolsSubTab === 'stack' && (
                        <div className="flex-1 overflow-y-auto px-8 pb-10 pt-6 animate-in slide-in-from-left-4 duration-300">
                            {/* Active Tools */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    Active ({projectTools.filter(t => t.status === 'active').length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {projectTools.filter(t => t.status === 'active').map(tool => (
                                        <div key={tool.id} className="flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group">
                                            <div className="p-4 flex items-start justify-between border-b border-gray-100 bg-gray-50/30">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden p-2">
                                                        <img
                                                            src={getLogoUrl(tool.website) || ''}
                                                            alt={tool.name}
                                                            className="w-full h-full object-contain"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900">{tool.name}</h3>
                                                        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">{tool.category}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-4 py-3 flex items-center gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Added by</span>
                                                    {tool.addedBy?.avatar_url ? (
                                                        <img src={tool.addedBy.avatar_url} className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white"></div>
                                                    )}
                                                </div>
                                                <div className="h-px flex-1 bg-gray-100"></div>
                                                <span className="text-[10px] text-gray-400">{tool.addedAt}</span>
                                            </div>
                                            <div className="px-4 pb-3">
                                                <p className="text-sm text-gray-600 italic">"{tool.note}"</p>
                                            </div>
                                            <div className="h-1 w-full bg-green-500"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Planned Tools */}
                            {projectTools.filter(t => t.status === 'planned').length > 0 && (
                                <div className="mt-8">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                        Planned ({projectTools.filter(t => t.status === 'planned').length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {projectTools.filter(t => t.status === 'planned').map(tool => (
                                            <div key={tool.id} className="flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 opacity-70 hover:opacity-100">
                                                <div className="p-4 flex items-start justify-between border-b border-gray-100 bg-gray-50/30">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden p-2">
                                                            <img
                                                                src={getLogoUrl(tool.website) || ''}
                                                                alt={tool.name}
                                                                className="w-full h-full object-contain"
                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-gray-900">{tool.name}</h3>
                                                            <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">{tool.category}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="px-4 py-3 flex items-center gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Added by</span>
                                                        {tool.addedBy?.avatar_url ? (
                                                            <img src={tool.addedBy.avatar_url} className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white"></div>
                                                        )}
                                                    </div>
                                                    <div className="h-px flex-1 bg-gray-100"></div>
                                                    <span className="text-[10px] text-gray-400">{tool.addedAt}</span>
                                                </div>
                                                <div className="h-1 w-full bg-amber-400"></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: CONNEXIONS (Interactive Canvas) */}
                    {toolsSubTab === 'connexions' && (
                        <div className="flex-1 relative bg-slate-50 overflow-hidden animate-in fade-in duration-300">
                            {/* Background Pattern */}
                            <div
                                className="absolute inset-0 opacity-10"
                                style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                            ></div>

                            {/* SVG Layer for Edges */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                                {graphEdges.map((edge) => {
                                    const startNode = graphNodes.find(n => n.id === edge.source);
                                    const endNode = graphNodes.find(n => n.id === edge.target);
                                    if (!startNode || !endNode) return null;

                                    const x1 = `${startNode.x}%`;
                                    const y1 = `${startNode.y}%`;
                                    const x2 = `${endNode.x}%`;
                                    const y2 = `${endNode.y}%`;
                                    const midX = (startNode.x + endNode.x) / 2;
                                    const midY = (startNode.y + endNode.y) / 2;

                                    return (
                                        <g key={edge.id}>
                                            <line
                                                x1={x1} y1={y1}
                                                x2={x2} y2={y2}
                                                stroke={edge.active ? "#22c55e" : "#cbd5e1"}
                                                strokeWidth="2"
                                                strokeDasharray={edge.active ? "0" : "5,5"}
                                                className={edge.active ? "animate-pulse" : ""}
                                            />
                                            {edge.active && (
                                                <circle r="4" fill="#22c55e">
                                                    <animateMotion
                                                        dur="2s"
                                                        repeatCount="indefinite"
                                                        path={`M${startNode.x * 10},${startNode.y * 5} L${endNode.x * 10},${endNode.y * 5}`}
                                                    />
                                                </circle>
                                            )}
                                            <foreignObject x={`${midX - 5}%`} y={`${midY - 2}%`} width="10%" height="24">
                                                <div className={`text-[10px] text-center px-2 py-0.5 rounded-full border shadow-sm mx-auto w-fit truncate ${edge.active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                                                    }`}>
                                                    {edge.label}
                                                </div>
                                            </foreignObject>
                                        </g>
                                    );
                                })}
                            </svg>

                            {/* Nodes Layer */}
                            <div className="absolute inset-0 z-10">
                                {graphNodes.map((node) => {
                                    const tool = projectTools.find(t => t.name === node.toolName);
                                    const isSelected = selectedToolNode?.id === node.id;

                                    return (
                                        <div
                                            key={node.id}
                                            onClick={() => setSelectedToolNode({ ...node, toolData: tool })}
                                            className={`absolute w-20 h-20 -ml-10 -mt-10 rounded-2xl bg-white border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-sm hover:scale-110 group ${isSelected ? 'border-blue-500 shadow-blue-200 shadow-lg scale-110' : 'border-gray-200 hover:border-blue-300'
                                                }`}
                                            style={{ left: `${node.x}%`, top: `${node.y}%` }}
                                        >
                                            <div className="w-10 h-10 flex items-center justify-center mb-1">
                                                {tool?.website && (
                                                    <img
                                                        src={getLogoUrl(tool.website) || ''}
                                                        alt={node.toolName}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-700 truncate max-w-[90%] px-1">{node.toolName}</span>
                                            <div className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${isSelected ? 'bg-blue-500' : 'bg-green-500'
                                                }`}>
                                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Side Panel (Contextual Info) */}
                            <div className={`absolute top-4 right-4 bottom-4 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 transform transition-transform duration-300 ease-in-out z-20 flex flex-col ${selectedToolNode ? 'translate-x-0' : 'translate-x-[110%]'
                                }`}>
                                {selectedToolNode && (
                                    <>
                                        <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50/50 rounded-t-xl">
                                            <div className="flex items-center gap-3">
                                                {selectedToolNode.toolData?.website && (
                                                    <img
                                                        src={getLogoUrl(selectedToolNode.toolData.website) || ''}
                                                        className="w-10 h-10 object-contain bg-white rounded-lg border border-gray-200 p-1"
                                                        alt=""
                                                    />
                                                )}
                                                <div>
                                                    <h3 className="font-bold text-gray-900">{selectedToolNode.toolName}</h3>
                                                    <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Connecté</span>
                                                </div>
                                            </div>
                                            <button onClick={() => setSelectedToolNode(null)} className="text-gray-400 hover:text-gray-600">
                                                <X size={18} />
                                            </button>
                                        </div>

                                        <div className="p-5 flex-1 overflow-y-auto">
                                            <div className="space-y-6">
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Flux de données</h4>
                                                    <div className="space-y-2">
                                                        {graphEdges.filter(e => e.source === selectedToolNode.id).map((e, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                                <ArrowUpRight size={14} className="text-gray-400" />
                                                                <span>Envoie vers <span className="font-semibold text-gray-900">{graphNodes.find(n => n.id === e.target)?.toolName}</span></span>
                                                            </div>
                                                        ))}
                                                        {graphEdges.filter(e => e.target === selectedToolNode.id).map((e, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                                <ArrowLeft size={14} className="text-gray-400" />
                                                                <span>Reçoit de <span className="font-semibold text-gray-900">{graphNodes.find(n => n.id === e.source)?.toolName}</span></span>
                                                            </div>
                                                        ))}
                                                        {!graphEdges.some(e => e.source === selectedToolNode.id || e.target === selectedToolNode.id) && (
                                                            <p className="text-sm text-gray-400 italic">Aucune connexion active.</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Métriques</h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="bg-white border border-gray-200 p-3 rounded-lg text-center">
                                                            <div className="text-xs text-gray-500">Uptime</div>
                                                            <div className="font-bold text-green-600">99.9%</div>
                                                        </div>
                                                        <div className="bg-white border border-gray-200 p-3 rounded-lg text-center">
                                                            <div className="text-xs text-gray-500">Last Sync</div>
                                                            <div className="font-bold text-gray-900">2m ago</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Actions</h4>
                                                    <button className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors text-gray-700">
                                                        <Wrench size={14} /> Configurer l'intégration
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-6 text-xs text-gray-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-0.5 bg-green-500"></div>
                                    <span>Active</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-0.5 border-t-2 border-dashed border-gray-300"></div>
                                    <span>Inactive</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span>Connecté</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'timeline' && (
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                            <Clock size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Project Timeline</h3>
                            <p className="text-gray-500">Project milestones and activity timeline will be displayed here.</p>
                        </div>
                    </div>
                </div>
            )}

            {showEditModal && (
                <EditGroupModal
                    group={group}
                    onClose={() => setShowEditModal(false)}
                    onUpdate={handleUpdateGroup}
                />
            )}
            {/* Members Modal */}
            <AnimatePresence>
                {showMembersModal && (
                    <MembersModal
                        members={members}
                        isAdmin={group.is_lead}
                        creatorId={group.created_by}
                        currentUserId={currentUser?.id}
                        onRemove={handleRemoveMember}
                        onClose={() => setShowMembersModal(false)}
                    />
                )}
            </AnimatePresence>

            {/* Add Member Modal */}
            {
                showAddMemberModal && (
                    <MemberPicker
                        isOpen={true}
                        onClose={() => setShowAddMemberModal(false)}
                        onSelect={(memberId) => {
                            handleAddMember(memberId);
                            setShowAddMemberModal(false);
                        }}
                        excludeIds={members.map(m => m.user_id)}
                        title="Add member to group"
                    />
                )
            }

            {/* Add Tool Modal - Bibliothèque d'outils */}
            <AnimatePresence>
                {showAddToolModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 lg:p-8"
                        onClick={() => setShowAddToolModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-[90vw] md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[85vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header - Fixed */}
                            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-start shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Tools Library</h2>
                                    <p className="text-sm text-gray-500">Add to your project stack.</p>
                                </div>
                                <button
                                    onClick={() => { setShowAddToolModal(false); setLibrarySearch(''); setLibraryCategory('all'); }}
                                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            {/* Search + View Toggle - Fixed */}
                            <div className="px-6 py-4 border-b border-gray-100 shrink-0">
                                <div className="flex gap-3 items-center">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search tools..."
                                            value={librarySearch}
                                            onChange={(e) => setLibrarySearch(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                                            autoFocus
                                        />
                                    </div>
                                    {/* View Mode Toggle */}
                                    <div className="flex bg-gray-100 rounded-lg p-1">
                                        <button
                                            onClick={() => setLibraryViewMode('grid')}
                                            className={`p-2 rounded-md transition-colors ${libraryViewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                            title="Grid view"
                                        >
                                            <LayoutGrid size={18} />
                                        </button>
                                        <button
                                            onClick={() => setLibraryViewMode('list')}
                                            className={`p-2 rounded-md transition-colors ${libraryViewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                            title="List view"
                                        >
                                            <List size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Category Filter - Fixed */}
                            <div className="px-6 py-3 border-b border-gray-100 overflow-x-auto shrink-0">
                                <div className="flex gap-2">
                                    {categoryFilters.map((cat) => (
                                        <button
                                            key={cat.key}
                                            onClick={() => setLibraryCategory(cat.key)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${libraryCategory === cat.key
                                                ? 'bg-gray-900 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tools List - Scrollable */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                                {libraryLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : filteredLibraryApps.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        {librarySearch ? 'No tools found matching your search.' : 'No tools available.'}
                                    </div>
                                ) : libraryViewMode === 'grid' ? (
                                    /* Grid View */
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {filteredLibraryApps.map((app) => (
                                            <div
                                                key={app.id}
                                                className="relative flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group"
                                            >
                                                {/* Delete button for non-certified apps */}
                                                {app.status !== 'CERTIFIED' && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!confirm(`Delete "${app.name}"? This cannot be undone.`)) return;
                                                            try {
                                                                await apiClient.delete(`/applications/${app.id}`);
                                                                setLibraryApps(prev => prev.filter(a => a.id !== app.id));
                                                                toast.success(`${app.name} deleted`);
                                                            } catch (err: any) {
                                                                toast.error(err.message || 'Failed to delete');
                                                            }
                                                        }}
                                                        className="absolute top-2 right-2 p-1.5 rounded-full bg-white border border-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all z-10"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}

                                                {/* Clickable area to add tool */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedAppToAdd(app);
                                                        setAddToolStatus('active');
                                                        setAddToolNote('');
                                                    }}
                                                    className="absolute inset-0 z-0"
                                                />

                                                {/* Logo */}
                                                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 relative z-0">
                                                    <img
                                                        src={app.logo_url || getLogoUrl(app.url)}
                                                        alt={app.name}
                                                        className="w-6 h-6 object-contain"
                                                    />
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0 relative z-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <h3 className="font-semibold text-gray-900 text-sm">{app.name}</h3>
                                                        {app.status === 'CERTIFIED' && (
                                                            <span className="w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center" title="Certified">
                                                                <Check size={10} className="text-white" strokeWidth={3} />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{app.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* List View */
                                    <div className="space-y-1">
                                        {filteredLibraryApps.map((app) => (
                                            <div
                                                key={app.id}
                                                className="relative w-full flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-gray-50 rounded-lg transition-all text-left group"
                                            >
                                                {/* Clickable area to add tool */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedAppToAdd(app);
                                                        setAddToolStatus('active');
                                                        setAddToolNote('');
                                                    }}
                                                    className="absolute inset-0 z-0"
                                                />

                                                {/* Logo */}
                                                <div className="w-8 h-8 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 relative z-0">
                                                    <img
                                                        src={app.logo_url || getLogoUrl(app.url)}
                                                        alt={app.name}
                                                        className="w-5 h-5 object-contain"
                                                    />
                                                </div>

                                                {/* Name + Badge */}
                                                <div className="flex items-center gap-1.5 min-w-[140px] relative z-0">
                                                    <h3 className="font-medium text-gray-900 text-sm">{app.name}</h3>
                                                    {app.status === 'CERTIFIED' && (
                                                        <span className="w-3.5 h-3.5 rounded-full bg-gray-900 flex items-center justify-center" title="Certified">
                                                            <Check size={8} className="text-white" strokeWidth={3} />
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Description */}
                                                <p className="flex-1 text-sm text-gray-500 truncate relative z-0">{app.description}</p>

                                                {/* Delete button for non-certified apps */}
                                                {app.status !== 'CERTIFIED' && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!confirm(`Delete "${app.name}"? This cannot be undone.`)) return;
                                                            try {
                                                                await apiClient.delete(`/applications/${app.id}`);
                                                                setLibraryApps(prev => prev.filter(a => a.id !== app.id));
                                                                toast.success(`${app.name} deleted`);
                                                            } catch (err: any) {
                                                                toast.error(err.message || 'Failed to delete');
                                                            }
                                                        }}
                                                        className="p-1.5 rounded-full bg-white border border-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all z-10 relative"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer - Create Custom Tool */}
                            <div className="border-t border-gray-100 bg-gray-50/50 shrink-0">
                                {!showCreateToolForm ? (
                                    <div className="px-6 py-4">
                                        <button
                                            onClick={() => setShowCreateToolForm(true)}
                                            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                        >
                                            <Plus size={16} />
                                            Create custom tool
                                        </button>
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-6 py-5"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-gray-900">Create Custom Tool</h3>
                                            <button
                                                onClick={() => {
                                                    setShowCreateToolForm(false);
                                                    setCreateToolName('');
                                                    setCreateToolUrl('');
                                                    setCreateToolDescription('');
                                                    setCreateToolCategory('Software Engineering');
                                                }}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Name */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Name *</label>
                                                <input
                                                    type="text"
                                                    value={createToolName}
                                                    onChange={(e) => setCreateToolName(e.target.value)}
                                                    placeholder="e.g. My Tool"
                                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>

                                            {/* URL */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Website URL *</label>
                                                <input
                                                    type="text"
                                                    value={createToolUrl}
                                                    onChange={(e) => setCreateToolUrl(e.target.value)}
                                                    placeholder="e.g. mytool.com"
                                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>

                                            {/* Category */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Category</label>
                                                <select
                                                    value={createToolCategory}
                                                    onChange={(e) => setCreateToolCategory(e.target.value)}
                                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                                >
                                                    <option value="Software Engineering">Engineering</option>
                                                    <option value="Cloud & Infrastructure">Cloud</option>
                                                    <option value="Data & Analytics">Data</option>
                                                    <option value="Product & UX">Product</option>
                                                    <option value="Automation & AI">AI</option>
                                                    <option value="Sales">Sales</option>
                                                    <option value="Marketing">Marketing</option>
                                                    <option value="Collaboration">Collaboration</option>
                                                    <option value="Project & Operations">Project</option>
                                                </select>
                                            </div>

                                            {/* Description */}
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
                                                <input
                                                    type="text"
                                                    value={createToolDescription}
                                                    onChange={(e) => setCreateToolDescription(e.target.value)}
                                                    placeholder="Brief description of the tool..."
                                                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>

                                        {/* Preview + Actions */}
                                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                                            {/* Preview */}
                                            <div className="flex items-center gap-3">
                                                {createToolUrl && (
                                                    <div className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                                                        <img
                                                            src={getLogoUrl(createToolUrl) || ''}
                                                            alt="Preview"
                                                            className="w-5 h-5 object-contain"
                                                        />
                                                    </div>
                                                )}
                                                <span className="text-sm text-gray-500">
                                                    {createToolUrl ? 'Logo preview' : 'Enter URL to see logo'}
                                                </span>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setShowCreateToolForm(false);
                                                        setCreateToolName('');
                                                        setCreateToolUrl('');
                                                        setCreateToolDescription('');
                                                        setCreateToolCategory('Software Engineering');
                                                    }}
                                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!createToolName.trim() || !createToolUrl.trim()) {
                                                            toast.error('Name and URL are required');
                                                            return;
                                                        }
                                                        setCreateToolLoading(true);
                                                        try {
                                                            const newApp = await apiClient.post('/applications/', {
                                                                name: createToolName.trim(),
                                                                url: createToolUrl.trim().replace(/^https?:\/\//, '').replace(/^www\./, ''),
                                                                description: createToolDescription.trim() || null,
                                                                category: createToolCategory
                                                            });
                                                            setLibraryApps(prev => [...prev, newApp]);
                                                            toast.success(`${createToolName} created successfully!`);
                                                            setShowCreateToolForm(false);
                                                            setCreateToolName('');
                                                            setCreateToolUrl('');
                                                            setCreateToolDescription('');
                                                            setCreateToolCategory('Software Engineering');
                                                        } catch (err: any) {
                                                            console.error('Failed to create tool:', err);
                                                            toast.error(err.message || 'Failed to create tool');
                                                        } finally {
                                                            setCreateToolLoading(false);
                                                        }
                                                    }}
                                                    disabled={createToolLoading || !createToolName.trim() || !createToolUrl.trim()}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                                >
                                                    {createToolLoading && <Loader2 size={14} className="animate-spin" />}
                                                    Create Tool
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Tool to Project Confirmation Modal */}
            <AnimatePresence>
                {selectedAppToAdd && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                        onClick={() => setSelectedAppToAdd(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                                    <img
                                        src={selectedAppToAdd.logo_url || getLogoUrl(selectedAppToAdd.url)}
                                        alt={selectedAppToAdd.name}
                                        className="w-7 h-7 object-contain"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 text-lg">Add {selectedAppToAdd.name}</h3>
                                    <p className="text-sm text-gray-500">to your project stack</p>
                                </div>
                                <button
                                    onClick={() => setSelectedAppToAdd(null)}
                                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="px-6 py-5 space-y-5">
                                {/* Status Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setAddToolStatus('active')}
                                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${addToolStatus === 'active'
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                                }`}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                                            <span className="font-medium">Active</span>
                                        </button>
                                        <button
                                            onClick={() => setAddToolStatus('planned')}
                                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${addToolStatus === 'planned'
                                                ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                                }`}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                                            <span className="font-medium">Planned</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Note */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
                                    <input
                                        type="text"
                                        value={addToolNote}
                                        onChange={(e) => setAddToolNote(e.target.value)}
                                        placeholder="e.g. Main IDE, CRM for enterprise clients..."
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setSelectedAppToAdd(null)}
                                    className="flex-1 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!group) return;
                                        setAddToolLoading(true);
                                        try {
                                            await apiClient.post(`/applications/projects/${group.id}/tools`, {
                                                application_id: selectedAppToAdd.id,
                                                status: addToolStatus,
                                                note: addToolNote.trim() || null
                                            });
                                            toast.success(`${selectedAppToAdd.name} added to project!`);
                                            setSelectedAppToAdd(null);
                                            setShowAddToolModal(false);
                                            setLibrarySearch('');
                                            setLibraryCategory('all');
                                            // TODO: Refresh project tools list
                                        } catch (err: any) {
                                            console.error('Failed to add tool:', err);
                                            toast.error(err.message || 'Failed to add tool');
                                        } finally {
                                            setAddToolLoading(false);
                                        }
                                    }}
                                    disabled={addToolLoading}
                                    className="flex-1 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {addToolLoading && <Loader2 size={16} className="animate-spin" />}
                                    Add to Project
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Lightbox for Images - Same as Chat */}
            <AnimatePresence>
                {lightboxImage && (
                    <div
                        className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
                        onClick={() => setLightboxImage(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative max-w-4xl max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={lightboxImage.url}
                                alt={lightboxImage.name}
                                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                            />

                            {/* Controls */}
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                <button
                                    onClick={() => handleDownload(lightboxImage.url, lightboxImage.name)}
                                    disabled={isDownloading}
                                    className="p-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
                                    title="Download"
                                >
                                    {isDownloading ? (
                                        <Loader2 size={20} className="text-white animate-spin" />
                                    ) : (
                                        <Download size={20} className="text-white" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setLightboxImage(null)}
                                    className="p-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full transition-colors"
                                    title="Close"
                                >
                                    <X size={20} className="text-white" />
                                </button>
                            </div>

                            {/* Filename */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
                                <p className="text-white text-sm">{lightboxImage.name}</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}

// --- Message Input (Enhanced with Attachments) ---
interface MessageInputProps {
    onSend: (content: string, attachments?: { url: string; type: string; name: string }[]) => void;
}

function MessageInput({ onSend }: MessageInputProps) {
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const apiClient = useApiClient(); // Make sure this is first

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (attachments.length + files.length > 5) {
            toast.error('Maximum 5 files allowed');
            return;
        }
        // Filter valid files (max 10MB each)
        const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024);
        if (validFiles.length < files.length) {
            toast.error('Some files exceed 10MB limit');
        }
        setAttachments(prev => [...prev, ...validFiles]);
        if (e.target) e.target.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!content.trim() && attachments.length === 0) return;

        setIsUploading(true);
        try {
            if (attachments.length > 0) {
                // Upload files first
                const uploadedFiles: { url: string; type: string; name: string }[] = [];

                for (const file of attachments) {
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.readAsDataURL(file);
                    });

                    const result = await apiClient.post<{ url: string; filename: string; content_type: string }>(
                        '/projects/upload-attachment',
                        { file: base64, filename: file.name, content_type: file.type }
                    );

                    uploadedFiles.push({ url: result.url, type: result.content_type, name: result.filename });
                }

                onSend(content, uploadedFiles);
            } else {
                onSend(content);
            }

            setContent('');
            setAttachments([]);
            textareaRef.current?.focus();
        } catch (error) {
            toast.error('Failed to send message');
        } finally {
            setIsUploading(false);
        }
    };

    const getFileExtension = (filename: string): string => {
        return filename.split('.').pop()?.toUpperCase() || 'FILE';
    };

    const getFileTypeColor = (type: string): string => {
        if (type === 'application/pdf') return 'bg-red-500';
        if (type.includes('word') || type.includes('document')) return 'bg-blue-500';
        if (type.includes('sheet') || type.includes('excel')) return 'bg-green-500';
        if (type === 'text/csv') return 'bg-emerald-500';
        if (type.startsWith('image/')) return 'bg-purple-500';
        return 'bg-gray-500';
    };

    return (
        <div className="p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-2xl duration-300 group focus-within:ring-2 focus-within:ring-black/5">
                {/* Attachments Preview - Same style as Chat */}
                {attachments.length > 0 && (
                    <div className="px-4 pt-3 flex flex-wrap gap-2">
                        {attachments.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm">
                                <div className={`w-8 h-8 ${getFileTypeColor(file.type)} rounded-lg flex items-center justify-center`}>
                                    <span className="text-white text-[10px] font-bold">{getFileExtension(file.name)}</span>
                                </div>
                                <span className="truncate max-w-[120px] text-gray-700 text-xs">{file.name}</span>
                                <button
                                    onClick={() => removeAttachment(index)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        {attachments.length < 5 && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1 text-gray-400 hover:text-gray-600 px-2 py-1 text-xs border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                            >
                                <Plus size={12} />
                                Add more
                            </button>
                        )}
                    </div>
                )}

                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message..."
                        className="w-full h-20 px-5 py-4 bg-transparent text-gray-900 placeholder-gray-400 resize-none focus:outline-none text-base"
                        disabled={isUploading}
                    />
                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                        className="hidden"
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-3">
                        <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide hidden sm:inline-block">
                            ⌘ + Enter
                        </span>
                        {/* Attachment Button */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all relative"
                            title="Attach files (max 5)"
                            disabled={isUploading || attachments.length >= 5}
                        >
                            <Paperclip className="w-4 h-4" />
                            {attachments.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[10px] rounded-full flex items-center justify-center">
                                    {attachments.length}
                                </span>
                            )}
                        </button>
                        {/* Send Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={(!content.trim() && attachments.length === 0) || isUploading}
                            className="p-2.5 bg-black text-white rounded-xl shadow-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                        >
                            {isUploading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Members Modal ---
interface MembersModalProps {
    members: ProjectMember[];
    isAdmin: boolean;
    creatorId: string;
    currentUserId?: string;
    onRemove: (userId: string) => void;
    onClose: () => void;
}

function MembersModal({ members, isAdmin, creatorId, currentUserId, onRemove, onClose }: MembersModalProps) {
    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4"
            >
                <div className="bg-white w-full max-w-md rounded-2xl shadow-xl pointer-events-auto">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{members.length} Members</h3>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    <div className="p-2 max-h-80 overflow-y-auto">
                        {members.map(member => {
                            const isMemberCreator = member.id === creatorId;
                            const isCurrentUser = member.id === currentUserId;
                            const canRemove = isAdmin && !isMemberCreator && !isCurrentUser;

                            return (
                                <div key={member.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl">
                                    {member.avatar_url ? (
                                        <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                                            {getInitials(member)}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 text-sm truncate">
                                                {getDisplayName(member)}
                                            </span>
                                            {isMemberCreator && <Crown className="w-3 h-3 text-amber-500" />}
                                            {member.role === 'lead' && !isMemberCreator && (
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Lead</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">{member.job_title || member.email}</p>
                                    </div>
                                    {canRemove && (
                                        <button
                                            onClick={() => onRemove(member.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                        >
                                            <UserMinus size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </>
    );
}

// --- Create Group Modal ---
interface CreateGroupModalProps {
    onClose: () => void;
    onCreate: (name: string, description: string, color: string, memberIds: string[]) => void;
}

function CreateGroupModal({ onClose, onCreate }: CreateGroupModalProps) {
    const [step, setStep] = useState<'details' | 'members'>('details');
    const [name, setName] = useState('');
    const [color, setColor] = useState('#6366f1');

    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6b7280'];

    const handleNext = () => {
        if (!name.trim()) {
            toast.error('Please enter a group name');
            return;
        }
        setStep('members');
    };

    if (step === 'members') {
        return (
            <MemberPicker
                isOpen={true}
                onClose={onClose}
                onSelect={() => { }}
                multiple={true}
                onSelectMultiple={(ids) => onCreate(name, '', color, ids)}
                title={`Add members to "${name}"`}
                hideGroupName={true}
            />
        );
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4"
            >
                <div className="bg-white w-full max-w-md rounded-2xl shadow-xl pointer-events-auto">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Create New Group</h3>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Product Innovation"
                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                            <div className="flex gap-2 flex-wrap">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={onClose} className="flex-1 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-50">
                                Cancel
                            </button>
                            <button
                                onClick={handleNext}
                                className="flex-1 py-2.5 bg-black text-white font-medium rounded-xl hover:bg-gray-800 flex items-center justify-center gap-2"
                            >
                                Add Members <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}

interface EditGroupModalProps {
    group: Project;
    onClose: () => void;
    onUpdate: (name: string, description: string, color: string) => void;
}

function EditGroupModal({ group, onClose, onUpdate }: EditGroupModalProps) {
    const [name, setName] = useState(group.name);
    const [color, setColor] = useState(group.color);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6b7280'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsSubmitting(true);
        await onUpdate(name, group.description || '', color);
        setIsSubmitting(false);
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4"
            >
                <div className="bg-white w-full max-w-md rounded-2xl shadow-xl pointer-events-auto">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Edit Group</h3>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                                placeholder="e.g. Marketing Team"
                                autoFocus
                            />
                        </div>



                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                            <div className="flex gap-2 flex-wrap">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-black scale-110' : 'hover:scale-105'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!name.trim() || isSubmitting}
                                className="flex-1 px-4 py-2.5 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </>
    );
}
