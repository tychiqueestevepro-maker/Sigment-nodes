'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Orbit,
    ArrowLeft,
    ZoomIn,
    ZoomOut,
    Maximize,
    X,
    Info,
    Clock,
    Calendar,
    Zap,
    Users,
    TrendingUp,
    FileText,
    Ban,
    Folder,
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useApiClient } from '../../../../../shared/hooks/useApiClient';
import toast from 'react-hot-toast';

// --- Types ---

interface Pillar {
    id: string;
    name: string;
    description: string;
    color?: string;
}

interface Cluster {
    id: string;
    title: string;
    pillar: string;
    pillar_id: string;
    impact_score: number;
    volume: number;
    last_updated: string;
    created_at: string;
    description?: string;
    note_ids?: string[]; // IDs of notes in this cluster
    pillar_color?: string;
}

interface Bubble {
    id: string;
    title: string;
    nodes: string;
    nodeCount: number;
    color: string;
    hex: string;
    size: string;
    position: string;
    zIndex: string;
    description: string;
}

interface Node {
    id: string;
    clusterId: string;
    title: string;
    description: string;
    x: number;
    y: number;
    delay: number;
    sizePx: number;
    reviewDate: string;
    impact: string;
    relevance: number;
    createdDate: string;
    collaborators: number;
    noteIds: string[]; // IDs of notes in this cluster
}

// --- Helper Functions ---

function getColorForPillar(pillarName: string): { bg: string; hex: string } {
    // Define a set of distinct colors
    const colorPalette = [
        { bg: 'bg-[#F06292]', hex: '#F06292' }, // Pink
        { bg: 'bg-[#FFB74D]', hex: '#FFB74D' }, // Orange
        { bg: 'bg-[#4DB6AC]', hex: '#4DB6AC' }, // Teal
        { bg: 'bg-[#9575CD]', hex: '#9575CD' }, // Purple
        { bg: 'bg-[#64B5F6]', hex: '#64B5F6' }, // Blue
        { bg: 'bg-[#81C784]', hex: '#81C784' }, // Green
        { bg: 'bg-[#E57373]', hex: '#E57373' }, // Red
        { bg: 'bg-[#FFF176]', hex: '#FFF176' }, // Yellow
    ];

    // Normalize pillar name for matching (lowercase, no special chars)
    const normalized = pillarName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Map common pillar names to specific colors
    if (normalized.includes('customer') || normalized.includes('experience')) return colorPalette[0]; // Pink
    if (normalized.includes('operation')) return colorPalette[1]; // Orange
    if (normalized.includes('esg') || normalized.includes('environmental')) return colorPalette[2]; // Teal
    if (normalized.includes('innovation') || normalized.includes('strategy')) return colorPalette[3]; // Purple
    if (normalized.includes('culture') || normalized.includes('workplace') || normalized.includes('hr')) return colorPalette[4]; // Blue
    if (normalized.includes('tech') || normalized.includes('digital')) return colorPalette[5]; // Green
    if (normalized.includes('risk') || normalized.includes('compliance')) return colorPalette[6]; // Red

    // Fallback: use hash-based color selection to ensure consistency
    const hash = Array.from(pillarName).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colorPalette[hash % colorPalette.length];
}

function getPositionForIndex(index: number): { position: string; zIndex: string } {
    const positions = [
        { position: "top-10 left-[10%]", zIndex: "z-10" },
        { position: "top-5 left-[55%]", zIndex: "z-20" },
        { position: "top-[25%] left-[30%]", zIndex: "z-30" },
        { position: "top-[55%] left-[15%]", zIndex: "z-40" },
        { position: "top-[60%] left-[60%]", zIndex: "z-20" },
        { position: "top-[40%] left-[80%]", zIndex: "z-10" }, // Extra positions if needed
    ];
    return positions[index % positions.length];
}

function getSizeForCount(count: number): string {
    if (count > 30) return "w-80 h-80";
    if (count > 20) return "w-72 h-72";
    if (count > 10) return "w-64 h-64";
    return "w-48 h-48";
}

// --- Main Component ---

export default function GalaxyViewPage() {
    const { organizationId } = useOrganization();
    const apiClient = useApiClient();

    const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isProcessing, setIsProcessing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // --- Data Fetching ---

    // Fetch pillars
    const { data: pillars = [] } = useQuery<Pillar[]>({
        queryKey: ['pillars', organizationId],
        queryFn: async () => {
            return await apiClient.get<Pillar[]>('/board/pillars');
        },
        enabled: !!organizationId,
    });

    // Fetch galaxy data (clusters)
    const { data: clusters = [] } = useQuery<Cluster[]>({
        queryKey: ['galaxy', organizationId],
        queryFn: async () => {
            return await apiClient.get<Cluster[]>('/board/galaxy');
        },
        enabled: !!organizationId,
    });

    // --- Data Transformation ---

    const bubbles: Bubble[] = useMemo(() => {
        return pillars.map((pillar, index) => {
            const pillarClusters = clusters.filter(c => c.pillar_id === pillar.id);
            const count = pillarClusters.length;

            // Use DB color if available, else fallback
            let hexColor = pillar.color;
            if (!hexColor) {
                const fallback = getColorForPillar(pillar.name);
                hexColor = fallback.hex;
            }

            const pos = getPositionForIndex(index);

            return {
                id: pillar.id,
                title: pillar.name,
                nodes: `${count} Nodes`,
                nodeCount: count,
                color: '', // Deprecated, using hex in style
                hex: hexColor,
                size: getSizeForCount(count),
                position: pos.position,
                zIndex: pos.zIndex,
                description: pillar.description,
            };
        });
    }, [pillars, clusters]);

    const solarSystemData = useMemo(() => {
        if (!selectedBubble) return { nodes: [], orbits: [] };

        const pillarClusters = clusters.filter(c => c.pillar_id === selectedBubble.id);
        const nodes: Node[] = [];
        const totalNodes = pillarClusters.length;
        const orbits: number[] = [];

        const firstOrbitRadius = 150;
        const orbitGap = 110;

        let nodesPlaced = 0;
        let orbitIndex = 0;

        while (nodesPlaced < totalNodes) {
            const currentRadius = firstOrbitRadius + (orbitIndex * orbitGap);
            const maxNodesOnThisOrbit = 3 * (orbitIndex + 1);
            const nodesForThisOrbit = Math.min(totalNodes - nodesPlaced, maxNodesOnThisOrbit);

            if (nodesForThisOrbit > 0) {
                orbits.push(currentRadius);
                const angleStep = (2 * Math.PI) / nodesForThisOrbit;
                const angleOffset = orbitIndex % 2 === 0 ? -Math.PI / 2 : 0;

                for (let i = 0; i < nodesForThisOrbit; i++) {
                    const cluster = pillarClusters[nodesPlaced + i];
                    const angle = (i * angleStep) + angleOffset;

                    // Mock data for missing fields
                    const collaborators = Math.floor(Math.random() * 6) + 2;
                    const reviewDate = new Date(cluster.last_updated).toLocaleDateString();
                    const createdDate = cluster.created_at ? new Date(cluster.created_at).toLocaleDateString() : 'Unknown';

                    nodes.push({
                        id: String(nodesPlaced + i),
                        clusterId: cluster.id,
                        title: cluster.title,
                        description: cluster.description || "No description available.",
                        x: Math.cos(angle) * currentRadius,
                        y: Math.sin(angle) * currentRadius,
                        delay: (orbitIndex * 0.15) + (i * 0.03),
                        sizePx: 48,
                        reviewDate: reviewDate,
                        impact: cluster.impact_score > 75 ? "High" : cluster.impact_score > 50 ? "Medium" : "Low",
                        relevance: Math.floor(cluster.impact_score), // Using impact score as relevance for now
                        createdDate: createdDate,
                        collaborators: collaborators,
                        noteIds: cluster.note_ids || [], // Add note IDs for moderation
                    });
                }
                nodesPlaced += nodesForThisOrbit;
                orbitIndex++;
            } else {
                break;
            }
        }
        return { nodes, orbits };
    }, [selectedBubble, clusters]);

    // --- Event Handlers ---

    const handleWheel = (e: React.WheelEvent) => {
        // Allow zoom in both views
        const scaleAdjustment = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.3, transform.scale + scaleAdjustment), 4);
        setTransform(prev => ({ ...prev, scale: newScale }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Allow pan in both views
        setIsDragging(true);
        setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        setTransform(prev => ({ ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
    };

    const handleMouseUp = () => { setIsDragging(false); };

    const resetZoom = () => {
        // Reset based on current view
        const optimalScale = selectedBubble ? (selectedBubble.nodeCount > 20 ? 0.6 : 0.9) : 1;
        setTransform({ x: 0, y: 0, scale: optimalScale });
    };

    const zoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.2, 4) }));
    const zoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.2, 0.3) }));

    const handleBubbleClick = (bubble: Bubble) => {
        setIsAnimating(true);
        setSelectedNode(null);
        setTimeout(() => {
            setSelectedBubble(bubble);
            setIsAnimating(false);
            const startScale = bubble.nodeCount > 20 ? 0.6 : 0.9;
            setTransform({ x: 0, y: 0, scale: startScale });
        }, 300);
    };

    const handleNodeClick = (e: React.MouseEvent, node: Node) => {
        e.stopPropagation();
        setSelectedNode(node);
    };

    const handleTreatedNotes = async () => {
        if (!selectedNode || !selectedNode.noteIds || selectedNode.noteIds.length === 0) {
            toast.error('No notes found in this cluster');
            return;
        }

        setIsProcessing(true);
        try {
            // Update all notes in the cluster to review status (for review zone)
            const updatePromises = selectedNode.noteIds.map(async (noteId) => {
                try {
                    await apiClient.patch(`/notes/${noteId}`, { status: 'review' });
                    return { success: true };
                } catch (error) {
                    return { success: false };
                }
            });

            const results = await Promise.all(updatePromises);
            const failedCount = results.filter(r => !r.success).length;

            if (failedCount > 0) {
                toast.error(`❌ ${failedCount} of ${selectedNode.noteIds.length} notes failed to update`);
            } else {
                toast.success(`✅ ${selectedNode.noteIds.length} note(s) marked for review!`);
                setSelectedNode(null);
            }
        } catch (error) {
            console.error('Error updating notes:', error);
            toast.error('❌ Failed to update notes. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRefuseNote = async () => {
        if (!selectedNode || !selectedNode.noteIds || selectedNode.noteIds.length === 0) {
            toast.error('No notes found in this cluster');
            return;
        }

        if (!confirm(`Are you sure you want to refuse ${selectedNode.noteIds.length} note(s)? This action will remove them from the cluster.`)) {
            return;
        }

        setIsProcessing(true);
        try {
            // Update all notes in the cluster to refused status
            const updatePromises = selectedNode.noteIds.map(async (noteId) => {
                try {
                    await apiClient.patch(`/notes/${noteId}`, { status: 'refused' });
                    return { success: true };
                } catch (error) {
                    return { success: false };
                }
            });

            const results = await Promise.all(updatePromises);
            const failedCount = results.filter(r => !r.success).length;

            if (failedCount > 0) {
                toast.error(`❌ ${failedCount} of ${selectedNode.noteIds.length} notes failed to refuse`);
            } else {
                toast.success(`🗑️ ${selectedNode.noteIds.length} note(s) refused and removed from the cluster.`);
                setSelectedNode(null);
            }
        } catch (error) {
            console.error('Error refusing notes:', error);
            toast.error('❌ Failed to refuse notes. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Render ---

    if (selectedBubble) {
        return (
            <div className="h-full w-full bg-white relative overflow-hidden flex">
                <style>{`@keyframes simplePop { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }`}</style>

                <div className="relative flex-1 h-full flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="absolute top-6 right-6 z-50 flex items-center gap-4 pointer-events-none">
                        <h1 className="pointer-events-auto text-2xl font-extrabold text-gray-900 uppercase tracking-tighter">
                            {selectedBubble.title}
                        </h1>
                        <button
                            onClick={() => { setSelectedBubble(null); setSelectedNode(null); }}
                            className="pointer-events-auto flex items-center gap-2 text-gray-600 hover:text-black bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all group"
                        >
                            <span className="font-medium text-sm">Back</span>
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform rotate-180" />
                        </button>
                    </div>

                    {/* Controls */}
                    <div className="absolute bottom-8 right-8 z-50 flex flex-col gap-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2">
                        <button onClick={zoomIn} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><ZoomIn size={20} /></button>
                        <button onClick={zoomOut} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><ZoomOut size={20} /></button>
                        <div className="h-px bg-gray-200 my-1"></div>
                        <button onClick={resetZoom} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><Maximize size={20} /></button>
                    </div>

                    {/* Canvas */}
                    <div
                        ref={containerRef}
                        className={`w-full h-full cursor-${isDragging ? 'grabbing' : 'grab'} touch-none`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                    >
                        <div
                            className="w-full h-full flex items-center justify-center origin-center transition-transform duration-75 ease-out"
                            style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
                        >
                            <div className="relative flex items-center justify-center">
                                {/* Orbits */}
                                {solarSystemData.orbits.map((radius, i) => (
                                    <div
                                        key={`orbit-${i}`}
                                        className="absolute rounded-full border border-gray-200 pointer-events-none"
                                        style={{
                                            width: radius * 2,
                                            height: radius * 2,
                                            zIndex: 0,
                                            left: '50%',
                                            top: '50%',
                                            marginLeft: -radius,
                                            marginTop: -radius
                                        }}
                                    />
                                ))}

                                {/* Core */}
                                <div
                                    className="absolute z-20 rounded-full flex flex-col items-center justify-center text-white shadow-2xl"
                                    style={{
                                        width: '130px',
                                        height: '130px',
                                        left: '50%',
                                        top: '50%',
                                        marginLeft: '-65px',
                                        marginTop: '-65px',
                                        backgroundColor: selectedBubble.hex
                                    }}
                                >
                                    <Orbit size={32} className="opacity-80 mb-1" />
                                    <span className="font-bold text-xs tracking-widest">CORE</span>
                                </div>

                                {/* Nodes */}
                                {solarSystemData.nodes.map((node) => (
                                    <div
                                        key={node.id}
                                        className="absolute z-30"
                                        style={{
                                            left: '50%',
                                            top: '50%',
                                            transform: `translate(${node.x}px, ${node.y}px)`,
                                            width: 0,
                                            height: 0
                                        }}
                                    >
                                        <button
                                            onClick={(e) => handleNodeClick(e, node)}
                                            className={`absolute -top-6 -left-6 rounded-full shadow-lg border-2 border-white cursor-pointer flex items-center justify-center hover:scale-125 hover:border-gray-800 hover:shadow-xl transition-transform duration-200 ${selectedNode?.id === node.id ? 'ring-4 ring-black ring-offset-2 scale-125' : ''
                                                }`}
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                backgroundColor: selectedBubble.hex,
                                                animation: `simplePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                                                animationDelay: `${node.delay}s`,
                                                opacity: 0
                                            }}
                                        ></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-8 left-8 text-gray-400 text-xs select-none">
                        Scroll to zoom • Drag to move • Click a node for details
                    </div>
                </div>

                {/* Detail Panel */}
                <div
                    className={`h-full bg-white border-l border-gray-200 shadow-2xl z-40 transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] flex flex-col ${selectedNode ? 'w-[400px] translate-x-0 opacity-100' : 'w-0 translate-x-full opacity-0 overflow-hidden'
                        }`}
                >
                    {selectedNode && (
                        <>
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedBubble.hex }}></div>
                                    <h3 className="font-bold text-lg text-gray-900">Node Details</h3>
                                </div>
                                <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="flex items-start gap-4">
                                    <div
                                        className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-md text-lg font-bold shrink-0 mt-1"
                                        style={{ backgroundColor: selectedBubble.hex }}
                                    >
                                        {Number(selectedNode.id) + 1}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 leading-tight mb-1">{selectedNode.title}</h2>
                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            {selectedBubble.title}
                                        </div>
                                    </div>
                                </div>
                                <hr className="border-gray-100" />
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        <Info size={14} />Strategic Brief
                                    </div>
                                    <p className="text-sm text-gray-600 leading-relaxed">{selectedNode.description}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            <Clock size={14} />Last Review
                                        </div>
                                        <div className="text-sm font-medium text-gray-900 border-b border-gray-100 pb-1">
                                            {selectedNode.reviewDate}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            <Calendar size={14} />Created Date
                                        </div>
                                        <div className="text-sm font-medium text-gray-900">{selectedNode.createdDate}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            <Zap size={14} />Potential Impact
                                        </div>
                                        <div className="text-sm font-bold text-gray-900">{selectedNode.impact}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            <Users size={14} />Collaborators
                                        </div>
                                        <div className="flex items-center -space-x-2 overflow-hidden pt-1">
                                            {[...Array(Math.min(selectedNode.collaborators, 4))].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500"
                                                >
                                                    {String.fromCharCode(65 + i)}
                                                </div>
                                            ))}
                                            {selectedNode.collaborators > 4 && (
                                                <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500">
                                                    +{selectedNode.collaborators - 4}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={14} />Relevance Score
                                        </div>
                                        <span className="text-gray-900 font-bold">{selectedNode.relevance}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000 ease-out relative"
                                            style={{ width: `${selectedNode.relevance}%`, backgroundColor: selectedBubble.hex }}
                                        >
                                            <div className="absolute inset-0 bg-white opacity-20 bg-[length:10px_10px] bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)]"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-6 mt-auto space-y-3">
                                    <button
                                        onClick={handleTreatedNotes}
                                        disabled={isProcessing}
                                        className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FileText size={18} /> {isProcessing ? 'Processing...' : 'Treated Notes'}
                                    </button>
                                    <button
                                        onClick={handleRefuseNote}
                                        disabled={isProcessing}
                                        className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Ban size={18} /> {isProcessing ? 'Processing...' : 'Refused'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // --- Initial View (Bubble List) ---

    return (
        <div className={`h-full w-full bg-white relative overflow-hidden flex items-center justify-center transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            {/* Background Grid */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#f0f0f0 1px, transparent 1px), linear-gradient(90deg, #f0f0f0 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {/* Decorative background blurs */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-100 rounded-full blur-[100px] opacity-50 mix-blend-multiply animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-[100px] opacity-50 mix-blend-multiply animate-pulse" style={{ animationDelay: '2s' }}></div>

            {/* Zoom Controls */}
            <div className="absolute bottom-8 right-8 z-50 flex flex-col gap-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2">
                <button onClick={zoomIn} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><ZoomIn size={20} /></button>
                <button onClick={zoomOut} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><ZoomOut size={20} /></button>
                <div className="h-px bg-gray-200 my-1"></div>
                <button onClick={resetZoom} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><Maximize size={20} /></button>
            </div>

            <div className="relative w-full h-full max-w-[1400px] mx-auto">
                <h1 className="absolute top-8 left-8 text-4xl font-extrabold text-gray-900 z-50">Galaxy View</h1>

                <div
                    ref={containerRef}
                    className={`w-full h-full cursor-${isDragging ? 'grabbing' : 'grab'} touch-none`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                >
                    <div
                        className="w-full h-full flex items-center justify-center origin-center transition-transform duration-75 ease-out"
                        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
                    >
                        {bubbles.map((bubble) => (
                            <div
                                key={bubble.id}
                                onClick={() => handleBubbleClick(bubble)}
                                className={`absolute rounded-full flex flex-col items-center justify-center text-white cursor-pointer shadow-2xl hover:scale-110 transition-transform duration-500 ease-out group ${bubble.size} ${bubble.position} ${bubble.zIndex}`}
                                style={{ backgroundColor: bubble.hex }}
                            >
                                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                                <Folder size={48} className="mb-2 opacity-90 group-hover:scale-110 transition-transform duration-300" />
                                <h3 className="font-extrabold text-lg text-center leading-tight px-4">{bubble.title}</h3>
                                <span className="text-xs font-medium opacity-80 mt-1">{bubble.nodes}</span>

                                {/* Floating mini-orbit effect */}
                                <div className="absolute w-[120%] h-[120%] border border-current opacity-0 group-hover:opacity-20 rounded-full transition-opacity duration-500 animate-spin-slow pointer-events-none" style={{ animationDuration: '10s' }}></div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="absolute bottom-8 left-8 text-gray-400 text-xs select-none">
                    Scroll to zoom • Drag to move • Click a bubble for details
                </div>
            </div>
        </div>
    );
}
