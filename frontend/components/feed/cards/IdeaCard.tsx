import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Layers, ArrowRight } from 'lucide-react';
import { NoteItem } from '@/types/feed';

interface IdeaCardProps {
    item: NoteItem;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ item }) => {
    const isProcessed = item.status === 'processed';
    const pillarColor = item.pillar_color || '#6B7280'; // Default gray

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
            {/* Pillar Strip */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: pillarColor }}
            />

            {/* Header */}
            <div className="flex items-start justify-between mb-3 pl-2">
                <div>
                    <div className="text-base font-bold text-gray-900 line-clamp-1 mb-0.5">
                        {item.title || (item.content_clarified ? item.content_clarified.slice(0, 80) : item.content.slice(0, 80))}
                    </div>
                    <div className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </div>
                </div>

                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-gray-200 shrink-0 h-fit">
                    <Layers size={12} /> Node
                </span>
            </div>

            {/* Content */}
            <div className="pl-2 mb-4">
                <p className="text-gray-800 whitespace-pre-wrap text-[15px] leading-relaxed line-clamp-4">
                    {item.content}
                </p>
            </div>

            {/* Footer */}
            <div className="pl-2 flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                <div className="flex items-center gap-2">
                    {item.pillar_name && (
                        <span
                            className="text-xs font-medium px-2 py-1 rounded-full border"
                            style={{
                                backgroundColor: `${pillarColor}10`,
                                color: pillarColor,
                                borderColor: `${pillarColor}30`
                            }}
                        >
                            {item.pillar_name}
                        </span>
                    )}
                </div>

                <button className="text-sm font-medium text-gray-900 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:underline">
                    View Node <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};
