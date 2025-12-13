'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { X, Search, Users, Send, Loader2, Check, MessageCircle, Rocket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { useApiClient } from '@/hooks/useApiClient';
import toast from 'react-hot-toast';

interface Member {
    id: string;
    name: string;
    email: string;
    role: string;
    job_title?: string;
    avatar_url?: string | null;
}

interface IdeaGroup {
    id: string;
    name: string;
    description?: string;
    color?: string;
    members?: { user_id: string; first_name?: string }[];
    is_project?: boolean;
}

interface Project {
    id: string;
    name: string;
    description?: string;
    color?: string;
    member_count?: number;
    members?: { user_id: string; first_name?: string }[];
}

interface ShareNoteModalProps {
    noteId: string;
    noteTitle: string;
    onClose: () => void;
}

export const ShareNoteModal: React.FC<ShareNoteModalProps> = ({ noteId, noteTitle, onClose }) => {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const { user } = useUser();
    const api = useApiClient();

    // Tab state: 'chat' | 'groups' | 'projects'
    const [activeTab, setActiveTab] = useState<'chat' | 'groups' | 'projects'>('chat');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [sendMode, setSendMode] = useState<'individual' | 'group'>('individual');

    // Fetch organization members
    const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
        queryKey: ['orgMembers', orgSlug],
        queryFn: async () => {
            if (!orgSlug) return [];
            const res = await fetch(`/api/v1/organizations/${orgSlug}/members`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data || []).filter((m: Member) => m.id !== user?.id);
        },
        enabled: !!orgSlug,
    });

    // Fetch user's groups (only groups, backend filters out projects)
    const { data: groups = [], isLoading: groupsLoading } = useQuery<IdeaGroup[]>({
        queryKey: ['userGroups'],
        queryFn: async () => {
            try {
                return await api.get<IdeaGroup[]>('/idea-groups');
            } catch {
                return [];
            }
        },
        enabled: activeTab === 'groups',
    });

    // Fetch user's projects
    const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
        queryKey: ['userProjects'],
        queryFn: async () => {
            try {
                return await api.get<Project[]>('/projects');
            } catch {
                return [];
            }
        },
        enabled: activeTab === 'projects',
    });

    const filteredMembers = members.filter((member) => {
        const name = member.name?.toLowerCase() || '';
        const email = member.email?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return name.includes(search) || email.includes(search);
    });

    const filteredGroups = groups.filter((group) => {
        const name = group.name?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return name.includes(search);
    });

    const filteredProjects = projects.filter((project) => {
        const name = project.name?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return name.includes(search);
    });

    const toggleMember = (memberId: string) => {
        setSelectedMembers((prev) =>
            prev.includes(memberId)
                ? prev.filter((id) => id !== memberId)
                : [...prev, memberId]
        );
    };

    const handleShareToChat = async () => {
        if (selectedMembers.length === 0) {
            toast.error('Please select at least one member');
            return;
        }

        setIsSending(true);

        try {
            if (selectedMembers.length === 1 || sendMode === 'individual') {
                for (const memberId of selectedMembers) {
                    const conversationId = await api.post<string>('/chat/start', {
                        target_user_id: memberId,
                    });
                    await api.post(`/chat/${conversationId}/messages`, {
                        content: '',
                        shared_note_id: noteId,
                    });
                }
                toast.success(`Node shared with ${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''}`);
            } else {
                const groupTitle = `Node: ${noteTitle.substring(0, 25)}${noteTitle.length > 25 ? '...' : ''}`;
                const conversationId = await api.post<string>('/chat/group', {
                    title: groupTitle,
                    participant_ids: selectedMembers,
                });
                await api.post(`/chat/${conversationId}/messages`, {
                    content: '',
                    shared_note_id: noteId,
                });
                toast.success('Node shared in new group chat');
            }
            onClose();
        } catch (error) {
            console.error('Error sharing node:', error);
            toast.error('Failed to share node');
        } finally {
            setIsSending(false);
        }
    };

    const handleShareToGroup = async () => {
        if (!selectedGroup) {
            toast.error(`Please select a ${activeTab === 'groups' ? 'group' : 'project'}`);
            return;
        }

        setIsSending(true);

        try {
            // Determine endpoint based on active tab
            if (activeTab === 'projects') {
                await api.post(`/projects/${selectedGroup}/messages`, {
                    content: `📌 Shared Node: ${noteTitle}`,
                    shared_note_id: noteId,
                });
            } else {
                await api.post(`/idea-groups/${selectedGroup}/messages`, {
                    content: `📌 Shared Node: ${noteTitle}`,
                    shared_note_id: noteId,
                });
            }

            toast.success(`Node shared to ${activeTab === 'groups' ? 'group' : 'project'}`);
            onClose();
        } catch (error) {
            console.error('Error sharing to group:', error);
            toast.error(`Failed to share to ${activeTab === 'groups' ? 'group' : 'project'}`);
        } finally {
            setIsSending(false);
        }
    };

    const getUserInitials = (member: Member) => {
        if (!member.name) return 'U';
        const parts = member.name.split(' ');
        const first = parts[0]?.[0] || '';
        const last = parts[1]?.[0] || '';
        return `${first}${last}`.toUpperCase() || 'U';
    };

    const getGroupInitials = (name: string) => {
        return name?.substring(0, 2).toUpperCase() || 'G';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-lg text-gray-900">Share Node</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => { setActiveTab('chat'); setSelectedGroup(null); }}
                        className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'chat'
                            ? 'text-black border-b-2 border-black bg-gray-50'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <MessageCircle size={16} />
                        Chat
                    </button>
                    <button
                        onClick={() => { setActiveTab('groups'); setSelectedMembers([]); }}
                        className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'groups'
                            ? 'text-black border-b-2 border-black bg-gray-50'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Users size={16} />
                        Groups
                    </button>
                    <button
                        onClick={() => { setActiveTab('projects'); setSelectedMembers([]); }}
                        className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'projects'
                            ? 'text-black border-b-2 border-black bg-gray-50'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Rocket size={16} />
                        Projects
                    </button>
                </div>

                {/* Search */}
                <div className="px-5 py-3 border-b border-gray-100">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'chat' ? "Search members..." : activeTab === 'groups' ? "Search groups..." : "Search projects..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 text-sm"
                        />
                    </div>
                </div>

                {/* Send Mode Toggle (only for chat tab with multiple selected) */}
                {activeTab === 'chat' && selectedMembers.length > 1 && (
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSendMode('individual')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${sendMode === 'individual'
                                    ? 'bg-black text-white'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                Send Individually
                            </button>
                            <button
                                onClick={() => setSendMode('group')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${sendMode === 'group'
                                    ? 'bg-black text-white'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <Users size={14} />
                                Create Chat Group
                            </button>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="max-h-[300px] overflow-y-auto">
                    {activeTab === 'chat' ? (
                        // Members List
                        membersLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : filteredMembers.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No members found
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {filteredMembers.map((member) => (
                                    <button
                                        key={member.id}
                                        onClick={() => toggleMember(member.id)}
                                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white text-sm font-medium shrink-0 overflow-hidden">
                                            {member.avatar_url ? (
                                                <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                                            ) : (
                                                getUserInitials(member)
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 truncate">{member.name}</div>
                                            <div className="text-sm text-gray-500 truncate">{member.job_title || member.role}</div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedMembers.includes(member.id) ? 'bg-black border-black' : 'border-gray-300'
                                            }`}>
                                            {selectedMembers.includes(member.id) && <Check size={12} className="text-white" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )
                    ) : activeTab === 'groups' ? (
                        // Groups List
                        groupsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No groups found
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {filteredGroups.map((group) => (
                                    <button
                                        key={group.id}
                                        onClick={() => setSelectedGroup(group.id === selectedGroup ? null : group.id)}
                                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                                            style={{ backgroundColor: group.color || '#6B7280' }}
                                        >
                                            {getGroupInitials(group.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 truncate">{group.name}</div>
                                            <div className="text-sm text-gray-500 truncate">
                                                {group.members?.length || 0} members
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedGroup === group.id ? 'bg-black border-black' : 'border-gray-300'
                                            }`}>
                                            {selectedGroup === group.id && <Check size={12} className="text-white" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )
                    ) : (
                        // Projects List
                        projectsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : filteredProjects.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No projects found
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {filteredProjects.map((project) => (
                                    <button
                                        key={project.id}
                                        onClick={() => setSelectedGroup(project.id === selectedGroup ? null : project.id)}
                                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                                            style={{ backgroundColor: project.color || '#6366f1' }}
                                        >
                                            <Rocket size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 truncate">{project.name}</div>
                                            <div className="text-sm text-gray-500 truncate">
                                                {project.member_count || 0} members
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedGroup === project.id ? 'bg-black border-black' : 'border-gray-300'
                                            }`}>
                                            {selectedGroup === project.id && <Check size={12} className="text-white" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={activeTab === 'chat' ? handleShareToChat : handleShareToGroup}
                        disabled={(activeTab === 'chat' && selectedMembers.length === 0) || ((activeTab === 'groups' || activeTab === 'projects') && !selectedGroup) || isSending}
                        className="w-full bg-black text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSending ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send size={18} />
                                {activeTab === 'chat'
                                    ? `Share with ${selectedMembers.length || 0} member${selectedMembers.length !== 1 ? 's' : ''}`
                                    : activeTab === 'groups'
                                        ? (selectedGroup ? 'Share to Group' : 'Select a Group')
                                        : (selectedGroup ? 'Share to Project' : 'Select a Project')
                                }
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
