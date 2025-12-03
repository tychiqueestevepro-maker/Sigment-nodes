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
}

export function MemberPicker({ isOpen, onClose, onSelect }: MemberPickerProps) {
    const { organization } = useOrganization();
    const [members, setMembers] = useState<Member[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && organization?.slug) {
            fetchMembers();
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
                                <h3 className="font-semibold text-gray-900">New Message</h3>
                                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search people..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
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
                                        {filteredMembers.map(member => (
                                            <button
                                                key={member.id}
                                                onClick={() => onSelect(member.id)}
                                                className="w-full p-3 flex items-center space-x-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-gray-100">
                                                    {member.avatar_url ? (
                                                        <img src={member.avatar_url} alt={member.name} className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        member.name.charAt(0)
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-900 truncate">{member.name}</div>
                                                    <div className="text-xs text-gray-500 truncate">{member.job_title || 'Member'}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
