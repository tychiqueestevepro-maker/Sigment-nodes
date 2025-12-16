'use client';

import { FileText, CheckCircle2, Circle } from 'lucide-react';
import { useProject } from '../ProjectContext';

export default function ProjectTimelinePage() {
    const { project } = useProject();

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                        <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Project Timeline</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-8">
                        Track key milestones, updates, and activity for {project?.name || 'this project'}.
                    </p>

                    {/* Timeline visualization (Empty State for now as per original code) */}
                    <div className="w-full max-w-2xl bg-white rounded-xl border border-gray-200 p-8 text-left">
                        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                            {/* Project Created Event */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                {/* Icon */}
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-green-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                    <CheckCircle2 size={20} className="text-white" />
                                </div>
                                {/* Card */}
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between space-x-2 mb-1">
                                        <div className="font-bold text-slate-900">Project Created</div>
                                        <time className="font-caveat font-medium text-slate-500 text-sm">
                                            {project?.created_at ? new Date(project.created_at).toLocaleDateString() : 'Just now'}
                                        </time>
                                    </div>
                                    <div className="text-slate-500 text-sm">
                                        Project "{project?.name}" was initialized by the team.
                                    </div>
                                </div>
                            </div>

                            {/* Future Milestone (Example) */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                {/* Icon */}
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-white border-slate-200 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                    <Circle size={20} className="text-slate-300" />
                                </div>
                                {/* Card */}
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 p-4 rounded-xl border border-slate-200 border-dashed">
                                    <div className="flex items-center justify-between space-x-2 mb-1">
                                        <div className="font-bold text-slate-400">First Milestone</div>
                                        <div className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-400">Upcoming</div>
                                    </div>
                                    <div className="text-slate-400 text-sm">
                                        Start adding tools and ideas to track progress.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
