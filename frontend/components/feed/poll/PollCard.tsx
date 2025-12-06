'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, Clock, BarChart3 } from 'lucide-react';
import { Poll, PollOption } from '@/types/poll';
import { useApiClient } from '@/hooks/useApiClient';
import { formatDistanceToNow } from 'date-fns';

interface PollCardProps {
    poll: Poll;
    onVote?: (poll: Poll) => void;
}

export const PollCard: React.FC<PollCardProps> = ({ poll: initialPoll, onVote }) => {
    const apiClient = useApiClient();
    const [poll, setPoll] = useState(initialPoll);
    const [isVoting, setIsVoting] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState<string[]>(poll.user_votes || []);

    const pollColor = poll.color || '#374151';

    // Optimistic update for instant feedback
    const handleOptionClick = async (optionId: string) => {
        if (poll.is_expired || isVoting) return;

        // For single vote polls
        if (!poll.allow_multiple) {
            // If clicking same option, unvote
            if (selectedOptions.includes(optionId)) {
                // Optimistic update
                const newSelectedOptions: string[] = [];
                setSelectedOptions(newSelectedOptions);

                const optimisticPoll = {
                    ...poll,
                    user_voted: false,
                    user_votes: [],
                    total_votes: Math.max(0, poll.total_votes - 1),
                    options: poll.options.map(opt => ({
                        ...opt,
                        is_voted: false,
                        votes_count: opt.id === optionId ? Math.max(0, opt.votes_count - 1) : opt.votes_count,
                        percentage: 0
                    }))
                };

                // Recalculate percentages
                const total = optimisticPoll.total_votes;
                optimisticPoll.options = optimisticPoll.options.map(opt => ({
                    ...opt,
                    percentage: total > 0 ? Math.round((opt.votes_count / total) * 100 * 10) / 10 : 0
                }));

                setPoll(optimisticPoll);
                onVote?.(optimisticPoll);

                // Background API call
                try {
                    const updated = await apiClient.delete<Poll>(`/feed/polls/${poll.id}/vote`);
                    setPoll(updated);
                    setSelectedOptions(updated.user_votes || []);
                    onVote?.(updated);
                } catch (error) {
                    console.error('Error unvoting:', error);
                    // Revert on error
                    setPoll(poll);
                    setSelectedOptions(poll.user_votes || []);
                }
                return;
            }

            // Vote on new option - optimistic update
            const prevVotedId = selectedOptions[0];
            const newSelectedOptions = [optionId];
            setSelectedOptions(newSelectedOptions);

            const optimisticPoll = {
                ...poll,
                user_voted: true,
                user_votes: newSelectedOptions,
                total_votes: prevVotedId ? poll.total_votes : poll.total_votes + 1,
                options: poll.options.map(opt => ({
                    ...opt,
                    is_voted: opt.id === optionId,
                    votes_count: opt.id === optionId
                        ? opt.votes_count + 1
                        : (opt.id === prevVotedId ? Math.max(0, opt.votes_count - 1) : opt.votes_count),
                    percentage: 0
                }))
            };

            // Recalculate percentages
            const total = optimisticPoll.total_votes;
            optimisticPoll.options = optimisticPoll.options.map(opt => ({
                ...opt,
                percentage: total > 0 ? Math.round((opt.votes_count / total) * 100 * 10) / 10 : 0
            }));

            setPoll(optimisticPoll);
            onVote?.(optimisticPoll);

            // Background API call
            try {
                const updated = await apiClient.post<Poll>(`/feed/polls/${poll.id}/vote`, {
                    option_ids: [optionId]
                });
                setPoll(updated);
                setSelectedOptions(updated.user_votes || []);
                onVote?.(updated);
            } catch (error) {
                console.error('Error voting:', error);
                // Revert on error
                setPoll(poll);
                setSelectedOptions(poll.user_votes || []);
            }
            return;
        }

        // Multiple choice - just toggle selection
        if (selectedOptions.includes(optionId)) {
            setSelectedOptions(prev => prev.filter(id => id !== optionId));
        } else {
            setSelectedOptions(prev => [...prev, optionId]);
        }
    };

    const handleMultiVote = async () => {
        if (selectedOptions.length === 0 || isVoting) return;

        setIsVoting(true);

        // Optimistic update
        const optimisticPoll = {
            ...poll,
            user_voted: true,
            user_votes: selectedOptions,
            total_votes: poll.total_votes + selectedOptions.length,
            options: poll.options.map(opt => ({
                ...opt,
                is_voted: selectedOptions.includes(opt.id),
                votes_count: selectedOptions.includes(opt.id) ? opt.votes_count + 1 : opt.votes_count,
                percentage: 0
            }))
        };

        const total = optimisticPoll.total_votes;
        optimisticPoll.options = optimisticPoll.options.map(opt => ({
            ...opt,
            percentage: total > 0 ? Math.round((opt.votes_count / total) * 100 * 10) / 10 : 0
        }));

        setPoll(optimisticPoll);
        onVote?.(optimisticPoll);

        try {
            const updated = await apiClient.post<Poll>(`/feed/polls/${poll.id}/vote`, {
                option_ids: selectedOptions
            });
            setPoll(updated);
            setSelectedOptions(updated.user_votes || []);
            onVote?.(updated);
        } catch (error) {
            console.error('Error voting:', error);
            setPoll(poll);
            setSelectedOptions(poll.user_votes || []);
        } finally {
            setIsVoting(false);
        }
    };

    const showResults = poll.user_voted || poll.is_expired;

    return (
        <div
            className="rounded-xl p-4 border-2 transition-all"
            style={{
                borderColor: pollColor,
                backgroundColor: `${pollColor}08`
            }}
        >
            {/* Question */}
            <div className="flex items-start gap-2 mb-4">
                <BarChart3 size={18} style={{ color: pollColor }} className="mt-0.5 shrink-0" />
                <h4 className="font-semibold text-gray-900">{poll.question}</h4>
            </div>

            {/* Options */}
            <div className="space-y-2 mb-4">
                {poll.options.map((option) => {
                    const isSelected = selectedOptions.includes(option.id);
                    const isVoted = option.is_voted;

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleOptionClick(option.id)}
                            disabled={poll.is_expired}
                            className={`
                                w-full relative overflow-hidden rounded-lg border transition-all text-left
                                ${poll.is_expired ? 'cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}
                            `}
                            style={{
                                borderColor: isVoted ? pollColor : isSelected ? `${pollColor}80` : '#e5e7eb',
                                backgroundColor: isVoted ? `${pollColor}10` : isSelected ? `${pollColor}05` : 'white'
                            }}
                        >
                            {/* Progress bar background - animated */}
                            {showResults && (
                                <div
                                    className="absolute inset-0 transition-all duration-300 ease-out"
                                    style={{
                                        width: `${option.percentage}%`,
                                        backgroundColor: isVoted ? `${pollColor}25` : '#f3f4f6'
                                    }}
                                />
                            )}

                            <div className="relative flex items-center justify-between p-3">
                                <div className="flex items-center gap-2">
                                    {isVoted ? (
                                        <CheckCircle2 size={18} style={{ color: pollColor }} className="shrink-0" />
                                    ) : isSelected ? (
                                        <CheckCircle2 size={18} style={{ color: `${pollColor}80` }} className="shrink-0" />
                                    ) : (
                                        <Circle size={18} className="text-gray-400 shrink-0" />
                                    )}
                                    <span className={`text-sm ${isVoted ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                                        {option.text}
                                    </span>
                                </div>

                                {showResults && (
                                    <span
                                        className="text-sm font-medium transition-all"
                                        style={{ color: isVoted ? pollColor : '#6b7280' }}
                                    >
                                        {option.percentage}%
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Multi-vote submit button */}
            {poll.allow_multiple && !poll.user_voted && !poll.is_expired && (
                <button
                    onClick={handleMultiVote}
                    disabled={selectedOptions.length === 0 || isVoting}
                    className="w-full py-2 rounded-lg font-medium text-sm transition-all active:scale-[0.98]"
                    style={{
                        backgroundColor: selectedOptions.length > 0 ? pollColor : '#e5e7eb',
                        color: selectedOptions.length > 0 ? 'white' : '#9ca3af',
                        cursor: selectedOptions.length > 0 ? 'pointer' : 'not-allowed'
                    }}
                >
                    {isVoting ? 'Voting...' : `Vote (${selectedOptions.length} selected)`}
                </button>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t" style={{ borderColor: `${pollColor}20` }}>
                <span>{poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}</span>

                {poll.expires_at && !poll.is_expired && (
                    <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>
                            Ends {formatDistanceToNow(new Date(poll.expires_at), { addSuffix: true })}
                        </span>
                    </div>
                )}

                {poll.is_expired && (
                    <span className="text-gray-400">Poll ended</span>
                )}

                {poll.allow_multiple && (
                    <span className="text-gray-400">Multiple choice</span>
                )}
            </div>
        </div>
    );
};
