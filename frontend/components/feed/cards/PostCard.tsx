import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageSquare, Share2, MoreHorizontal } from 'lucide-react';
import { PostItem } from '@/types/feed';

interface PostCardProps {
    item: PostItem;
}

export const PostCard: React.FC<PostCardProps> = ({ item }) => {
    // Safety: Handle missing user_info gracefully
    const userInfo = item.user_info || {};
    const firstName = userInfo.first_name || '';
    const lastName = userInfo.last_name || '';
    const email = userInfo.email || 'Unknown';

    // Safety: Handle avatar initials crash
    const userInitials = (firstName?.[0] || email?.[0] || 'U').toUpperCase();

    // Safety: Construct user name safely
    const userName = firstName
        ? `${firstName} ${lastName}`.trim()
        : email !== 'Unknown' ? email : 'Anonymous User';

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                        {userInfo.avatar_url ? (
                            <img
                                src={userInfo.avatar_url}
                                alt={userName}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            userInitials
                        )}
                    </div>
                    <div>
                        <div className="font-semibold text-gray-900">{userName}</div>
                        <div className="text-xs text-gray-500">
                            {item.created_at
                                ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
                                : 'Just now'}
                        </div>
                    </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="text-gray-800 mb-4 whitespace-pre-wrap text-[15px] leading-relaxed">
                {item.content || ''}
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
