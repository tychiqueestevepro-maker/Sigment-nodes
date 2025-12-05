'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';

interface CommentFormProps {
    onSubmit: (content: string) => Promise<void>;
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
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedContent = content.trim();
        if (!trimmedContent || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSubmit(trimmedContent);
            setContent('');
        } catch (error) {
            console.error('Failed to submit comment:', error);
        } finally {
            setIsSubmitting(false);
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

    return (
        <form onSubmit={handleSubmit} className="relative">
            <div className={`
                flex items-start gap-2 bg-gray-50 rounded-xl border border-gray-200 
                focus-within:border-gray-300 focus-within:bg-white transition-all
                ${compact ? 'p-2' : 'p-3'}
            `}>
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
                        disabled={!content.trim() || isSubmitting}
                        className={`
                            p-1.5 rounded-lg transition-all
                            ${content.trim() && !isSubmitting
                                ? 'text-white bg-gray-900 hover:bg-gray-800'
                                : 'text-gray-300 bg-gray-100 cursor-not-allowed'
                            }
                        `}
                    >
                        <Send size={16} className={isSubmitting ? 'animate-pulse' : ''} />
                    </button>
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
