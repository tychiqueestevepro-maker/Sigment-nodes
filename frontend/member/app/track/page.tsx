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
    XCircle
} from 'lucide-react';
import { api } from '@/lib/api';

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
    };
    return statusMap[status] || { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' };
}

// Helper to format date
function formatDate(dateString: string): string {
    if (!dateString) return 'Date unknown';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
        return 'Date error';
    }
}

export default function TrackPage() {
    const [selectedNote, setSelectedNote] = useState<any>(null);

    // Get user ID from localStorage
    const userId = typeof window !== 'undefined' ? localStorage.getItem('sigment_user_id') : null;

    // Fetch user's notes from API
    const { data: notesList = [], isLoading, error, refetch } = useQuery<any[]>({
        queryKey: ['user-notes', userId],
        queryFn: async () => {
            if (!userId) {
                return [];
            }
            const url = `${api.baseURL}/notes/user/${userId}`;
            if (!userId) return [];
            const response = await fetch(`${api.baseURL}/notes/user/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch user notes');
            const data = await response.json();

            // Transform raw Supabase data into display format
            return data.map((note: any) => {
                // Use content_clarified as title, fallback to content_raw excerpt
                const title = note.content_clarified ||
                    (note.content_raw ? note.content_raw.substring(0, 50) + "..." : "Untitled Note");

                // Extract category from clusters.pillars.name if available
                const category = note.clusters?.pillars?.name || "PENDING";

                // Use created_at for date
                const date = note.created_at ? formatDate(note.created_at) : "Date unknown";

                // Map status to display format
                const statusMap: Record<string, string> = {
                    'draft': 'Draft',
                    'processing': 'Processing',
                    'processed': 'Processed',
                    'review': 'In Review',
                    'approved': 'Approved',
                    'refused': 'Refused'
                };
                const statusDisplay = statusMap[note.status] || note.status;

                return {
                    id: note.id,
                    title: title,
                    content: note.content_raw || "",
                    category: category,
                    color: getColorForCategory(category),
                    status: statusDisplay,
                    status_raw: note.status,
                    date: date,
                    created_at: note.created_at,
                    processed_date: note.processed_at,
                    relevance_score: note.ai_relevance_score || 0,
                    cluster_id: note.cluster_id,
                    cluster_title: note.clusters?.title || null,
                    statusConfig: getStatusConfig(statusDisplay),
                };
            });
        },
        enabled: !!userId,
    });

    // Compute note data from selected note (real data)
    const noteData = useMemo(() => {
        if (!selectedNote) {
            return null;
        }

        const relevanceScore = selectedNote.relevance_score || 0;
        const createdDate = formatDate(selectedNote.date);
        const processedDate = selectedNote.processed_date ? formatDate(selectedNote.processed_date) : "Pending";

        // Determine current stage based on status
        let currentStageId = 'submission';
        if (selectedNote.status_raw === 'processing' || selectedNote.status_raw === 'processed') currentStageId = 'fusion';
        if (selectedNote.status_raw === 'review' || selectedNote.status_raw === 'approved' || selectedNote.status_raw === 'refused') currentStageId = 'validation';
        if (selectedNote.status_raw === 'approved') currentStageId = 'deployment';

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
            statusConfig: getStatusConfig(selectedNote.status),

            // Stages configuration
            stages: [
                { id: 'submission', label: 'Submission', date: createdDate, status: 'completed', icon: FileText },
                { id: 'fusion', label: 'Fusion', date: selectedNote.processed_date ? processedDate : 'Pending', status: ['processing', 'processed', 'review', 'approved', 'refused'].includes(selectedNote.status_raw) ? 'completed' : 'pending', icon: Users },
                { id: 'validation', label: 'Validation Board', date: ['review', 'approved', 'refused'].includes(selectedNote.status_raw) ? 'In Progress' : 'Pending', status: ['review', 'approved', 'refused'].includes(selectedNote.status_raw) ? 'current' : 'pending', icon: CheckCircle2 },
                { id: 'deployment', label: 'Implementation', date: 'Future', status: selectedNote.status_raw === 'approved' ? 'pending' : 'locked', icon: ArrowUpRight }, // Changed Rocket to ArrowUpRight as Rocket might not be imported
            ],

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
            if (noteData.status_raw === 'review') setActiveStage('validation');
            else if (noteData.status_raw === 'processed') setActiveStage('fusion');
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
                    <div className="grid gap-4">
                        {notesList.map(note => {
                            return (
                                <div key={note.id} onClick={() => setSelectedNote(note)} className="p-6 rounded-2xl border border-gray-100 hover:border-black hover:shadow-md cursor-pointer transition-all bg-gray-50 hover:bg-white group">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${note.color}`}>{note.category}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900">{note.title}</h3>
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
                        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-8">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-gray-900">Fusion Points</h3>
                                <span className="bg-black text-white text-xs font-bold px-2.5 py-1 rounded-full">{noteData.fusion.length} steps</span>
                            </div>
                            <p className="text-gray-500 text-sm mb-6">Timeline of AI processing and data integration.</p>

                            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gray-200 before:translate-x-[0.5px]">
                                {noteData.fusion.map((item, idx) => (
                                    <div key={item.id} className="relative flex gap-4 items-start group">
                                        {/* Timeline dot */}
                                        <div className="absolute top-0 left-2 -ml-[9px] h-4 w-4 rounded-full border-2 border-white bg-gray-400 shadow-sm z-10 group-hover:bg-blue-500 transition-colors"></div>

                                        <div className="pl-6 flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{item.title}</h4>
                                                <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><Clock size={12} /> {item.time}</span>
                                            </div>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">{item.date}</span>
                                            <p className="text-sm text-gray-600 leading-relaxed p-3 bg-gray-50 rounded-lg border border-gray-100 group-hover:border-blue-100 transition-colors">
                                                {item.desc}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 'validation':
                return (
                    <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-200 p-0 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider">
                                    <Target size={16} /> Status Evolution
                                </div>
                                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
                                    <span className="text-xs font-medium text-gray-500">Last Updated:</span>
                                    <span className="text-sm font-bold text-black">{noteData.validation[0].date}</span>
                                </div>
                            </div>

                            <div className="p-6 space-y-8">
                                {noteData.validation.map((version, i) => (
                                    <div key={version.id} className="relative pl-8 border-l-2 border-gray-100 space-y-2">
                                        {/* Version Indicator */}
                                        <div className="absolute top-0 -left-[9px] h-4 w-4 rounded-full bg-white border-4 border-gray-200 z-10">
                                            {i === 0 && <div className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>}
                                        </div>

                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-xl font-extrabold text-gray-900">{version.title}</h4>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold text-gray-500 bg-gray-100 rounded-full border border-gray-200">{version.id}</span>
                                                </div>
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{version.date} • {version.status}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${version.impact === 'High Impact' ? 'text-green-600 bg-green-50 border-green-200' : 'text-orange-600 bg-orange-50 border-orange-200'}`}>
                                                {version.impact}
                                            </span>
                                        </div>

                                        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            {version.description}
                                        </p>

                                        <div className="pl-4 pt-2">
                                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <CheckCircle size={14} /> Key Status Points
                                            </h5>
                                            <ul className="space-y-1.5">
                                                {version.changes.map((change, j) => (
                                                    <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                                                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0"></div>
                                                        <span>{change}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ))}
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
                            <span className="flex items-center gap-1 text-blue-600 text-xs font-bold bg-blue-50 px-2 py-1 rounded-full"><Target size={12} /> Tracking Mode</span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">{noteData.title}</h1>
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

                                return (
                                    <div
                                        key={stage.id}
                                        onClick={() => setActiveStage(stage.id)}
                                        className={`relative pl-6 cursor-pointer transition-all duration-300 group ${isActive ? 'scale-105' : 'opacity-70 hover:opacity-100'}`}
                                    >
                                        <div className={`absolute -left-[21px] top-0 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${isActive || isCurrent ? 'bg-black text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div>
                                            <span className={`text-xs font-bold uppercase tracking-wider mb-1 block ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{stage.date}</span>
                                            <h3 className={`text-lg font-bold ${isActive ? 'text-black' : 'text-gray-600'}`}>{stage.label}</h3>
                                            {isCurrent && <div className="mt-2 inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide animate-pulse">Current Step</div>}
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
