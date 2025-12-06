'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    Send,
    User as UserIcon,
    MoreVertical,
    Search,
    Loader2,
    Plus,
    Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { useApiClient } from '@/hooks/useApiClient';

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
}

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    is_read: boolean;
    created_at: string;
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
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
    const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);

    // Fetch conversations
    const fetchConversations = async () => {
        try {
            const data = await apiClient.get<Conversation[]>('/chat');
            setConversations(data);
            return data;
        } catch (error) {
            console.error(error);
            toast.error('Could not load conversations');
            return [];
        } finally {
            setIsLoadingConversations(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchConversations().then((data) => {
                // Select first conversation by default if available and none selected
                if (data.length > 0 && !selectedConversationId) {
                    setSelectedConversationId(data[0].id);
                }
            });
        }
    }, [user]);

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

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden">
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
                        <div className="flex justify-center items-center h-32">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
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
                                            <span className="text-[11px] text-gray-400 shrink-0 ml-2">
                                                {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                            {conv.last_message || (conv.is_group ? memberNames : conv.other_participant?.job_title || 'Start chatting')}
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

function ChatWindow({ conversation, currentUser, apiClient }: { conversation: Conversation; currentUser: any; apiClient: any }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch messages
    useEffect(() => {
        async function fetchMessages() {
            setIsLoading(true);
            try {
                const data = await apiClient.get<Message[]>(`/chat/${conversation.id}/messages`);
                // Sort by created_at ascending for display
                setMessages(data.sort((a: Message, b: Message) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                ));
            } catch (error) {
                console.error(error);
                toast.error('Failed to load messages');
            } finally {
                setIsLoading(false);
            }
        }
        fetchMessages();
    }, [conversation.id]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (content: string) => {
        // Optimistic update
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
            const savedMessage = await apiClient.post<Message>(`/chat/${conversation.id}/messages`, { content });

            // Replace temp message with real one
            setMessages(prev => prev.map(m => m.id === tempId ? savedMessage : m));
        } catch (error) {
            console.error(error);
            toast.error('Failed to send message');
            // Remove failed message
            setMessages(prev => prev.filter(m => m.id !== tempId));
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
                        <p className="text-xs text-gray-500">
                            {conversation.is_group
                                ? getGroupMemberNames(conversation.participants)
                                : (conversation.other_participant?.job_title || 'Member')
                            }
                        </p>
                    </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-full transition-colors">
                    <MoreVertical className="w-5 h-5" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
                {isLoading ? (
                    <div className="flex justify-center pt-10">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.sender_id === currentUser.id;
                        const showTime = true; // Could optimize to show time only periodically

                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
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
                                    <p className={`text-[10px] mt-1 ${isMe ? 'text-gray-400' : 'text-gray-400'} text-right opacity-70`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area (FireAndForget Style) */}
            <div className="p-6 bg-gray-50 border-t border-gray-100">
                <ChatInput onSend={handleSendMessage} />
            </div>
        </>
    );
}

function ChatInput({ onSend }: { onSend: (content: string) => void }) {
    const [content, setContent] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSubmit = () => {
        if (!content.trim()) return;
        onSend(content);
        setContent('');
        textareaRef.current?.focus();
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-2xl duration-300 group focus-within:ring-2 focus-within:ring-black/5">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="w-full h-24 px-5 py-4 bg-transparent text-gray-900 placeholder-gray-400 resize-none focus:outline-none text-base"
                />
                <div className="absolute bottom-3 right-3 flex items-center space-x-3">
                    <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide hidden sm:inline-block">
                        ⌘ + Enter
                    </span>
                    <button
                        onClick={handleSubmit}
                        disabled={!content.trim()}
                        className="p-2.5 bg-black text-white rounded-xl shadow-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
