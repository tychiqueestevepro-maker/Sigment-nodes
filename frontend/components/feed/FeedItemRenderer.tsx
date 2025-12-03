import React from 'react';
import { FeedItem } from '@/types/feed';
import { PostCard } from './cards/PostCard';
import { IdeaCard } from './cards/IdeaCard';
import { ClusterCard } from './cards/ClusterCard';

interface FeedItemRendererProps {
    item: FeedItem;
}

export const FeedItemRenderer: React.FC<FeedItemRendererProps> = ({ item }) => {
    // Safety: Prevent crash if item is null/undefined
    if (!item) return null;

    switch (item.type) {
        case 'POST':
            return <PostCard item={item} />;
        case 'NOTE':
            return <IdeaCard item={item} />;
        case 'CLUSTER':
            return <ClusterCard item={item} />;
        default:
            // Safety: Handle unknown types gracefully instead of crashing
            console.warn('Unknown feed item type:', (item as any)?.type);
            return null;
    }
};
