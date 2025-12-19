'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye, MessageCircle, Wrench, Clock, MoreVertical, ArrowLeft,
    Crown, CheckCircle2, Edit3, Users, UserPlus, LogOut, Trash2, X, UserMinus, ChevronRight
} from 'lucide-react';
import { ProjectProvider, useProject, ProjectMember, Project } from './ProjectContext';
import { MemberPicker } from '@/components/shared/MemberPicker';

// --- Helper Functions ---
function getInitials(member: ProjectMember | null): string {
    if (!member) return '?';
    const first = member.first_name?.[0] || '';
    const last = member.last_name?.[0] || '';
    return (first + last).toUpperCase() || member.email?.[0]?.toUpperCase() || '?';
}

function getDisplayName(member: ProjectMember | null): string {
    if (!member) return 'Unknown';
    if (member.first_name) {
        return `${member.first_name} ${member.last_name || ''}`.trim();
    }
    return member.email || 'Unknown';
}

// --- Tab Configuration ---
const tabs = [
    { key: 'overview', label: 'Overview', icon: Eye, path: 'overview' },
    { key: 'chat', label: 'Chat', icon: MessageCircle, path: 'chat' },
    { key: 'tools', label: 'Tools', icon: Wrench, path: 'tools' },
    { key: 'timeline', label: 'Timeline', icon: Clock, path: 'timeline' },
];

// --- Edit Group Modal ---
interface EditGroupModalProps {
    group: Project;
    onClose: () => void;
    onUpdate: (name: string, description: string, color: string) => void;
}

function EditGroupModal({ group, onClose, onUpdate }: EditGroupModalProps) {
    const [name, setName] = useState(group.name);
    const [color, setColor] = useState(group.color);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6b7280'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsSubmitting(true);
        await onUpdate(name, group.description || '', color);
        setIsSubmitting(false);
        onClose();
    };

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
                <div className="bg-white w-full max-w-md rounded-2xl shadow-xl pointer-events-auto">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Edit Project</h3>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                                placeholder="e.g. Marketing Team"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                            <div className="flex gap-2 flex-wrap">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-black scale-110' : 'hover:scale-105'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!name.trim() || isSubmitting}
                                className="flex-1 px-4 py-2.5 bg-black text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </>
    );
}

// --- Members Modal ---
interface MembersModalProps {
    members: ProjectMember[];
    isAdmin: boolean;
    creatorId: string;
    currentUserId?: string;
    onRemove: (userId: string) => void;
    onClose: () => void;
}

function MembersModal({ members, isAdmin, creatorId, currentUserId, onRemove, onClose }: MembersModalProps) {
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
                <div className="bg-white w-full max-w-md rounded-2xl shadow-xl pointer-events-auto">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{members.length} Members</h3>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    <div className="p-2 max-h-80 overflow-y-auto">
                        {members.map(member => {
                            const isMemberCreator = member.user_id === creatorId;
                            const isCurrentUser = member.user_id === currentUserId;
                            const canRemove = isAdmin && !isMemberCreator && !isCurrentUser;

                            return (
                                <div key={member.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl">
                                    {member.avatar_url ? (
                                        <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                                            {getInitials(member)}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 text-sm truncate">
                                                {getDisplayName(member)}
                                            </span>
                                            {isMemberCreator && <Crown className="w-3 h-3 text-amber-500" />}
                                            {member.role === 'lead' && !isMemberCreator && (
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Lead</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">{member.job_title || member.email}</p>
                                    </div>
                                    {canRemove && (
                                        <button
                                            onClick={() => onRemove(member.user_id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                        >
                                            <UserMinus size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </>
    );
}

// --- Project Header Component ---
function ProjectHeader() {
    const pathname = usePathname();
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const projectId = params.projectId as string;

    const {
        project,
        members,
        currentUser,
        updateProject,
        deleteProject,
        leaveProject,
        addMember,
        removeMember,
        onBack
    } = useProject();

    const [showMenu, setShowMenu] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    const changeStatus = async (newStatus: string) => {
        if (!project) return;
        console.log('🔄 Changing status to:', newStatus);
        await updateProject(project.name, project.description || '', project.color, newStatus);
        console.log('✅ Status changed, project should refresh');
    };

    if (!project) {
        // Loading skeleton
        return (
            <div className="px-8 pt-6 pb-4 bg-white border-b border-gray-200 animate-pulse">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-6 w-16 bg-gray-100 rounded-full"></div>
                            <div className="h-6 w-16 bg-gray-100 rounded-full"></div>
                        </div>
                        <div className="h-8 w-48 bg-gray-100 rounded mb-2"></div>
                        <div className="h-4 w-64 bg-gray-50 rounded"></div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-8 w-24 bg-gray-200 rounded-md"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isCreator = project.created_by === currentUser?.id;

    // Get active tab from pathname
    const getActiveTab = () => {
        if (pathname.includes('/chat')) return 'chat';
        if (pathname.includes('/tools')) return 'tools';
        if (pathname.includes('/timeline')) return 'timeline';
        return 'overview';
    };

    const activeTab = getActiveTab();

    return (
        <>
            <div className="px-8 pt-6 pb-4 bg-white border-b border-gray-200">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tracking-wider uppercase">
                                Project
                            </span>
                            {project.status === 'active' && (
                                <span className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded-full">
                                    <CheckCircle2 size={12} /> Active
                                </span>
                            )}
                            {project.status === 'archived' && (
                                <span className="flex items-center gap-1 text-yellow-600 text-xs font-bold bg-yellow-50 px-2 py-1 rounded-full">
                                    <Clock size={12} /> Archived
                                </span>
                            )}
                            {project.status === 'completed' && (
                                <span className="flex items-center gap-1 text-gray-600 text-xs font-bold bg-gray-100 px-2 py-1 rounded-full">
                                    <CheckCircle2 size={12} /> Completed
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                            {project.name}
                            {project.is_lead && <Crown className="w-5 h-5 text-amber-500" />}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {project.member_count} members · Created {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'recently'}
                        </p>
                    </div>

                    <div className="flex gap-2 items-center">
                        {/* Tab Navigation - Using Link for nested routes */}
                        <div className="bg-gray-100 p-1 rounded-lg flex mr-2">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.key;
                                const href = `/${orgSlug}/projects/${projectId}/${tab.path}`;

                                return (
                                    <Link
                                        key={tab.key}
                                        href={href}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${isActive
                                            ? 'bg-white text-black shadow-sm'
                                            : 'text-gray-500 hover:text-gray-900'
                                            }`}
                                    >
                                        <Icon size={14} />
                                        {tab.label}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Menu button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 text-gray-400 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                                        {project.is_lead && (
                                            <button
                                                onClick={() => {
                                                    setShowMenu(false);
                                                    setShowEditModal(true);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                            >
                                                <Edit3 size={16} /> Rename Project
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setShowMembersModal(true); setShowMenu(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            <Users size={16} /> View Members
                                        </button>
                                        {project.is_lead && (
                                            <button
                                                onClick={() => { setShowAddMemberModal(true); setShowMenu(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                            >
                                                <UserPlus size={16} /> Add Member
                                            </button>
                                        )}
                                        {project.is_lead && (
                                            <div className="relative group">
                                                <div className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                                    <div className="flex items-center gap-3">
                                                        <CheckCircle2 size={16} /> Change Status
                                                    </div>
                                                    <ChevronRight size={14} />
                                                </div>
                                                {/* Status submenu */}
                                                <div className="absolute left-full top-0 ml-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                                    <button
                                                        onClick={() => {
                                                            changeStatus('active');
                                                            setShowMenu(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                                        Active
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            changeStatus('archived');
                                                            setShowMenu(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 flex items-center gap-2"
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                                        Archived
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            changeStatus('completed');
                                                            setShowMenu(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                                                        Completed
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {!project.is_lead && (
                                            <button
                                                onClick={() => { leaveProject(); setShowMenu(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <LogOut size={16} /> Leave Project
                                            </button>
                                        )}
                                        {project.is_lead && (
                                            <button
                                                onClick={() => { deleteProject(); setShowMenu(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 size={16} /> Delete Project
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Back button */}
                        <button
                            onClick={onBack}
                            className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-gray-700 hover:text-black hover:shadow-md transition-all font-medium"
                        >
                            Back
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showEditModal && (
                    <EditGroupModal
                        group={project}
                        onClose={() => setShowEditModal(false)}
                        onUpdate={updateProject}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showMembersModal && (
                    <MembersModal
                        members={members}
                        isAdmin={project.is_lead}
                        creatorId={project.created_by}
                        currentUserId={currentUser?.id}
                        onRemove={removeMember}
                        onClose={() => setShowMembersModal(false)}
                    />
                )}
            </AnimatePresence>

            {showAddMemberModal && (
                <MemberPicker
                    isOpen={true}
                    onClose={() => setShowAddMemberModal(false)}
                    onSelect={(memberId) => {
                        addMember(memberId);
                        setShowAddMemberModal(false);
                    }}
                    excludeIds={members.map(m => m.user_id)}
                    title="Add member to project"
                />
            )}
        </>
    );
}

// --- Layout Content Component ---
function ProjectLayoutContent({ children }: { children: ReactNode }) {
    return (
        <div className="h-full w-full bg-white flex flex-col animate-in fade-in duration-300">
            <ProjectHeader />
            <div className="flex-1 overflow-hidden flex flex-col">
                {children}
            </div>
        </div>
    );
}

// --- Main Layout Export ---
export default function ProjectLayout({ children }: { children: ReactNode }) {
    return (
        <ProjectProvider>
            <ProjectLayoutContent>
                {children}
            </ProjectLayoutContent>
        </ProjectProvider>
    );
}
