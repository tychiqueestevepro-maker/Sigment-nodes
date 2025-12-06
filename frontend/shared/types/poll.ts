// Types for Poll system

export interface PollOption {
    id: string;
    text: string;
    votes_count: number;
    percentage: number;
    is_voted: boolean;
}

export interface Poll {
    id: string;
    post_id: string;
    question: string;
    options: PollOption[];
    allow_multiple: boolean;
    total_votes: number;
    color?: string;
    expires_at?: string;
    is_expired: boolean;
    user_voted: boolean;
    user_votes: string[];
    created_at: string;
}

export interface CreatePollOption {
    text: string;
}

export interface CreatePollRequest {
    question: string;
    options: CreatePollOption[];
    allow_multiple?: boolean;
    expires_in_hours?: number;
    color?: string;
}

export interface VotePollRequest {
    option_ids: string[];
}
