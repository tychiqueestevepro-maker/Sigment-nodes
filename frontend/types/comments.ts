// Types pour le système de commentaires

export interface CommentUser {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
}

export interface Comment {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    parent_comment_id: string | null;
    created_at: string;
    updated_at: string;
    user_info: CommentUser;
    likes_count: number;
    is_liked: boolean;
    replies_count: number;
    replies?: Comment[]; // Pour les réponses imbriquées
}

export interface CreateCommentRequest {
    content: string;
    parent_comment_id?: string;
}

export interface CommentsResponse {
    comments: Comment[];
    total_count: number;
    has_more: boolean;
}
