'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, FileText, Maximize2, X, Download, Loader2, Send, Paperclip, Plus } from 'lucide-react';
import { useProject } from '../ProjectContext';
import { useApiClient } from '@/hooks/useApiClient';
import { SharedNoteCard, SharedPostCard } from '@/components/feed/share';
import toast from 'react-hot-toast';

// --- Helper Functions ---
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

// --- Message Input Component ---
interface MessageInputProps {
    onSend: (content: string, attachments?: { url: string; type: string; name: string }[]) => void;
}

function MessageInput({ onSend }: MessageInputProps) {
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (attachments.length + files.length > 5) {
            toast.error('Maximum 5 files allowed');
            return;
        }
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
                        disabled={isUploading}
                    />
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

// --- Main Chat Page ---
export default function ProjectChatPage() {
    const {
        messages,
        isLoadingMessages,
        currentUser,
        organization,
        sendMessage
    } = useProject();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // Track scroll behavior
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const prevMessagesLengthRef = useRef(0);

    useEffect(() => {
        if (shouldScrollToBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShouldScrollToBottom(false);
        } else if (messages.length > prevMessagesLengthRef.current && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.sender_id === currentUser?.id) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
        prevMessagesLengthRef.current = messages.length;
    }, [messages, shouldScrollToBottom, currentUser?.id]);

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
            toast.error('Download failed');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSendMessage = (content: string, attachments?: { url: string; type: string; name: string }[]) => {
        sendMessage(content, attachments);
    };

    return (
        <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                {isLoadingMessages && messages.length === 0 ? (
                    <div className="space-y-4 animate-pulse">
                        {/* Loading skeleton */}
                        <div className="flex justify-start">
                            <div className="max-w-[70%]">
                                <div className="h-3 w-20 bg-gray-200 rounded mb-1.5"></div>
                                <div className="px-4 py-3 bg-white rounded-2xl rounded-bl-md border border-gray-100 shadow-sm">
                                    <div className="h-4 w-48 bg-gray-200 rounded"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <div className="max-w-[70%]">
                                <div className="px-4 py-3 bg-gray-300 rounded-2xl rounded-br-md">
                                    <div className="h-4 w-32 bg-gray-400 rounded"></div>
                                </div>
                            </div>
                        </div>
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
                        const isMe = msg.is_system_message ? false : (msg.sender_id === currentUser?.id);

                        return (
                            <div key={msg.id} className={`flex gap-2 mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                {/* Avatar */}
                                {!isMe && (
                                    <div className="flex-shrink-0">
                                        {msg.is_system_message ? (
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
                                            {/* Attachment Display */}
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

            {/* Lightbox for Images */}
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
