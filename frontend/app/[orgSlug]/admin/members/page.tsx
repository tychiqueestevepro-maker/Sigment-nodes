'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Search,
    Filter,
    UserPlus,
    MoreHorizontal,
    Copy,
    CheckCircle,
    ArrowLeft,
    Shield,
    Crown,
    Briefcase,
    User
} from 'lucide-react';
import { InviteMemberModal } from '@/components/owner/InviteMemberModal';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MemberActionsMenu } from '@/components/shared/MemberActionsMenu';
import { useUser } from '@/contexts/UserContext';

export default function OwnerAdminPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;

    const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);
    const { organization, userRole } = useOrganization();
    const { user } = useUser();

    const [members, setMembers] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [stats, setStats] = React.useState({
        total: 0,
        active: 0,
        pending: 0
    });

    // Pagination
    const [currentPage, setCurrentPage] = React.useState(1);
    const MEMBERS_PER_PAGE = 50;

    // Search and Filters
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showFilters, setShowFilters] = React.useState(false);
    const [filters, setFilters] = React.useState({
        role: '',
        seniority: '',
        joinedAfter: '',
        joinedBefore: '',
        status: ''
    });

    // Fallback: get user ID and role from localStorage if context is empty
    const effectiveUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('sigment_user_id') : null);
    const effectiveUserRole = userRole || (typeof window !== 'undefined' ? localStorage.getItem('sigment_user_role') : null);

    // Filter members based on search and filters
    const filteredMembers = React.useMemo(() => {
        return members.filter(member => {
            // Search filter (name or email)
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                member.name?.toLowerCase().includes(searchLower) ||
                member.email?.toLowerCase().includes(searchLower);

            // Role filter
            const matchesRole = !filters.role || member.role === filters.role;

            // Seniority filter
            const matchesSeniority = !filters.seniority ||
                String(member.seniority_level) === filters.seniority;

            // Status filter
            const matchesStatus = !filters.status || member.status === filters.status;

            // Date filters
            const joinedDate = member.joined_at ? new Date(member.joined_at) : null;
            const matchesJoinedAfter = !filters.joinedAfter ||
                (joinedDate && joinedDate >= new Date(filters.joinedAfter));
            const matchesJoinedBefore = !filters.joinedBefore ||
                (joinedDate && joinedDate <= new Date(filters.joinedBefore));

            return matchesSearch && matchesRole && matchesSeniority &&
                matchesStatus && matchesJoinedAfter && matchesJoinedBefore;
        });
    }, [members, searchQuery, filters]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filters]);

    React.useEffect(() => {
        if (orgSlug && organization?.id) {
            fetchData();
        }
    }, [orgSlug, organization?.id]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Members
            const membersRes = await fetch(`http://localhost:8000/api/v1/organizations/${orgSlug}/members`);
            const membersData = membersRes.ok ? await membersRes.json() : [];

            // Fetch Pending Invites
            let pendingCount = 0;
            if (organization?.id) {
                const invitesRes = await fetch(`http://localhost:8000/api/invitations?organization_id=${organization.id}`);
                if (invitesRes.ok) {
                    const invitesData = await invitesRes.json();
                    pendingCount = invitesData.length;
                }
            }

            setMembers(membersData);
            setStats({
                total: membersData.length,
                active: membersData.filter((m: any) => m.status === 'Active').length,
                pending: pendingCount
            });

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Edit Title Modal State
    const [editTitleModal, setEditTitleModal] = React.useState<{ isOpen: boolean; member: any | null; newTitle: string }>({
        isOpen: false,
        member: null,
        newTitle: ''
    });

    // Handle member actions
    const handleMemberAction = async (action: string, member: any) => {
        const baseUrl = `http://localhost:8000/api/v1/organizations/${orgSlug}/members`;

        try {
            switch (action) {
                case 'promote':
                    await fetch(`${baseUrl}/role`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: member.id, new_role: 'BOARD' })
                    });
                    break;

                case 'demote':
                    await fetch(`${baseUrl}/role`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: member.id, new_role: 'MEMBER' })
                    });
                    break;

                case 'edit_title':
                    setEditTitleModal({ isOpen: true, member, newTitle: member.job_title || '' });
                    return; // Don't refresh yet, wait for modal submit

                case 'suspend':
                    if (!confirm(`Are you sure you want to suspend ${member.name}'s account?`)) return;
                    await fetch(`${baseUrl}/suspend`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: member.id })
                    });
                    break;

                case 'reactivate':
                    await fetch(`${baseUrl}/reactivate`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: member.id })
                    });
                    break;

                case 'remove':
                    if (!confirm(`Are you sure you want to remove ${member.name} from the team? This action cannot be undone.`)) return;
                    await fetch(`${baseUrl}/${member.id}`, {
                        method: 'DELETE'
                    });
                    break;

                default:
                    console.log('Unknown action:', action);
                    return;
            }

            // Refresh members list after action
            fetchData();

        } catch (error) {
            console.error('Error performing action:', error);
            alert('Failed to perform action. Please try again.');
        }
    };

    // Handle Edit Title Submit
    const handleEditTitleSubmit = async () => {
        if (!editTitleModal.member) return;

        try {
            await fetch(`http://localhost:8000/api/v1/organizations/${orgSlug}/members/title`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: editTitleModal.member.id,
                    job_title: editTitleModal.newTitle
                })
            });

            setEditTitleModal({ isOpen: false, member: null, newTitle: '' });
            fetchData();
        } catch (error) {
            console.error('Error updating title:', error);
            alert('Failed to update title. Please try again.');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <InviteMemberModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                orgSlug={orgSlug}
                orgId={organization?.id || ''}
            />

            {/* Edit Title Modal */}
            {editTitleModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Job Title</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Update job title for <strong>{editTitleModal.member?.name}</strong>
                        </p>
                        <input
                            type="text"
                            value={editTitleModal.newTitle}
                            onChange={(e) => setEditTitleModal(prev => ({ ...prev, newTitle: e.target.value }))}
                            placeholder="Enter new job title..."
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 mb-4"
                            autoFocus
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setEditTitleModal({ isOpen: false, member: null, newTitle: '' })}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditTitleSubmit}
                                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                            Admin Panel
                        </span>
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-0.5 rounded-full">
                            <CheckCircle size={12} /> Active
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Members</h1>
                    <p className="text-lg text-gray-500 mt-1">
                        Manage your organization's configuration and members.
                    </p>
                </div>
                <button
                    onClick={() => router.push(`/${orgSlug}`)}
                    className="flex items-center gap-2 text-gray-600 hover:text-black bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all group"
                >
                    <span className="font-medium text-sm">Back to Workspace</span>
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Members</div>
                    <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
                    <div className="text-sm text-green-600 mt-1 font-medium">↗ +{stats.total} this week</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Suspended Accounts</div>
                    <div className="text-3xl font-bold text-gray-900">{members.filter(m => m.status === 'suspended').length}</div>
                </div>
                <div
                    onClick={() => router.push(`/${orgSlug}/admin/members/invitations`)}
                    className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
                >
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 group-hover:text-blue-600 transition-colors">Invitations</div>
                    <div className="text-3xl font-bold text-gray-900">{stats.pending}</div>
                    <div className="text-xs text-blue-600 mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">View details →</div>
                </div>
            </div>



            {/* Filters & Actions */}
            <div className="flex items-center justify-between mb-4">
                <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${showFilters ? 'ring-2 ring-black/10' : ''}`}
                    >
                        <Filter size={16} /> Filters
                        {(filters.role || filters.seniority || filters.status || filters.joinedAfter || filters.joinedBefore) && (
                            <span className="w-2 h-2 bg-black rounded-full"></span>
                        )}
                    </button>
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="bg-black text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        <UserPlus size={16} /> Invite Member
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
                    <div className="grid grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                            <select
                                value={filters.role}
                                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                            >
                                <option value="">All Roles</option>
                                <option value="OWNER">Owner</option>
                                <option value="BOARD">Board</option>
                                <option value="MEMBER">Member</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Seniority Level</label>
                            <select
                                value={filters.seniority}
                                onChange={(e) => setFilters(prev => ({ ...prev, seniority: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                            >
                                <option value="">All Levels</option>
                                <option value="1">1 - Junior</option>
                                <option value="2">2</option>
                                <option value="3">3 - Mid</option>
                                <option value="4">4</option>
                                <option value="5">5 - Senior</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                            >
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Joined After</label>
                            <input
                                type="date"
                                value={filters.joinedAfter}
                                onChange={(e) => setFilters(prev => ({ ...prev, joinedAfter: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Joined Before</label>
                            <input
                                type="date"
                                value={filters.joinedBefore}
                                onChange={(e) => setFilters(prev => ({ ...prev, joinedBefore: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                        <button
                            onClick={() => setFilters({ role: '', seniority: '', joinedAfter: '', joinedBefore: '', status: '' })}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            Clear all filters
                        </button>
                    </div>
                </div>
            )}
            {/* Members Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-visible">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="w-12 p-4 text-left">
                                <input type="checkbox" className="rounded border-gray-300 text-black focus:ring-black" />
                            </th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User Profile</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Title</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Seniority</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500">Loading members...</td>
                            </tr>
                        ) : members.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500">No members found.</td>
                            </tr>
                        ) : (() => {
                            // Pagination logic
                            const startIndex = (currentPage - 1) * MEMBERS_PER_PAGE;
                            const endIndex = startIndex + MEMBERS_PER_PAGE;
                            const paginatedMembers = filteredMembers.slice(startIndex, endIndex);
                            const totalPages = Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE);

                            return paginatedMembers.map((member) => (
                                <tr key={member.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-4">
                                        <input type="checkbox" className="rounded border-gray-300 text-black focus:ring-black" />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                                                {member.avatar_url ? (
                                                    <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    member.name.substring(0, 2).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{member.name}</div>
                                                <div className="text-sm text-gray-500">{member.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700">
                                            {member.role === 'OWNER' && <Crown size={12} className="text-yellow-600" />}
                                            {member.role === 'BOARD' && <Briefcase size={12} className="text-blue-600" />}
                                            {member.role === 'MEMBER' && <User size={12} className="text-gray-600" />}
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-sm text-gray-700">
                                            {member.job_title || '-'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-sm text-gray-700">
                                            {member.seniority_level || '-'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">
                                        {member.joined_at ? new Date(member.joined_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <MemberActionsMenu
                                            currentUserRole={effectiveUserRole || ''}
                                            currentUserId={effectiveUserId || undefined}
                                            targetMember={member}
                                            onAction={handleMemberAction}
                                        />
                                    </td>
                                </tr>
                            ));
                        })()
                        }
                    </tbody>
                </table>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-sm text-gray-500">
                    <div>
                        Showing <span className="font-medium text-gray-900">
                            {filteredMembers.length > 0 ? ((currentPage - 1) * MEMBERS_PER_PAGE) + 1 : 0}-{Math.min(currentPage * MEMBERS_PER_PAGE, filteredMembers.length)}
                        </span> of <span className="font-medium text-gray-900">{filteredMembers.length}</span> members
                        {filteredMembers.length !== members.length && (
                            <span className="text-gray-400 ml-1">(filtered from {members.length})</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE), p + 1))}
                            disabled={currentPage >= Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE)}
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
