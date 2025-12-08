'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, Plus, Layers, Users, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApiClient } from '@/hooks/useApiClient';
import { MemberPicker } from './MemberPicker';
import toast from 'react-hot-toast';

interface IdeaGroup {
    id: string;
    name: string;
    description?: string;
    color: string;
    member_count: number;
    item_count: number;
    is_admin: boolean;
}

interface GroupPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (groupId: string) => void;
    noteId?: string;  // If provided, the note will be added to the selected group
    clusterId?: string;  // If provided, the cluster will be added to the selected group
}

export function GroupPicker({ isOpen, onClose, onSelect, noteId, clusterId }: GroupPickerProps) {
    const apiClient = useApiClient();
    const [groups, setGroups] = useState<IdeaGroup[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateFlow, setShowCreateFlow] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupColor, setNewGroupColor] = useState('#6366f1');
    const [assignedGroupIds, setAssignedGroupIds] = useState<Set<string>>(new Set());
    const [showMemberPicker, setShowMemberPicker] = useState(false);

    const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
        '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6b7280',
    ];

    useEffect(() => {
        if (isOpen) {
            fetchGroups();
            setSearchQuery('');
            setShowCreateFlow(false);
            setShowMemberPicker(false);
            // Reset create form
            setNewGroupName('');
            setNewGroupColor('#6366f1');
        }
    }, [isOpen]);

    useEffect(() => {
        const fetchAssigned = async () => {
            if (!noteId && !clusterId) return;
            try {
                const params = new URLSearchParams();
                if (noteId) params.append('note_id', noteId);
                if (clusterId) params.append('cluster_id', clusterId);
                const ids = await apiClient.get<string[]>(`/idea-groups/containing?${params.toString()}`);
                setAssignedGroupIds(new Set(ids));
            } catch (err) {
                console.error(err);
            }
        };
        if (isOpen) {
            fetchAssigned();
        } else {
            setAssignedGroupIds(new Set());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, noteId, clusterId]);

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const data = await apiClient.get<IdeaGroup[]>('/idea-groups');
            setGroups(data);
        } catch (error) {
            console.error('Failed to fetch groups', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectGroup = async (groupId: string) => {
        // If noteId or clusterId provided, add the item to the group
        if (noteId || clusterId) {
            try {
                await apiClient.post(`/idea-groups/${groupId}/items`, {
                    note_id: noteId || null,
                    cluster_id: clusterId || null
                });
                toast.success('Idea shared with group');
            } catch (error: any) {
                toast.error(error.message || 'Failed to share idea');
                return;
            }
        }
        onSelect(groupId);
    };

    const handleCreateGroup = async (memberIds: string[]) => {
        try {
            const groupId = await apiClient.post<string>('/idea-groups', {
                name: newGroupName,
                description: '',
                color: newGroupColor,
                member_ids: memberIds
            });

            // If noteId or clusterId provided, add the item to the new group
            if (noteId || clusterId) {
                await apiClient.post(`/idea-groups/${groupId}/items`, {
                    note_id: noteId || null,
                    cluster_id: clusterId || null
                });
            }

            toast.success('Group created');
            onSelect(groupId);
        } catch (error: any) {
            setShowMemberPicker(false);
            toast.error(error.message || 'Failed to create group');
        }
    };

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (typeof document === 'undefined') return null;

    // If showing member picker for new group creation
    if (isOpen && showMemberPicker) {
        return (
            <MemberPicker
                isOpen={true}
                onClose={() => {
                    setShowMemberPicker(false);
                    setShowCreateFlow(false);
                }}
                onSelect={() => { }}
                multiple={true}
                onSelectMultiple={(ids) => handleCreateGroup(ids)}
                title={`Add members to "${newGroupName}"`}
                hideGroupName={true}
            />
        );
    }

    // Don't render anything if not open
    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none p-4"
                    >
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden pointer-events-auto flex flex-col max-h-[80vh]">
                            {/* Header */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
                                <h3 className="font-semibold text-gray-900">
                                    {showCreateFlow ? 'Create New Group' : 'Share with Group'}
                                </h3>
                                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {showCreateFlow ? (
                                /* Create New Group Flow */
                                <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Group Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            placeholder="e.g., Product Innovation"
                                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                            autoFocus
                                        />
                                    </div>



                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Color
                                        </label>
                                        <div className="flex gap-2 flex-wrap">
                                            {colors.map((c) => (
                                                <button
                                                    key={c}
                                                    onClick={() => setNewGroupColor(c)}
                                                    className={`w-7 h-7 rounded-full transition-transform ${newGroupColor === c ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'}`}
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={() => setShowCreateFlow(false)}
                                            className="flex-1 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-50"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!newGroupName.trim()) {
                                                    toast.error('Please enter a group name');
                                                    return;
                                                }
                                                setShowMemberPicker(true);
                                            }}
                                            className="flex-1 py-2.5 bg-black text-white font-medium rounded-xl hover:bg-gray-800 flex items-center justify-center gap-2"
                                        >
                                            Add Members
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Select Existing Group */
                                <>
                                    {/* Search */}
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="Search groups..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                autoFocus
                                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Group List */}
                                    <div className="flex-1 overflow-y-auto p-2">
                                        {isLoading ? (
                                            <div className="flex justify-center py-8">
                                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                            </div>
                                        ) : filteredGroups.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500 text-sm">
                                                {groups.length === 0 ? 'No groups yet. Create one!' : 'No groups found.'}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {filteredGroups.map(group => {
                                                    const isAssigned = assignedGroupIds.has(group.id);
                                                    return (
                                                        <button
                                                            key={group.id}
                                                            onClick={() => !isAssigned && handleSelectGroup(group.id)}
                                                            disabled={isAssigned}
                                                            className={`w-full p-3 flex items-center space-x-3 rounded-xl transition-colors text-left group ${isAssigned ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <div
                                                                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                                                style={{ backgroundColor: group.color + '20' }}
                                                            >
                                                                <Layers className="w-5 h-5" style={{ color: group.color }} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-gray-900 truncate">
                                                                    {group.name}
                                                                    {isAssigned && <span className="ml-2 text-xs text-gray-400 font-normal italic">(Joined)</span>}
                                                                </div>
                                                                <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                                                                    <span className="flex items-center gap-1">
                                                                        <Users size={12} />
                                                                        {group.member_count}
                                                                    </span>
                                                                    <span>·</span>
                                                                    <span>{group.item_count} ideas</span>
                                                                </div>
                                                            </div>
                                                            {!isAssigned && <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Create New Group Button */}
                                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                                        <button
                                            onClick={() => setShowCreateFlow(true)}
                                            className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-gray-600 font-medium hover:border-gray-300 hover:bg-white transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus size={18} />
                                            Create New Group
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
