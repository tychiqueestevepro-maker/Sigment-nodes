'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Link2, Plus, Layers, Loader2, Trash2, ZoomIn, ZoomOut, Maximize, ArrowUpRight, ArrowLeft, Wrench, X, Power, Edit3
} from 'lucide-react';
import { useProject, ProjectTool } from '../ProjectContext'; // Adjust path based on structure
import { useApiClient } from '@/hooks/useApiClient';
import { ToolsLibrary, LibraryApp } from './ToolsLibrary'; // Import the new component
import toast from 'react-hot-toast';

// --- Helper Functions ---
const getLogoUrl = (url: string) => {
    try {
        const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        return `https://logo.clearbit.com/${domain}`;
    } catch (e) {
        return null;
    }
};

// --- Smart Suggestions Logic ---
function getSmartSuggestions(source: ProjectTool, target: ProjectTool): string[] {
    const sCat = source.category || '';
    const tCat = target.category || '';
    const suggestions: string[] = [];

    // Generic defaults
    suggestions.push('Integrates with');

    // Rule-based suggestions
    if (sCat.includes('Engineering') && tCat.includes('Engineering')) {
        suggestions.push('Deploys to', 'Builds', 'Monitors');
    }
    if (sCat.includes('Design') && tCat.includes('Engineering')) {
        suggestions.push('Handoff to', 'Assets for');
    }
    if (sCat.includes('Sales') && tCat.includes('Marketing')) {
        suggestions.push('Syncs leads to', 'Notifies');
    }
    if (sCat.includes('Marketing') && tCat.includes('Sales')) {
        suggestions.push('Sends MQLs to', 'Updates contacts in');
    }
    if (sCat.includes('Data') && tCat.includes('Analytics')) {
        suggestions.push('Streams to', 'ETL to', 'Visualizes data from');
    }

    // Fallback if specific rules don't match well
    if (suggestions.length === 1) {
        suggestions.push('Sends data to', 'Triggers');
    }

    return suggestions.slice(0, 3);
}

export default function ProjectToolsPage() {
    const {
        projectTools,
        isLoadingTools,
        deleteProjectTool,
        connections,
        deleteConnection,
        updateConnection,
        createConnection,
        apiClient,
        project
    } = useProject();

    const projectId = project?.id;

    // Local State
    const [toolsSubTab, setToolsSubTab] = useState<'stack' | 'connexions'>('stack');
    const [showAddToolModal, setShowAddToolModal] = useState(false);

    // Tools Library State (lifted here to pass to component)
    const [libraryApps, setLibraryApps] = useState<LibraryApp[]>([]);
    const [libraryLoading, setLibraryLoading] = useState(false);

    // Canvas State
    const canvasRef = useRef<HTMLDivElement>(null);
    const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isCanvasDragging, setIsCanvasDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

    // Connection Creation State
    const [showConnectionModal, setShowConnectionModal] = useState(false);
    const [connectionSource, setConnectionSource] = useState<ProjectTool | null>(null);
    const [connectionTarget, setConnectionTarget] = useState<ProjectTool | null>(null);
    const [connectionLabel, setConnectionLabel] = useState('');
    const [customLabel, setCustomLabel] = useState('');

    // Selection State
    const [selectedToolNode, setSelectedToolNode] = useState<{ id: string; toolName: string; x: number; y: number; toolData?: ProjectTool } | null>(null);

    // Canvas Visibility State (which tools are shown on the canvas)
    const [toolsOnCanvas, setToolsOnCanvas] = useState<Set<string>>(new Set());

    // Initialize canvas with tools that have connections
    useEffect(() => {
        if (projectTools.length > 0 && connections.length > 0 && toolsOnCanvas.size === 0) {
            // Get all application IDs that are involved in connections
            const connectedAppIds = new Set<string>();
            connections.forEach(conn => {
                connectedAppIds.add(conn.source_tool_id);
                connectedAppIds.add(conn.target_tool_id);
            });

            // Find the corresponding project tool IDs
            const connectedToolIds = projectTools
                .filter(t => t.status === 'active' && connectedAppIds.has(t.application_id))
                .map(t => t.id);

            if (connectedToolIds.length > 0) {
                setToolsOnCanvas(new Set(connectedToolIds));
            }
        }
    }, [projectTools, connections]); // Depend on both projectTools and connections


    // Fetch Library Apps when modal opens
    useEffect(() => {
        if (showAddToolModal && libraryApps.length === 0) {
            setLibraryLoading(true);
            apiClient.get<LibraryApp[]>('/applications/library')
                .then(data => setLibraryApps(data))
                .catch(err => console.error('Failed to load apps:', err))
                .finally(() => setLibraryLoading(false));
        }
    }, [showAddToolModal, libraryApps.length, apiClient]);

    // Initial Node Positions
    useEffect(() => {
        if (projectTools.length > 0 && Object.keys(nodePositions).length === 0) {
            const initialPositions: Record<string, { x: number; y: number }> = {};
            const activeTools = projectTools.filter(t => t.status === 'active');

            // Simple grid layout
            activeTools.forEach((tool, index) => {
                const col = index % 4;
                const row = Math.floor(index / 4);
                initialPositions[tool.id] = {
                    x: 20 + (col * 20),
                    y: 20 + (row * 20)
                };
            });
            setNodePositions(initialPositions);
        }
    }, [projectTools]); // Removed nodePositions from deps to prevent infinite loop

    // --- Computed Graph Data ---
    const graphNodes = useMemo(() => {
        return projectTools
            .filter(t => t.status === 'active' && toolsOnCanvas.has(t.id)) // Only show tools on canvas
            .map(t => ({
                id: t.id,
                applicationId: t.application_id, // Add this for matching connections
                toolName: t.name,
                x: nodePositions[t.id]?.x || 50,
                y: nodePositions[t.id]?.y || 50
            }));
    }, [projectTools, nodePositions, toolsOnCanvas]);

    const graphEdges = useMemo(() => {
        return connections.map(c => ({
            id: c.id,
            source: c.source_tool_id,
            target: c.target_tool_id,
            label: c.label,
            active: c.is_active
        }));
    }, [connections]);

    // --- Canvas Handlers ---
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || e.button === 0) { // Middle or Left click to pan
            setIsCanvasDragging(true);
            setDragStart({ x: e.clientX - canvasTransform.x, y: e.clientY - canvasTransform.y });
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isCanvasDragging) {
            setCanvasTransform(prev => ({
                ...prev,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            }));
        }
    };

    const handleCanvasMouseUp = () => {
        setIsCanvasDragging(false);
    };

    const handleCanvasWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const scaleAmount = -e.deltaY * 0.001;
            setCanvasTransform(prev => ({
                ...prev,
                scale: Math.min(Math.max(0.5, prev.scale + scaleAmount), 3)
            }));
        } else {
            // Pan logic update
            setCanvasTransform(prev => ({
                ...prev,
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    const zoomIn = () => setCanvasTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.2, 3) }));
    const zoomOut = () => setCanvasTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.2, 0.5) }));
    const resetZoom = () => setCanvasTransform({ x: 0, y: 0, scale: 1 });

    const handleNodeDragStart = (e: React.MouseEvent, nodeId: string, initialX: number, initialY: number) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const canvasScale = canvasTransform.scale;

        // Canvas dimensions (fixed in CSS/style as 2000x1500)
        const canvasWidth = 2000;
        const canvasHeight = 1500;

        const handleDragMove = (moveEvent: MouseEvent) => {
            const dx = (moveEvent.clientX - startX) / canvasScale;
            const dy = (moveEvent.clientY - startY) / canvasScale;

            // Convert px delta to percentage delta
            const dxPercent = (dx / canvasWidth) * 100;
            const dyPercent = (dy / canvasHeight) * 100;

            setNodePositions(prev => ({
                ...prev,
                [nodeId]: {
                    x: Math.max(0, Math.min(100, initialX + dxPercent)),
                    y: Math.max(0, Math.min(100, initialY + dyPercent))
                }
            }));
        };

        const handleDragEnd = () => {
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    };

    const handleCreateConnection = async () => {
        if (!connectionSource || !connectionTarget) return;
        const labelToUse = customLabel.trim() || connectionLabel;
        if (!labelToUse) {
            toast.error('Please add a label');
            return;
        }

        // Check if source already has an outgoing connection
        const sourceAppId = connectionSource.application_id || connectionSource.id;
        const targetAppId = connectionTarget.application_id || connectionTarget.id;

        const sourceOutgoing = connections.filter(c => c.source_tool_id === sourceAppId);
        if (sourceOutgoing.length >= 1) {
            toast.error(`${connectionSource.name} already has an outgoing connection. Each tool can only send to one other tool.`);
            return;
        }

        // Check if target already has an incoming connection
        const targetIncoming = connections.filter(c => c.target_tool_id === targetAppId);
        if (targetIncoming.length >= 1) {
            toast.error(`${connectionTarget.name} already has an incoming connection. Each tool can only receive from one other tool.`);
            return;
        }

        // Add both tools to canvas FIRST (before creating connection)
        setToolsOnCanvas(prev => {
            const newSet = new Set(prev);
            newSet.add(connectionSource.id);
            newSet.add(connectionTarget.id);
            return newSet;
        });

        try {
            await createConnection(
                sourceAppId,
                targetAppId,
                labelToUse
            );

            setShowConnectionModal(false);
            setConnectionSource(null);
            setConnectionTarget(null);
            setConnectionLabel('');
            setCustomLabel('');
        } catch (error) {
            // Toast handled in context
        }
    };

    const handleDeleteConnection = async (connectionId: string) => {
        // Find the connection to get source and target IDs
        const conn = connections.find(c => c.id === connectionId);
        if (!conn) return;

        // Delete the connection
        await deleteConnection(connectionId);

        // Check if source or target tools have any remaining connections
        const sourceAppId = conn.source_tool_id;
        const targetAppId = conn.target_tool_id;

        const remainingConnections = connections.filter(c => c.id !== connectionId);

        const sourceHasConnections = remainingConnections.some(
            c => c.source_tool_id === sourceAppId || c.target_tool_id === sourceAppId
        );
        const targetHasConnections = remainingConnections.some(
            c => c.source_tool_id === targetAppId || c.target_tool_id === targetAppId
        );

        // Remove tools from canvas if they have no connections
        setToolsOnCanvas(prev => {
            const newSet = new Set(prev);

            if (!sourceHasConnections) {
                const sourceTool = projectTools.find(t => t.application_id === sourceAppId);
                if (sourceTool) newSet.delete(sourceTool.id);
            }

            if (!targetHasConnections) {
                const targetTool = projectTools.find(t => t.application_id === targetAppId);
                if (targetTool) newSet.delete(targetTool.id);
            }

            return newSet;
        });
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            {/* Sub-Nav & Action Bar */}
            <div className="px-8 py-6 flex justify-between items-center shrink-0 bg-gray-50/80 backdrop-blur-sm z-10 border-b border-gray-100">
                <div>
                    <div className="flex gap-1 bg-gray-200/50 p-1 rounded-lg">
                        <button
                            onClick={() => setToolsSubTab('stack')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${toolsSubTab === 'stack' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Stack
                        </button>
                        <button
                            onClick={() => { setToolsSubTab('connexions'); setSelectedToolNode(null); }}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${toolsSubTab === 'connexions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Link2 size={14} /> Connections
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => toolsSubTab === 'connexions' ? setShowConnectionModal(true) : setShowAddToolModal(true)}
                    className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow transition-all"
                >
                    <Plus size={16} />
                    {toolsSubTab === 'stack' ? 'Add' : 'Connect'}
                </button>
            </div>

            {/* VIEW: STACK */}
            {toolsSubTab === 'stack' && (
                <div className="flex-1 overflow-y-auto px-8 pb-10 pt-6 animate-in slide-in-from-left-4 duration-300">
                    {/* Loading State */}
                    {isLoadingTools && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoadingTools && projectTools.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                <Layers size={32} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No tools yet</h3>
                            <p className="text-gray-500 mb-4 max-w-sm">Start building your project stack by adding the tools your team uses.</p>
                            <button
                                onClick={() => setShowAddToolModal(true)}
                                className="px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
                            >
                                <Plus size={16} />
                                Add your first tool
                            </button>
                        </div>
                    )}

                    {/* Active Tools */}
                    {!isLoadingTools && projectTools.filter(t => t.status === 'active').length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Active ({projectTools.filter(t => t.status === 'active').length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {projectTools.filter(t => t.status === 'active').map(tool => (
                                    <div key={tool.id} className="relative flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group">
                                        <button
                                            onClick={() => deleteProjectTool(tool.id, tool.name)}
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white border border-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all z-10"
                                            title="Remove from project"
                                        >
                                            <Trash2 size={14} />
                                        </button>

                                        <div className="p-4 flex items-start justify-between border-b border-gray-100 bg-gray-50/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden p-2">
                                                    <img
                                                        src={tool.logo_url || getLogoUrl(tool.website) || ''}
                                                        alt={tool.name}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900">{tool.name}</h3>
                                                    <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">{tool.category}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3 flex items-center gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Added by</span>
                                                {tool.addedBy?.avatar_url ? (
                                                    <img src={tool.addedBy.avatar_url} className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white"></div>
                                                )}
                                            </div>
                                            <div className="h-px flex-1 bg-gray-100"></div>
                                            <span className="text-[10px] text-gray-400">{tool.addedAt}</span>
                                        </div>
                                        {tool.note && (
                                            <div className="px-4 pb-3">
                                                <p className="text-sm text-gray-600 italic">"{tool.note}"</p>
                                            </div>
                                        )}
                                        <div className="h-1 w-full bg-green-500"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Planned Tools */}
                    {projectTools.filter(t => t.status === 'planned').length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                Planned ({projectTools.filter(t => t.status === 'planned').length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {projectTools.filter(t => t.status === 'planned').map(tool => (
                                    <div key={tool.id} className="relative flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 opacity-70 hover:opacity-100 group">
                                        <button
                                            onClick={() => deleteProjectTool(tool.id, tool.name)}
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white border border-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all z-10"
                                            title="Remove from project"
                                        >
                                            <Trash2 size={14} />
                                        </button>

                                        <div className="p-4 flex items-start justify-between border-b border-gray-100 bg-gray-50/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden p-2">
                                                    <img
                                                        src={tool.logo_url || getLogoUrl(tool.website) || ''}
                                                        alt={tool.name}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900">{tool.name}</h3>
                                                    <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">{tool.category}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3 flex items-center gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Added by</span>
                                                {tool.addedBy?.avatar_url ? (
                                                    <img src={tool.addedBy.avatar_url} className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white"></div>
                                                )}
                                            </div>
                                            <div className="h-px flex-1 bg-gray-100"></div>
                                            <span className="text-[10px] text-gray-400">{tool.addedAt}</span>
                                        </div>
                                        {tool.note && (
                                            <div className="px-4 pb-3">
                                                <p className="text-sm text-gray-600 italic">"{tool.note}"</p>
                                            </div>
                                        )}
                                        <div className="h-1 w-full bg-amber-400"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW: CONNEXIONS (Interactive Canvas) */}
            {toolsSubTab === 'connexions' && (
                <div className="flex-1 relative bg-slate-50 overflow-hidden animate-in fade-in duration-300">
                    {/* Background Pattern */}
                    <div
                        className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                    ></div>

                    {/* Canvas viewport */}
                    <div
                        ref={canvasRef}
                        className={`absolute inset-0 overflow-hidden ${isCanvasDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onWheel={handleCanvasWheel}
                    >
                        {/* Inner canvas */}
                        <div
                            className="relative transition-transform duration-75 ease-out"
                            style={{
                                width: '2000px',
                                height: '1500px',
                                transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
                                transformOrigin: '0 0'
                            }}
                        >
                            {/* SVG Layer for Edges */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                                {graphEdges.map((edge) => {
                                    const startNode = graphNodes.find(n => n.applicationId === edge.source);
                                    const endNode = graphNodes.find(n => n.applicationId === edge.target);
                                    if (!startNode || !endNode) return null;

                                    const x1 = `${startNode.x}%`;
                                    const y1 = `${startNode.y}%`;
                                    const x2 = `${endNode.x}%`;
                                    const y2 = `${endNode.y}%`;
                                    const midX = (startNode.x + endNode.x) / 2;
                                    const midY = (startNode.y + endNode.y) / 2;

                                    return (
                                        <g key={edge.id}>
                                            <line
                                                x1={x1} y1={y1}
                                                x2={x2} y2={y2}
                                                stroke={edge.active ? "#22c55e" : "#cbd5e1"}
                                                strokeWidth="2"
                                                strokeDasharray={edge.active ? "0" : "5,5"}
                                                className={edge.active ? "animate-pulse" : ""}
                                            />
                                            <foreignObject x={`${midX - 5}%`} y={`${midY - 2}%`} width="10%" height="24">
                                                <div className={`text-[10px] text-center px-2 py-0.5 rounded-full border shadow-sm mx-auto w-fit truncate ${edge.active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                                                    }`}>
                                                    {edge.label}
                                                </div>
                                            </foreignObject>
                                        </g>
                                    );
                                })}
                            </svg>

                            {/* Nodes Layer */}
                            <div className="absolute inset-0 z-10">
                                {graphNodes.map((node) => {
                                    const tool = projectTools.find(t => t.name === node.toolName);
                                    const isSelected = selectedToolNode?.id === node.id;

                                    return (
                                        <div
                                            key={node.id}
                                            className={`absolute w-20 h-20 -ml-10 -mt-10 rounded-2xl bg-white border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-sm hover:scale-110 group ${isSelected ? 'border-blue-500 shadow-blue-200 shadow-lg scale-110' : 'border-gray-200 hover:border-blue-300'
                                                }`}
                                            style={{ left: `${node.x}%`, top: `${node.y}%` }}
                                        >
                                            {/* Main clickable area */}
                                            <div
                                                onClick={() => setSelectedToolNode({ ...node, toolData: tool })}
                                                className="flex flex-col items-center justify-center w-full h-full"
                                            >
                                                <div className="w-10 h-10 flex items-center justify-center mb-1">
                                                    {tool?.website && (
                                                        <img
                                                            src={tool.logo_url || getLogoUrl(tool.website) || ''}
                                                            alt={node.toolName}
                                                            className="w-full h-full object-contain"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-700 truncate max-w-[90%] px-1">{node.toolName}</span>
                                            </div>



                                            {/* Add connection button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConnectionSource(tool || null);
                                                    setConnectionTarget(null);
                                                    setConnectionLabel('');
                                                    setCustomLabel('');
                                                    setShowConnectionModal(true);
                                                }}
                                                className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg z-20"
                                                title={`Add connection from ${node.toolName}`}
                                            >
                                                <Plus size={14} />
                                            </button>

                                            {/* Remove from canvas button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (tool) {
                                                        // Delete all connections involving this tool
                                                        const toolAppId = tool.application_id;
                                                        const connectionsToDelete = connections.filter(
                                                            c => c.source_tool_id === toolAppId || c.target_tool_id === toolAppId
                                                        );

                                                        // Delete connections
                                                        connectionsToDelete.forEach(conn => {
                                                            deleteConnection(conn.id);
                                                        });

                                                        // Remove from canvas
                                                        setToolsOnCanvas(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete(tool.id);
                                                            return newSet;
                                                        });

                                                        // Close panel if this tool was selected
                                                        if (selectedToolNode?.id === node.id) {
                                                            setSelectedToolNode(null);
                                                        }
                                                    }
                                                }}
                                                className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-red-600 shadow-lg z-20"
                                                title={`Remove ${node.toolName} from canvas`}
                                            >
                                                <X size={12} />
                                            </button>

                                            {/* Drag handle */}
                                            <button
                                                onMouseDown={(e) => handleNodeDragStart(e, node.id, node.x, node.y)}
                                                className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-gray-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-gray-700 shadow-lg z-20 cursor-move"
                                                title={`Drag to move ${node.toolName}`}
                                            >
                                                <Maximize size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Side Panel */}
                    <div className={`absolute top-4 right-4 bottom-4 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${selectedToolNode ? 'translate-x-0' : 'translate-x-[110%]'
                        }`}>
                        {selectedToolNode && (
                            <>
                                <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50/50 rounded-t-xl">
                                    <div className="flex items-center gap-3">
                                        {selectedToolNode.toolData?.website && (
                                            <img
                                                src={selectedToolNode.toolData.logo_url || getLogoUrl(selectedToolNode.toolData.website) || ''}
                                                className="w-10 h-10 object-contain bg-white rounded-lg border border-gray-200 p-1"
                                                alt=""
                                            />
                                        )}
                                        <div>
                                            <h3 className="font-bold text-gray-900">{selectedToolNode.toolName}</h3>
                                            <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Connected</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedToolNode(null)} className="text-gray-400 hover:text-gray-600">
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="p-5 flex-1 overflow-y-auto">
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Data Flow</h4>
                                            <div className="space-y-2">
                                                {/* Outgoing connections */}
                                                {graphEdges.filter(e => e.source === selectedToolNode.toolData?.application_id).map((e) => {
                                                    const targetNode = graphNodes.find(n => n.applicationId === e.target);
                                                    return (
                                                        <div key={e.id} className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 text-gray-600 mb-1">
                                                                    <ArrowUpRight size={14} className="text-gray-400" />
                                                                    <span className="font-medium text-gray-900">{targetNode?.toolName || 'Unknown'}</span>
                                                                </div>
                                                                <div className="ml-6 text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200 inline-block">
                                                                    {e.label || 'Connected'}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={(ev) => { ev.stopPropagation(); handleDeleteConnection(e.id); }}
                                                                className="p-1.5 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-all ml-2"
                                                                title="Delete connection"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                {/* Incoming connections */}
                                                {graphEdges.filter(e => e.target === selectedToolNode.toolData?.application_id).map((e) => {
                                                    const sourceNode = graphNodes.find(n => n.applicationId === e.source);
                                                    return (
                                                        <div key={e.id} className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 text-gray-600 mb-1">
                                                                    <ArrowLeft size={14} className="text-gray-400" />
                                                                    <span className="font-medium text-gray-900">{sourceNode?.toolName || 'Unknown'}</span>
                                                                </div>
                                                                <div className="ml-6 text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200 inline-block">
                                                                    {e.label || 'Connected'}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={(ev) => { ev.stopPropagation(); handleDeleteConnection(e.id); }}
                                                                className="p-1.5 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-all ml-2"
                                                                title="Delete connection"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                {graphEdges.filter(e =>
                                                    e.source === selectedToolNode.toolData?.application_id ||
                                                    e.target === selectedToolNode.toolData?.application_id
                                                ).length === 0 && (
                                                        <p className="text-sm text-gray-400 italic">No active connections.</p>
                                                    )}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Comments</h4>

                                            {/* Comment Input */}
                                            <div className="mb-3">
                                                <textarea
                                                    placeholder="Add a comment about this tool..."
                                                    className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                    rows={3}
                                                />
                                                <button className="mt-2 w-full bg-black text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-800 transition-colors">
                                                    Post Comment
                                                </button>
                                            </div>

                                            {/* Comments List */}
                                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                                {/* Example comment - replace with actual data */}
                                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                    <div className="flex items-start gap-2 mb-2">
                                                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                                            TE
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium text-gray-900">Tychique Esteve</span>
                                                                <span className="text-xs text-gray-400">2h ago</span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                This integration is working great! We're seeing good data flow.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* No comments state */}
                                                {/* <p className="text-sm text-gray-400 italic text-center py-4">No comments yet. Be the first to comment!</p> */}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Actions</h4>
                                            <div className="space-y-2">
                                                {/* Toggle Active/Inactive for connections */}
                                                {graphEdges.filter(e =>
                                                    e.source === selectedToolNode.toolData?.application_id ||
                                                    e.target === selectedToolNode.toolData?.application_id
                                                ).map(conn => (
                                                    <button
                                                        key={`toggle-${conn.id}`}
                                                        onClick={async () => {
                                                            try {
                                                                await updateConnection(conn.id, { is_active: !conn.active });
                                                            } catch (error) {
                                                                // Error handled in context
                                                            }
                                                        }}
                                                        className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${conn.active
                                                            ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                                                            : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Power size={14} />
                                                            <span>{conn.active ? 'Active' : 'Inactive'}</span>
                                                        </div>
                                                        <span className="text-xs opacity-70">{conn.label}</span>
                                                    </button>
                                                ))}

                                                {graphEdges.filter(e =>
                                                    e.source === selectedToolNode.toolData?.application_id ||
                                                    e.target === selectedToolNode.toolData?.application_id
                                                ).length === 0 && (
                                                        <p className="text-sm text-gray-400 italic text-center py-2">No connections to manage</p>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Zoom Controls */}
                    <div className="absolute bottom-20 left-4 z-50 flex flex-col gap-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2">
                        <button onClick={zoomIn} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600" title="Zoom In">
                            <ZoomIn size={20} />
                        </button>
                        <button onClick={zoomOut} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600" title="Zoom Out">
                            <ZoomOut size={20} />
                        </button>
                        <div className="h-px bg-gray-200 my-1"></div>
                        <button onClick={resetZoom} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600" title="Reset View">
                            <Maximize size={20} />
                        </button>
                    </div>

                    {/* Legend */}
                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-6 text-xs text-gray-500 z-50">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 bg-green-500"></div>
                            <span>Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 border-t-2 border-dashed border-gray-300"></div>
                            <span>Inactive</span>
                        </div>

                    </div>
                </div>
            )}

            {/* Tools Library Modal */}
            {showAddToolModal && (
                <ToolsLibrary
                    onClose={() => setShowAddToolModal(false)}
                    libraryApps={libraryApps}
                    setLibraryApps={setLibraryApps}
                    libraryLoading={libraryLoading}
                />
            )}

            {/* Create Connection Modal */}
            <AnimatePresence>
                {showConnectionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                        onClick={() => { setShowConnectionModal(false); setConnectionSource(null); setConnectionTarget(null); setConnectionLabel(''); setCustomLabel(''); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-lg">Create Connection</h3>
                                    <p className="text-sm text-gray-500">Link two tools in your stack</p>
                                </div>
                                <button
                                    onClick={() => { setShowConnectionModal(false); setConnectionSource(null); setConnectionTarget(null); }}
                                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="px-6 py-5 space-y-5">
                                {/* Source Tool */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">From (Source)</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {projectTools.filter(t => t.status === 'active').map(tool => (
                                            <button
                                                key={tool.id}
                                                onClick={() => { setConnectionSource(tool); setConnectionLabel(''); }}
                                                disabled={connectionTarget?.id === tool.id}
                                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${connectionSource?.id === tool.id
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : connectionTarget?.id === tool.id
                                                        ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <img
                                                    src={tool.logo_url || getLogoUrl(tool.website) || ''}
                                                    alt={tool.name}
                                                    className="w-8 h-8 object-contain"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                                <span className="text-[10px] font-medium text-gray-600 truncate w-full text-center">{tool.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Arrow */}
                                <div className="flex items-center justify-center py-2">
                                    <div className="flex-1 h-px bg-gray-200"></div>
                                    <div className="px-4 py-1.5 bg-gray-100 rounded-full text-gray-500 text-xs font-medium flex items-center gap-2">
                                        <ArrowUpRight size={14} />
                                        sends to
                                    </div>
                                    <div className="flex-1 h-px bg-gray-200"></div>
                                </div>

                                {/* Target Tool */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">To (Target)</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {projectTools.filter(t => t.status === 'active').map(tool => {
                                            const toolAppId = tool.application_id || tool.id;
                                            const sourceAppId = connectionSource?.application_id || connectionSource?.id;

                                            // Check if this target is already connected from the selected source
                                            const isAlreadyConnected = connectionSource ? connections.some(conn =>
                                                conn.source_application_id === sourceAppId &&
                                                conn.target_application_id === toolAppId
                                            ) : false;
                                            const isSameAsSource = connectionSource?.id === tool.id;
                                            const isDisabled = isSameAsSource || isAlreadyConnected;

                                            return (
                                                <button
                                                    key={tool.id}
                                                    onClick={() => { setConnectionTarget(tool); setConnectionLabel(''); }}
                                                    disabled={isDisabled}
                                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all relative ${connectionTarget?.id === tool.id
                                                        ? 'border-green-500 bg-green-50'
                                                        : isDisabled
                                                            ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    {isAlreadyConnected && (
                                                        <span className="absolute -top-1 -right-1 text-[8px] bg-gray-500 text-white px-1.5 py-0.5 rounded-full">Connected</span>
                                                    )}
                                                    <img
                                                        src={tool.logo_url || getLogoUrl(tool.website) || ''}
                                                        alt={tool.name}
                                                        className="w-8 h-8 object-contain"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                    <span className="text-[10px] font-medium text-gray-600 truncate w-full text-center">{tool.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Connection Label (Suggestions) */}
                                {connectionSource && connectionTarget && (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Connection Type</label>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {getSmartSuggestions(connectionSource, connectionTarget).map((suggestion, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { setConnectionLabel(suggestion); setCustomLabel(''); }}
                                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${connectionLabel === suggestion
                                                        ? 'bg-gray-900 text-white'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                        <input
                                            type="text"
                                            value={customLabel}
                                            onChange={(e) => { setCustomLabel(e.target.value); setConnectionLabel(''); }}
                                            placeholder="Or enter a custom label..."
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => { setShowConnectionModal(false); setConnectionSource(null); setConnectionTarget(null); setConnectionLabel(''); setCustomLabel(''); }}
                                    className="flex-1 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateConnection}
                                    disabled={!connectionSource || !connectionTarget || (!connectionLabel && !customLabel.trim())}
                                    className="flex-1 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    <Link2 size={16} />
                                    Create Connection
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
