'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowUpRight,
    CheckCircle2,
    GitCommit,
    Download,
    MoreHorizontal,
    ArrowLeft,
    FileText,
    ArrowDownRight,
    Target,
    Calendar,
    Clock,
    Users,
    Briefcase,
    ChevronRight,
    Orbit,
    Pause,
    Play,
    RefreshCw,
    Archive,
    ArchiveRestore,
    X,
    Ban,
    Quote
} from 'lucide-react';
import { useApiClient } from '@/hooks/useApiClient';
import { useUser } from '@/contexts';
import { useRouter, useParams } from 'next/navigation';

// Helper function to get color for pillar category
function getColorForCategory(category: string): string {
    const normalized = category.toLowerCase();
    if (normalized.includes('customer') || normalized.includes('experience')) return 'bg-pink-100 text-pink-600';
    if (normalized.includes('operation')) return 'bg-orange-100 text-orange-600';
    if (normalized.includes('esg') || normalized.includes('environmental')) return 'bg-teal-100 text-teal-600';
    if (normalized.includes('innovation') || normalized.includes('strategy')) return 'bg-purple-100 text-purple-600';
    if (normalized.includes('culture') || normalized.includes('workplace') || normalized.includes('hr')) return 'bg-blue-100 text-blue-600';
    if (normalized.includes('tech') || normalized.includes('digital')) return 'bg-green-100 text-green-600';
    return 'bg-gray-100 text-gray-600';
}

// Helper to format date
function formatDate(dateString: string): string {
    if (!dateString) return 'Date unknown';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'Date unknown';
    }
}

export default function ArchivePage() {
    const [selectedArchive, setSelectedArchive] = useState<any>(null);
    const [viewMode, setViewMode] = useState('report');
    const [timelineProgress, setTimelineProgress] = useState(100);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedArchiveNode, setSelectedArchiveNode] = useState<any>(null);
    const apiClient = useApiClient();
    const { user } = useUser();
    const router = useRouter();
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const queryClient = useQueryClient();

    // Check access - only OWNER and BOARD can access
    useEffect(() => {
        if (user && user.role && !['OWNER', 'BOARD'].includes(user.role)) {
            router.push(`/${window.location.pathname.split('/')[1]}/home`);
        }
    }, [user, router]);

    // Fetch archived notes from API
    const { data: archivesList = [], isLoading } = useQuery<any[]>({
        queryKey: ['archived-notes'],
        queryFn: async () => {
            const data = await apiClient.get<any[]>('/board/archived-notes');
            // Add color based on category
            return data.map((note: any) => ({
                ...note,
                color: getColorForCategory(note.category),
            }));
        },
        enabled: !!user && ['OWNER', 'BOARD'].includes(user.role || ''),
    });

    // Unarchive mutation
    const unarchiveMutation = useMutation({
        mutationFn: async (noteId: string) => {
            return apiClient.post(`/board/unarchive-note/${noteId}`, {});
        },
        onSuccess: () => {
            // Refresh the lists
            queryClient.invalidateQueries({ queryKey: ['archived-notes'] });
            queryClient.invalidateQueries({ queryKey: ['review-notes'] });
            queryClient.invalidateQueries({ queryKey: ['unified-feed'] });
            // Close the detail view and return to archive list (note will disappear)
            setSelectedArchive(null);
            setSelectedArchiveNode(null);
        },
        onError: (error) => {
            console.error('Error unarchiving note:', error);
        },
    });

    // Compute archive data from selected archive (real data instead of mock)
    const archiveData = useMemo(() => {
        if (!selectedArchive) {
            return {
                title: "No Archive Selected",
                category: "N/A",
                description: "",
                relevance: 0,
                lastReview: "",
                createdDate: "",
                impactMetrics: [],
                businessValue: [],
                riskLevel: "Unknown",
                riskDesc: "",
                costEstimation: "",
                collaborators: []
            };
        }

        // Use real data from the selected archive
        const rawScore = selectedArchive.relevance_score || 0;
        const relevancePercentage = Math.round(rawScore * 10);

        // Extract team capacity data
        const teamCapacity = selectedArchive.team_capacity || {
            team_size: 0,
            profiles: [],
            feasibility: "Unknown",
            feasibility_reason: "No AI analysis available yet"
        };

        // Calculate Potential Impact based on relevance score
        let potentialImpact = "Low";
        let impactColor = "text-red-600";
        if (rawScore >= 8.5) {
            potentialImpact = "High";
            impactColor = "text-green-600";
        } else if (rawScore >= 6.5) {
            potentialImpact = "Medium";
            impactColor = "text-amber-600";
        }

        return {
            title: selectedArchive.cluster_title || selectedArchive.title,
            category: selectedArchive.category,
            description: selectedArchive.content_clarified || selectedArchive.content || "No description available.",
            relevance: relevancePercentage,
            lastReview: formatDate(selectedArchive.date),
            createdDate: formatDate(selectedArchive.date),
            aiReasoning: selectedArchive.ai_reasoning || "AI analysis pending...",

            impactMetrics: [
                {
                    label: "Relevance Score",
                    value: `${relevancePercentage}%`,
                    trend: rawScore > 7 ? "up" : "down",
                    color: "text-black",
                    bg: "bg-white",
                    desc: "AI-calculated relevance"
                },
                {
                    label: "Potential Impact",
                    value: potentialImpact,
                    trend: rawScore > 6.5 ? "up" : "down",
                    color: impactColor,
                    bg: "bg-white",
                    desc: "Strategic business impact"
                },
                {
                    label: "Team Size",
                    value: teamCapacity.team_size > 0 ? `${teamCapacity.team_size} people` : "TBD",
                    trend: "up",
                    color: "text-black",
                    bg: "bg-white",
                    desc: "AI-suggested headcount"
                },
            ],

            businessValue: [
                `Part of ${selectedArchive.category} strategic initiative`,
                selectedArchive.cluster_title ? `Belongs to cluster: ${selectedArchive.cluster_title}` : "Standalone insight",
                `Submitted by: ${selectedArchive.author}`,
            ],

            teamCapacity: teamCapacity,
            feasibility: teamCapacity.feasibility || "Unknown",
            feasibilityReason: teamCapacity.feasibility_reason || "No feasibility analysis available",
            suggestedProfiles: teamCapacity.profiles || [],

            collaborators: [
                {
                    id: 1,
                    name: selectedArchive.author,
                    role: "Contributor",
                    avatar: selectedArchive.author_avatar || selectedArchive.author?.substring(0, 2).toUpperCase() || "??",
                    isUrl: !!selectedArchive.author_avatar,
                    color: "bg-blue-100 text-blue-700",
                    idea: (selectedArchive.content_clarified || selectedArchive.title || "").substring(0, 80) + ((selectedArchive.content_clarified || selectedArchive.title || "").length > 80 ? "..." : ""),
                    fullIdea: selectedArchive.content_clarified || selectedArchive.content || "",
                    date: formatDate(selectedArchive.date),
                    x: 25,
                    y: 30
                }
            ],

            lastUpdateDisplay: formatDate(selectedArchive.updated_at || selectedArchive.date),
            createdDisplay: formatDate(selectedArchive.date)
        };
    }, [selectedArchive]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying) {
            setTimelineProgress(0);
            let p = 0;
            interval = setInterval(() => {
                p += 1;
                setTimelineProgress(p);
                if (p >= 100) {
                    setIsPlaying(false);
                    clearInterval(interval);
                }
            }, 30);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    const visibleCollaborators = useMemo(() => {
        if (timelineProgress === 100) return archiveData.collaborators;
        const threshold = Math.floor((timelineProgress / 100) * archiveData.collaborators.length);
        return archiveData.collaborators.slice(0, threshold + 1);
    }, [timelineProgress, archiveData.collaborators]);

    const handleUnarchive = () => {
        if (selectedArchive) {
            unarchiveMutation.mutate(selectedArchive.id);
        }
    };

    // Access check
    if (user && user.role && !['OWNER', 'BOARD'].includes(user.role)) {
        return (
            <div className="h-full w-full bg-white p-8 flex items-center justify-center">
                <div className="text-center">
                    <Archive size={48} className="mx-auto text-gray-300 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
                    <p className="text-gray-500">Only Board members and Owners can access the Archive.</p>
                </div>
            </div>
        );
    }

    if (!selectedArchive) {
        return (
            <div className="h-full w-full bg-white p-8 animate-in fade-in duration-500">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <Archive size={24} className="text-gray-600" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900">Archive</h1>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                    </div>
                ) : archivesList.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center p-4 bg-gray-50 rounded-full mb-4">
                            <Archive size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No archived ideas</h3>
                        <p className="text-gray-500">Ideas archived from the Review queue will appear here.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {archivesList.map(archive => (
                            <div key={archive.id} onClick={() => setSelectedArchive(archive)} className="p-6 rounded-2xl border border-gray-100 hover:border-gray-300 hover:shadow-md cursor-pointer transition-all bg-gray-50 hover:bg-white group">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${archive.color}`}>{archive.category}</span>
                                            <span className="flex items-center gap-1 text-gray-500 text-xs font-medium bg-gray-100 px-2 py-1 rounded-full">
                                                <Archive size={10} /> Archived
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">{archive.cluster_title || archive.title}</h3>
                                        <p className="text-sm text-gray-500 mt-1">Submitted by {archive.author} • Archived: {formatDate(archive.updated_at)}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-200 group-hover:bg-gray-100 group-hover:border-gray-300 transition-colors">
                                        <ArrowUpRight size={20} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="h-full w-full bg-white overflow-y-auto p-8 animate-in fade-in duration-500 relative flex flex-col">

            <div className="flex-1 max-w-6xl mx-auto w-full space-y-8 pb-12">

                {/* HEADER */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tracking-wider uppercase">
                                {archiveData.category}
                            </span>
                            <span className="flex items-center gap-1 text-gray-500 text-xs font-bold bg-gray-100 px-2 py-1 rounded-full">
                                <Archive size={12} /> Archived
                            </span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                            {archiveData.title}
                        </h1>
                        <p className="text-lg text-gray-500 max-w-2xl">
                            Archived Idea • Strategic Assessment
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <div className="bg-gray-100 p-1 rounded-lg flex mr-4">
                            <button
                                onClick={() => setViewMode('report')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'report' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Report
                            </button>
                            <button
                                onClick={() => setViewMode('evolution')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'evolution' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                <GitCommit size={14} /> Evolution
                            </button>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg hover:bg-gray-50"><Download size={20} /></button>
                        <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg hover:bg-gray-50"><MoreHorizontal size={20} /></button>
                        <button onClick={() => setSelectedArchive(null)} className="ml-2 flex items-center gap-2 text-gray-600 hover:text-black bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                            <span className="font-medium text-sm">Back</span>
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                <hr className="border-gray-100" />

                {viewMode === 'report' ? (
                    // --- DETAILED REPORT VIEW ---
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">

                        {/* LEFT COLUMN (2/3) */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Executive Summary */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    <FileText size={14} /> Executive Summary
                                </div>
                                <p className="text-gray-800 leading-relaxed text-lg font-medium">{archiveData.description}</p>
                            </div>

                            {/* --- IMPACT BLOCK --- */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-0 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider">
                                        Strategic Impact Analysis
                                    </div>
                                </div>

                                <div className="p-6">
                                    {/* KPIs Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                        {archiveData.impactMetrics.map((metric, i) => (
                                            <div key={i} className={`p-5 rounded-xl border border-gray-200 ${metric.bg}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{metric.label}</div>
                                                    {metric.trend === 'up' ? <ArrowUpRight size={16} className={metric.color} /> : <ArrowDownRight size={16} className={metric.color} />}
                                                </div>
                                                <div className={`text-4xl font-extrabold ${metric.color} mb-2 tracking-tight`}>
                                                    {metric.value}
                                                </div>
                                                <div className="text-xs text-gray-500 font-medium">{metric.desc}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Business Value Points */}
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-600 mb-4 flex items-center gap-2">
                                                <Target size={16} /> Key Business Outcomes
                                            </h4>
                                            <ul className="space-y-3">
                                                {archiveData.businessValue.map((val, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700 font-medium">
                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-black shrink-0"></div>
                                                        <span className="leading-snug">{val}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Team Capacity & Feasibility */}
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-purple-600 mb-4 flex items-center gap-2">
                                                <Users size={16} /> Team Capacity & Feasibility
                                            </h4>

                                            {/* Feasibility Indicator */}
                                            <div className="p-3 bg-white rounded-xl border border-gray-100">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-gray-500 uppercase">Feasibility</span>
                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${archiveData.feasibility === 'Easy' ? 'bg-green-100 text-green-700' :
                                                        archiveData.feasibility === 'Moderate' ? 'bg-amber-100 text-amber-700' :
                                                            archiveData.feasibility === 'Complex' ? 'bg-red-100 text-red-700' :
                                                                'bg-gray-100 text-gray-700'
                                                        }`}>{archiveData.feasibility}</span>
                                                </div>
                                                <p className="text-xs text-gray-500">{archiveData.feasibilityReason}</p>
                                            </div>

                                            {/* Suggested Team Profiles */}
                                            <div className="p-3 bg-white rounded-xl border border-gray-100">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Briefcase size={14} className="text-gray-400" />
                                                    <span className="text-xs font-semibold text-gray-500 uppercase">Suggested Profiles</span>
                                                </div>
                                                {archiveData.suggestedProfiles.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {archiveData.suggestedProfiles.map((profile: string, i: number) => (
                                                            <span key={i} className="bg-purple-50 text-purple-700 text-xs font-medium px-2 py-1 rounded-full border border-purple-200">
                                                                {profile}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400 italic">AI analysis pending...</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metadata Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase"><Calendar size={14} /> Created</div>
                                    <div className="text-lg font-bold text-gray-900">{archiveData.createdDisplay}</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase"><Clock size={14} /> Last Update</div>
                                    <div className="text-lg font-bold text-gray-900">{archiveData.lastUpdateDisplay}</div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN (1/3) */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm h-full flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider"><Users size={16} /> Contributors</div>
                                    <span className="bg-black text-white text-xs font-bold px-2 py-1 rounded-md">{archiveData.collaborators.length}</span>
                                </div>
                                <div className="space-y-4 flex-1">
                                    {archiveData.collaborators.map((member, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group cursor-default border border-transparent hover:border-gray-100">
                                            {member.isUrl ? (
                                                <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${member.color}`}>{member.avatar}</div>
                                            )}
                                            <div className="flex-1 min-w-0"><div className="font-semibold text-gray-900 truncate">{member.name}</div><div className="flex items-center gap-1 text-xs text-gray-500 truncate"><Briefcase size={10} />{member.role}</div></div>
                                            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- EVOLUTION VIEW (GRAPH) ---
                    <div className="flex flex-col gap-6 animate-in zoom-in-95 duration-500">
                        <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200 h-[500px] relative overflow-hidden shadow-inner">
                            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94A3B8 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
                            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                                <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="20" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#94A3B8" /></marker></defs>
                                {visibleCollaborators.map((collab) => (
                                    <path key={collab.id} d={`M${collab.x}%,${collab.y}% Q50%,${collab.y > 50 ? '60%' : '40%'} 50%,50%`} fill="none" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrowhead)" className="animate-in fade-in duration-700" />
                                ))}
                            </svg>
                            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center transition-all duration-500" style={{ scale: timelineProgress > 10 ? '1' : '0.5', opacity: timelineProgress > 5 ? 1 : 0 }}>
                                <div className="w-20 h-20 bg-gray-400 text-white rounded-full flex items-center justify-center shadow-2xl ring-8 ring-white"><Orbit size={32} className="animate-pulse" /></div>
                                <div className="mt-3 bg-white px-3 py-1.5 rounded-lg shadow-sm text-center border border-gray-200"><h3 className="font-bold text-sm text-gray-900">Archived Concept</h3></div>
                            </div>
                            {visibleCollaborators.map((collab) => (
                                <div key={collab.id} onClick={() => setSelectedArchiveNode(collab)} className="absolute z-10 flex flex-col items-center group cursor-pointer hover:scale-105 transition-all duration-300" style={{ left: `${collab.x}%`, top: `${collab.y}%`, transform: 'translate(-50%, -50%)' }}>
                                    <div className={`bg-white p-3 rounded-xl shadow-md border border-gray-100 w-48 mb-2 relative animate-in slide-in-from-bottom-2 duration-500 ${selectedArchiveNode?.id === collab.id ? 'border-gray-400 ring-1 ring-gray-400' : ''}`}>
                                        <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-bold text-gray-400 uppercase">{collab.date}</span><div className={`w-2 h-2 rounded-full ${collab.color.split(' ')[0]}`}></div></div>
                                        <p className="text-xs font-medium text-gray-800 italic">"{collab.idea}"</p>
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border-2 border-white overflow-hidden ${collab.isUrl ? 'bg-white' : collab.color}`}>
                                        {collab.isUrl ? (
                                            <img src={collab.avatar} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            collab.avatar
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-6 shadow-sm">
                            <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 rounded-full bg-gray-600 text-white flex items-center justify-center hover:bg-gray-700 transition-colors shrink-0">{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}</button>
                            <div className="flex-1"><div className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2"><span>Project Kickoff</span><span>Archived</span></div><div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; setTimelineProgress((x / rect.width) * 100); }}><div className="h-full bg-gray-500 rounded-full transition-all duration-100 ease-linear relative" style={{ width: `${timelineProgress}%` }}><div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-500 rounded-full shadow-sm"></div></div></div></div>
                            <button onClick={() => { setTimelineProgress(0); setIsPlaying(true); }} className="p-2 text-gray-400 hover:text-gray-700 transition-colors"><RefreshCw size={18} /></button>
                        </div>
                    </div>
                )}

                {/* BOTTOM ACTIONS (IN-FLOW) */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <button
                        onClick={handleUnarchive}
                        disabled={unarchiveMutation.isPending}
                        className="px-6 py-3 rounded-xl font-medium text-gray-500 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <ArchiveRestore size={18} />
                        {unarchiveMutation.isPending ? 'Restoring...' : 'Restore to Review'}
                    </button>
                    <button className="px-6 py-3 rounded-xl font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2">
                        <Users size={18} />
                        Share with Group
                    </button>
                </div>

            </div>

            {/* DETAIL PANEL (EVOLUTION) */}
            <div className={`fixed top-0 right-0 bottom-0 w-[400px] bg-white border-l border-gray-200 shadow-2xl z-50 transition-transform duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] flex flex-col ${selectedArchiveNode ? 'translate-x-0' : 'translate-x-full'}`}>
                {selectedArchiveNode && (
                    <>
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                            <h3 className="font-bold text-lg text-gray-900">Contribution Details</h3>
                            <button onClick={() => setSelectedArchiveNode(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-8">
                            {/* User Profile */}
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg overflow-hidden shadow-sm border border-gray-100 ${selectedArchiveNode.isUrl ? 'bg-white' : selectedArchiveNode.color}`}>
                                    {selectedArchiveNode.isUrl ? (
                                        <img src={selectedArchiveNode.avatar} alt={selectedArchiveNode.name} className="w-full h-full object-cover" />
                                    ) : (
                                        selectedArchiveNode.avatar
                                    )}
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 leading-tight">{selectedArchiveNode.name}</h4>
                                    <p className="text-sm text-gray-500 font-medium">{selectedArchiveNode.role}</p>
                                </div>
                            </div>

                            {/* Idea Content */}
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
                                    Original Contribution
                                </label>
                                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-gray-800 text-base leading-relaxed font-medium relative group hover:bg-gray-100 transition-colors">
                                    <Quote size={16} className="text-gray-300 absolute top-4 right-4 opacity-50" />
                                    {selectedArchiveNode.fullIdea || selectedArchiveNode.idea}
                                </div>
                            </div>

                            {/* Metadata Grid */}
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Submitted</div>
                                        <div className="text-sm font-semibold text-gray-900">{selectedArchiveNode.date}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                                    <div className="p-2 bg-gray-100 text-gray-600 rounded-lg shrink-0">
                                        <Archive size={18} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</div>
                                        <div className="text-sm font-semibold text-gray-900">Archived</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 space-y-3">
                            <button
                                onClick={handleUnarchive}
                                disabled={unarchiveMutation.isPending}
                                className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <ArchiveRestore size={18} />
                                {unarchiveMutation.isPending ? 'Restoring...' : 'Restore to Review'}
                            </button>
                            <button className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center justify-center gap-2"><Ban size={18} /> Delete Permanently</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
