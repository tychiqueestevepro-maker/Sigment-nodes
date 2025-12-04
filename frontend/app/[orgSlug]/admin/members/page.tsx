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

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <InviteMemberModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                orgSlug={orgSlug}
                orgId={organization?.id || ''}
            />

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
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Active Now</div>
                    <div className="text-3xl font-bold text-gray-900">{stats.active}</div>
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

            {/* Invite Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8 flex items-center justify-between">
                <div>
                    <h3 className="text-blue-900 font-bold text-lg mb-1">Invite your team</h3>
                    <p className="text-blue-700 text-sm">Send this link to your team members so they can create their profile.</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white px-4 py-2 rounded-lg border border-blue-200 text-gray-500 text-sm flex items-center gap-2 min-w-[300px]">
                        <span className="truncate">https://sigment.com/join/workspace...</span>
                    </div>
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
                    >
                        <Copy size={16} /> Copy
                    </button>
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex items-center justify-between mb-6">
                <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search members..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
                    />
                </div>
                <div className="flex gap-3">
                    <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
                        <Filter size={16} /> Filters
                    </button>
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="bg-black text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        <UserPlus size={16} /> Invite Member
                    </button>
                </div>
            </div>

            {/* Members Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="w-12 p-4 text-left">
                                <input type="checkbox" className="rounded border-gray-300 text-black focus:ring-black" />
                            </th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User Profile</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">Loading members...</td>
                            </tr>
                        ) : members.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">No members found.</td>
                            </tr>
                        ) : (
                            members.map((member) => (
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
                                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                                            <span className={`w-2 h-2 rounded-full ${member.status === 'Active' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">
                                        {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <MemberActionsMenu
                                            currentUserRole={userRole || ''}
                                            currentUserId={user?.id}
                                            targetMember={member}
                                            onAction={(action, m) => console.log(action, m)}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-sm text-gray-500">
                    <div>Showing <span className="font-medium text-gray-900">{members.length > 0 ? 1 : 0}-{members.length}</span> of <span className="font-medium text-gray-900">{stats.total}</span> members</div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">Previous</button>
                        <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
