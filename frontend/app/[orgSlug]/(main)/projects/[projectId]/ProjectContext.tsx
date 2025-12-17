'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useApiClient } from '@/hooks/useApiClient';
import toast from 'react-hot-toast';

// --- Types ---
interface ApiClient {
    get<T>(url: string): Promise<T>;
    post<T>(url: string, body: any): Promise<T>;
    put<T>(url: string, body: any): Promise<T>;
    delete<T>(url: string): Promise<T>;
}

export interface ProjectMember {
    id: string;
    user_id: string;
    project_id: string;
    first_name?: string;
    last_name?: string;
    job_title?: string;
    email: string;
    avatar_url?: string;
    role: 'lead' | 'member';
    joined_at: string;
    last_read_at?: string;
}

export interface Project {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
    color: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    member_count: number;
    item_count: number;
    is_lead: boolean;
    has_unread?: boolean;
    status: string;
}

export interface ReadReceipt {
    user_id: string;
    first_name?: string;
    last_name?: string;
    read_at: string;
}

export interface ProjectMessage {
    id: string;
    project_id: string;
    sender_id: string;
    sender_name?: string;
    sender_avatar_url?: string;
    content: string;
    attachment_url?: string;
    attachment_type?: string;
    attachment_name?: string;
    shared_note_id?: string;
    shared_note?: any;
    shared_post_id?: string;
    shared_post?: any;
    created_at: string;
    read_by?: ReadReceipt[];
    is_system_message?: boolean;
}

export interface Collaborator {
    name: string;
    avatar_url?: string;
    quote: string;
    date?: string;
}

export interface ProjectItem {
    id: string;
    project_id: string;
    note_id?: string;
    cluster_id?: string;
    added_by: string;
    joined_at: string;
    note?: any;
    cluster?: any;
    category?: string;
    status?: string;
    item_type?: string;
    created_date?: string;
    title?: string;
    summary?: string;
    note_count?: number;
    collaborators?: Collaborator[];
}

export interface ProjectTool {
    id: string;
    application_id: string;
    name: string;
    website: string;
    category: string;
    status: string;
    addedBy: any;
    addedAt: string;
    note: string;
    logo_url?: string;
}

export interface Connection {
    id: string;
    source_tool_id: string;
    target_tool_id: string;
    source_application_id: string;
    target_application_id: string;
    label: string;
    is_active: boolean;
    chain_id?: string;  // Identifies which visual chain this connection belongs to
}

// --- Context Interface ---
interface ProjectContextType {
    // Core data
    project: Project | null;
    members: ProjectMember[];
    items: ProjectItem[];
    messages: ProjectMessage[];
    projectTools: ProjectTool[];
    connections: Connection[];

    // Loading states
    isLoading: boolean;
    isLoadingMessages: boolean;
    isLoadingItems: boolean;
    isLoadingTools: boolean;
    isLoadingConnections: boolean;

    // User & Organization
    currentUser: any;
    organization: any;
    apiClient: ApiClient;

    // Actions
    refreshProject: () => Promise<void>;
    refreshMembers: () => Promise<void>;
    refreshItems: () => Promise<void>;
    refreshMessages: () => Promise<void>;
    refreshTools: () => Promise<void>;
    refreshConnections: () => Promise<void>;

    // Message actions
    sendMessage: (content: string, attachments?: { url: string; type: string; name: string }[]) => Promise<void>;
    setMessages: React.Dispatch<React.SetStateAction<ProjectMessage[]>>;

    // Member actions
    addMember: (userId: string) => Promise<void>;
    removeMember: (userId: string) => Promise<void>;
    leaveProject: () => Promise<void>;

    // Project actions
    updateProject: (name: string, description: string, color: string) => Promise<void>;
    deleteProject: () => Promise<void>;

    // Item actions
    removeItem: (itemId: string) => Promise<void>;
    selectedItemId: string | null;
    setSelectedItemId: (id: string | null) => void;

    // Tools actions
    addToolToProject: (applicationId: string, status: string, note?: string) => Promise<void>;
    deleteProjectTool: (toolId: string, toolName: string) => Promise<void>;
    setProjectTools: React.Dispatch<React.SetStateAction<ProjectTool[]>>;

    // Connection actions
    createConnection: (sourceAppId: string, targetAppId: string, label: string, chainId?: string) => Promise<void>;
    updateConnection: (connectionId: string, updates: { is_active?: boolean; label?: string }) => Promise<void>;
    deleteConnection: (connectionId: string) => Promise<void>;
    setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;

    // Navigation
    onBack: () => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function useProject() {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
}

// --- Provider Component ---
interface ProjectProviderProps {
    children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;
    const orgSlug = params.orgSlug as string;

    const { user, isLoading: isAuthLoading } = useUser();
    const { organization } = useOrganization();
    const apiClient = useApiClient();

    // Core state
    const [project, setProject] = useState<Project | null>(null);
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [items, setItems] = useState<ProjectItem[]>([]);
    const [messages, setMessages] = useState<ProjectMessage[]>([]);
    const [projectTools, setProjectTools] = useState<ProjectTool[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // Loading states
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [isLoadingItems, setIsLoadingItems] = useState(true);
    const [isLoadingTools, setIsLoadingTools] = useState(false);
    const [isLoadingConnections, setIsLoadingConnections] = useState(false);

    // Refs for cleanup
    const isMountedRef = useRef(true);

    // --- Data Fetching Functions ---

    const refreshProject = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await apiClient.get<Project>(`/projects/${projectId}`);
            if (isMountedRef.current) {
                setProject(data);
            }
        } catch (error) {
            console.error('Error fetching project:', error);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [projectId, apiClient]);

    const refreshMembers = useCallback(async () => {
        if (!projectId) return;
        const cacheKey = `cached_members_project_${projectId}`;

        // Try cache first
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    setMembers(parsed);
                }
            } catch (e) { }
        }

        try {
            const data = await apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`);
            if (isMountedRef.current) {
                setMembers(data);
                localStorage.setItem(cacheKey, JSON.stringify(data));
            }
        } catch (error) {
            console.error('Error fetching members:', error);
        }
    }, [projectId, apiClient]);

    const refreshItems = useCallback(async () => {
        if (!projectId) return;
        const cacheKey = `cached_items_group_${projectId}`;

        // Try cache first
        const cached = localStorage.getItem(cacheKey);
        let loadedFromCache = false;
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    setItems(parsed);
                    if (parsed.length > 0 && !selectedItemId) {
                        setSelectedItemId(parsed[0].id);
                    }
                    setIsLoadingItems(false);
                    loadedFromCache = true;
                }
            } catch (e) { }
        }

        if (!loadedFromCache) {
            setIsLoadingItems(true);
        }

        try {
            const data = await apiClient.get<ProjectItem[]>(`/projects/${projectId}/items`);
            if (isMountedRef.current) {
                setItems(data);
                if (data.length > 0 && !loadedFromCache) {
                    setSelectedItemId(data[0].id);
                }
                localStorage.setItem(cacheKey, JSON.stringify(data));
            }
        } catch (error) {
            console.error('Error fetching items:', error);
        } finally {
            if (isMountedRef.current) {
                setIsLoadingItems(false);
            }
        }
    }, [projectId, apiClient, selectedItemId]);

    const refreshMessages = useCallback(async (isPolling = false) => {
        if (!projectId) return;
        const cacheKey = `cached_messages_group_${projectId}`;

        if (!isPolling) {
            // Try cache first
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        setMessages(parsed);
                        setIsLoadingMessages(false);
                    }
                } catch (e) { }
            }
        }

        try {
            const data = await apiClient.get<ProjectMessage[]>(`/projects/${projectId}/messages`);
            if (isMountedRef.current) {
                setMessages(data);
                localStorage.setItem(cacheKey, JSON.stringify(data));
            }
        } catch (error: any) {
            if (!isPolling) {
                console.error('Error fetching messages:', error);
                if (error.status === 403) {
                    toast.error('You are no longer a member of this project');
                    router.push(`/${orgSlug}/projects`);
                }
            }
        } finally {
            if (isMountedRef.current && !isPolling) {
                setIsLoadingMessages(false);
            }
        }
    }, [projectId, apiClient, router, orgSlug]);

    const refreshTools = useCallback(async () => {
        if (!projectId) return;
        setIsLoadingTools(true);
        try {
            const tools = await apiClient.get<any[]>(`/applications/projects/${projectId}/tools`);
            const formattedTools = tools.map((tool: any) => ({
                id: tool.id,
                application_id: tool.application_id,
                name: tool.application?.name || 'Unknown',
                website: tool.application?.url || '',
                category: tool.application?.category || 'Other',
                status: tool.status,
                addedBy: tool.added_by,
                addedAt: new Date(tool.added_at).toLocaleDateString('en-GB'),
                note: tool.note || '',
                logo_url: tool.application?.logo_url
            }));
            if (isMountedRef.current) {
                setProjectTools(formattedTools);
            }
        } catch (error) {
            console.error('Error fetching tools:', error);
            setProjectTools([]);
        } finally {
            if (isMountedRef.current) {
                setIsLoadingTools(false);
            }
        }
    }, [projectId, apiClient]);

    const refreshConnections = useCallback(async () => {
        if (!projectId) return;
        setIsLoadingConnections(true);
        try {
            const data = await apiClient.get<Connection[]>(`/applications/projects/${projectId}/connections`);
            if (isMountedRef.current) {
                setConnections(data || []);
            }
        } catch (error) {
            console.error('Error fetching connections:', error);
            setConnections([]);
        } finally {
            if (isMountedRef.current) {
                setIsLoadingConnections(false);
            }
        }
    }, [projectId, apiClient]);

    // --- Action Functions ---

    const sendMessage = useCallback(async (content: string, attachments?: { url: string; type: string; name: string }[]) => {
        if (!projectId) return;
        if (!content.trim() && (!attachments || attachments.length === 0)) return;

        try {
            if (attachments && attachments.length > 0) {
                for (let i = 0; i < attachments.length; i++) {
                    const attachment = attachments[i];
                    const payload: any = {
                        content: i === 0 ? content : '',
                        attachment_url: attachment.url,
                        attachment_type: attachment.type,
                        attachment_name: attachment.name
                    };
                    const newMsg = await apiClient.post<ProjectMessage>(`/projects/${projectId}/messages`, payload);
                    setMessages(prev => [...prev, newMsg]);
                }
            } else {
                const newMsg = await apiClient.post<ProjectMessage>(`/projects/${projectId}/messages`, { content });
                setMessages(prev => [...prev, newMsg]);
            }
        } catch (error) {
            toast.error('Failed to send message');
        }
    }, [projectId, apiClient]);

    const addMember = useCallback(async (userId: string) => {
        if (!projectId) return;
        try {
            await apiClient.post(`/projects/${projectId}/members`, { user_id: userId });
            toast.success('Member added');
            refreshMembers();
            refreshProject();
        } catch (error: any) {
            toast.error(error.message || 'Failed to add member');
        }
    }, [projectId, apiClient, refreshMembers, refreshProject]);

    const removeMember = useCallback(async (userId: string) => {
        if (!projectId) return;
        try {
            await apiClient.delete(`/projects/${projectId}/members/${userId}`);
            toast.success('Member removed');
            refreshMembers();
            refreshProject();
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove member');
        }
    }, [projectId, apiClient, refreshMembers, refreshProject]);

    const leaveProject = useCallback(async () => {
        if (!projectId) return;
        try {
            await apiClient.post(`/projects/${projectId}/leave`, {});
            toast.success('Left the project');
            router.push(`/${orgSlug}/projects`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to leave project');
        }
    }, [projectId, apiClient, router, orgSlug]);

    const updateProject = useCallback(async (name: string, description: string, color: string) => {
        if (!projectId) return;
        try {
            await apiClient.put(`/projects/${projectId}`, { name, description, color });
            toast.success('Project updated');
            refreshProject();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update project');
        }
    }, [projectId, apiClient, refreshProject]);

    const deleteProject = useCallback(async () => {
        if (!projectId) return;
        try {
            await apiClient.delete(`/projects/${projectId}`);
            toast.success('Project deleted');
            router.push(`/${orgSlug}/projects`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete project');
        }
    }, [projectId, apiClient, router, orgSlug]);

    const removeItem = useCallback(async (itemId: string) => {
        if (!projectId) return;
        try {
            await apiClient.delete(`/projects/${projectId}/items/${itemId}`);
            toast.success('Idea removed from project');
            const newItems = items.filter(i => i.id !== itemId);
            setItems(newItems);
            if (newItems.length > 0) {
                setSelectedItemId(newItems[0].id);
            } else {
                setSelectedItemId(null);
            }
        } catch (error: any) {
            toast.error('Failed to remove idea');
        }
    }, [projectId, apiClient, items]);

    const addToolToProject = useCallback(async (applicationId: string, status: string, note?: string) => {
        if (!projectId) return;
        try {
            await apiClient.post(`/applications/projects/${projectId}/tools`, {
                application_id: applicationId,
                status: status,
                note: note || null
            });
            refreshTools();
        } catch (error: any) {
            throw error;
        }
    }, [projectId, apiClient, refreshTools]);

    const deleteProjectTool = useCallback(async (toolId: string, toolName: string) => {
        if (!projectId) return;
        if (!confirm(`Remove "${toolName}" from this project?`)) return;
        try {
            await apiClient.delete(`/applications/projects/${projectId}/tools/${toolId}`);
            setProjectTools(prev => prev.filter(t => t.id !== toolId));
            toast.success(`${toolName} removed from project`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove tool');
        }
    }, [projectId, apiClient]);

    const createConnection = useCallback(async (sourceAppId: string, targetAppId: string, label: string, chainId?: string) => {
        if (!projectId) return;
        try {
            const payload: any = {
                source_application_id: sourceAppId,
                target_application_id: targetAppId,
                label: label,
            };

            // If chainId is provided, extend an existing chain; otherwise, create a new one
            if (chainId) {
                payload.chain_id = chainId;
            }

            await apiClient.post(`/applications/projects/${projectId}/connections`, payload);
            toast.success('Connection created!');
            refreshConnections();
        } catch (error: any) {
            toast.error(error.message || 'Failed to create connection');
            throw error;
        }
    }, [projectId, apiClient, refreshConnections]);

    const updateConnection = useCallback(async (connectionId: string, updates: { is_active?: boolean; label?: string }) => {
        if (!projectId) return;
        console.log('🔄 Updating connection:', connectionId, updates);
        try {
            await apiClient.patch(`/applications/projects/${projectId}/connections/${connectionId}`, updates);
            // Update local state
            setConnections(prev => prev.map(c =>
                c.id === connectionId
                    ? { ...c, is_active: updates.is_active ?? c.is_active, label: updates.label ?? c.label }
                    : c
            ));
            toast.success('Connection updated');
        } catch (error: any) {
            console.error('❌ Failed to update connection:', error);
            toast.error(error.message || 'Failed to update connection');
            throw error;
        }
    }, [projectId, apiClient]);

    const deleteConnection = useCallback(async (connectionId: string) => {
        if (!projectId) return;
        if (!confirm('Delete this connection?')) return;
        try {
            await apiClient.delete(`/applications/projects/${projectId}/connections/${connectionId}`);
            setConnections(prev => prev.filter(c => c.id !== connectionId));
            toast.success('Connection deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete connection');
        }
    }, [projectId, apiClient]);

    const onBack = useCallback(() => {
        router.push(`/${orgSlug}/projects`);
    }, [router, orgSlug]);

    // --- Initial Data Loading ---
    useEffect(() => {
        isMountedRef.current = true;

        if (isAuthLoading) return;

        if (!user) {
            setIsLoading(false);
            return;
        }

        if (projectId) {
            // Load critical data first
            Promise.all([
                refreshProject(),
                refreshMembers()
            ]).finally(() => {
                // Load non-critical data in background
                refreshItems();
                refreshMessages();
                refreshTools();
                refreshConnections();
            });

            // Mark as read
            apiClient.post(`/projects/${projectId}/mark-read`, {}).catch(() => { });

            // Poll messages every 30 seconds
            const pollInterval = setInterval(() => refreshMessages(true), 30000);

            return () => {
                isMountedRef.current = false;
                clearInterval(pollInterval);
            };
        } else {
            setIsLoading(false);
        }
    }, [projectId, user, isAuthLoading]);

    // --- Context Value ---
    const contextValue = useMemo<ProjectContextType>(() => ({
        // Core data
        project,
        members,
        items,
        messages,
        projectTools,
        connections,

        // Loading states
        isLoading,
        isLoadingMessages,
        isLoadingItems,
        isLoadingTools,
        isLoadingConnections,

        // User & Organization
        currentUser: user,
        organization,
        apiClient,

        // Actions
        refreshProject,
        refreshMembers,
        refreshItems,
        refreshMessages: () => refreshMessages(false),
        refreshTools,
        refreshConnections,

        // Message actions
        sendMessage,
        setMessages,

        // Member actions
        addMember,
        removeMember,
        leaveProject,

        // Project actions
        updateProject,
        deleteProject,

        // Item actions
        removeItem,
        selectedItemId,
        setSelectedItemId,

        // Tools actions
        addToolToProject,
        deleteProjectTool,
        setProjectTools,

        // Connection actions
        createConnection,
        updateConnection,
        deleteConnection,
        setConnections,

        // Navigation
        onBack,
    }), [
        project, members, items, messages, projectTools, connections,
        isLoading, isLoadingMessages, isLoadingItems, isLoadingTools, isLoadingConnections,
        user, organization, apiClient,
        refreshProject, refreshMembers, refreshItems, refreshMessages, refreshTools, refreshConnections,
        sendMessage, addMember, removeMember, leaveProject,
        updateProject, deleteProject, removeItem, selectedItemId,
        addToolToProject, deleteProjectTool, createConnection, updateConnection, deleteConnection, onBack
    ]);

    return (
        <ProjectContext.Provider value={contextValue}>
            {children}
        </ProjectContext.Provider>
    );
}
