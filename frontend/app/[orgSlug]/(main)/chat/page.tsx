'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@/contexts/UserContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    Send,
    User as UserIcon,
    MoreVertical,
    Search,
    Loader2,
    Plus,
    Users,
    UserPlus,
    Edit3,
    LogOut,
    Eye,
    X,
    Paperclip,
    Download,
    Trash2,
    Maximize2,
    FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { useApiClient } from '@/hooks/useApiClient';
import { SharedPostCard, SharedNoteCard } from '@/components/feed/share';

// --- Types ---

interface Participant {
    id: string;
    first_name: string | null;
    last_name: string | null;
    job_title: string | null;
    email: string | null;
    avatar_url?: string | null;
}

interface Conversation {
    id: string;
    updated_at: string;
    other_participant: Participant | null;
    participants?: Participant[];
    title?: string;
    is_group: boolean;
    last_message?: string;
    has_unread?: boolean;
}

interface ReadReceipt {
    user_id: string;
    first_name?: string;
    last_name?: string;
    read_at: string;
}

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    is_read: boolean;
    created_at: string;
    shared_post_id?: string;
    shared_post?: any;
    shared_note_id?: string;
    shared_note?: any;
    attachment_url?: string;
    attachment_type?: string;
    attachment_name?: string;
    read_by?: ReadReceipt[];
}

// Avatar colors
const avatarColors = [
    'bg-emerald-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
];

function getAvatarColor(id: string): string {
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length;
    return avatarColors[index];
}

function getInitials(participant: Participant | null): string {
    if (!participant) return '?';
    const first = participant.first_name?.[0] || participant.email?.[0] || '';
    const last = participant.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
}

function getDisplayName(participant: Participant | null): string {
    if (!participant) return 'Unknown';
    if (participant.first_name) {
        return `${participant.first_name} ${participant.last_name || ''}`.trim();
    }
    return participant.email || 'Unknown';
}

function getGroupMemberNames(participants: Participant[] | undefined): string {
    if (!participants || participants.length === 0) return 'Group';
    return participants.map(p => p.first_name || p.email?.split('@')[0] || 'User').join(', ');
}

// --- Components ---

export default function ChatPage() {
    const { user } = useUser();
    const { organization } = useOrganization();
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
    const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);

    // Fetch conversations
    const fetchConversations = async () => {
        try {
            const data = await apiClient.get<Conversation[]>('/chat');

            // Sort by updated_at DESC (most recent first)
            const sorted = [...data].sort((a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );

            setConversations(sorted);

            // Cache for instant load next time
            if (user && organization) {
                localStorage.setItem(`cached_conversations_${organization.id}_${user.id}`, JSON.stringify(sorted));
            }

            return sorted;
        } catch (error) {
            console.error(error);
            toast.error('Could not load conversations');
            return [];
        } finally {
            setIsLoadingConversations(false);
        }
    };

    // Load from cache immediately on mount
    useEffect(() => {
        if (user && organization) {
            const cached = localStorage.getItem(`cached_conversations_${organization.id}_${user.id}`);
            if (cached) {
                try {
                    setConversations(JSON.parse(cached));
                    setIsLoadingConversations(false);
                } catch (e) {
                    console.error('Error parsing cached conversations', e);
                }
            }
        }
    }, [user, organization]);

    useEffect(() => {
        if (user) {
            fetchConversations().then((data) => {
                // Try to recover last active conversation from storage
                const lastActiveId = localStorage.getItem(`last_conversation_${organization?.id}_${user.id}`);
                const targetConv = data.find(c => c.id === lastActiveId);

                if (targetConv) {
                    setSelectedConversationId(targetConv.id);
                } else if (data.length > 0 && !selectedConversationId) {
                    // Fallback to most recent (first element as backend sorts by updated_at)
                    setSelectedConversationId(data[0].id);
                }
            });
        }
    }, [user, organization?.id]);

    // Persist selection
    useEffect(() => {
        if (selectedConversationId && user && organization) {
            localStorage.setItem(`last_conversation_${organization.id}_${user.id}`, selectedConversationId);
        }
    }, [selectedConversationId, user, organization]);

    const handleStartConversation = async (targetUserId: string) => {
        setIsMemberPickerOpen(false);
        try {
            const conversationId = await apiClient.post<string>('/chat/start', { target_user_id: targetUserId });

            // Refresh list to show new conversation
            const updatedConversations = await fetchConversations();

            // Select the new conversation
            setSelectedConversationId(conversationId);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Could not start conversation');
        }
    };

    const handleCreateGroup = async (memberIds: string[], title: string) => {
        setIsGroupPickerOpen(false);
        try {
            const conversationId = await apiClient.post<string>('/chat/group', {
                title,
                participant_ids: memberIds
            });

            // Refresh list to show new conversation
            await fetchConversations();

            // Select the new conversation
            setSelectedConversationId(conversationId);
            toast.success('Group created');

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Could not create group');
        }
    };

    // Mark conversation as read (update local state immediately)
    // Mark conversation as read (update local state immediately)
    const markAsRead = (conversationId: string) => {
        // Update local conversations state
        setConversations(prev => {
            const updated = prev.map(conv =>
                conv.id === conversationId
                    ? { ...conv, has_unread: false }
                    : conv
            );

            // Check if any *other* conversation has unread messages
            const hasAnyUnread = updated.some(c => c.has_unread);

            // Optimistically update the sidebar query data
            if (user?.id) {
                // We optimistically set it to what we think it is based on visible conversations.
                // If there are invisible unread conversations, the invalidation below will fix it shortly.
                queryClient.setQueryData(['chatUnreadStatus', user.id], { has_unread: hasAnyUnread });
            }

            return updated;
        });

        // Always invalidate to ensure truth from server
        queryClient.invalidateQueries({ queryKey: ['chatUnreadStatus'] });
    };

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <MemberPicker
                isOpen={isMemberPickerOpen}
                onClose={() => setIsMemberPickerOpen(false)}
                onSelect={handleStartConversation}
            />

            <MemberPicker
                isOpen={isGroupPickerOpen}
                onClose={() => setIsGroupPickerOpen(false)}
                onSelect={() => { }}
                multiple={true}
                onSelectMultiple={handleCreateGroup}
            />

            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-20">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">Messages</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsGroupPickerOpen(true)}
                            className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors shadow-sm"
                            title="New Group"
                        >
                            <Users className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsMemberPickerOpen(true)}
                            className="p-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors shadow-sm"
                            title="New Message"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Search (Visual only for now) */}
                <div className="px-4 py-3 border-b border-gray-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Filter conversations..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border-transparent rounded-lg text-sm focus:bg-white focus:border-gray-200 focus:ring-0 transition-all"
                        />
                    </div>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoadingConversations ? (
                        <div className="animate-pulse">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="px-5 py-3 flex items-center gap-3 border-b border-gray-50/50">
                                    <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0"></div>
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <div className="h-3.5 bg-gray-200 rounded w-24"></div>
                                            <div className="h-3 bg-gray-100 rounded w-10"></div>
                                        </div>
                                        <div className="h-3 bg-gray-100 rounded w-48"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                <MessageSquare className="w-6 h-6 text-gray-300" />
                            </div>
                            <p className="text-sm font-medium text-gray-900">No messages yet</p>
                            <p className="text-xs text-gray-500 mt-1">Start a conversation with your team.</p>
                            <button
                                onClick={() => setIsMemberPickerOpen(true)}
                                className="mt-4 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                            >
                                Start a chat
                            </button>
                        </div>
                    ) : (
                        conversations.map((conv) => {
                            const avatarColor = conv.other_participant ? getAvatarColor(conv.other_participant.id) : 'bg-gray-400';
                            const initials = getInitials(conv.other_participant);
                            const displayName = conv.is_group ? conv.title : getDisplayName(conv.other_participant);
                            const isSelected = selectedConversationId === conv.id;
                            const groupMembers = conv.participants || [];
                            const memberNames = conv.is_group ? getGroupMemberNames(conv.participants) : '';

                            return (
                                <div
                                    key={conv.id}
                                    onClick={() => setSelectedConversationId(conv.id)}
                                    className={`px-5 py-3 cursor-pointer transition-all flex items-center gap-3 ${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    {/* Avatar */}
                                    {conv.is_group && groupMembers.length >= 2 ? (
                                        // Stacked avatars for groups
                                        <div className="relative w-10 h-10 shrink-0">
                                            {/* First avatar (bottom-right) */}
                                            <div className={`absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-xs border-2 border-white ${getAvatarColor(groupMembers[1].id)}`}>
                                                {groupMembers[1].avatar_url ? (
                                                    <img
                                                        src={groupMembers[1].avatar_url}
                                                        alt=""
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                ) : (
                                                    getInitials(groupMembers[1])
                                                )}
                                            </div>
                                            {/* Second avatar (top-left) */}
                                            <div className={`absolute top-0 left-0 w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-xs border-2 border-white ${getAvatarColor(groupMembers[0].id)}`}>
                                                {groupMembers[0].avatar_url ? (
                                                    <img
                                                        src={groupMembers[0].avatar_url}
                                                        alt=""
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                ) : (
                                                    getInitials(groupMembers[0])
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        // Single avatar
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${avatarColor}`}>
                                            {conv.other_participant?.avatar_url ? (
                                                <img
                                                    src={conv.other_participant.avatar_url}
                                                    alt={displayName || 'User'}
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                initials
                                            )}
                                        </div>
                                    )}

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-gray-900 truncate">
                                                {displayName}
                                            </p>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                {conv.has_unread && (
                                                    <div className="w-2 h-2 bg-gray-800 rounded-full" />
                                                )}
                                                <span className="text-[11px] text-gray-400">
                                                    {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                            {conv.last_message || (conv.is_group ? `${(conv.participants?.length || 0) + 1} members` : conv.other_participant?.job_title || 'Start chatting')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-gray-50 relative z-10">
                {selectedConversation ? (
                    <ChatWindow
                        conversation={selectedConversation}
                        currentUser={user}
                        apiClient={apiClient}
                        onRefresh={fetchConversations}
                        onMarkAsRead={markAsRead}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
                            <MessageSquare className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">Your Messages</h3>
                        <p className="text-sm text-gray-500 mt-2">Select a conversation to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ChatWindow({ conversation, currentUser, apiClient, onRefresh, onMarkAsRead }: { conversation: Conversation; currentUser: any; apiClient: any; onRefresh: () => Promise<any>; onMarkAsRead?: (id: string) => void }) {
    const { organization } = useOrganization();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState(conversation.title || '');

    // Lightbox state for viewing images
    const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // Download function that works with cross-origin URLs
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

    // Add member states
    const [availableMembers, setAvailableMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');

    // Fetch available members when Add Member modal opens
    useEffect(() => {
        if (showAddMemberModal && organization?.slug) {
            fetchAvailableMembers();
        }
    }, [showAddMemberModal, organization?.slug]);

    const fetchAvailableMembers = async () => {
        setLoadingMembers(true);
        try {
            const res = await fetch(`/api/v1/organizations/${organization!.slug}/members`);
            if (res.ok) {
                const allMembers = await res.json();
                // Filter out members already in the group AND the current user
                const currentMemberIds = new Set(conversation.participants?.map(p => p.id) || []);
                currentMemberIds.add(currentUser.id); // Exclude self
                const filtered = allMembers.filter((m: any) => !currentMemberIds.has(m.id));
                setAvailableMembers(filtered);
            }
        } catch (error) {
            console.error('Failed to fetch members', error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const filteredAvailableMembers = availableMembers.filter(m =>
        m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email?.toLowerCase().includes(memberSearch.toLowerCase())
    );

    // Fetch messages with instant transition (Twitter-style)
    const [previousConversationId, setPreviousConversationId] = useState<string | null>(null);

    useEffect(() => {
        let isCancelled = false;

        // Cache Key
        const cacheKey = `cached_messages_chat_${conversation.id}`;

        // If switching conversations
        const isNewConversation = previousConversationId !== conversation.id;

        async function fetchMessages() {
            // Force loading state on switch to show Skeleton immediately
            // Only set state if not cancelled
            if (!isCancelled && (messages.length === 0 || isNewConversation)) {

                // TRY LOAD FROM CACHE FIRST (Instant Display)
                const cached = localStorage.getItem(cacheKey);
                let loadedFromCache = false;

                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                            setMessages(parsed);
                            setIsLoading(false); // No skeleton needed
                            loadedFromCache = true;
                        }
                    } catch (e) {
                        console.error("Cache parse error", e);
                    }
                }

                // Only show skeleton if NO cache
                if (!loadedFromCache) {
                    setIsLoading(true);
                    if (isNewConversation) {
                        setMessages([]); // Clear old messages immediately for distinct switch
                    }
                }
            }

            try {
                const data = await apiClient.get(`/chat/${conversation.id}/messages`) as Message[];

                // CRITICAL: Only update state if this effect is still active
                if (!isCancelled) {
                    // Sort by created_at ascending for display
                    const sorted = data.sort((a: Message, b: Message) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                    setMessages(sorted);
                    setPreviousConversationId(conversation.id);

                    // Update cache
                    localStorage.setItem(cacheKey, JSON.stringify(sorted));
                }

                // Mark conversation as read (fire and forget)
                if (!isCancelled) {
                    const lastMessage = data.length > 0 ? data[data.length - 1] : null;
                    const payload = lastMessage ? { last_message_created_at: lastMessage.created_at } : {};

                    apiClient.post(`/chat/${conversation.id}/read`, payload).then(() => {
                        if (onMarkAsRead) {
                            onMarkAsRead(conversation.id);
                        }
                    }).catch(() => { });
                }

            } catch (error) {
                if (!isCancelled) {
                    console.error(error);
                    // Only show error for new conversations if loading
                    if (isNewConversation) {
                        // Don't toast if we showed cache
                        // toast.error('Failed to load messages'); 
                    }
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        }

        fetchMessages();

        return () => {
            isCancelled = true;
        };
    }, [conversation.id]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (content: string, attachments?: { url: string; type: string; name: string }[]) => {
        // If we have attachments, send one message per attachment
        // First message gets the text content, others are attachment-only
        if (attachments && attachments.length > 0) {
            for (let i = 0; i < attachments.length; i++) {
                const attachment = attachments[i];
                const messageContent = i === 0 ? content : ''; // Only first message has text

                const tempId = Math.random().toString();
                const newMessage: Message = {
                    id: tempId,
                    conversation_id: conversation.id,
                    sender_id: currentUser.id,
                    content: messageContent,
                    is_read: false,
                    created_at: new Date().toISOString(),
                    attachment_url: attachment.url,
                    attachment_type: attachment.type,
                    attachment_name: attachment.name
                };
                setMessages(prev => [...prev, newMessage]);

                try {
                    const savedMessage = await apiClient.post(`/chat/${conversation.id}/messages`, {
                        content: messageContent,
                        attachment_url: attachment.url,
                        attachment_type: attachment.type,
                        attachment_name: attachment.name
                    });
                    setMessages(prev => prev.map(m => m.id === tempId ? savedMessage : m));
                } catch (error) {
                    console.error(error);
                    toast.error('Failed to send attachment');
                    setMessages(prev => prev.filter(m => m.id !== tempId));
                }
            }
        } else if (content.trim()) {
            // Text-only message
            const tempId = Math.random().toString();
            const newMessage: Message = {
                id: tempId,
                conversation_id: conversation.id,
                sender_id: currentUser.id,
                content: content,
                is_read: false,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, newMessage]);

            try {
                const savedMessage = await apiClient.post(`/chat/${conversation.id}/messages`, { content });
                setMessages(prev => prev.map(m => m.id === tempId ? savedMessage : m));
            } catch (error) {
                console.error(error);
                toast.error('Failed to send message');
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        }
    };

    return (
        <>
            {/* Chat Header */}
            <div className="h-16 px-6 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center space-x-3">
                    {/* Avatar Header */}
                    {conversation.is_group && conversation.participants && conversation.participants.length >= 2 ? (
                        // Stacked avatars for groups
                        <div className="relative w-9 h-9 shrink-0">
                            <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold text-xs border-2 border-white ${getAvatarColor(conversation.participants[1].id)}`}>
                                {conversation.participants[1].avatar_url ? (
                                    <img
                                        src={conversation.participants[1].avatar_url}
                                        alt=""
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : (
                                    getInitials(conversation.participants[1])
                                )}
                            </div>
                            <div className={`absolute top-0 left-0 w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold text-xs border-2 border-white ${getAvatarColor(conversation.participants[0].id)}`}>
                                {conversation.participants[0].avatar_url ? (
                                    <img
                                        src={conversation.participants[0].avatar_url}
                                        alt=""
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : (
                                    getInitials(conversation.participants[0])
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold border border-gray-200 overflow-hidden ${conversation.is_group ? 'bg-indigo-50 text-indigo-600' : getAvatarColor(conversation.other_participant?.id || 'id')}`}>
                            {conversation.is_group ? (
                                <Users size={18} />
                            ) : conversation.other_participant?.avatar_url ? (
                                <img
                                    src={conversation.other_participant.avatar_url}
                                    alt={conversation.other_participant.first_name || 'User'}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                getInitials(conversation.other_participant)
                            )}
                        </div>
                    )}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">
                            {conversation.is_group
                                ? conversation.title
                                : getDisplayName(conversation.other_participant)
                            }
                        </h3>
                        {!conversation.is_group && (
                            <p className="text-xs text-gray-500">
                                {conversation.other_participant?.job_title || 'Member'}
                            </p>
                        )}
                    </div>
                </div>

                {/* Menu Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-full transition-colors"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowMenu(false)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                                {/* View Members - Only for groups */}
                                {conversation.is_group && (
                                    <button
                                        onClick={() => { setShowMembersModal(true); setShowMenu(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <Eye size={16} />
                                        View Members
                                    </button>
                                )}

                                {/* Add Member - Only for groups */}
                                {conversation.is_group && (
                                    <button
                                        onClick={() => { setShowAddMemberModal(true); setShowMenu(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <UserPlus size={16} />
                                        Add Member
                                    </button>
                                )}

                                {/* Rename Group - Only for groups */}
                                {conversation.is_group && (
                                    <button
                                        onClick={() => { setShowRenameModal(true); setShowMenu(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <Edit3 size={16} />
                                        Rename Group
                                    </button>
                                )}

                                {/* Leave - Only for groups */}
                                {conversation.is_group && (
                                    <button
                                        onClick={async () => {
                                            setShowMenu(false);
                                            if (confirm('Leave this group? You will no longer receive messages.')) {
                                                try {
                                                    await apiClient.delete(`/chat/${conversation.id}`);
                                                    toast.success('You left the group');
                                                    await onRefresh();
                                                } catch (error: any) {
                                                    toast.error(error?.response?.data?.detail || 'Failed to leave group');
                                                }
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut size={16} />
                                        Leave Group
                                    </button>
                                )}

                                {/* Delete Conversation - Only for 1-1 */}
                                {!conversation.is_group && (
                                    <button
                                        onClick={async () => {
                                            setShowMenu(false);
                                            if (confirm('Delete this conversation? You can start a new one anytime.')) {
                                                try {
                                                    await apiClient.delete(`/chat/${conversation.id}`);
                                                    toast.success('Conversation deleted');
                                                    await onRefresh();
                                                } catch (error: any) {
                                                    toast.error(error?.response?.data?.detail || 'Failed to delete conversation');
                                                }
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                        Delete Conversation
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                {isLoading && messages.length === 0 ? (
                    /* Skeleton Messages - Twitter-style instant feel */
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
                        {/* Skeleton: Sent message */}
                        <div className="flex justify-end">
                            <div className="max-w-[70%]">
                                <div className="px-4 py-3 bg-gray-300 rounded-2xl rounded-br-md">
                                    <div className="h-4 w-56 bg-gray-400 rounded"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.sender_id === currentUser.id;
                        const hasSharedPost = !!msg.shared_post;
                        const hasTextContent = !!msg.content;

                        // Check if next message is from same sender and same minute
                        const nextMsg = messages[index + 1];
                        const prevMsg = messages[index - 1];
                        const msgTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const nextMsgTime = nextMsg ? new Date(nextMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
                        const prevMsgTime = prevMsg ? new Date(prevMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

                        const showTimestamp = !nextMsg || nextMsg.sender_id !== msg.sender_id || msgTime !== nextMsgTime;
                        const isGroupedWithPrev = prevMsg && prevMsg.sender_id === msg.sender_id && msgTime === prevMsgTime;

                        // Read receipt logic
                        let readReceiptText = null;
                        if (isMe && msg.read_by && msg.read_by.length > 0) {
                            if (conversation.is_group) {
                                // For groups: "Vu par [Names]"
                                const names = msg.read_by.map(r => r.first_name || 'User').join(', ');
                                readReceiptText = `Vu par ${names}`;
                            } else {
                                // For 1-1: "Vu à [Time]"
                                const readTime = new Date(msg.read_by[0].read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                readReceiptText = `Vu à ${readTime}`;
                            }
                        }

                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={msg.id}
                                className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-2 ${isGroupedWithPrev ? 'mt-1' : 'mt-4 first:mt-0'}`}
                            >
                                {/* Avatar for received messages - only show if not grouped */}
                                {!isMe && !isGroupedWithPrev && (
                                    <div className="flex-shrink-0">
                                        {(() => {
                                            const sender = conversation.participants?.find((p: any) => p.id === msg.sender_id || p.user_id === msg.sender_id);
                                            return sender?.avatar_url ? (
                                                <img
                                                    src={sender.avatar_url}
                                                    alt={getDisplayName ? getDisplayName(sender) : (sender.first_name || 'User')}
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getAvatarColor(msg.sender_id)}`}>
                                                    {sender ? getInitials(sender) : 'U'}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Spacer for grouped messages */}
                                {!isMe && isGroupedWithPrev && <div className="w-8 flex-shrink-0" />}

                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} flex-1`}>
                                    {/* Shared Post Card */}
                                    {hasSharedPost && (
                                        <div className="mb-1" onClick={(e) => e.stopPropagation()}>
                                            <SharedPostCard post={msg.shared_post} />
                                        </div>
                                    )}

                                    {/* Shared Note Card */}
                                    {msg.shared_note && (
                                        <div className="mb-1" onClick={(e) => e.stopPropagation()}>
                                            <SharedNoteCard note={msg.shared_note} />
                                        </div>
                                    )}

                                    {/* Attachment */}
                                    {msg.attachment_url && (
                                        <div className="mb-1 max-w-[70%]">
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
                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isMe ? 'bg-black text-white border-black' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                                                        }`}
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

                                    {/* Text Content */}
                                    {hasTextContent && (
                                        <div
                                            className={`
                                            max-w-[70%] px-5 py-3 text-sm shadow-sm
                                            ${isMe
                                                    ? 'bg-black text-white rounded-2xl rounded-tr-sm'
                                                    : 'bg-white text-gray-900 border border-gray-100 rounded-2xl rounded-tl-sm'
                                                }
                                        `}
                                        >
                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                        </div>
                                    )}

                                    {/* Timestamp & Read Receipt */}
                                    {(showTimestamp || readReceiptText) && (
                                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mt-1`}>
                                            {showTimestamp && (
                                                <p className="text-[10px] text-gray-400 opacity-70">
                                                    {msgTime}
                                                </p>
                                            )}
                                            {readReceiptText && (
                                                <p className="text-[10px] text-gray-400 font-medium">
                                                    {readReceiptText}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {!(showMembersModal || showRenameModal || showAddMemberModal) && (
                <div className="p-6 bg-gray-50 border-t border-gray-100">
                    <ChatInput onSend={handleSendMessage} />
                </div>
            )}

            {/* Modals rendered via Portal */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {/* View Members Modal */}
                    {showMembersModal && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowMembersModal(false)}
                                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ type: "spring", duration: 0.3 }}
                                className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative z-10 mx-auto"
                            >
                                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
                                    <h3 className="font-bold text-lg text-gray-900">Members</h3>
                                    <button onClick={() => setShowMembersModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <X size={20} className="text-gray-400" />
                                    </button>
                                </div>
                                <div className="max-h-[350px] overflow-y-auto p-2">
                                    {conversation.is_group && conversation.participants ? (
                                        conversation.participants.map(p => (
                                            <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl transition-colors mx-2">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ${getAvatarColor(p.id)}`}>
                                                    {p.avatar_url ? (
                                                        <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        getInitials(p)
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900">{getDisplayName(p)}</p>
                                                    <p className="text-xs text-gray-500 font-medium">{p.job_title || 'Member'}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : conversation.other_participant ? (
                                        <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl transition-colors mx-2">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ${getAvatarColor(conversation.other_participant.id)}`}>
                                                {conversation.other_participant.avatar_url ? (
                                                    <img src={conversation.other_participant.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    getInitials(conversation.other_participant)
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">{getDisplayName(conversation.other_participant)}</p>
                                                <p className="text-xs text-gray-500 font-medium">{conversation.other_participant.job_title || 'Member'}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 text-center py-6 text-sm">No members found</p>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Rename Group Modal */}
                    {showRenameModal && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowRenameModal(false)}
                                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ type: "spring", duration: 0.3 }}
                                className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative z-10 mx-auto"
                            >
                                <div className="flex items-center justify-between px-6 py-5">
                                    <h3 className="font-bold text-lg text-gray-900">Rename Group</h3>
                                    <button onClick={() => setShowRenameModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <X size={20} className="text-gray-400" />
                                    </button>
                                </div>
                                <div className="px-6 pb-6 pt-0">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Group Name</label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        placeholder="Enter new name..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all font-medium text-gray-900 placeholder:text-gray-400"
                                        autoFocus
                                    />
                                    <div className="flex gap-3 mt-6">
                                        <button
                                            onClick={() => setShowRenameModal(false)}
                                            className="flex-1 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!newGroupName.trim()) {
                                                    toast.error('Please enter a group name');
                                                    return;
                                                }
                                                try {
                                                    await apiClient.patch(`/chat/${conversation.id}`, { title: newGroupName.trim() });
                                                    toast.success('Group renamed successfully');
                                                    setShowRenameModal(false);
                                                    await onRefresh();
                                                } catch (error: any) {
                                                    toast.error(error.message || 'Failed to rename group');
                                                }
                                            }}
                                            className="flex-1 bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-all text-sm shadow-lg shadow-black/20"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Add Member to Group Modal */}
                    {showAddMemberModal && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowAddMemberModal(false)}
                                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ type: "spring", duration: 0.3 }}
                                className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative z-10 mx-auto flex flex-col max-h-[80vh]"
                            >
                                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
                                    <h3 className="font-bold text-lg text-gray-900">Add to Group</h3>
                                    <button onClick={() => { setShowAddMemberModal(false); setMemberSearch(''); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <X size={20} className="text-gray-400" />
                                    </button>
                                </div>

                                {/* Search */}
                                <div className="px-4 py-3 border-b border-gray-50">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <input
                                            type="text"
                                            placeholder="Search members..."
                                            value={memberSearch}
                                            onChange={(e) => setMemberSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                                        />
                                    </div>
                                </div>

                                {/* Member List */}
                                <div className="flex-1 overflow-y-auto p-2">
                                    {loadingMembers ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                        </div>
                                    ) : filteredAvailableMembers.length === 0 ? (
                                        <div className="text-center py-8">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <Users className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <p className="text-gray-500 text-sm">
                                                {availableMembers.length === 0 ? 'All members are already in this group' : 'No matching members'}
                                            </p>
                                        </div>
                                    ) : (
                                        filteredAvailableMembers.map(member => (
                                            <button
                                                key={member.id}
                                                onClick={async () => {
                                                    try {
                                                        // Call backend API to add member
                                                        await apiClient.post(`/chat/${conversation.id}/members`, { member_id: member.id });
                                                        toast.success(`${member.name} added to group`);
                                                        setShowAddMemberModal(false);
                                                        setMemberSearch('');
                                                        // Refresh conversations to update participant list
                                                        await onRefresh();
                                                    } catch (error: any) {
                                                        toast.error(error.message || 'Failed to add member');
                                                    }
                                                }}
                                                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-2xl transition-colors text-left"
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ${getAvatarColor(member.id)}`}>
                                                    {member.avatar_url ? (
                                                        <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        member.name?.charAt(0) || '?'
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-gray-900 truncate">{member.name}</p>
                                                    <p className="text-xs text-gray-500 truncate">{member.job_title || member.email}</p>
                                                </div>
                                                <UserPlus size={18} className="text-gray-300" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Image Lightbox */}
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
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}

function ChatInput({ onSend }: { onSend: (content: string, attachments?: { url: string; type: string; name: string }[]) => void }) {
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const apiClient = useApiClient();

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Check max 5 files total
        if (attachments.length + files.length > 5) {
            toast.error('Maximum 5 files allowed');
            return;
        }

        // Validate each file
        const validFiles: File[] = [];
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`${file.name} exceeds 10MB limit`);
                continue;
            }
            validFiles.push(file);
        }

        setAttachments(prev => [...prev, ...validFiles]);
        // Reset input to allow selecting same file again
        e.target.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!content.trim() && attachments.length === 0) return;

        try {
            if (attachments.length > 0) {
                setIsUploading(true);
                const uploadedAttachments: { url: string; type: string; name: string }[] = [];

                // Upload all files
                for (const file of attachments) {
                    const base64 = await readFileAsBase64(file);
                    const uploadRes = (await apiClient.post('/chat/upload', {
                        file: base64,
                        filename: file.name,
                        content_type: file.type
                    })) as { url: string; filename: string; content_type: string };
                    uploadedAttachments.push({
                        url: uploadRes.url,
                        type: uploadRes.content_type,
                        name: uploadRes.filename
                    });
                }

                // Send message with all attachments
                onSend(content, uploadedAttachments);
                setContent('');
                setAttachments([]);
                setIsUploading(false);
                textareaRef.current?.focus();
            } else {
                onSend(content);
                setContent('');
                textareaRef.current?.focus();
            }
        } catch (error) {
            toast.error('Failed to send message');
            setIsUploading(false);
        }
    };

    const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
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
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-2xl duration-300 group focus-within:ring-2 focus-within:ring-black/5">
            {/* Attachments Preview */}
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
                />
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    multiple
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
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
