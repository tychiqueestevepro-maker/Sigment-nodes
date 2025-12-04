'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Clock,
    Mail,
    User,
    Calendar,
    Check,
    AlertCircle
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { formatDistanceToNow } from 'date-fns';
import { MemberActionsMenu } from '@/components/shared/MemberActionsMenu';

export default function PendingInvitesPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const { organization } = useOrganization();

    const [invitations, setInvitations] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (organization?.id) {
            fetchInvitations();
        }
    }, [organization?.id]);

    const fetchInvitations = async () => {
        if (!organization?.id) return;
        try {
            const response = await fetch(`http://localhost:8000/api/invitations?organization_id=${organization.id}`);
            if (response.ok) {
                const data = await response.json();
                setInvitations(data);
            }
        } catch (error) {
            console.error('Error fetching invitations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                            Admin Panel
                        </span>
                        <span className="flex items-center gap-1 text-blue-600 text-xs font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                            <Clock size={12} /> Status
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Invitations Status</h1>
                    <p className="text-lg text-gray-500 mt-1">
                        Track the status of sent invitations.
                    </p>
                </div>
                <button
                    onClick={() => router.push(`/${orgSlug}/admin/members`)}
                    className="flex items-center gap-2 text-gray-600 hover:text-black bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium text-sm">Back to Members</span>
                </button>
            </div>

            {/* Invitations Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invited By</th>
                            <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">Loading invitations...</td>
                            </tr>
                        ) : invitations.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">No invitations found.</td>
                            </tr>
                        ) : (
                            invitations.map((invite) => {
                                const isExpired = new Date(invite.expires_at) < new Date();
                                const status = invite.status === 'accepted' ? 'Accepted' : isExpired ? 'Expired' : 'Pending';
                                const statusColor = status === 'Accepted'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : status === 'Expired'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-orange-50 text-orange-700 border-orange-200';

                                return (
                                    <tr key={invite.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                                                    <Mail size={14} />
                                                </div>
                                                <span className="font-medium text-gray-900">{invite.email}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {invite.role}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${statusColor}`}>
                                                {status === 'Pending' && <Clock size={12} />}
                                                {status === 'Accepted' && <Check size={12} />}
                                                {status === 'Expired' && <AlertCircle size={12} />}
                                                {status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500">
                                            <div className="flex flex-col">
                                                <span>{formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}</span>
                                                {status === 'Pending' && (
                                                    <span className="text-xs text-gray-400">Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-xs">
                                                    <User size={12} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900">{invite.inviter_name || 'Unknown'}</span>
                                                    <span className="text-xs text-gray-500">{invite.inviter_email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <MemberActionsMenu
                                                currentUserRole="" // Not needed for invitations
                                                targetMember={invite}
                                                isInvitation={true}
                                                onAction={(action, i) => console.log(action, i)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
