import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageSquare, Share2, MoreHorizontal } from 'lucide-react';
import { PostItem } from '@/types/feed';

interface PostCardProps {
    item: PostItem;
}

export const PostCard: React.FC<PostCardProps> = ({ item }) => {
    const userInitials = item.user_info?.first_name?.[0] || item.user_info?.email?.[0] || 'U';
    const userName = item.user_info?.first_name
        ? `${item.user_info.first_name} ${item.user_info.last_name || ''}`
        : item.user_info?.email || 'Unknown User';

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                        {item.user_info?.avatar_url ? (
                            <img
                                src={item.user_info.avatar_url}
                                alt={userName}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            userInitials.toUpperCase()
                        )}
                    </div>
                    <div>
                        <div className="font-semibold text-gray-900">{userName}</div>
                        <div className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </div>
                    </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="text-gray-800 mb-4 whitespace-pre-wrap text-[15px] leading-relaxed">
                {item.content}
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-6 pt-4 border-t border-gray-100 text-gray-500">
                <button className="flex items-center gap-2 hover:text-red-500 transition-colors group">
                    <Heart size={18} className="group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">{item.likes_count || 0}</span>
                </button>
                <button className="flex items-center gap-2 hover:text-blue-500 transition-colors group">
                    <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">{item.comments_count || 0}</span>
                </button>
                <button className="flex items-center gap-2 hover:text-gray-900 transition-colors ml-auto">
                    <Share2 size={18} />
                </button>
            </div>
        </div>
    );
};
