import React from 'react';
import { FeedItem } from '@/types/feed';
import { PostCard } from './cards/PostCard';
import { IdeaCard } from './cards/IdeaCard';
import { ClusterCard } from './cards/ClusterCard';

interface FeedItemRendererProps {
    item: FeedItem;
}

export const FeedItemRenderer: React.FC<FeedItemRendererProps> = ({ item }) => {
    switch (item.type) {
        case 'POST':
            return <PostCard item={item} />;
        case 'NOTE':
            return <IdeaCard item={item} />;
        case 'CLUSTER':
            return <ClusterCard item={item} />;
        default:
            console.warn('Unknown feed item type:', (item as any).type);
            return null;
    }
};
