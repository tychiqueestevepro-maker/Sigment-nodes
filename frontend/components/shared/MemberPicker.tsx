'use client';

import { useState, useEffect } from 'react';
import { Search, X, User as UserIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrganization } from '@/contexts/OrganizationContext';

interface Member {
    id: string;
    name: string;
    email: string;
    job_title: string;
    avatar_url?: string;
}

interface MemberPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (memberId: string) => void;
    multiple?: boolean;
    onSelectMultiple?: (memberIds: string[], title: string) => void;
}

export function MemberPicker({ isOpen, onClose, onSelect, multiple, onSelectMultiple }: MemberPickerProps) {
    const { organization } = useOrganization();
    const [members, setMembers] = useState<Member[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [groupTitle, setGroupTitle] = useState('');

    useEffect(() => {
        if (isOpen && organization?.slug) {
            fetchMembers();
            setSelectedIds(new Set());
            setGroupTitle('');
        }
    }, [isOpen, organization?.slug]);

    const fetchMembers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/v1/organizations/${organization!.slug}/members`);
            if (res.ok) {
                const data = await res.json();
                setMembers(data);
            }
        } catch (error) {
            console.error('Failed to fetch members', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (memberId: string) => {
        if (multiple) {
            const newSelected = new Set(selectedIds);
            if (newSelected.has(memberId)) {
                newSelected.delete(memberId);
            } else {
                newSelected.add(memberId);
            }
            setSelectedIds(newSelected);
        } else {
            onSelect(memberId);
        }
    };

    const handleCreateGroup = () => {
        if (onSelectMultiple && selectedIds.size > 0 && groupTitle.trim()) {
            onSelectMultiple(Array.from(selectedIds), groupTitle);
        }
    };

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.job_title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden pointer-events-auto flex flex-col max-h-[80vh]">
                            {/* Header */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
                                <h3 className="font-semibold text-gray-900">{multiple ? 'New Group Chat' : 'New Message'}</h3>
                                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Group Name Input (Only if multiple) */}
                            {multiple && (
                                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Group Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Marketing Team"
                                        value={groupTitle}
                                        onChange={(e) => setGroupTitle(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
                                    />
                                </div>
                            )}

                            {/* Search */}
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search people..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus={!multiple}
                                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
                                    />
                                </div>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto p-2">
                                {isLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                    </div>
                                ) : filteredMembers.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        No members found.
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredMembers.map(member => {
                                            const isSelected = selectedIds.has(member.id);
                                            return (
                                                <button
                                                    key={member.id}
                                                    onClick={() => handleSelect(member.id)}
                                                    className={`w-full p-3 flex items-center space-x-3 hover:bg-gray-50 rounded-xl transition-colors text-left group ${isSelected ? 'bg-gray-50 ring-1 ring-black/5' : ''}`}
                                                >
                                                    <div className="relative">
                                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-gray-100">
                                                            {member.avatar_url ? (
                                                                <img src={member.avatar_url} alt={member.name} className="w-full h-full rounded-full object-cover" />
                                                            ) : (
                                                                member.name.charAt(0)
                                                            )}
                                                        </div>
                                                        {multiple && isSelected && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white rounded-full flex items-center justify-center border border-white">
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-gray-900 truncate">{member.name}</div>
                                                        <div className="text-xs text-gray-500 truncate">{member.job_title || 'Member'}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Footer (Create Button) */}
                            {multiple && (
                                <div className="p-4 border-t border-gray-100 bg-gray-50">
                                    <button
                                        onClick={handleCreateGroup}
                                        disabled={selectedIds.size === 0 || !groupTitle.trim()}
                                        className="w-full py-2.5 bg-black text-white rounded-xl font-medium shadow-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Create Group ({selectedIds.size})
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
