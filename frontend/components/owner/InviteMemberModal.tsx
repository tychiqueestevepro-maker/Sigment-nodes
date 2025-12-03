import React, { useState, useRef } from 'react';
import { X, Copy, Check, Loader2, Orbit, User, Upload, FileText, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUser } from '@/contexts/UserContext';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    orgSlug: string;
    orgId: string;
}

export function InviteMemberModal({ isOpen, onClose, orgSlug, orgId }: InviteMemberModalProps) {
    const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
    const [email, setEmail] = useState('');
    const [bulkEmails, setBulkEmails] = useState('');
    const [role, setRole] = useState<'BOARD' | 'MEMBER'>('MEMBER');
    const [isLoading, setIsLoading] = useState(false);
    const [inviteLinks, setInviteLinks] = useState<Array<{ email: string, link: string }>>([]);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get current user for invited_by field
    const { user } = useUser(); // Corrected usage of useUser hook

    if (!isOpen) return null;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            toast.error('Please upload a valid CSV file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            // Simple CSV parsing: split by newline or comma, filter valid emails
            const emails = text
                .split(/[\n,]/)
                .map(e => e.trim())
                .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

            if (emails.length > 0) {
                setBulkEmails(emails.join(', '));
                toast.success(`Found ${emails.length} emails in CSV`);
            } else {
                toast.error('No valid emails found in file');
            }
        };
        reader.readAsText(file);
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setInviteLinks([]);

        if (!user) {
            toast.error('You must be logged in to invite members');
            setIsLoading(false);
            return;
        }

        // Extract emails based on tab
        let emailsToInvite: string[] = [];
        if (activeTab === 'single') {
            if (!email) return;
            emailsToInvite = [email];
        } else {
            if (!bulkEmails) return;
            emailsToInvite = bulkEmails
                .split(/[\n,]/)
                .map(e => e.trim())
                .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        }

        if (emailsToInvite.length === 0) {
            toast.error('Please enter valid email addresses');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:8000/api/invitations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emails: emailsToInvite,
                    role,
                    organization_id: orgId,
                    invited_by: user.id
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to generate invitations');
            }

            const data = await response.json();
            setInviteLinks(data.invitation_links);

            if (data.failed_emails.length > 0) {
                toast.error(
                    <div className="min-w-[300px]">
                        <p className="font-bold mb-2 text-sm">Failed to invite {data.failed_emails.length} users:</p>
                        <ul className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                            {data.failed_emails.map((fail: any, idx: number) => (
                                <li key={idx} className="text-xs flex flex-col bg-red-50 p-2 rounded border border-red-100">
                                    <span className="font-semibold text-red-900 truncate">{fail.email}</span>
                                    <span className="text-red-700">{fail.error}</span>
                                </li>
                            ))}
                        </ul>
                    </div>,
                    { duration: 3000, className: '!p-0 !bg-white !max-w-md' }
                );
            } else {
                toast.success(`Successfully generated ${data.success_count} invitations!`);
            }
        } catch (error) {
            console.error('Error inviting members:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to generate invitations', { duration: 3000 });
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (link: string, index: number) => {
        navigator.clipboard.writeText(link);
        setCopiedIndex(index);
        toast.success('Link copied!');
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleClose = () => {
        setInviteLinks([]);
        setEmail('');
        setBulkEmails('');
        setRole('MEMBER');
        setActiveTab('single');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900">Invite New Members</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {inviteLinks.length === 0 ? (
                        <form onSubmit={handleInvite} className="space-y-6">
                            {/* Tabs */}
                            <div className="flex p-1 bg-gray-100 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('single')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'single' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Single Invite
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('bulk')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'bulk' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Bulk Invite
                                </button>
                            </div>

                            {/* Input Area */}
                            <div>
                                {activeTab === 'single' ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="colleague@company.com"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Addresses</label>
                                            <textarea
                                                value={bulkEmails}
                                                onChange={(e) => setBulkEmails(e.target.value)}
                                                placeholder="john@example.com, sarah@example.com..."
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all min-h-[100px]"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Separate emails with commas or new lines.</p>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-gray-200"></div>
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-white px-2 text-gray-500">Or upload CSV</span>
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all"
                                        >
                                            <Upload size={24} className="text-gray-400 mb-2" />
                                            <span className="text-sm font-medium text-gray-600">Click to upload CSV</span>
                                            <span className="text-xs text-gray-400 mt-1">Max 100 emails</span>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                accept=".csv"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Role Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">Select Role</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRole('BOARD')}
                                        className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${role === 'BOARD'
                                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                                            : 'border-gray-100 hover:border-gray-200 text-gray-600'
                                            }`}
                                    >
                                        <Orbit size={24} className="mb-2" />
                                        <span className="font-bold text-sm">Board Member</span>
                                        <span className="text-[10px] mt-1 opacity-75">Full Access</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setRole('MEMBER')}
                                        className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${role === 'MEMBER'
                                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                                            : 'border-gray-100 hover:border-gray-200 text-gray-600'
                                            }`}
                                    >
                                        <User size={24} className="mb-2" />
                                        <span className="font-bold text-sm">Member</span>
                                        <span className="text-[10px] mt-1 opacity-75">Limited Access</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || (activeTab === 'single' ? !email : !bulkEmails)}
                                className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" /> Generating...
                                    </>
                                ) : (
                                    'Generate Invitations'
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Check size={24} />
                                </div>
                                <h3 className="font-bold text-green-800 mb-1">
                                    {inviteLinks.length} Invitation{inviteLinks.length > 1 ? 's' : ''} Generated!
                                </h3>
                                <p className="text-sm text-green-700">Links are valid for 2 hours.</p>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {inviteLinks.map((invite, index) => (
                                    <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-medium text-gray-500">{invite.email}</span>
                                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase">{role}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={invite.link}
                                                className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-600 focus:outline-none"
                                            />
                                            <button
                                                onClick={() => copyToClipboard(invite.link, index)}
                                                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-2 py-1.5 rounded transition-colors"
                                            >
                                                {copiedIndex === index ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleClose}
                                className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
