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
    Ban
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { useApiClient } from '@/hooks/useApiClient';

// --- Types ---
type ApiClient = ReturnType<typeof useApiClient>;

interface GroupMember {
    id: string;
    first_name?: string;
    last_name?: string;
    job_title?: string;
    email: string;
    avatar_url?: string;
    role: 'admin' | 'member';
    added_at: string;
}

interface IdeaGroup {
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
    members: GroupMember[];
    is_admin: boolean;
    has_unread?: boolean;
}

interface ReadReceipt {
    user_id: string;
    first_name?: string;
    last_name?: string;
    read_at: string;
}

interface GroupMessage {
    id: string;
    idea_group_id: string;
    sender_id: string;
    sender_name?: string;
    sender_avatar_url?: string;
    content: string;
    attachment_url?: string;
    attachment_type?: string;
    attachment_name?: string;
    created_at: string;
    read_by?: ReadReceipt[];
}

interface Collaborator {
    name: string;
    avatar_url?: string;
    quote: string;
    date?: string;
}

interface GroupItem {
    id: string;
    idea_group_id: string;
    note_id?: string;
    cluster_id?: string;
    added_by: string;
    added_at: string;
    item_type: 'note' | 'cluster';
    title?: string;
    summary?: string;
    note_count?: number;
    // Full review data
    category?: string;
    author_name?: string;
    author_avatar?: string;
    content_raw?: string;
    relevance_score?: number;
    created_date?: string;
    collaborators?: Collaborator[];
    status?: string;
}

// --- Helpers ---
function getInitials(member: GroupMember | null): string {
    if (!member) return '?';
    const first = member.first_name?.charAt(0) || '';
    const last = member.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
}

function getDisplayName(member: GroupMember | null): string {
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

    const [groups, setGroups] = useState<IdeaGroup[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialSelectedId);
    const [isLoading, setIsLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');



    const fetchGroups = useCallback(async () => {
        try {
            const data = await apiClient.get<IdeaGroup[]>('/idea-groups');
            setGroups(data);
            return data;
        } catch (error) {
            console.error('Error fetching groups:', error);
            toast.error('Could not load groups');
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [apiClient]);

    useEffect(() => {
        if (user) {
            fetchGroups().then((data) => {
                if (data.length > 0 && !initialSelectedId) {
                    setSelectedGroupId(data[0].id);
                }
            });

            // Poll every 30 seconds to update unread indicators
            const pollInterval = setInterval(() => {
                fetchGroups();
            }, 30000);

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
            apiClient.post(`/idea-groups/${selectedGroupId}/mark-read`, {}).catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroupId]);



    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
        );
    }

    return (
        <div className="h-full flex bg-white">
            {/* Sidebar - Groups List */}
            <div className="w-80 border-r border-gray-100 flex flex-col bg-white">
                {/* Header */}
                <div className="h-16 px-6 flex items-center justify-between border-b border-gray-100">
                    <h1 className="text-lg font-bold text-gray-900">Groups</h1>

                </div>

                {/* Search */}
                <div className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search groups..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border-0 rounded-lg text-sm focus:ring-2 focus:ring-black/5"
                        />
                    </div>
                </div>

                {/* Groups List */}
                <div className="flex-1 overflow-y-auto px-2">
                    {filteredGroups.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Users className="w-6 h-6 text-gray-300" />
                            </div>
                            <p className="text-sm text-gray-500">No groups yet</p>

                        </div>
                    ) : (
                        filteredGroups.map(group => (
                            <button
                                key={group.id}
                                onClick={() => setSelectedGroupId(group.id)}
                                className={`w-full p-3 rounded-xl mb-1 text-left transition-all ${selectedGroupId === group.id
                                    ? 'bg-gray-100'
                                    : 'hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: group.color + '20' }}
                                    >
                                        <Layers className="w-5 h-5" style={{ color: group.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1">
                                            <span className="font-medium text-gray-900 text-sm truncate">
                                                {group.name}
                                            </span>
                                            {group.is_admin && (
                                                <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">
                                            {group.member_count} members · {group.item_count} ideas
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {group.has_unread && (
                                            <div className="w-2 h-2 bg-gray-800 rounded-full" />
                                        )}
                                        <span className="text-xs text-gray-400">
                                            {formatDate(group.updated_at)}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {selectedGroup ? (
                    <GroupView
                        group={selectedGroup}
                        currentUser={user}
                        apiClient={apiClient}
                        onRefresh={fetchGroups}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Your Groups</h3>
                            <p className="text-sm text-gray-500 mt-1">Select a group to view discussions</p>
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
}

// --- Group View Component ---
interface GroupViewProps {
    group: IdeaGroup;
    currentUser: any;
    apiClient: ApiClient;
    onRefresh: () => Promise<any>;
}

function GroupView({ group, currentUser, apiClient, onRefresh }: GroupViewProps) {
    const [messages, setMessages] = useState<GroupMessage[]>([]);
    const [items, setItems] = useState<GroupItem[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [isLoadingItems, setIsLoadingItems] = useState(true);
    const [showMenu, setShowMenu] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'idea'>('chat');
    const [ideaViewMode, setIdeaViewMode] = useState<'summary' | 'evolution'>('summary');
    const [timelineProgress, setTimelineProgress] = useState(100);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedReviewNode, setSelectedReviewNode] = useState<any>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const handleUpdateGroup = async (name: string, description: string, color: string) => {
        try {
            await apiClient.put(`/idea-groups/${group.id}`, { name, description, color });
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

    // Fetch messages with polling for reactivity
    useEffect(() => {
        async function fetchMessages() {
            try {
                const data = await apiClient.get<GroupMessage[]>(`/idea-groups/${group.id}/messages`);
                setMessages(data);
            } catch (error) {
                console.error('Error loading messages:', error);
            } finally {
                setIsLoadingMessages(false);
            }
        }

        // Initial fetch
        setIsLoadingMessages(true);
        fetchMessages();

        // Poll every 15 seconds for new messages (more reasonable interval)
        const pollInterval = setInterval(fetchMessages, 15000);

        return () => clearInterval(pollInterval);
    }, [group.id, apiClient]);

    // Fetch items
    useEffect(() => {
        async function fetchItems() {
            setIsLoadingItems(true);
            try {
                const data = await apiClient.get<GroupItem[]>(`/idea-groups/${group.id}/items`);
                setItems(data);
                // Auto-select first item if available and none selected
                if (data.length > 0) {
                    setSelectedItemId(data[0].id);
                }
            } catch (error) {
                console.error('Error loading items:', error);
            } finally {
                setIsLoadingItems(false);
            }
        }
        fetchItems();
    }, [group.id, apiClient]);

    const handleRemoveItem = async () => {
        if (!currentItem) return;
        if (!confirm('Are you sure you want to remove this idea from the group?')) return;

        try {
            await apiClient.delete(`/idea-groups/${group.id}/items/${currentItem.id}`);
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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

    const handleSendMessage = async (content: string) => {
        if (!content.trim()) return;
        try {
            const newMsg = await apiClient.post<GroupMessage>(`/idea-groups/${group.id}/messages`, { content });
            setMessages(prev => [...prev, newMsg]);
        } catch (error) {
            toast.error('Failed to send message');
        }
    };

    const handleAddMember = async (userId: string) => {
        try {
            await apiClient.post(`/idea-groups/${group.id}/members`, { user_id: userId });
            toast.success('Member added');
            onRefresh();
        } catch (error: any) {
            toast.error(error.message || 'Failed to add member');
        }
    };

    const handleRemoveMember = async (userId: string) => {
        try {
            await apiClient.delete(`/idea-groups/${group.id}/members/${userId}`);
            toast.success('Member removed');
            onRefresh();
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove member');
        }
    };

    const handleLeaveGroup = async () => {
        try {
            await apiClient.post(`/idea-groups/${group.id}/leave`, {});
            toast.success('Left the group');
            onRefresh();
        } catch (error: any) {
            toast.error(error.message || 'Failed to leave group');
        }
    };

    const handleDeleteGroup = async () => {
        if (!confirm('Are you sure you want to delete this group?')) return;
        try {
            await apiClient.delete(`/idea-groups/${group.id}`);
            toast.success('Group deleted');
            onRefresh();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete group');
        }
    };

    return (
        <>
            {/* Header with centered Chat/Idea toggle */}
            <div className="h-16 px-6 bg-white border-b border-gray-200 flex items-center shadow-sm">
                {/* Left: Group info */}
                <div className="flex items-center space-x-3 flex-1">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: group.color + '20' }}
                    >
                        <Layers className="w-5 h-5" style={{ color: group.color }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1">
                            {group.name}
                            {group.is_admin && <Crown className="w-3 h-3 text-amber-500" />}
                        </h3>
                        <p className="text-xs text-gray-500">{group.member_count} members</p>
                    </div>
                </div>

                {/* Center: Chat/Idea toggle */}
                <div className="flex-1 flex justify-center">
                    <div className="bg-gray-100 p-1 rounded-xl flex">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'chat'
                                ? 'bg-white text-black shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <MessageCircle size={16} /> Chat
                        </button>
                        <button
                            onClick={() => setActiveTab('idea')}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'idea'
                                ? 'bg-white text-black shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Lightbulb size={16} /> Idea
                        </button>
                    </div>
                </div>

                {/* Right: Menu */}
                <div className="flex-1 flex justify-end">
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-full"
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
                                            <Edit3 size={16} /> Rename Group
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { setShowMembersModal(true); setShowMenu(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        <Eye size={16} /> View Members
                                    </button>
                                    {group.is_admin && (
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
                                            <LogOut size={16} /> Leave Group
                                        </button>
                                    )}
                                    {group.is_admin && (
                                        <button
                                            onClick={() => { handleDeleteGroup(); setShowMenu(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 size={16} /> Delete Group
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'chat' ? (
                <>
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                        {isLoadingMessages ? (
                            <div className="flex justify-center pt-10">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
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
                                const isMe = msg.sender_id === currentUser?.id;
                                return (
                                    <div key={msg.id} className={`flex mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] ${isMe ? 'order-2' : ''}`}>
                                            {!isMe && (
                                                <p className="text-xs text-gray-500 mb-1 ml-1">
                                                    {msg.sender_name || 'Unknown'}
                                                </p>
                                            )}
                                            <div className={`px-4 py-2.5 rounded-2xl ${isMe
                                                ? 'bg-black text-white rounded-br-md'
                                                : 'bg-white text-gray-900 border border-gray-100 rounded-bl-md shadow-sm'
                                                }`}>
                                                <p className="text-sm">{msg.content}</p>
                                            </div>
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
            ) : (
                /* Idea Tab */
                <div className="flex-1 flex overflow-hidden bg-gray-50/50">
                    {items.length > 1 && !isLoadingItems && (
                        <div className="w-72 border-r border-gray-200 bg-white flex flex-col shrink-0">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Layers size={12} /> Linked Ideas ({items.length})
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {items.map(item => {
                                    const isSelected = currentItem?.id === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedItemId(item.id)}
                                            className={`w-full text-left p-3 rounded-xl border transition-all relative group ${isSelected
                                                ? 'bg-white border-gray-300 shadow-sm ring-1 ring-gray-200'
                                                : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'
                                                }`}
                                        >
                                            {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-black rounded-r-full" />}
                                            <div className="flex items-center gap-2 mb-1 pl-2">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getColorForCategory(item.category)}`}>
                                                    {item.category?.toUpperCase() || (item.item_type === 'cluster' ? 'CLUSTER' : 'UNCATEGORIZED')}
                                                </span>
                                                <span className="text-[10px] text-gray-400 truncate flex-1">{formatDate(item.created_date || item.added_at || new Date().toISOString())}</span>
                                            </div>
                                            <p className={`text-sm font-semibold pl-2 line-clamp-2 ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {item.title || 'Untitled Idea'}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-6 relative">
                        {isLoadingItems ? (
                            <div className="flex justify-center pt-10">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                            </div>
                        ) : !currentItem ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                                    <Lightbulb className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="text-gray-500 text-sm">No idea linked yet</p>
                                <p className="text-gray-400 text-xs mt-1">Share an idea from Review to this group</p>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* Header with View Toggle */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            {currentItem.category && (
                                                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tracking-wider uppercase">
                                                    {currentItem.category}
                                                </span>
                                            )}
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${currentItem.status ? getStatusStyle(currentItem.status) : (
                                                currentItem.item_type === 'cluster' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                            )
                                                }`}>
                                                {currentItem.status ? getStatusLabel(currentItem.status, currentItem.item_type) : (
                                                    currentItem.note_count && currentItem.note_count > 1 ? `${currentItem.note_count} Contributors` : 'Note'
                                                )}
                                            </span>
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-900">
                                            {currentItem.title || 'Untitled Idea'}
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="bg-gray-100 p-1 rounded-lg flex">
                                            <button
                                                onClick={() => setIdeaViewMode('summary')}
                                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${ideaViewMode === 'summary'
                                                    ? 'bg-white text-black shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                <FileText size={14} /> Summary
                                            </button>
                                            <button
                                                onClick={() => setIdeaViewMode('evolution')}
                                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${ideaViewMode === 'evolution'
                                                    ? 'bg-white text-black shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                <GitCommit size={14} /> Evolution
                                            </button>
                                        </div>
                                        {isCreator && (
                                            <button
                                                onClick={handleRemoveItem}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remove idea from group"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {ideaViewMode === 'summary' ? (
                                    /* Summary View */
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            <FileText size={14} /> Summary
                                        </div>
                                        <p className="text-gray-800 leading-relaxed text-base">
                                            {currentItem.summary || 'No summary available.'}
                                        </p>
                                        {currentItem.note_count && currentItem.note_count > 1 && (
                                            <div className="mt-6 pt-4 border-t border-gray-100">
                                                <div className="flex items-center gap-2 text-sm text-purple-600 font-medium">
                                                    <Users size={16} />
                                                    {currentItem.note_count} notes merged in this cluster
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Evolution View - Same as Review */
                                    <div className="space-y-6">
                                        <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200 h-[500px] relative overflow-hidden shadow-inner">
                                            {/* Background pattern */}
                                            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94A3B8 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

                                            {/* SVG Arrows */}
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                                                <defs>
                                                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="20" refY="3.5" orient="auto">
                                                        <polygon points="0 0, 10 3.5, 0 7" fill="#94A3B8" />
                                                    </marker>
                                                </defs>
                                                {(currentItem.collaborators || []).slice(0, 4).map((_, i) => {
                                                    const positions = [
                                                        { x: 18, y: 25 },
                                                        { x: 82, y: 25 },
                                                        { x: 18, y: 75 },
                                                        { x: 82, y: 75 }
                                                    ];
                                                    const pos = positions[i];
                                                    const visibleProgress = (timelineProgress / 100) * (currentItem.collaborators?.length || 1);
                                                    if (i >= visibleProgress) return null;
                                                    return (
                                                        <path
                                                            key={i}
                                                            d={`M${pos.x}%,${pos.y}% Q50%,${pos.y > 50 ? '60%' : '40%'} 50%,50%`}
                                                            fill="none"
                                                            stroke="#CBD5E1"
                                                            strokeWidth="2"
                                                            strokeDasharray="5,5"
                                                            markerEnd="url(#arrowhead)"
                                                            className="animate-in fade-in duration-700"
                                                        />
                                                    );
                                                })}
                                            </svg>

                                            {/* Central Node - Global Concept */}
                                            <div
                                                className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center transition-all duration-500"
                                                style={{ scale: timelineProgress > 10 ? '1' : '0.5', opacity: timelineProgress > 5 ? 1 : 0 }}
                                            >
                                                <div className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center shadow-2xl ring-8 ring-white">
                                                    <Orbit size={32} className="animate-pulse" />
                                                </div>
                                                <div className="mt-3 bg-white px-3 py-1.5 rounded-lg shadow-sm text-center border border-gray-200">
                                                    <h3 className="font-bold text-sm text-gray-900">Global Concept</h3>
                                                </div>
                                            </div>

                                            {/* Contributor Nodes */}
                                            {(currentItem.collaborators || []).slice(0, 4).map((collab, i) => {
                                                const positions = [
                                                    { x: 18, y: 25 },
                                                    { x: 82, y: 25 },
                                                    { x: 18, y: 75 },
                                                    { x: 82, y: 75 }
                                                ];
                                                const colors = ['bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-purple-100 text-purple-600', 'bg-orange-100 text-orange-600'];
                                                const pos = positions[i];
                                                const color = colors[i % colors.length];
                                                const visibleProgress = (timelineProgress / 100) * (currentItem.collaborators?.length || 1);
                                                if (i >= visibleProgress) return null;

                                                return (
                                                    <div
                                                        key={i}
                                                        onClick={() => setSelectedReviewNode(collab)}
                                                        className="absolute z-10 flex flex-col items-center group cursor-pointer hover:scale-105 transition-all duration-300"
                                                        style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                                                    >
                                                        <div className="bg-white p-3 rounded-xl shadow-md border border-gray-100 w-48 mb-2 relative animate-in slide-in-from-bottom-2 duration-500">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                                    {collab.date ? formatDate(collab.date) : 'Unknown'}
                                                                </span>
                                                                <div className={`w-2 h-2 rounded-full ${color.split(' ')[0]}`} />
                                                            </div>
                                                            <p className="text-xs font-medium text-gray-800 italic line-clamp-3">"{collab.quote}"</p>
                                                        </div>
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border-2 border-white overflow-hidden ${collab.avatar_url ? 'bg-white' : color}`}>
                                                            {collab.avatar_url ? (
                                                                <img src={collab.avatar_url} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                collab.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>



                                        {/* Timeline Controls - Same as Review */}
                                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-6 shadow-sm">
                                            <button
                                                onClick={() => setIsPlaying(!isPlaying)}
                                                className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0"
                                            >
                                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                                            </button>
                                            <div className="flex-1">
                                                <div className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2">
                                                    <span>Project Kickoff</span>
                                                    <span>Consolidation</span>
                                                </div>
                                                <div
                                                    className="h-2 w-full bg-gray-100 rounded-full overflow-hidden cursor-pointer"
                                                    onClick={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const x = e.clientX - rect.left;
                                                        setTimelineProgress((x / rect.width) * 100);
                                                    }}
                                                >
                                                    <div className="h-full bg-black rounded-full transition-all duration-100 ease-linear relative" style={{ width: `${timelineProgress}%` }}>
                                                        <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-black rounded-full shadow-sm" />
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setTimelineProgress(0); setIsPlaying(true); }}
                                                className="p-2 text-gray-400 hover:text-black transition-colors"
                                            >
                                                <RefreshCw size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* DETAIL PANEL (EVOLUTION) - Slide-over Sidebar */}
                                <div className={`fixed top-0 right-0 bottom-0 w-[400px] bg-white border-l border-gray-200 shadow-2xl z-50 transition-transform duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] flex flex-col ${selectedReviewNode ? 'translate-x-0' : 'translate-x-full'}`}>
                                    {selectedReviewNode && (
                                        <>
                                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                                                <h3 className="font-bold text-lg text-gray-900">Contribution Details</h3>
                                                <button onClick={() => setSelectedReviewNode(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                                    <X size={20} />
                                                </button>
                                            </div>
                                            <div className="p-6 flex-1 overflow-y-auto space-y-8">
                                                {/* User Profile */}
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg overflow-hidden shadow-sm border border-gray-100 bg-white">
                                                        {selectedReviewNode.avatar_url ? (
                                                            <img src={selectedReviewNode.avatar_url} alt={selectedReviewNode.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500">
                                                                {selectedReviewNode.name?.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-gray-900 leading-tight">{selectedReviewNode.name}</h4>
                                                        <p className="text-sm text-gray-500 font-medium">Contributor</p>
                                                    </div>
                                                </div>

                                                {/* Idea Content */}
                                                <div>
                                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                                                        Original Contribution
                                                    </label>
                                                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-gray-800 text-base leading-relaxed font-medium relative group hover:bg-gray-100 transition-colors">
                                                        <Quote size={16} className="text-gray-300 absolute top-4 right-4 opacity-50" />
                                                        {selectedReviewNode.quote}
                                                    </div>
                                                </div>

                                                {/* Metadata Grid */}
                                                <div className="grid grid-cols-1 gap-3">
                                                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                                                            <Calendar size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Submitted</div>
                                                            <div className="text-sm font-semibold text-gray-900">
                                                                {selectedReviewNode.date ? formatDate(selectedReviewNode.date) : 'Unknown date'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                                                        <div className="p-2 bg-green-50 text-green-600 rounded-lg shrink-0">
                                                            <CheckCircle2 size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</div>
                                                            <div className="text-sm font-semibold text-gray-900">Merged to Cluster</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>


                                        </>
                                    )}
                                </div>
                            </div>
                        )}
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
                        members={group.members}
                        isAdmin={group.is_admin}
                        creatorId={group.created_by}
                        currentUserId={currentUser?.id}
                        onRemove={handleRemoveMember}
                        onClose={() => setShowMembersModal(false)}
                    />
                )}
            </AnimatePresence>

            {/* Add Member Modal */}
            {showAddMemberModal && (
                <MemberPicker
                    isOpen={true}
                    onClose={() => setShowAddMemberModal(false)}
                    onSelect={(memberId) => {
                        handleAddMember(memberId);
                        setShowAddMemberModal(false);
                    }}
                    excludeIds={group.members.map(m => m.id)}
                    title="Add member to group"
                />
            )}
        </>
    );
}

// --- Message Input ---
interface MessageInputProps {
    onSend: (content: string) => void;
}

function MessageInput({ onSend }: MessageInputProps) {
    const [message, setMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            onSend(message);
            setMessage('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200">
            <div className="flex items-center gap-3">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write a message..."
                    className="flex-1 px-4 py-3 bg-gray-50 border-0 rounded-full text-sm focus:ring-2 focus:ring-black focus:bg-white transition-all"
                />
                <button
                    type="submit"
                    disabled={!message.trim()}
                    className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={18} />
                </button>
            </div>
        </form>
    );
}

// --- Members Modal ---
interface MembersModalProps {
    members: GroupMember[];
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
                                            {member.role === 'admin' && !isMemberCreator && (
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Admin</span>
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
    group: IdeaGroup;
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
