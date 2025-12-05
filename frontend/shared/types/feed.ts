export type FeedItemType = 'CLUSTER' | 'NOTE' | 'POST';

export interface BaseFeedItem {
    id: string;
    type: FeedItemType;
    sort_date: string;
}

export interface ClusterItem extends BaseFeedItem {
    type: 'CLUSTER';
    title: string;
    note_count: number;
    velocity_score: number;
    pillar_id?: string;
    pillar_name?: string;
    pillar_color?: string;
    created_at: string;
    last_updated_at: string;
    preview_notes?: Array<{
        id: string;
        content: string;
        user_id: string;
        created_at: string;
    }>;
}

export interface NoteItem extends BaseFeedItem {
    type: 'NOTE';
    title?: string; // AI-generated clarified title
    content: string;
    content_raw?: string;
    content_clarified?: string;
    status: string;
    cluster_id?: string;
    pillar_id?: string;
    pillar_name?: string;
    pillar_color?: string;
    ai_relevance_score?: number;
    user_id: string;
    is_mine: boolean;
    created_at: string;
    processed_at?: string;
}

export interface PostItem extends BaseFeedItem {
    type: 'POST';
    content: string;
    post_type: string;
    user_id: string;
    user_info?: {
        first_name?: string;
        last_name?: string;
        email?: string;
        avatar_url?: string;
    };
    likes_count: number;
    comments_count: number;
    is_mine: boolean;
    created_at: string;
}

export type FeedItem = ClusterItem | NoteItem | PostItem;
