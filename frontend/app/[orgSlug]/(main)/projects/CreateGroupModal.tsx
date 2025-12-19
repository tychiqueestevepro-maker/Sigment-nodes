'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Rocket, Users, Search, Crown, ArrowLeft, ChevronRight } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useApiClient } from '@/hooks/useApiClient';

interface CreateGroupModalProps {
    onClose: () => void;
    onCreate: (name: string, description: string, color: string, memberIds: string[], leadId?: string) => void;
}

export default function CreateGroupModal({ onClose, onCreate }: CreateGroupModalProps) {
    const { user } = useUser();
    const { organization } = useOrganization();
    const apiClient = useApiClient();

    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#22c55e'); // Default green
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Member selection state
    const [orgMembers, setOrgMembers] = useState<any[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [projectLeadId, setProjectLeadId] = useState<string>('');
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);

    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6b7280'];

    // Fetch members on mount
    useEffect(() => {
        if (organization?.slug) {
            fetchMembers();
        }
    }, [organization?.slug]);

    // Ensure current user is always selected and default lead
    useEffect(() => {
        if (user?.id) {
            setSelectedMembers(prev => {
                const newSet = new Set(prev);
                newSet.add(user.id);
                return newSet;
            });
            if (!projectLeadId) {
                setProjectLeadId(user.id);
            }
        }
    }, [user?.id]);

    const fetchMembers = async () => {
        setIsLoadingMembers(true);
        try {
            const members = await apiClient.get<any[]>(`/organizations/${organization!.slug}/members`);
            setOrgMembers(members);
        } catch (error) {
            console.error('Error fetching org members:', error);
        } finally {
            setIsLoadingMembers(false);
        }
    };

    const handleCreate = async () => {
        if (!name.trim() || isSubmitting) return;
        setIsSubmitting(true);
        await onCreate(name, description, color, Array.from(selectedMembers), projectLeadId || undefined);
        setIsSubmitting(false);
        // Don't call onClose() here - let the parent handle it after navigation
    };

    const filteredMembers = orgMembers.filter(member => {
        const query = memberSearchQuery.toLowerCase();
        const memberName = member.name?.toLowerCase() || '';
        const jobTitle = member.job_title?.toLowerCase() || '';
        const email = member.email?.toLowerCase() || '';
        return memberName.includes(query) || jobTitle.includes(query) || email.includes(query);
    });

    const leadName = orgMembers.find(m => m.id === projectLeadId)?.name;

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4"
            >
                <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="p-8 pb-4 flex items-start justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                {step === 1 ? 'Create New Project' : 'Select Team Members'}
                            </h3>
                            <p className="text-gray-500 mt-1">
                                {step === 1 ? 'Set up your project workspace' : 'Choose who will work on this project'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-8">
                        <AnimatePresence mode="wait">
                            {step === 1 ? (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="py-6 space-y-8"
                                >
                                    {/* Name Input */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-3">Project Name</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Website Redesign, Q4 Marketing Campaign"
                                            className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-xl font-semibold placeholder:text-gray-300"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(2)}
                                        />
                                    </div>

                                    {/* Description Input */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-3">Description (Optional)</label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="What is this project about?"
                                            rows={4}
                                            className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all resize-none text-gray-700 font-medium placeholder:text-gray-400"
                                        />
                                    </div>

                                    {/* Color Selection */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-4">Project Color</label>
                                        <div className="flex flex-wrap gap-4">
                                            {colors.map(c => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => setColor(c)}
                                                    className={`w-11 h-11 rounded-full transition-all flex items-center justify-center ${color === c ? 'ring-[3px] ring-offset-2 ring-black scale-110' : 'hover:scale-110 hover:shadow-lg opacity-80 hover:opacity-100'
                                                        }`}
                                                    style={{ backgroundColor: c }}
                                                >
                                                    {color === c && <Check size={20} className="text-white font-bold" strokeWidth={4} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="py-6 space-y-6"
                                >
                                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                                            <Users size={16} className="text-gray-400" />
                                            Team Members
                                        </h3>
                                        <p className="text-xs text-gray-500 mb-5">
                                            Check members and click on <Crown size={14} className="inline" /> for the lead
                                        </p>

                                        {/* Search Bar */}
                                        <div className="relative mb-6">
                                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                                            <input
                                                type="text"
                                                value={memberSearchQuery}
                                                onChange={(e) => setMemberSearchQuery(e.target.value)}
                                                placeholder="Search by name, role or email..."
                                                className="w-full pl-12 pr-5 py-3.5 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-200 text-sm bg-gray-50/30 font-medium placeholder:text-gray-400"
                                            />
                                        </div>

                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                                            {isLoadingMembers ? (
                                                <div className="flex justify-center py-12">
                                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
                                                </div>
                                            ) : filteredMembers.length === 0 ? (
                                                <div className="text-center py-12 text-gray-400 text-sm font-medium">No members found matching your search</div>
                                            ) : (
                                                filteredMembers.map((member) => {
                                                    const isSelected = selectedMembers.has(member.id);
                                                    const isLead = projectLeadId === member.id;
                                                    const isYou = member.id === user?.id;

                                                    return (
                                                        <div
                                                            key={member.id}
                                                            className={`flex items-center gap-4 p-4 rounded-2xl transition-all border-2 ${isSelected
                                                                ? isLead ? 'border-black bg-white shadow-sm' : 'border-gray-100 bg-gray-50/30'
                                                                : 'border-transparent bg-white hover:bg-gray-50/50'
                                                                }`}
                                                        >
                                                            {/* Checkbox */}
                                                            <div className="flex items-center justify-center shrink-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    disabled={isYou} // Cannot unselect self
                                                                    onChange={(e) => {
                                                                        const newSet = new Set(selectedMembers);
                                                                        if (e.target.checked) {
                                                                            newSet.add(member.id);
                                                                        } else {
                                                                            newSet.delete(member.id);
                                                                            if (member.id === projectLeadId) {
                                                                                setProjectLeadId('');
                                                                            }
                                                                        }
                                                                        setSelectedMembers(newSet);
                                                                    }}
                                                                    className="w-5 h-5 cursor-pointer accent-black rounded-lg border-gray-300"
                                                                />
                                                            </div>

                                                            {/* Crown Icon */}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isLead) {
                                                                        setProjectLeadId('');
                                                                    } else {
                                                                        setProjectLeadId(member.id);
                                                                        setSelectedMembers(prev => new Set(prev).add(member.id));
                                                                    }
                                                                }}
                                                                className={`p-2 rounded-xl transition-all shrink-0 ${isLead
                                                                    ? 'bg-black text-white shadow-md'
                                                                    : 'text-gray-200 hover:text-gray-400 hover:bg-gray-100'
                                                                    }`}
                                                                title={isLead ? 'Remove as lead' : 'Assign as lead'}
                                                            >
                                                                <Crown size={18} />
                                                            </button>

                                                            {/* Avatar */}
                                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base border-2 overflow-hidden shrink-0 ${isLead
                                                                ? 'border-black bg-black text-white'
                                                                : 'border-white bg-gray-100 text-gray-700 shadow-sm'
                                                                }`}>
                                                                {member.avatar_url ? (
                                                                    <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span>{member.name?.substring(0, 2).toUpperCase()}</span>
                                                                )}
                                                            </div>

                                                            {/* Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-gray-900 flex items-center gap-2 truncate text-base">
                                                                    {member.name}
                                                                    {isYou && (
                                                                        <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider">You</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-400 font-medium truncate">{member.job_title || 'Team Member'}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Selection Info Bar */}
                                    <div className="flex items-center justify-between px-2 pt-2">
                                        <div className="text-sm text-gray-400 font-semibold">
                                            {selectedMembers.size} {selectedMembers.size > 1 ? 'members' : 'member'} selected
                                        </div>
                                        {projectLeadId && (
                                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-4 py-2 rounded-2xl shadow-sm">
                                                <Crown size={16} className="text-black" />
                                                <span className="text-sm font-bold text-black">{leadName}</span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="p-8 pt-6 flex justify-between items-center bg-white">
                        {step === 2 && (
                            <button
                                onClick={() => setStep(1)}
                                className="px-8 py-4 text-gray-900 font-bold flex items-center gap-3 transition-all hover:bg-gray-50 rounded-2xl border border-gray-100"
                            >
                                <ArrowLeft size={20} />
                                Back
                            </button>
                        )}
                        <div className="ml-auto flex gap-4">
                            {step === 1 ? (
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={!name.trim()}
                                    className="px-10 py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center gap-3 shadow-[0_10px_30px_rgb(0,0,0,0.1)] hover:-translate-y-1 active:translate-y-0"
                                >
                                    Next
                                    <ChevronRight size={20} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleCreate}
                                    disabled={!name.trim() || isSubmitting}
                                    className="px-10 py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center gap-3 shadow-[0_10px_30px_rgb(0,0,0,0.1)] hover:-translate-y-1 active:translate-y-0"
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Project'}
                                    {!isSubmitting && <Rocket size={20} />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}
