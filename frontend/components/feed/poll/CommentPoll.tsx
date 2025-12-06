'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, BarChart3 } from 'lucide-react';
import { CommentPollData } from '@/types/comments';
import { useApiClient } from '@/hooks/useApiClient';

interface CommentPollProps {
    commentId: string;
    pollData: CommentPollData;
    currentUserId?: string;
    onVote?: (updatedPoll: CommentPollData) => void;
}

export const CommentPoll: React.FC<CommentPollProps> = ({
    commentId,
    pollData: initialPollData,
    currentUserId,
    onVote
}) => {
    const apiClient = useApiClient();
    const [pollData, setPollData] = useState(initialPollData);
    const [isVoting, setIsVoting] = useState(false);

    const hasVoted = currentUserId ? pollData.voter_ids.includes(currentUserId) : false;
    const pollColor = pollData.color || '#3B82F6';

    const handleVote = async (optionIndex: number) => {
        if (hasVoted || isVoting) return;

        // Optimistic update
        const newPollData = {
            ...pollData,
            options: pollData.options.map((opt, idx) => ({
                ...opt,
                votes: idx === optionIndex ? opt.votes + 1 : opt.votes
            })),
            voter_ids: currentUserId ? [...pollData.voter_ids, currentUserId] : pollData.voter_ids,
            total_votes: pollData.total_votes + 1
        };

        setPollData(newPollData);
        onVote?.(newPollData);

        // API call
        setIsVoting(true);
        try {
            const response = await apiClient.post<{ poll_data: CommentPollData }>(
                `/feed/comments/${commentId}/poll/vote`,
                { option_index: optionIndex }
            );
            if (response.poll_data) {
                setPollData(response.poll_data);
                onVote?.(response.poll_data);
            }
        } catch (error) {
            console.error('Error voting on poll:', error);
            // Revert on error
            setPollData(initialPollData);
        } finally {
            setIsVoting(false);
        }
    };

    const totalVotes = pollData.total_votes;

    return (
        <div
            className="rounded-lg p-3 border mt-2 mb-3"
            style={{
                borderColor: pollColor,
                backgroundColor: `${pollColor}08`
            }}
        >
            {/* Question */}
            <div className="flex items-center gap-1.5 mb-2" style={{ color: pollColor }}>
                <BarChart3 size={14} />
                <span className="text-xs font-medium">{pollData.question}</span>
            </div>

            {/* Options */}
            <div className="space-y-1.5">
                {pollData.options.map((option, index) => {
                    const percentage = totalVotes > 0
                        ? Math.round((option.votes / totalVotes) * 100)
                        : 0;
                    const isSelected = false; // We don't track which option user voted for

                    return (
                        <button
                            key={index}
                            onClick={() => handleVote(index)}
                            disabled={hasVoted || isVoting}
                            className={`
                                w-full relative overflow-hidden rounded text-left transition-all text-xs
                                ${hasVoted ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}
                            `}
                            style={{
                                backgroundColor: hasVoted ? `${pollColor}10` : 'white',
                                border: `1px solid ${hasVoted ? pollColor : '#e5e7eb'}`
                            }}
                        >
                            {/* Progress bar */}
                            {hasVoted && (
                                <div
                                    className="absolute inset-0 transition-all duration-300"
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: `${pollColor}20`
                                    }}
                                />
                            )}

                            <div className="relative flex items-center justify-between p-2">
                                <div className="flex items-center gap-1.5">
                                    {hasVoted ? (
                                        <CheckCircle2 size={14} style={{ color: pollColor }} />
                                    ) : (
                                        <Circle size={14} className="text-gray-400" />
                                    )}
                                    <span className="text-gray-700">{option.text}</span>
                                </div>

                                {hasVoted && (
                                    <span
                                        className="text-xs font-medium"
                                        style={{ color: pollColor }}
                                    >
                                        {percentage}%
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="text-xs text-gray-400 mt-2">
                {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </div>
        </div>
    );
};
