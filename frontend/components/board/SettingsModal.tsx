'use client';

import React, { useState } from 'react';
import {
    Globe,
    Clock,
    Home,
    Monitor,
    Sun,
    Moon,
    Layout,
    BellRing,
    Hash,
    Github,
    Settings,
    X,
    CreditCard,
    Lock,
    Shield
} from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeSettingsTab, setActiveSettingsTab] = useState('general');
    const [theme, setTheme] = useState('light');
    const [density, setDensity] = useState('comfortable');
    const [startupView, setStartupView] = useState('Home');
    const [integrations, setIntegrations] = useState({ jira: false, slack: true, github: false });

    if (!isOpen) return null;

    const renderSettingsContent = () => {
        switch (activeSettingsTab) {
            case 'general':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg text-gray-600"><Globe size={18} /></div>
                                <div><div className="text-sm font-medium text-gray-900">Language</div><div className="text-xs text-gray-500">English (US)</div></div>
                            </div>
                            <button className="text-xs font-bold text-gray-400 border border-gray-100 bg-gray-50 px-3 py-1.5 rounded-lg cursor-not-allowed">Change</button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg text-gray-600"><Clock size={18} /></div>
                                <div><div className="text-sm font-medium text-gray-900">Timezone</div><div className="text-xs text-gray-500">UTC-05:00 (EST)</div></div>
                            </div>
                            <button className="text-xs font-bold text-gray-500 border border-gray-100 bg-gray-50 px-3 py-1.5 rounded-lg hover:bg-gray-100">Edit</button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg text-gray-600"><Home size={18} /></div>
                                <div><div className="text-sm font-medium text-gray-900">Startup View</div><div className="text-xs text-gray-500">{startupView}</div></div>
                            </div>
                            <select
                                value={startupView}
                                onChange={(e) => setStartupView(e.target.value)}
                                className="text-xs font-bold text-gray-700 border border-gray-200 bg-white px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:border-gray-400"
                            >
                                <option value="Home">Home</option>
                                <option value="Galaxy View">Galaxy View</option>
                                <option value="Review">Review</option>
                                <option value="Chat">Chat</option>
                            </select>
                        </div>
                    </div>
                );
            case 'account':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center text-white text-xl font-bold">JD</div>
                            <div>
                                <button className="text-xs font-bold text-white bg-black px-4 py-2 rounded-lg hover:bg-gray-800">Upload new picture</button>
                                <div className="text-xs text-gray-400 mt-1">JPG, GIF or PNG. Max size of 800K</div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Full Name</label><input type="text" defaultValue="John Doe" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-black" /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Email</label><input type="email" defaultValue="john.doe@sigment.com" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-black" /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Status</label><select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none"><option>Available</option><option>In a meeting</option><option>Focus Mode</option></select></div>
                        </div>
                    </div>
                );
            case 'appearance':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg text-gray-600"><Monitor size={18} /></div>
                                <div><div className="text-sm font-medium text-gray-900">Theme</div><div className="text-xs text-gray-500">{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</div></div>
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setTheme('light')} className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-white shadow-sm text-black' : 'text-gray-400'}`}><Sun size={16} /></button>
                                <button onClick={() => setTheme('dark')} className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-gray-800 shadow-sm text-white' : 'text-gray-400'}`}><Moon size={16} /></button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg text-gray-600"><Layout size={18} /></div>
                                <div><div className="text-sm font-medium text-gray-900">Density</div><div className="text-xs text-gray-500">{density === 'comfortable' ? 'Standard spacing' : 'More content on screen'}</div></div>
                            </div>
                            <select
                                value={density}
                                onChange={(e) => setDensity(e.target.value)}
                                className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1 outline-none cursor-pointer"
                            >
                                <option value="comfortable">Comfortable</option>
                                <option value="compact">Compact</option>
                            </select>
                        </div>
                    </div>
                );
            case 'notifications':
                return (
                    <div className="space-y-4">
                        {["Mentions (@)", "Project Updates (Track)", "New Messages", "Email Digest"].map((item, i) => (
                            <div key={i} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-100 rounded-lg text-gray-600"><BellRing size={18} /></div>
                                    <div className="text-sm font-medium text-gray-900">{item}</div>
                                </div>
                                <div className={`h-6 w-10 rounded-full relative cursor-pointer transition-colors ${i < 2 ? 'bg-black' : 'bg-gray-200'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${i < 2 ? 'right-1' : 'left-1'}`}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'integrations':
                return (
                    <div className="space-y-4">
                        {/* Jira */}
                        <div className="p-4 border border-gray-200 rounded-xl flex items-center justify-between hover:border-gray-300 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0 text-xl">J</div>
                                <div>
                                    <div className="font-bold text-sm text-gray-900">Jira Software</div>
                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed max-w-[200px]">Plan, track, and manage your agile and software development projects.</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIntegrations(prev => ({ ...prev, jira: !prev.jira }))}
                                className={`text-xs px-4 py-2 rounded-lg font-bold transition-colors ${integrations.jira ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-black text-white hover:bg-gray-800'}`}
                            >
                                {integrations.jira ? 'Disconnect' : 'Connect'}
                            </button>
                        </div>

                        {/* Slack */}
                        <div className="p-4 border border-gray-200 rounded-xl flex items-center justify-between hover:border-gray-300 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-[#4A154B] rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0"><Hash size={24} /></div>
                                <div>
                                    <div className="font-bold text-sm text-gray-900">Slack</div>
                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed max-w-[200px]">Bring all your communication together in one place. Real-time messaging and archiving.</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIntegrations(prev => ({ ...prev, slack: !prev.slack }))}
                                className={`text-xs px-4 py-2 rounded-lg font-bold transition-colors ${integrations.slack ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-black text-white hover:bg-gray-800'}`}
                            >
                                {integrations.slack ? 'Disconnect' : 'Connect'}
                            </button>
                        </div>

                        {/* GitHub */}
                        <div className="p-4 border border-gray-200 rounded-xl flex items-center justify-between hover:border-gray-300 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0"><Github size={24} /></div>
                                <div>
                                    <div className="font-bold text-sm text-gray-900">GitHub</div>
                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed max-w-[200px]">Complete development platform to build, scale, and deliver secure software.</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIntegrations(prev => ({ ...prev, github: !prev.github }))}
                                className={`text-xs px-4 py-2 rounded-lg font-bold transition-colors ${integrations.github ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-black text-white hover:bg-gray-800'}`}
                            >
                                {integrations.github ? 'Disconnect' : 'Connect'}
                            </button>
                        </div>
                    </div>
                );
            default: return null;
        }
    }

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-300">
            <div className="bg-white w-[700px] h-[550px] rounded-3xl shadow-2xl border border-white/50 flex overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Sidebar of Modal */}
                <div className="w-1/3 bg-gray-50 border-r border-gray-100 p-6 flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Settings size={20} /> Settings</h2>
                    <div className="space-y-1">
                        <button onClick={() => setActiveSettingsTab('general')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSettingsTab === 'general' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:bg-gray-100'}`}>General</button>
                        <button onClick={() => setActiveSettingsTab('account')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSettingsTab === 'account' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:bg-gray-100'}`}>Account</button>
                        <button onClick={() => setActiveSettingsTab('appearance')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSettingsTab === 'appearance' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:bg-gray-100'}`}>Appearance</button>
                        <button onClick={() => setActiveSettingsTab('notifications')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSettingsTab === 'notifications' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:bg-gray-100'}`}>Notifications</button>
                        <div className="h-px bg-gray-200 my-2"></div>
                        <button onClick={() => setActiveSettingsTab('integrations')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSettingsTab === 'integrations' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:bg-gray-100'}`}>Integrations</button>
                    </div>
                </div>
                {/* Content of Modal */}
                <div className="flex-1 p-8 relative flex flex-col">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
                        <X size={20} />
                    </button>
                    <h3 className="text-lg font-bold text-gray-900 mb-1 capitalize">{activeSettingsTab}</h3>
                    <p className="text-sm text-gray-500 mb-6">Manage your workspace preferences.</p>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {renderSettingsContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};
