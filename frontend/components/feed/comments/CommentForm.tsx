'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, X, ImagePlus, Loader2, BarChart3 } from 'lucide-react';
import { QuickPollCreator } from '@/components/feed/poll';

interface CommentFormProps {
    onSubmit: (content: string, mediaUrl?: string, pollData?: { question: string; options: string[]; color: string }) => Promise<void>;
    onCancel?: () => void;
    placeholder?: string;
    autoFocus?: boolean;
    compact?: boolean;
}

export const CommentForm: React.FC<CommentFormProps> = ({
    onSubmit,
    onCancel,
    placeholder = 'Write a comment...',
    autoFocus = false,
    compact = false
}) => {
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollData, setPollData] = useState<{ question: string; options: string[]; color: string } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [autoFocus]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [content]);

    // Handle image selection
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please select a valid image (JPEG, PNG, GIF, or WebP)');
            return;
        }

        // Validate file size (5MB for comments)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image is too large. Maximum size is 5MB');
            return;
        }

        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
        // Close poll if open
        setShowPollCreator(false);
        setPollData(null);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedContent = content.trim();
        if (!trimmedContent && !selectedImage && !pollData) return;
        if (isSubmitting) return;

        setIsSubmitting(true);
        setIsUploading(!!selectedImage);

        try {
            let mediaUrl: string | undefined = undefined;

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
                    throw new Error('Failed to upload image');
                }

                const uploadData = await uploadResponse.json();
                mediaUrl = uploadData.url;
            }

            await onSubmit(trimmedContent, mediaUrl, pollData || undefined);
            setContent('');
            handleRemoveImage();
            setShowPollCreator(false);
            setPollData(null);
        } catch (error) {
            console.error('Failed to submit comment:', error);
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Cmd/Ctrl + Enter
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(e);
        }
        // Cancel on Escape
        if (e.key === 'Escape' && onCancel) {
            onCancel();
        }
    };

    const canSubmit = content.trim() || selectedImage || pollData;

    return (
        <form onSubmit={handleSubmit} className="relative">
            <div className={`
                flex flex-col gap-2 bg-gray-50 rounded-xl border border-gray-200 
                focus-within:border-gray-300 focus-within:bg-white transition-all
                ${compact ? 'p-2' : 'p-3'}
            `}>
                {/* Quick Poll Creator */}
                {showPollCreator && (
                    <QuickPollCreator
                        onPollChange={setPollData}
                        onClose={() => {
                            setShowPollCreator(false);
                            setPollData(null);
                        }}
                    />
                )}

                {/* Image Preview */}
                {imagePreview && (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full max-h-32 object-cover"
                        />
                        <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black rounded-full text-white transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                <div className="flex items-start gap-2">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        rows={1}
                        className={`
                            flex-1 bg-transparent resize-none outline-none text-gray-800 
                            placeholder-gray-400 min-h-[24px]
                            ${compact ? 'text-sm' : 'text-sm'}
                        `}
                        disabled={isSubmitting}
                    />

                    <div className="flex items-center gap-1 shrink-0">
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageSelect}
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                        />

                        {/* Image button */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSubmitting || showPollCreator}
                            className={`p-1.5 rounded-lg transition-colors ${selectedImage
                                ? 'text-green-600 bg-green-50'
                                : showPollCreator
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                            title="Add image"
                        >
                            <ImagePlus size={16} />
                        </button>

                        {/* Poll button */}
                        <button
                            type="button"
                            onClick={() => {
                                setShowPollCreator(!showPollCreator);
                                if (!showPollCreator) {
                                    handleRemoveImage();
                                } else {
                                    setPollData(null);
                                }
                            }}
                            disabled={isSubmitting}
                            className={`p-1.5 rounded-lg transition-colors ${showPollCreator || pollData
                                ? 'text-blue-600 bg-blue-50'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                            title="Add poll"
                        >
                            <BarChart3 size={16} />
                        </button>

                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                            >
                                <X size={16} />
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={!canSubmit || isSubmitting}
                            className={`
                                p-1.5 rounded-lg transition-all
                                ${canSubmit && !isSubmitting
                                    ? 'text-white bg-gray-900 hover:bg-gray-800'
                                    : 'text-gray-300 bg-gray-100 cursor-not-allowed'
                                }
                            `}
                        >
                            {isUploading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Send size={16} className={isSubmitting ? 'animate-pulse' : ''} />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {!compact && (
                <div className="mt-1 text-xs text-gray-400 text-right">
                    Press ⌘+Enter to submit
                </div>
            )}
        </form>
    );
};
