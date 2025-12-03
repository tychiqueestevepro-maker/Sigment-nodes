import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './useApiClient';
import { FeedItem } from '@/types/feed';

interface UseFeedResult {
    items: FeedItem[];
    totalCount: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
}

export function useFeed(): UseFeedResult {
    const apiClient = useApiClient();

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['unifiedFeed'],
        queryFn: async () => {
            const response = await apiClient.get<{ items: FeedItem[]; total_count: number }>('/feed/unified/');
            console.log('Feed data received:', response.items?.length || 0);
            return response;
        },
        refetchInterval: 30000,
        retry: 1,
    });

    return {
        items: data?.items || [],
        totalCount: data?.total_count || 0,
        isLoading,
        error: error as Error | null,
        refetch,
    };
}
