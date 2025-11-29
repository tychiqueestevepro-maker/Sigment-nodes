'use client';

import React from 'react';
import { CheckCircle, XCircle, Clock, Sparkles, Users, FileCheck } from 'lucide-react';
import { format } from 'date-fns';

interface TimelineEvent {
    id: string;
    event_type: string;
    title: string;
    description?: string;
    created_at: string;
}

interface EventTimelineProps {
    events: TimelineEvent[];
    isLoading?: boolean;
}

// Get icon and color for event type
function getEventConfig(eventType: string): { icon: any; color: string; bgColor: string; dotColor: string } {
    const configs: Record<string, any> = {
        submission: {
            icon: FileCheck,
            color: 'text-gray-600',
            bgColor: 'bg-gray-50',
            dotColor: 'bg-gray-400',
        },
        ai_analysis: {
            icon: Sparkles,
            color: 'text-gray-600',
            bgColor: 'bg-gray-50',
            dotColor: 'bg-gray-400',
        },
        fusion: {
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            dotColor: 'bg-blue-500',
        },
        reviewing: {
            icon: CheckCircle,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            dotColor: 'bg-blue-500',
        },
        refusal: {
            icon: XCircle,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
            dotColor: 'bg-red-500',
        },
    };

    return configs[eventType] || configs.submission;
}

// Format timestamp to "HH:mm - dd MMM"
function formatEventDate(dateString: string): string {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';

        return format(date, 'HH:mm - dd MMM');
    } catch (e) {
        return 'Date error';
    }
}

export function EventTimeline({ events, isLoading = false }: EventTimelineProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!events || events.length === 0) {
        return (
            <div className="text-center py-12">
                <Clock size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No events yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-0 relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {events.map((event, index) => {
                const config = getEventConfig(event.event_type);
                const Icon = config.icon;
                const isLast = index === events.length - 1;

                return (
                    <div key={event.id} className={`relative flex gap-4 ${!isLast ? 'pb-8' : ''}`}>
                        {/* Timeline dot with icon */}
                        <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${config.bgColor} border-2 border-white shadow-sm flex items-center justify-center`}>
                            <Icon size={18} className={config.color} />
                        </div>

                        {/* Event content */}
                        <div className="flex-1 pt-1">
                            <div className="flex items-start justify-between mb-1">
                                <h4 className={`text-base font-bold ${config.color}`}>
                                    {event.title}
                                </h4>
                                <span className="text-xs text-gray-400 font-medium whitespace-nowrap ml-4">
                                    {formatEventDate(event.created_at)}
                                </span>
                            </div>

                            {event.description && (
                                <p className="text-sm text-gray-600 leading-relaxed mt-2 pr-4">
                                    {event.description}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
