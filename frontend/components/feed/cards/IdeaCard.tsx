import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Layers, ArrowRight, Clock, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { NoteItem } from '@/types/feed';

interface IdeaCardProps {
    item: NoteItem;
}

// Status badge configuration
function getStatusConfig(status: string): { label: string; color: string; bg: string; icon: React.ReactNode } | null {
    switch (status) {
        case 'review':
            return { label: 'In Review', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <Eye size={10} /> };
        case 'approved':
            return { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <CheckCircle2 size={10} /> };
        case 'refused':
            return { label: 'Refused', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: <XCircle size={10} /> };
        default:
            return null; // No badge for 'processed'
    }
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ item }) => {
    const pillarColor = item.pillar_color || '#6B7280'; // Default gray
    const statusConfig = getStatusConfig(item.status);

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

                <div className="flex items-center gap-2 shrink-0">
                    {/* Status Badge */}
                    {statusConfig && (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 border ${statusConfig.bg} ${statusConfig.color}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                        </span>
                    )}

                    {/* Node Badge */}
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-gray-200 h-fit">
                        <Layers size={12} /> Node
                    </span>
                </div>
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
