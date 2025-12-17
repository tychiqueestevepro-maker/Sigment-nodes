'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Link2, Plus, Layers, Loader2, Trash2, ZoomIn, ZoomOut, Maximize, Maximize2, Minimize2, ArrowUpRight, ArrowLeft, Wrench, X, Power, Edit3
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
    const [extendChainId, setExtendChainId] = useState<string | null>(null); // Chain ID to extend when using + button

    // Selection State
    const [selectedToolNode, setSelectedToolNode] = useState<{ id: string; toolName: string; x: number; y: number; chainId?: string; applicationId?: string; toolData?: ProjectTool } | null>(null);

    // Canvas Visibility State (which tools are shown on the canvas)
    const [toolsOnCanvas, setToolsOnCanvas] = useState<Set<string>>(new Set());

    // Comments State
    const [chainComments, setChainComments] = useState<Array<{ id: string; content: string; user_name: string; user_avatar?: string; created_at: string }>>([]);
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [expandedSidebar, setExpandedSidebar] = useState(false);

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

    // Calculate positions based on chain_id from connections
    useEffect(() => {
        if (toolsOnCanvas.size === 0 || connections.length === 0) return;

        // Build a map of tool ID to application ID
        const toolToApp: Record<string, string> = {};
        projectTools.forEach(t => {
            toolToApp[t.id] = t.application_id;
        });

        // Build reverse map: application ID to tool ID
        const appToTool: Record<string, string> = {};
        projectTools.forEach(t => {
            if (toolsOnCanvas.has(t.id)) {
                appToTool[t.application_id] = t.id;
            }
        });

        // Group connections by chain_id
        const chainMap = new Map<string, typeof connections>();
        connections.forEach(conn => {
            const chainId = conn.chain_id || conn.id; // Fallback to connection id if no chain_id
            if (!chainMap.has(chainId)) {
                chainMap.set(chainId, []);
            }
            chainMap.get(chainId)!.push(conn);
        });

        // For each chain, order the tools by connection flow
        const chains: string[][] = [];

        chainMap.forEach((chainConnections) => {
            // Get all app IDs in this chain
            const appIds = new Set<string>();
            chainConnections.forEach(c => {
                appIds.add(c.source_tool_id);
                appIds.add(c.target_tool_id);
            });

            // Find starting tools (sources that are not targets in this chain)
            const targetsInChain = new Set(chainConnections.map(c => c.target_tool_id));
            const startApps = Array.from(appIds).filter(id => !targetsInChain.has(id));

            // Order tools from start to end
            const orderedTools: string[] = [];
            const visited = new Set<string>();
            const queue = startApps.length > 0 ? [...startApps] : [Array.from(appIds)[0]];

            while (queue.length > 0) {
                const appId = queue.shift()!;
                if (visited.has(appId)) continue;
                visited.add(appId);

                const toolId = appToTool[appId];
                if (toolId && toolsOnCanvas.has(toolId)) {
                    orderedTools.push(toolId);
                }

                // Find next tools in the chain
                chainConnections.forEach(c => {
                    if (c.source_tool_id === appId && !visited.has(c.target_tool_id)) {
                        queue.push(c.target_tool_id);
                    }
                });
            }

            if (orderedTools.length > 0) {
                chains.push(orderedTools);
            }
        });

        // Position each chain on its own row
        const newPositions: Record<string, { x: number; y: number }> = {};
        chains.forEach((chain, rowIndex) => {
            const startX = 10;
            const spacingX = 80 / Math.max(chain.length, 1); // Spread across width

            chain.forEach((toolId, colIndex) => {
                newPositions[toolId] = {
                    x: startX + (colIndex * Math.min(spacingX, 25)),
                    y: 25 + (rowIndex * 30) // Each chain on a new row
                };
            });
        });

        setNodePositions(newPositions);
    }, [toolsOnCanvas, connections, projectTools]); // Re-run when tools or connections change

    // --- Computed Graph Data (with visual duplication per chain) ---
    const { graphNodes, graphEdges, chainNodePositions } = useMemo(() => {
        if (connections.length === 0) {
            return { graphNodes: [], graphEdges: [], chainNodePositions: {} };
        }

        // Build maps
        const appToTool: Record<string, ProjectTool> = {};
        projectTools.forEach(t => {
            appToTool[t.application_id] = t;
        });

        // Group connections by chain_id
        const chainMap = new Map<string, typeof connections>();
        connections.forEach(conn => {
            const chainId = conn.chain_id || conn.id;
            if (!chainMap.has(chainId)) {
                chainMap.set(chainId, []);
            }
            chainMap.get(chainId)!.push(conn);
        });

        const nodes: Array<{
            id: string;
            applicationId: string;
            toolName: string;
            chainId: string;
            x: number;
            y: number;
            toolData?: ProjectTool;
        }> = [];

        const edges: Array<{
            id: string;
            source: string;
            target: string;
            label: string;
            active: boolean;
            chainId: string;
        }> = [];

        const positions: Record<string, { x: number; y: number }> = {};
        let rowIndex = 0;

        chainMap.forEach((chainConnections, chainId) => {
            // Get all app IDs in this chain
            const appIds = new Set<string>();
            chainConnections.forEach(c => {
                appIds.add(c.source_tool_id);
                appIds.add(c.target_tool_id);
            });

            // Find starting tools (sources that are not targets in this chain)
            const targetsInChain = new Set(chainConnections.map(c => c.target_tool_id));
            const startApps = Array.from(appIds).filter(id => !targetsInChain.has(id));

            // Order tools from start to end
            const orderedApps: string[] = [];
            const visited = new Set<string>();
            const queue = startApps.length > 0 ? [...startApps] : [Array.from(appIds)[0]];

            while (queue.length > 0) {
                const appId = queue.shift()!;
                if (visited.has(appId)) continue;
                visited.add(appId);
                orderedApps.push(appId);

                chainConnections.forEach(c => {
                    if (c.source_tool_id === appId && !visited.has(c.target_tool_id)) {
                        queue.push(c.target_tool_id);
                    }
                });
            }

            // Create nodes for this chain
            const startX = 10;
            const spacingX = 80 / Math.max(orderedApps.length, 1);

            orderedApps.forEach((appId, colIndex) => {
                const tool = appToTool[appId];
                if (!tool) return;

                const nodeId = `${tool.id}_${chainId}`; // Unique ID per chain
                const x = startX + (colIndex * Math.min(spacingX, 25));
                const y = 25 + (rowIndex * 30);

                nodes.push({
                    id: nodeId,
                    applicationId: appId,
                    toolName: tool.name,
                    chainId: chainId,
                    x,
                    y,
                    toolData: tool
                });

                positions[nodeId] = { x, y };
            });

            // Create edges for this chain (with chain-specific source/target IDs)
            chainConnections.forEach(conn => {
                const sourceTool = appToTool[conn.source_tool_id];
                const targetTool = appToTool[conn.target_tool_id];
                if (!sourceTool || !targetTool) return;

                edges.push({
                    id: conn.id,
                    source: `${sourceTool.id}_${chainId}`,
                    target: `${targetTool.id}_${chainId}`,
                    label: conn.label,
                    active: conn.is_active,
                    chainId: chainId
                });
            });

            rowIndex++;
        });

        return { graphNodes: nodes, graphEdges: edges, chainNodePositions: positions };
    }, [connections, projectTools]);

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

    // Fit all connections to view
    const fitToView = useCallback(() => {
        if (graphNodes.length === 0) return;

        // Get actual viewport dimensions
        const container = canvasRef.current?.parentElement;
        const viewportWidth = container?.clientWidth || 1000;
        const viewportHeight = container?.clientHeight || 600;

        // Find the bounds of all nodes (in percentage 0-100)
        const xValues = graphNodes.map(n => n.x);
        const yValues = graphNodes.map(n => n.y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);

        // Canvas dimensions
        const canvasWidth = 2000;
        const canvasHeight = 1500;

        // Convert percentages to pixels
        const leftPx = (minX / 100) * canvasWidth;
        const rightPx = (maxX / 100) * canvasWidth;
        const topPx = (minY / 100) * canvasHeight;
        const bottomPx = (maxY / 100) * canvasHeight;

        // Content bounds with padding (80px for node size)
        const contentWidth = rightPx - leftPx + 200;
        const contentHeight = bottomPx - topPx + 200;

        // Calculate scale to fit
        const scaleX = viewportWidth / contentWidth;
        const scaleY = viewportHeight / contentHeight;
        const scale = Math.min(Math.max(0.4, Math.min(scaleX, scaleY)), 1.2);

        // Calculate center of content
        const contentCenterX = leftPx + (rightPx - leftPx) / 2;
        const contentCenterY = topPx + (bottomPx - topPx) / 2;

        // Calculate offset to center the content in viewport
        const offsetX = (viewportWidth / 2) - (contentCenterX * scale);
        const offsetY = (viewportHeight / 2) - (contentCenterY * scale);

        setCanvasTransform({ x: offsetX, y: offsetY, scale });
    }, [graphNodes]);

    // Auto-fit on initial load when we have nodes
    useEffect(() => {
        if (graphNodes.length > 0 && canvasTransform.scale === 1 && canvasTransform.x === 0 && canvasTransform.y === 0) {
            // Small delay to ensure canvas is rendered
            const timer = setTimeout(fitToView, 100);
            return () => clearTimeout(timer);
        }
    }, [graphNodes.length, fitToView]);

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

        const sourceAppId = connectionSource.application_id || connectionSource.id;
        const targetAppId = connectionTarget.application_id || connectionTarget.id;

        // Check for duplicate connection ONLY in the same chain
        // Different chains can have the same source → target
        const duplicateConnection = connections.find(
            c => c.source_tool_id === sourceAppId &&
                c.target_tool_id === targetAppId &&
                (extendChainId ? c.chain_id === extendChainId : false) // Only check same chain if extending
        );
        if (duplicateConnection) {
            toast.error('This connection already exists in this chain');
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
                labelToUse,
                extendChainId || undefined // Pass chain_id if extending, undefined for new chain
            );

            setShowConnectionModal(false);
            setConnectionSource(null);
            setConnectionTarget(null);
            setConnectionLabel('');
            setCustomLabel('');
            setExtendChainId(null); // Reset chain id
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

    // Load comments when a node is selected
    useEffect(() => {
        const loadComments = async () => {
            if (selectedToolNode?.chainId && selectedToolNode?.applicationId && projectId) {
                try {
                    const comments = await apiClient.get<Array<{ id: string; content: string; user_name: string; user_avatar?: string; created_at: string }>>(
                        `/applications/projects/${projectId}/chain-comments/${selectedToolNode.chainId}/${selectedToolNode.applicationId}`
                    );
                    console.log('Loaded comments:', comments);
                    setChainComments(Array.isArray(comments) ? comments : []);
                } catch (error) {
                    console.error('Failed to load comments:', error);
                    setChainComments([]);
                }
            } else {
                setChainComments([]);
            }
        };
        loadComments();
    }, [selectedToolNode?.chainId, selectedToolNode?.applicationId, projectId, apiClient]);

    // Post a new comment
    const handlePostComment = async () => {
        if (!newComment.trim() || !selectedToolNode?.chainId || !selectedToolNode?.applicationId || !projectId) {
            console.log('Missing data:', {
                comment: newComment.trim(),
                chainId: selectedToolNode?.chainId,
                applicationId: selectedToolNode?.applicationId,
                projectId
            });
            toast.error('Missing required data');
            return;
        }

        console.log('Posting comment:', {
            chain_id: selectedToolNode.chainId,
            application_id: selectedToolNode.applicationId,
            content: newComment.trim()
        });

        setIsPostingComment(true);
        try {
            const newCommentData = await apiClient.post<{ id: string; content: string; user_name: string; user_avatar?: string; created_at: string }>(`/applications/projects/${projectId}/chain-comments`, {
                chain_id: selectedToolNode.chainId,
                application_id: selectedToolNode.applicationId,
                content: newComment.trim()
            });
            console.log('Posted comment:', newCommentData);
            setChainComments(prev => [newCommentData, ...prev]);
            setNewComment('');
            toast.success('Comment posted!');
        } catch (error: any) {
            console.error('Comment error:', error?.response?.data || error);
            toast.error('Failed to post comment');
        } finally {
            setIsPostingComment(false);
        }
    };

    // Delete a comment
    const handleDeleteComment = async (commentId: string) => {
        try {
            await apiClient.delete(`/applications/projects/${projectId}/chain-comments/${commentId}`);
            setChainComments(prev => prev.filter(c => c.id !== commentId));
            toast.success('Comment deleted');
        } catch (error) {
            toast.error('Failed to delete comment');
        }
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
                    onClick={() => {
                        if (toolsSubTab === 'connexions') {
                            // Reset chain_id to create a new chain (not extend existing)
                            setConnectionSource(null);
                            setConnectionTarget(null);
                            setConnectionLabel('');
                            setCustomLabel('');
                            setExtendChainId(null); // New chain
                            setShowConnectionModal(true);
                        } else {
                            setShowAddToolModal(true);
                        }
                    }}
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
                                    // Match by unique node ID (toolId_chainId)
                                    const startNode = graphNodes.find(n => n.id === edge.source);
                                    const endNode = graphNodes.find(n => n.id === edge.target);
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
                                    const tool = node.toolData;
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



                                            {/* Add connection button (extends THIS chain) */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConnectionSource(tool || null);
                                                    setConnectionTarget(null);
                                                    setConnectionLabel('');
                                                    setCustomLabel('');
                                                    setExtendChainId(node.chainId); // Extend THIS specific chain
                                                    setShowConnectionModal(true);
                                                }}
                                                className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg z-20"
                                                title={`Extend chain from ${node.toolName}`}
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
                    <div className={`absolute top-4 right-4 bottom-4 ${expandedSidebar ? 'w-[500px]' : 'w-80'} bg-white rounded-xl shadow-2xl border border-gray-100 transform transition-all duration-300 ease-in-out z-50 flex flex-col ${selectedToolNode ? 'translate-x-0' : 'translate-x-[110%]'
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
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setExpandedSidebar(!expandedSidebar)}
                                            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                                            title={expandedSidebar ? "Collapse panel" : "Expand panel"}
                                        >
                                            {expandedSidebar ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                        </button>
                                        <button onClick={() => { setSelectedToolNode(null); setExpandedSidebar(false); }} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-5 flex-1 overflow-y-auto">
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Data Flow</h4>
                                            <div className="space-y-2">
                                                {/* Outgoing connections (only from THIS chain) */}
                                                {graphEdges.filter(e => e.source === selectedToolNode.id).map((e) => {
                                                    const targetNode = graphNodes.find(n => n.id === e.target);
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
                                                {/* Incoming connections (only from THIS chain) */}
                                                {graphEdges.filter(e => e.target === selectedToolNode.id).map((e) => {
                                                    const sourceNode = graphNodes.find(n => n.id === e.source);
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
                                                    e.source === selectedToolNode.id ||
                                                    e.target === selectedToolNode.id
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
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    disabled={isPostingComment}
                                                />
                                                <button
                                                    onClick={handlePostComment}
                                                    disabled={isPostingComment || !newComment.trim()}
                                                    className="mt-2 w-full bg-black text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isPostingComment ? 'Posting...' : 'Post Comment'}
                                                </button>
                                            </div>

                                            {/* Comments List */}
                                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                                {chainComments.length === 0 ? (
                                                    <p className="text-sm text-gray-400 italic text-center py-4">No comments yet. Be the first to comment!</p>
                                                ) : (
                                                    chainComments.filter(c => c && c.id).map(comment => (
                                                        <div key={comment.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 group">
                                                            <div className="flex items-start gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                                                                    {comment.user_avatar ? (
                                                                        <img src={comment.user_avatar} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        (comment.user_name || 'U').slice(0, 2).toUpperCase()
                                                                    )}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-medium text-gray-900">{comment.user_name || 'Anonymous'}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs text-gray-400">
                                                                                {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ''}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => handleDeleteComment(comment.id)}
                                                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                                                                title="Delete comment"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-sm text-gray-600 mt-1">{comment.content}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
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
                        <button onClick={fitToView} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600" title="Fit All to View">
                            <Layers size={20} />
                        </button>
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
