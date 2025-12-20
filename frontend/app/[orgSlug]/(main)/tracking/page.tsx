'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowUpRight,
    CheckCircle2,
    Clock,
    FileText,
    ArrowDownRight,
    Target,
    Calendar,
    Users,
    Briefcase,
    ChevronRight,
    Loader,
    AlertCircle,
    CheckCircle,
    XCircle,
    Archive
} from 'lucide-react';
import { api, apiClient } from '@/lib/api';
import { useApiClient } from '@/hooks/useApiClient';
import RoleGuard from '@/guards/RoleGuard';

// Helper function to get color for pillar category
function getColorForCategory(category: string): string {
    if (!category) return 'bg-gray-100 text-gray-600';
    const normalized = category.toLowerCase();
    if (normalized.includes('customer') || normalized.includes('experience')) return 'bg-pink-100 text-pink-600';
    if (normalized.includes('operation')) return 'bg-orange-100 text-orange-600';
    if (normalized.includes('esg') || normalized.includes('environmental')) return 'bg-teal-100 text-teal-600';
    if (normalized.includes('innovation') || normalized.includes('strategy')) return 'bg-purple-100 text-purple-600';
    if (normalized.includes('culture') || normalized.includes('workplace') || normalized.includes('hr')) return 'bg-blue-100 text-blue-600';
    if (normalized.includes('tech') || normalized.includes('digital')) return 'bg-green-100 text-green-600';
    if (normalized.includes('pending')) return 'bg-gray-100 text-gray-600';
    return 'bg-gray-100 text-gray-600';
}

// Helper function to get status icon and color
function getStatusConfig(status: string): { icon: any; color: string; bgColor: string } {
    const statusMap: Record<string, any> = {
        'Draft': { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' },
        'Processing': { icon: Loader, color: 'text-blue-600', bgColor: 'bg-blue-100' },
        'Processed': { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
        'In Review': { icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
        'Approved': { icon: CheckCircle2, color: 'text-green-700', bgColor: 'bg-green-200' },
        'Refused': { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
        'Archived': { icon: Archive, color: 'text-gray-600', bgColor: 'bg-gray-100' },
    };
    return statusMap[status] || { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' };
}

// Helper to format date
function formatDate(dateString: string): string {
    if (!dateString) return 'Date unknown';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';

        // Format: DD MMM YYYY, HH:mm
        const dateStr = date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        return `${dateStr}, ${timeStr}`;
    } catch (e) {
        return 'Date error';
    }
}

export default function TrackPage() {
    return (
        <RoleGuard allowedRoles={['MEMBER']}>
            <TrackPageContent />
        </RoleGuard>
    );
}

function TrackPageContent() {
    const [selectedNote, setSelectedNote] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const authApiClient = useApiClient();

    // Get user ID from localStorage on client side only
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedUserId = localStorage.getItem('sigment_user_id');
            setUserId(storedUserId);
        }
    }, []);

    // Fetch user's notes from API
    const { data: notesList = [], isLoading, error, refetch } = useQuery<any[]>({
        queryKey: ['user-notes', userId],
        queryFn: async () => {
            if (!userId) return [];
            const data = await authApiClient.get<any[]>(`/notes/user/${userId}`);

            // Backend already provides correctly formatted data, just add color and statusConfig
            // AND format the date for display
            return data.map((note: any) => ({
                ...note,
                date: formatDate(note.date), // Format the date here
                color: getColorForCategory(note.category),
                statusConfig: getStatusConfig(note.status),
            }));
        },
        enabled: !!userId,
    });

    // Fetch timeline events for selected note
    const { data: timelineEvents = [] } = useQuery<any[]>({
        queryKey: ['note-timeline', selectedNote?.id],
        queryFn: async () => {
            if (!selectedNote?.id) return [];
            try {
                return await authApiClient.get<any[]>(`/notes/${selectedNote.id}/timeline`);
            } catch (error) {
                console.error('Failed to fetch timeline:', error);
                return [];
            }
        },
        enabled: !!selectedNote?.id,
    });

    // Compute note data from selected note (real data)
    const noteData = useMemo(() => {
        if (!selectedNote) {
            return null;
        }

        const relevanceScore = selectedNote.relevance_score || 0;
        const createdDate = formatDate(selectedNote.date);
        const processedDate = selectedNote.processed_date ? formatDate(selectedNote.processed_date) : "Pending";
        // Fusion only if 2 or more notes are in the cluster
        const hasFusion = selectedNote.cluster_note_count >= 2;

        // Determine current stage based on status
        let currentStageId = 'submission';
        if (hasFusion && (selectedNote.status_raw === 'processing' || selectedNote.status_raw === 'processed')) {
            currentStageId = 'fusion';
        }
        if (['review', 'approved', 'refused', 'archived'].includes(selectedNote.status_raw)) {
            currentStageId = 'validation';
        }
        if (selectedNote.status_raw === 'approved') {
            currentStageId = 'deployment';
        }

        // Validation Board label changes based on status
        const validationLabel = selectedNote.status_raw === 'refused'
            ? 'Idea Closed'
            : selectedNote.status_raw === 'archived'
                ? 'Archived'
                : 'Validation Board';

        const validationDate = ['review', 'approved', 'refused', 'archived'].includes(selectedNote.status_raw)
            ? (selectedNote.status_raw === 'refused'
                ? 'Closed'
                : selectedNote.status_raw === 'archived'
                    ? 'Archived'
                    : 'In Progress')
            : 'Pending';

        // Build stages array - conditionally include Fusion only if 2+ notes are fused
        const allStages = [
            {
                id: 'submission',
                label: 'Submission',
                date: createdDate,
                status: 'completed',
                icon: FileText
            },
            ...(hasFusion ? [{
                id: 'fusion',
                label: 'Fusion',
                date: selectedNote.processed_date ? processedDate : 'Pending',
                status: ['processing', 'processed', 'review', 'approved', 'refused', 'archived'].includes(selectedNote.status_raw) ? 'completed' : 'pending',
                icon: Users
            }] : []),
            {
                id: 'validation',
                label: validationLabel,
                date: validationDate,
                status: ['review', 'approved', 'refused', 'archived'].includes(selectedNote.status_raw) ? 'current' : 'pending',
                icon: CheckCircle2
            },
            {
                id: 'deployment',
                label: 'Implementation',
                date: 'Future',
                status: selectedNote.status_raw === 'approved' ? 'pending' : 'locked',
                icon: ArrowUpRight
            },
        ];

        return {
            title: selectedNote.title,
            category: selectedNote.category,
            description: selectedNote.content || "No description available.",
            relevance: Math.round(relevanceScore),
            createdDate: createdDate,
            processedDate: processedDate,
            status: selectedNote.status,
            status_raw: selectedNote.status_raw,
            cluster_title: selectedNote.cluster_title,
            cluster_id: selectedNote.cluster_id,
            cluster_note_count: selectedNote.cluster_note_count || 0,
            statusConfig: getStatusConfig(selectedNote.status),
            stages: allStages,

            // Mocked data for UI demonstration (derived from real context where possible)
            fusion: [
                { id: 1, title: "AI Analysis", date: processedDate, time: "10:00 AM", desc: "Initial content analysis and relevance scoring." },
                { id: 2, title: "Cluster Assignment", date: processedDate, time: "10:05 AM", desc: selectedNote.cluster_title ? `Mapped to cluster: ${selectedNote.cluster_title}` : "Pending clustering..." },
                { id: 3, title: "Strategic Alignment", date: processedDate, time: "10:10 AM", desc: `Relevance score calculated at ${Math.round(relevanceScore)}%.` }
            ],
            validation: [
                {
                    id: "v1.0", date: processedDate, status: "CURRENT STATUS",
                    title: "Current Review Status",
                    description: `The note is currently in ${selectedNote.status} state.`,
                    impact: relevanceScore > 70 ? "High Impact" : "Medium Impact",
                    changes: ["Submitted to board", "AI Processing complete", "Awaiting executive decision"]
                }
            ]
        };
    }, [selectedNote]);

    const [activeStage, setActiveStage] = useState('submission');

    // Update active stage when note changes
    useEffect(() => {
        if (noteData) {
            const hasFusion = noteData.cluster_note_count >= 2;
            if (noteData.status_raw === 'review' || noteData.status_raw === 'refused') setActiveStage('validation');
            else if (hasFusion && noteData.status_raw === 'processed') setActiveStage('fusion');
            else setActiveStage('submission');
        }
    }, [noteData]);

    if (!selectedNote || !noteData) {
        return (
            <div className="h-full w-full bg-white p-8 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900">Track Queue</h1>
                    <div className="text-sm text-gray-500">
                        Total notes: <span className="font-bold text-gray-900">{notesList.length}</span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                    </div>
                ) : notesList.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center p-4 bg-gray-50 rounded-full mb-4">
                            <FileText size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No notes yet</h3>
                        <p className="text-gray-500">Notes you submit will appear here for tracking.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 max-h-[calc(100vh-140px)] overflow-y-auto pr-2 pb-8">
                        {notesList.map(note => {
                            // Use cluster title if available (it's usually cleaner), otherwise note title
                            const displayTitle = note.cluster_title || note.title;

                            return (
                                <div key={note.id} onClick={() => setSelectedNote(note)} className="p-6 rounded-2xl border border-gray-100 hover:border-black hover:shadow-md cursor-pointer transition-all bg-gray-50 hover:bg-white group">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${note.color}`}>{note.category}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 leading-tight">{displayTitle}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{note.date}</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-200 group-hover:bg-black group-hover:text-white transition-colors">
                                            <ArrowUpRight size={20} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )
    }

    const renderStageContent = () => {
        switch (activeStage) {
            case 'submission':
                return (
                    <div className="animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">ME</div>
                                <div>
                                    <h3 className="font-bold text-gray-900">You</h3>
                                    <p className="text-sm text-gray-500">Note Author</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <FileText size={14} /> Initial Content
                            </div>
                            <p className="text-gray-800 leading-relaxed text-lg font-medium">{noteData.description}</p>
                        </div>
                    </div>
                );
            case 'fusion':
                return (
                    <div className="animate-in slide-in-from-bottom-4 duration-300">
                        {/* Fusion Details Section */}
                        {noteData.cluster_id ? (
                            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-bold text-gray-900">Fusion Details</h3>
                                    <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                        Clustered
                                    </span>
                                </div>
                                <p className="text-gray-500 text-sm mb-6">
                                    Your idea's evolution within its strategic cluster.
                                </p>

                                {noteData.cluster_title && (
                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Users size={16} className="text-blue-600" />
                                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Cluster</span>
                                        </div>
                                        <h4 className="text-base font-bold text-gray-900">{noteData.cluster_title}</h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Relevance Score: {noteData.relevance}%
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-center">
                                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                                    <Users size={32} className="text-gray-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">No Cluster Yet</h3>
                                <p className="text-gray-500 max-w-md">
                                    This idea hasn't been grouped with similar ideas yet. Clustering happens during AI processing.
                                </p>
                            </div>
                        )}
                    </div>
                );
            case 'validation':
                // Get last updated from note data, fallback to timeline events if available
                const latestEvent = timelineEvents && timelineEvents.length > 0
                    ? timelineEvents[timelineEvents.length - 1]
                    : null;

                // Priority: timeline event > processed_date > created_date
                let lastUpdated = 'Unknown';
                if (latestEvent?.created_at) {
                    lastUpdated = new Date(latestEvent.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else if (noteData.processedDate) {
                    lastUpdated = new Date(noteData.processedDate).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                } else if (noteData.createdDate) {
                    lastUpdated = new Date(noteData.createdDate).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                }

                return (
                    <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-200 p-0 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider">
                                    <Target size={16} /> Status Evolution
                                </div>
                                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
                                    <span className="text-xs font-medium text-gray-500">Last Updated:</span>
                                    <span className="text-sm font-bold text-black">{lastUpdated}</span>
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-xl font-extrabold text-gray-900">Current Review Status</h3>
                                        <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full border ${noteData.status_raw === 'refused'
                                            ? 'text-red-600 bg-red-50 border-red-200'
                                            : noteData.status_raw === 'approved'
                                                ? 'text-green-600 bg-green-50 border-green-200'
                                                : noteData.status_raw === 'archived'
                                                    ? 'text-gray-600 bg-gray-50 border-gray-200'
                                                    : 'text-orange-600 bg-orange-50 border-orange-200'
                                            }`}>
                                            {noteData.status_raw === 'refused'
                                                ? 'Refused'
                                                : noteData.status_raw === 'approved'
                                                    ? 'Approved'
                                                    : noteData.status_raw === 'archived'
                                                        ? 'Archived'
                                                        : 'In Review'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        {noteData.status_raw === 'refused'
                                            ? 'This idea was not selected for implementation at this time.'
                                            : noteData.status_raw === 'approved'
                                                ? 'Your idea has been approved and is moving forward!'
                                                : noteData.status_raw === 'archived'
                                                    ? 'This idea has been archived for future reference.'
                                                    : 'The note is currently being reviewed by the executive team.'}
                                    </p>
                                </div>

                                <div className="mt-6">
                                    <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                                        <CheckCircle size={14} /> Key Status Points
                                    </h5>
                                    <ul className="space-y-2">
                                        {timelineEvents.slice().reverse().map((event: any, idx: number) => {
                                            const eventTime = new Date(event.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            });

                                            return (
                                                <li key={event.id} className="text-sm text-gray-600 flex items-start gap-2 border-l-2 border-gray-200 pl-4 py-2">
                                                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0"></div>
                                                    <div className="flex-1">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <span className="font-medium text-gray-900">{event.title}</span>
                                                            <span className="text-xs text-gray-400 whitespace-nowrap">{eventTime}</span>
                                                        </div>
                                                        {event.description && (
                                                            <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'deployment':
                return (
                    <div className="animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-center">
                            <div className="p-4 bg-white rounded-full shadow-sm mb-4"><ArrowUpRight size={32} className="text-gray-400" /></div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Ready for Implementation</h3>
                            <p className="text-gray-500 max-w-md">This stage is pending final board validation. Once approved, the implementation checklist will appear here.</p>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="h-full w-full bg-white overflow-y-auto p-8 animate-in fade-in duration-500 relative flex flex-col">
            <div className="flex-1 max-w-6xl mx-auto w-full space-y-8 pb-12">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tracking-wider uppercase">{noteData.category}</span>
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded">Tracking Mode</span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2 leading-tight">
                            {noteData.cluster_title || noteData.title}
                        </h1>
                        <p className="text-lg text-gray-500 max-w-2xl">Project Lifecycle & Status</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setSelectedNote(null)} className="flex items-center gap-2 text-gray-600 hover:text-black bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all">
                            <span className="font-medium text-sm">Back</span>
                        </button>
                    </div>
                </div>

                <hr className="border-gray-100" />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* TIMELINE LEFT */}
                    <div className="lg:col-span-4">
                        <div className="relative pl-4 border-l-2 border-gray-100 space-y-12">
                            {noteData.stages.map((stage) => {
                                const isActive = activeStage === stage.id;
                                const isCompleted = stage.status === 'completed';
                                const isCurrent = stage.status === 'current';
                                const Icon = stage.icon;

                                // Determine color based on status for Validation/Idea Closed stage
                                let stageColor = 'bg-gray-100 text-gray-400';
                                if (stage.id === 'validation') {
                                    if (noteData.status_raw === 'approved' || noteData.status_raw === 'validated') {
                                        stageColor = 'bg-green-500 text-white';
                                    } else if (noteData.status_raw === 'refused') {
                                        stageColor = 'bg-red-500 text-white';
                                    } else if (noteData.status_raw === 'archived') {
                                        stageColor = 'bg-gray-400 text-white';
                                    } else if (isCurrent) {
                                        stageColor = 'bg-black text-white';
                                    }
                                } else if (isActive || isCurrent) {
                                    stageColor = 'bg-black text-white';
                                } else if (isCompleted) {
                                    stageColor = 'bg-green-500 text-white';
                                }

                                return (
                                    <div
                                        key={stage.id}
                                        onClick={() => setActiveStage(stage.id)}
                                        className={`relative pl-6 cursor-pointer transition-all duration-300 group ${isActive ? 'scale-105' : 'opacity-70 hover:opacity-100'}`}
                                    >
                                        <div className={`absolute -left-[21px] top-0 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${stageColor}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div>
                                            <span className={`text-xs font-bold uppercase tracking-wider mb-1 block ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{stage.date}</span>
                                            <h3 className={`text-lg font-bold ${isActive ? 'text-black' : 'text-gray-600'}`}>{stage.label}</h3>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* CONTENT RIGHT */}
                    <div className="lg:col-span-8">
                        {renderStageContent()}
                    </div>
                </div>
            </div>
        </div>
    );
}
