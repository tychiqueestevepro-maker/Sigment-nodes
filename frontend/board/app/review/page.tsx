'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
    ShieldAlert,
    Coins,
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
    Rocket,
    X,
    Ban
} from 'lucide-react';
import { api } from '@/lib/api';

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
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ReviewPage() {
    const [selectedReview, setSelectedReview] = useState<any>(null);
    const [viewMode, setViewMode] = useState('report');
    const [timelineProgress, setTimelineProgress] = useState(100);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedReviewNode, setSelectedReviewNode] = useState<any>(null);

    // Fetch review notes from API
    const { data: reviewsList = [], isLoading } = useQuery<any[]>({
        queryKey: ['review-notes'],
        queryFn: async () => {
            const response = await fetch(`${api.baseURL}/board/review-notes`);
            if (!response.ok) throw new Error('Failed to fetch review notes');
            const data = await response.json();
            // Add color based on category
            return data.map((note: any) => ({
                ...note,
                color: getColorForCategory(note.category),
                date: formatDate(note.date),
            }));
        },
    });

    // Compute review data from selected review (real data instead of mock)
    const reviewData = useMemo(() => {
        if (!selectedReview) {
            return {
                title: "No Review Selected",
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

        // Use real data from the selected review
        const relevanceScore = selectedReview.relevance_score || 0;

        return {
            title: selectedReview.title,
            category: selectedReview.category,
            description: selectedReview.content || "No description available.",
            relevance: Math.round(relevanceScore),
            lastReview: formatDate(selectedReview.date),
            createdDate: formatDate(selectedReview.date),

            impactMetrics: [
                {
                    label: "Relevance Score",
                    value: `${Math.round(relevanceScore)}%`,
                    trend: relevanceScore > 70 ? "up" : "down",
                    color: "text-black",
                    bg: "bg-white",
                    desc: "AI-calculated relevance"
                },
                {
                    label: "Strategic Value",
                    value: relevanceScore > 80 ? "High" : relevanceScore > 50 ? "Medium" : "Low",
                    trend: "up",
                    color: "text-black",
                    bg: "bg-white",
                    desc: "Business alignment"
                },
                {
                    label: "Review Status",
                    value: "Pending",
                    trend: "up",
                    color: "text-black",
                    bg: "bg-white",
                    desc: "Awaiting decision"
                },
            ],

            businessValue: [
                `Part of ${selectedReview.category} strategic initiative`,
                selectedReview.cluster_title ? `Belongs to cluster: ${selectedReview.cluster_title}` : "Standalone insight",
                `Submitted by: ${selectedReview.author}`,
            ],

            riskLevel: relevanceScore > 70 ? "Low" : "Medium",
            riskDesc: relevanceScore > 70 ? "High relevance score indicates strong strategic alignment" : "Review needed to validate alignment with strategic goals",
            costEstimation: "To be determined",

            // Mock collaborators for now - we'll enhance this later
            collaborators: [
                {
                    id: 1,
                    name: selectedReview.author,
                    role: "Contributor",
                    avatar: selectedReview.author.substring(0, 2).toUpperCase(),
                    color: "bg-blue-100 text-blue-700",
                    idea: selectedReview.title.substring(0, 50),
                    date: formatDate(selectedReview.date),
                    x: 50,
                    y: 50
                }
            ]
        };
    }, [selectedReview]);

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
        if (timelineProgress === 100) return reviewData.collaborators;
        const threshold = Math.floor((timelineProgress / 100) * reviewData.collaborators.length);
        return reviewData.collaborators.slice(0, threshold + 1);
    }, [timelineProgress, reviewData.collaborators]);

    if (!selectedReview) {
        return (
            <div className="h-full w-full bg-white p-8 animate-in fade-in duration-500">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Review Queue</h1>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                    </div>
                ) : reviewsList.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center p-4 bg-gray-50 rounded-full mb-4">
                            <CheckCircle2 size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No notes in review</h3>
                        <p className="text-gray-500">Notes marked for review will appear here.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {reviewsList.map(review => (
                            <div key={review.id} onClick={() => setSelectedReview(review)} className="p-6 rounded-2xl border border-gray-100 hover:border-black hover:shadow-md cursor-pointer transition-all bg-gray-50 hover:bg-white group">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full mb-2 inline-block ${review.color}`}>{review.category}</span>
                                        <h3 className="text-xl font-bold text-gray-900">{review.title}</h3>
                                        <p className="text-sm text-gray-500 mt-1">Submitted by {review.author} • {review.date}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-200 group-hover:bg-black group-hover:text-white transition-colors">
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
                                {reviewData.category}
                            </span>
                            <span className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded-full">
                                <CheckCircle2 size={12} /> Ready for Review
                            </span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                            {reviewData.title}
                        </h1>
                        <p className="text-lg text-gray-500 max-w-2xl">
                            Strategic Assessment & Validation
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
                        <button onClick={() => setSelectedReview(null)} className="ml-2 flex items-center gap-2 text-gray-600 hover:text-black bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all group">
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
                                <p className="text-gray-800 leading-relaxed text-lg font-medium">{reviewData.description}</p>
                            </div>

                            {/* --- IMPACT BLOCK --- */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-0 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider">
                                        Strategic Impact Analysis
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
                                        <span className="text-xs font-medium text-gray-500">Confidence Score:</span>
                                        <span className="text-sm font-bold text-black">85%</span>
                                    </div>
                                </div>

                                <div className="p-6">
                                    {/* KPIs Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                        {reviewData.impactMetrics.map((metric, i) => (
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
                                                {reviewData.businessValue.map((val, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700 font-medium">
                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-black shrink-0"></div>
                                                        <span className="leading-snug">{val}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Risk & Cost Analysis */}
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-orange-600 mb-4 flex items-center gap-2">
                                                <ShieldAlert size={16} /> Risk & Feasibility
                                            </h4>

                                            <div className="p-3 bg-white rounded-xl border border-gray-100">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-gray-500 uppercase">Risk Level</span>
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">{reviewData.riskLevel}</span>
                                                </div>
                                                <p className="text-xs text-gray-500">{reviewData.riskDesc}</p>
                                            </div>

                                            <div className="p-3 bg-white rounded-xl border border-gray-100">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                                                        <Coins size={16} /> Estimated Cost
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-900">{reviewData.costEstimation}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metadata Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase"><Calendar size={14} /> Created</div>
                                    <div className="text-lg font-bold text-gray-900">{reviewData.createdDate}</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase"><Clock size={14} /> Last Update</div>
                                    <div className="text-lg font-bold text-gray-900">{reviewData.lastReview}</div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN (1/3) */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm h-full flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider"><Users size={16} /> Contributors</div>
                                    <span className="bg-black text-white text-xs font-bold px-2 py-1 rounded-md">{reviewData.collaborators.length}</span>
                                </div>
                                <div className="space-y-4 flex-1">
                                    {reviewData.collaborators.map((member, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group cursor-default border border-transparent hover:border-gray-100">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${member.color}`}>{member.avatar}</div>
                                            <div className="flex-1 min-w-0"><div className="font-semibold text-gray-900 truncate">{member.name}</div><div className="flex items-center gap-1 text-xs text-gray-500 truncate"><Briefcase size={10} />{member.role}</div></div>
                                            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600" />
                                        </div>
                                    ))}
                                </div>
                                <button className="mt-6 w-full py-2 border border-dashed border-gray-300 text-gray-400 rounded-xl text-sm font-medium hover:text-gray-900 hover:border-gray-400 transition-colors flex items-center justify-center gap-2">
                                    <Users size={16} /> Add Contributor
                                </button>
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
                                <div className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center shadow-2xl ring-8 ring-white"><Orbit size={32} className="animate-pulse" /></div>
                                <div className="mt-3 bg-white px-3 py-1.5 rounded-lg shadow-sm text-center border border-gray-200"><h3 className="font-bold text-sm text-gray-900">Global Concept</h3></div>
                            </div>
                            {visibleCollaborators.map((collab) => (
                                <div key={collab.id} onClick={() => setSelectedReviewNode(collab)} className="absolute z-10 flex flex-col items-center group cursor-pointer hover:scale-105 transition-all duration-300" style={{ left: `${collab.x}%`, top: `${collab.y}%`, transform: 'translate(-50%, -50%)' }}>
                                    <div className={`bg-white p-3 rounded-xl shadow-md border border-gray-100 w-48 mb-2 relative animate-in slide-in-from-bottom-2 duration-500 ${selectedReviewNode?.id === collab.id ? 'border-black ring-1 ring-black' : ''}`}>
                                        <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-bold text-gray-400 uppercase">{collab.date}</span><div className={`w-2 h-2 rounded-full ${collab.color.split(' ')[0]}`}></div></div>
                                        <p className="text-xs font-medium text-gray-800 italic">"{collab.idea}"</p>
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border-2 border-white ${collab.color}`}>{collab.avatar}</div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-6 shadow-sm">
                            <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0">{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}</button>
                            <div className="flex-1"><div className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2"><span>Project Kickoff</span><span>Consolidation</span></div><div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; setTimelineProgress((x / rect.width) * 100); }}><div className="h-full bg-black rounded-full transition-all duration-100 ease-linear relative" style={{ width: `${timelineProgress}%` }}><div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-black rounded-full shadow-sm"></div></div></div></div>
                            <button onClick={() => { setTimelineProgress(0); setIsPlaying(true); }} className="p-2 text-gray-400 hover:text-black transition-colors"><RefreshCw size={18} /></button>
                        </div>
                    </div>
                )}

                {/* BOTTOM ACTIONS (IN-FLOW) */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <button className="px-6 py-3 rounded-xl font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2">
                        <Archive size={18} />
                        Archived
                    </button>
                    <button className="px-6 py-3 rounded-xl font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2">
                        <Users size={18} />
                        Share with Group
                    </button>
                    <button className="px-8 py-3 rounded-xl font-bold text-white bg-black hover:bg-gray-800 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2">
                        <Rocket size={18} />
                        Launch Implementation
                    </button>
                </div>

            </div>

            {/* DETAIL PANEL (EVOLUTION) */}
            <div className={`fixed top-0 right-0 bottom-0 w-[400px] bg-white border-l border-gray-200 shadow-2xl z-50 transition-transform duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] flex flex-col ${selectedReviewNode ? 'translate-x-0' : 'translate-x-full'}`}>
                {selectedReviewNode && (
                    <>
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900">Contribution Details</h3>
                            <button onClick={() => setSelectedReviewNode(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20} /></button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl ${selectedReviewNode.color}`}>{selectedReviewNode.avatar}</div>
                                <div><h4 className="text-xl font-bold text-gray-900">{selectedReviewNode.name}</h4><p className="text-sm text-gray-500">{selectedReviewNode.role}</p></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Original Idea</label><div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-800 font-medium">"{selectedReviewNode.idea}"</div></div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Timeline</label><div className="flex items-center gap-2 text-gray-700"><Calendar size={16} /> Submitted on {selectedReviewNode.date}, 2024</div></div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Status</label><div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 px-3 py-2 rounded-lg inline-block"><CheckCircle2 size={16} /> Merged</div></div>
                        </div>
                        <div className="p-6 border-t border-gray-100 space-y-3">
                            <button className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800">View Full Thread</button>
                            <button className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center justify-center gap-2"><Ban size={18} /> Refused</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
