'use client';

import { FileText, Users, Crown } from 'lucide-react';
import { useProject } from '../ProjectContext';

export default function ProjectOverviewPage() {
    const { project, members, isLoading } = useProject();

    if (isLoading || !project) {
        return (
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Skeleton */}
                    {[1, 2].map(i => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                            <div className="h-4 w-24 bg-gray-100 rounded mb-4"></div>
                            <div className="h-20 bg-gray-50 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Project Description */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FileText size={14} /> Description
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                        {project.description || 'No description provided for this project.'}
                    </p>
                </div>

                {/* Team Members */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Users size={14} /> Team Members ({members.length})
                    </h3>
                    <div className="grid gap-3">
                        {members.map(member => {
                            const isLead = project.created_by === member.user_id;
                            return (
                                <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                    {member.avatar_url ? (
                                        <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                                            {(member.first_name?.[0] || '') + (member.last_name?.[0] || '')}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900 flex items-center gap-2">
                                            {member.first_name} {member.last_name}
                                            {isLead && <Crown className="w-4 h-4 text-amber-500" />}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {isLead ? 'Lead Member' : (member.job_title || 'Team Member')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
