'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    MoreHorizontal,
    Trash2,
    Edit,
    Send,
    XCircle,
    ArrowUpCircle,
    ArrowDownCircle,
    UserCog,
    Ban,
    RefreshCw
} from 'lucide-react';

interface MemberActionsMenuProps {
    currentUserRole: string;
    currentUserId?: string;
    targetMember: any;
    isInvitation?: boolean;
    onAction: (action: string, member: any) => void;
}

export function MemberActionsMenu({
    currentUserRole,
    currentUserId,
    targetMember,
    isInvitation = false,
    onAction
}: MemberActionsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (isInvitation) {
        // Invitation Actions
        return (
            <div className="relative" ref={menuRef}>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    className="p-2 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <MoreHorizontal size={18} />
                </button>
                {isOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onAction('resend', targetMember); setIsOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                            >
                                <Send size={14} /> Resend Invitation
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onAction('revoke', targetMember); setIsOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                            >
                                <XCircle size={14} /> Revoke Invitation
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Member Actions Logic
    const isSelf = currentUserId === targetMember.id;
    const targetRole = (targetMember.role || '').toUpperCase();
    const normalizedCurrentRole = (currentUserRole || '').toUpperCase();
    const isSuspended = (targetMember.status || '').toLowerCase() === 'suspended';

    let actions: any[] = [];

    if (targetRole === 'OWNER') {
        if (isSelf) {
            actions.push({ label: 'Edit Profile', icon: <UserCog size={14} />, action: 'edit_profile' });
        }
    } else if (targetRole === 'BOARD') {
        if (normalizedCurrentRole === 'OWNER') {
            actions.push({ label: 'Demote to Member', icon: <ArrowDownCircle size={14} />, action: 'demote' });
            actions.push({ label: 'Edit Title', icon: <Edit size={14} />, action: 'edit_title' });
            if (isSuspended) {
                actions.push({ label: 'Reactivate Account', icon: <RefreshCw size={14} />, action: 'reactivate' });
            } else {
                actions.push({ label: 'Suspend Account', icon: <Ban size={14} />, action: 'suspend' });
            }
            actions.push({ label: 'Remove from Team', icon: <Trash2 size={14} />, action: 'remove', isDestructive: true });
        }
    } else if (targetRole === 'MEMBER') {
        if (normalizedCurrentRole === 'OWNER' || normalizedCurrentRole === 'BOARD') {
            actions.push({ label: 'Promote to Board', icon: <ArrowUpCircle size={14} />, action: 'promote' });
            actions.push({ label: 'Edit Title', icon: <Edit size={14} />, action: 'edit_title' });
            if (isSuspended) {
                actions.push({ label: 'Reactivate Account', icon: <RefreshCw size={14} />, action: 'reactivate' });
            } else {
                actions.push({ label: 'Suspend Account', icon: <Ban size={14} />, action: 'suspend' });
            }
            actions.push({ label: 'Remove from Team', icon: <Trash2 size={14} />, action: 'remove', isDestructive: true });
        }
    }

    if (actions.length === 0) {
        // Render a disabled button or nothing if no actions available
        return (
            <button disabled className="p-2 text-gray-200 cursor-not-allowed rounded-lg">
                <MoreHorizontal size={18} />
            </button>
        );
    }

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="p-2 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100 transition-colors"
            >
                <MoreHorizontal size={18} />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-80 overflow-y-auto">
                    <div className="p-1">
                        {actions.map((action) => (
                            <button
                                key={action.action}
                                onClick={(e) => { e.stopPropagation(); onAction(action.action, targetMember); setIsOpen(false); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left ${action.isDestructive ? 'text-red-600 hover:bg-red-50' :
                                    action.isWarning ? 'text-orange-600 hover:bg-orange-50' :
                                        'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                {action.icon} {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
