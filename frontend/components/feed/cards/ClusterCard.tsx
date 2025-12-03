import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Layers, TrendingUp, ArrowRight, FileText } from 'lucide-react';
import { ClusterItem } from '@/types/feed';

interface ClusterCardProps {
    item: ClusterItem;
}

export const ClusterCard: React.FC<ClusterCardProps> = ({ item }) => {
    const pillarColor = item.pillar_color || '#8B5CF6'; // Default purple

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
            {/* Header / Title Area */}
            <div className="p-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-purple-200">
                            <Layers size={12} /> CLUSTER
                        </span>
                        <span className="text-xs text-gray-500">
                            Updated {formatDistanceToNow(new Date(item.last_updated_at), { addSuffix: true })}
                        </span>
                    </div>

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

                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
                    {item.title}
                </h3>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5" title="Number of notes in this cluster">
                        <Layers size={14} />
                        <span>{item.note_count} notes</span>
                    </div>
                    <div className="w-px h-3 bg-gray-300"></div>
                    <div className="flex items-center gap-1.5 text-green-600 font-medium" title="Velocity Score">
                        <TrendingUp size={14} />
                        <span>Velocity: {item.velocity_score?.toFixed(1)}</span>
                    </div>
                </div>
            </div>

            {/* Preview Notes (Stacked Look) */}
            {item.preview_notes && item.preview_notes.length > 0 && (
                <div className="px-5 pb-5">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2.5">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Latest Updates
                        </div>
                        {item.preview_notes.map((note: { id: string; content: string }) => (
                            <div key={note.id} className="flex items-start gap-2.5 group/note">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-300 group-hover/note:bg-purple-400 transition-colors shrink-0"></div>
                                <span className="text-sm text-gray-600 line-clamp-1 group-hover/note:text-gray-900 transition-colors">
                                    {note.content}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer Action */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                    Created {formatDistanceToNow(new Date(item.created_at))} ago
                </span>
                <button className="text-sm font-semibold text-purple-700 flex items-center gap-1 hover:gap-2 transition-all">
                    Explore Cluster <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
};
