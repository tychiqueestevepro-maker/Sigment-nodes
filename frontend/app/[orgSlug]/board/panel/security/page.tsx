'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Shield, Lock, Key, ArrowLeft } from 'lucide-react';

export default function BoardPanelSecurityPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    return (
        <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
            {/* Header */}
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                            Board Space
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Security</h1>
                    <p className="text-lg text-gray-500 mt-1">
                        Manage your organization's security settings.
                    </p>
                </div>
                <button
                    onClick={() => window.location.href = `/${orgSlug}/board`}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    Back to Workspace <ArrowLeft size={16} className="rotate-180" />
                </button>
            </div>

            <div className="space-y-6 pb-8 max-w-4xl">
                {/* 2FA Section */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                            <Shield size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Two-Factor Authentication (2FA)</h3>
                            <p className="text-gray-500 text-sm mb-4">
                                Require all members to use two-factor authentication to access this workspace.
                            </p>
                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                                    <span className="ml-3 text-sm font-medium text-gray-900">Enforce 2FA</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Policy */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                            <Lock size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Password Policy</h3>
                            <p className="text-gray-500 text-sm mb-4">
                                Set minimum requirements for member passwords.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked readOnly className="rounded border-gray-300 text-black focus:ring-black" />
                                    <span className="text-sm text-gray-700">Minimum 8 characters</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="rounded border-gray-300 text-black focus:ring-black" />
                                    <span className="text-sm text-gray-700">Require special character</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="rounded border-gray-300 text-black focus:ring-black" />
                                    <span className="text-sm text-gray-700">Require number</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="rounded border-gray-300 text-black focus:ring-black" />
                                    <span className="text-sm text-gray-700">Expire every 90 days</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* API Access */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                            <Key size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">API Access</h3>
                            <p className="text-gray-500 text-sm mb-4">
                                Manage API keys and access tokens for integrations.
                            </p>
                            <button className="text-sm font-medium text-black border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                                Manage Keys
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
