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
    const { organizationId } = apiClient.auth;

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['unified Feed', organizationId],
        queryFn: async () => {
            if (!organizationId) return { items: [], total_count: 0 };

            try {
                const response = await apiClient.get<{ items: FeedItem[]; total_count: number }>('/feed/unified/');
                return response;
            } catch (err: any) {
                // Silently handle temporary server errors (500, network errors)
                // These are common during server restarts or network issues
                const isTemporaryError = err.message?.includes('500') ||
                    err.message?.includes('Network') ||
                    err.response?.status === 500;

                if (!isTemporaryError) {
                    console.error('Feed fetch error:', err);
                }

                // Return empty feed on error to avoid breaking the UI
                return { items: [], total_count: 0 };
            }
        },
        enabled: !!organizationId,
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
