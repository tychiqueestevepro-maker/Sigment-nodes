'use client';

import React from 'react';
import { Lightbulb, ArrowUpRight, Tag } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

interface SharedNoteCardProps {
    note: {
        id: string;
        title?: string;
        content?: string;
        content_clarified?: string;
        content_raw?: string;
        category?: string;
        pillar_name?: string;
        pillar_color?: string;
        status?: string;
        user_info?: {
            first_name?: string;
            last_name?: string;
            avatar_url?: string;
        };
    };
}

export const SharedNoteCard: React.FC<SharedNoteCardProps> = ({ note }) => {
    const router = useRouter();
    const params = useParams();
    const orgSlug = params.orgSlug as string;

    const handleClick = () => {
        router.push(`/${orgSlug}/idea/${note.id}`);
    };

    // Get the best title/content to display
    const displayTitle = note.title ||
        note.content_clarified?.substring(0, 60) ||
        note.content?.substring(0, 60) ||
        note.content_raw?.substring(0, 60) ||
        'Shared Node';

    const displayContent = note.content_clarified || note.content || note.content_raw || '';
    const description = displayContent.length > 100 ? displayContent.substring(0, 100) + '...' : displayContent;

    // Determine badge and color
    const category = note.category || note.pillar_name || 'Node';
    const pillarColor = note.pillar_color || '#6B7280';

    return (
        <div
            onClick={handleClick}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all"
            style={{ width: '280px' }}
        >
            {/* Header with badge and arrow icon */}
            <div className="px-4 pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Icon circle with pillar color */}
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${pillarColor}20` }}
                    >
                        <Lightbulb size={14} style={{ color: pillarColor }} />
                    </div>
                    {/* Badge text */}
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Node
                    </span>
                </div>
                {/* Arrow */}
                <ArrowUpRight size={16} className="text-gray-300" />
            </div>

            {/* Title */}
            <div className="px-4 pt-3">
                <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2">
                    {displayTitle}
                </h3>
            </div>

            {/* Description */}
            {description && displayTitle !== description && (
                <div className="px-4 pt-1">
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                        {description}
                    </p>
                </div>
            )}

            {/* Category/Pillar tag */}
            {category && (
                <div className="px-4 pt-3">
                    <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                        style={{
                            backgroundColor: `${pillarColor}15`,
                            color: pillarColor
                        }}
                    >
                        <Tag size={10} />
                        {category}
                    </span>
                </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 mt-2 flex items-center justify-end">
                {/* Status badge */}
                <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-full uppercase tracking-wide">
                    {note.status || 'Idea'}
                </span>
            </div>
        </div>
    );
};
