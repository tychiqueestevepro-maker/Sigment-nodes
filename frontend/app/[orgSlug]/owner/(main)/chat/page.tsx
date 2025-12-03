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
    Plus
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
}

interface Conversation {
    id: string;
    updated_at: string;
    other_participant: Participant;
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

// --- Components ---

export default function ChatPage() {
    const { user } = useUser();
    const { organization } = useOrganization();
    const apiClient = useApiClient();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);

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

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden">
            <MemberPicker
                isOpen={isMemberPickerOpen}
                onClose={() => setIsMemberPickerOpen(false)}
                onSelect={handleStartConversation}
            />

            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-20">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">Messages</h2>
                    <button
                        onClick={() => setIsMemberPickerOpen(true)}
                        className="p-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors shadow-sm"
                        title="New Message"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
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
                        conversations.map((conv) => (
                            <div
                                key={conv.id}
                                onClick={() => setSelectedConversationId(conv.id)}
                                className={`p-4 border-b border-gray-50 cursor-pointer transition-all ${selectedConversationId === conv.id
                                    ? 'bg-gray-100 border-l-4 border-l-black pl-[12px]' // Adjust padding for border
                                    : 'hover:bg-gray-50 bg-white border-l-4 border-l-transparent'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 font-medium border border-gray-100">
                                        {conv.other_participant?.first_name?.[0] || conv.other_participant?.email?.[0] || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <p className="text-sm font-semibold text-gray-900 truncate">
                                                {conv.other_participant?.first_name
                                                    ? `${conv.other_participant.first_name} ${conv.other_participant.last_name || ''}`
                                                    : conv.other_participant?.email}
                                            </p>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(conv.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                            {conv.other_participant?.job_title || 'Member'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
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
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold border border-gray-200">
                        {conversation.other_participant?.first_name?.[0] || '?'}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">
                            {conversation.other_participant?.first_name
                                ? `${conversation.other_participant.first_name} ${conversation.other_participant.last_name || ''}`
                                : conversation.other_participant?.email}
                        </h3>
                        <p className="text-xs text-gray-500">
                            {conversation.other_participant?.job_title || 'Member'}
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
