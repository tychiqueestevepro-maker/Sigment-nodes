'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, LayoutGrid, List, Plus, Trash2, Check, Loader2 } from 'lucide-react';
import { useProject, ProjectTool } from '../ProjectContext'; // Adjust import path
import { useApiClient } from '@/hooks/useApiClient';
import toast from 'react-hot-toast';

// --- Types ---
export interface LibraryApp {
    id: string;
    name: string;
    description: string;
    category: string;
    status: 'CERTIFIED' | 'COMMUNITY';
    url: string;
    logo_url?: string;
    popularity: number;
}

interface ToolsLibraryProps {
    onClose: () => void;
    libraryApps: LibraryApp[];
    setLibraryApps: React.Dispatch<React.SetStateAction<LibraryApp[]>>;
    libraryLoading: boolean;
}

// --- Helper ---
const getLogoUrl = (url: string) => {
    try {
        const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        return `https://logo.clearbit.com/${domain}`;
    } catch (e) {
        return null;
    }
};

export function ToolsLibrary({ onClose, libraryApps, setLibraryApps, libraryLoading }: ToolsLibraryProps) {
    const { project, addToolToProject } = useProject();
    const apiClient = useApiClient();

    // Local State for Library UI
    const [librarySearch, setLibrarySearch] = useState('');
    const [libraryCategory, setLibraryCategory] = useState<string>('all');
    const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'list'>('grid');

    // Add Tool State
    const [selectedAppToAdd, setSelectedAppToAdd] = useState<LibraryApp | null>(null);
    const [addToolStatus, setAddToolStatus] = useState<string>('active');
    const [addToolNote, setAddToolNote] = useState('');
    const [addToolLoading, setAddToolLoading] = useState(false);

    // Create Custom Tool State
    const [showCreateToolForm, setShowCreateToolForm] = useState(false);
    const [createToolName, setCreateToolName] = useState('');
    const [createToolUrl, setCreateToolUrl] = useState('');
    const [createToolDescription, setCreateToolDescription] = useState('');
    const [createToolCategory, setCreateToolCategory] = useState('Software Engineering');
    const [createToolLoading, setCreateToolLoading] = useState(false);

    const categoryFilters = [
        { key: 'all', label: 'All' },
        { key: 'Software Engineering', label: 'Engineering' },
        { key: 'Product & UX', label: 'Product' },
        { key: 'Data & Analytics', label: 'Data' },
        { key: 'Automation & AI', label: 'AI' },
        { key: 'Marketing', label: 'Marketing' },
        { key: 'Sales', label: 'Sales' },
        { key: 'Project & Operations', label: 'Ops' },
        { key: 'Cloud & Infrastructure', label: 'Cloud' },
        { key: 'Collaboration', label: 'Collab' },
    ];

    const filteredLibraryApps = useMemo(() => {
        return libraryApps.filter(app => {
            const matchesSearch = app.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
                app.description.toLowerCase().includes(librarySearch.toLowerCase());
            const matchesCategory = libraryCategory === 'all' || app.category === libraryCategory;
            return matchesSearch && matchesCategory;
        });
    }, [libraryApps, librarySearch, libraryCategory]);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 lg:p-8"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-[90vw] md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[85vh] flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header - Fixed */}
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-start shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Tools Library</h2>
                            <p className="text-sm text-gray-500">Add to your project stack.</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Search + View Toggle - Fixed */}
                    <div className="px-6 py-4 border-b border-gray-100 shrink-0">
                        <div className="flex gap-3 items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search tools..."
                                    value={librarySearch}
                                    onChange={(e) => setLibrarySearch(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-white border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                                    autoFocus
                                />
                            </div>
                            {/* View Mode Toggle */}
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setLibraryViewMode('grid')}
                                    className={`p-2 rounded-md transition-colors ${libraryViewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    title="Grid view"
                                >
                                    <LayoutGrid size={18} />
                                </button>
                                <button
                                    onClick={() => setLibraryViewMode('list')}
                                    className={`p-2 rounded-md transition-colors ${libraryViewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    title="List view"
                                >
                                    <List size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Category Filter - Fixed */}
                    <div className="px-6 py-3 border-b border-gray-100 overflow-x-auto shrink-0">
                        <div className="flex gap-2">
                            {categoryFilters.map((cat) => (
                                <button
                                    key={cat.key}
                                    onClick={() => setLibraryCategory(cat.key)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${libraryCategory === cat.key
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tools List - Scrollable */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                        {libraryLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : filteredLibraryApps.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                {librarySearch ? 'No tools found matching your search.' : 'No tools available.'}
                            </div>
                        ) : libraryViewMode === 'grid' ? (
                            /* Grid View */
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {filteredLibraryApps.map((app) => (
                                    <div
                                        key={app.id}
                                        className="relative flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group"
                                    >
                                        {/* Delete button for non-certified apps */}
                                        {app.status !== 'CERTIFIED' && (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`Delete "${app.name}"? This cannot be undone.`)) return;
                                                    try {
                                                        await apiClient.delete(`/applications/${app.id}`);
                                                        setLibraryApps(prev => prev.filter(a => a.id !== app.id));
                                                        toast.success(`${app.name} deleted`);
                                                    } catch (err: any) {
                                                        toast.error(err.message || 'Failed to delete');
                                                    }
                                                }}
                                                className="absolute top-2 right-2 p-1.5 rounded-full bg-white border border-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all z-10"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}

                                        {/* Clickable area to add tool */}
                                        <button
                                            onClick={() => {
                                                setSelectedAppToAdd(app);
                                                setAddToolStatus('active');
                                                setAddToolNote('');
                                            }}
                                            className="absolute inset-0 z-0"
                                        />

                                        {/* Logo */}
                                        <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 relative z-0">
                                            <img
                                                src={app.logo_url || getLogoUrl(app.url) || ''}
                                                alt={app.name}
                                                className="w-6 h-6 object-contain"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 relative z-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="font-semibold text-gray-900 text-sm">{app.name}</h3>
                                                {app.status === 'CERTIFIED' && (
                                                    <span className="w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center" title="Certified">
                                                        <Check size={10} className="text-white" strokeWidth={3} />
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{app.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* List View */
                            <div className="space-y-1">
                                {filteredLibraryApps.map((app) => (
                                    <div
                                        key={app.id}
                                        className="relative w-full flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-gray-50 rounded-lg transition-all text-left group"
                                    >
                                        {/* Clickable area to add tool */}
                                        <button
                                            onClick={() => {
                                                setSelectedAppToAdd(app);
                                                setAddToolStatus('active');
                                                setAddToolNote('');
                                            }}
                                            className="absolute inset-0 z-0"
                                        />

                                        {/* Logo */}
                                        <div className="w-8 h-8 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 relative z-0">
                                            <img
                                                src={app.logo_url || getLogoUrl(app.url) || ''}
                                                alt={app.name}
                                                className="w-5 h-5 object-contain"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>

                                        {/* Name + Badge */}
                                        <div className="flex items-center gap-1.5 min-w-[140px] relative z-0">
                                            <h3 className="font-medium text-gray-900 text-sm">{app.name}</h3>
                                            {app.status === 'CERTIFIED' && (
                                                <span className="w-3.5 h-3.5 rounded-full bg-gray-900 flex items-center justify-center" title="Certified">
                                                    <Check size={8} className="text-white" strokeWidth={3} />
                                                </span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <p className="flex-1 text-sm text-gray-500 truncate relative z-0">{app.description}</p>

                                        {/* Delete button for non-certified apps */}
                                        {app.status !== 'CERTIFIED' && (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`Delete "${app.name}"? This cannot be undone.`)) return;
                                                    try {
                                                        await apiClient.delete(`/applications/${app.id}`);
                                                        setLibraryApps(prev => prev.filter(a => a.id !== app.id));
                                                        toast.success(`${app.name} deleted`);
                                                    } catch (err: any) {
                                                        toast.error(err.message || 'Failed to delete');
                                                    }
                                                }}
                                                className="p-1.5 rounded-full bg-white border border-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all z-10 relative"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer - Create Custom Tool */}
                    <div className="border-t border-gray-100 bg-gray-50/50 shrink-0">
                        {!showCreateToolForm ? (
                            <div className="px-6 py-4">
                                <button
                                    onClick={() => setShowCreateToolForm(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    <Plus size={16} />
                                    Create custom tool
                                </button>
                            </div>
                        ) : (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="px-6 py-5"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-gray-900">Create Custom Tool</h3>
                                    <button
                                        onClick={() => {
                                            setShowCreateToolForm(false);
                                            setCreateToolName('');
                                            setCreateToolUrl('');
                                            setCreateToolDescription('');
                                            setCreateToolCategory('Software Engineering');
                                        }}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Name *</label>
                                        <input
                                            type="text"
                                            value={createToolName}
                                            onChange={(e) => setCreateToolName(e.target.value)}
                                            placeholder="e.g. My Tool"
                                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* URL */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Website URL *</label>
                                        <input
                                            type="text"
                                            value={createToolUrl}
                                            onChange={(e) => setCreateToolUrl(e.target.value)}
                                            placeholder="e.g. mytool.com"
                                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Category</label>
                                        <select
                                            value={createToolCategory}
                                            onChange={(e) => setCreateToolCategory(e.target.value)}
                                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                        >
                                            <option value="Software Engineering">Engineering</option>
                                            <option value="Cloud & Infrastructure">Cloud</option>
                                            <option value="Data & Analytics">Data</option>
                                            <option value="Product & UX">Product</option>
                                            <option value="Automation & AI">AI</option>
                                            <option value="Sales">Sales</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Collaboration">Collaboration</option>
                                            <option value="Project & Operations">Project</option>
                                        </select>
                                    </div>

                                    {/* Description */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
                                        <input
                                            type="text"
                                            value={createToolDescription}
                                            onChange={(e) => setCreateToolDescription(e.target.value)}
                                            placeholder="Brief description of the tool..."
                                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                {/* Preview + Actions */}
                                <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                                    {/* Preview */}
                                    <div className="flex items-center gap-3">
                                        {createToolUrl && (
                                            <div className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                                                <img
                                                    src={getLogoUrl(createToolUrl) || ''}
                                                    alt="Preview"
                                                    className="w-5 h-5 object-contain"
                                                />
                                            </div>
                                        )}
                                        <span className="text-sm text-gray-500">
                                            {createToolUrl ? 'Logo preview' : 'Enter URL to see logo'}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setShowCreateToolForm(false);
                                                setCreateToolName('');
                                                setCreateToolUrl('');
                                                setCreateToolDescription('');
                                                setCreateToolCategory('Software Engineering');
                                            }}
                                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!createToolName.trim() || !createToolUrl.trim()) {
                                                    toast.error('Name and URL are required');
                                                    return;
                                                }
                                                setCreateToolLoading(true);
                                                try {
                                                    const newApp = await apiClient.post<LibraryApp>('/applications/', {
                                                        name: createToolName.trim(),
                                                        url: createToolUrl.trim().replace(/^https?:\/\//, '').replace(/^www\./, ''),
                                                        description: createToolDescription.trim() || null,
                                                        category: createToolCategory
                                                    });
                                                    setLibraryApps(prev => [...prev, newApp]);
                                                    toast.success(`${createToolName} created successfully!`);
                                                    setShowCreateToolForm(false);
                                                    setCreateToolName('');
                                                    setCreateToolUrl('');
                                                    setCreateToolDescription('');
                                                    setCreateToolCategory('Software Engineering');
                                                } catch (err: any) {
                                                    console.error('Failed to create tool:', err);
                                                    toast.error(err.message || 'Failed to create tool');
                                                } finally {
                                                    setCreateToolLoading(false);
                                                }
                                            }}
                                            disabled={createToolLoading || !createToolName.trim() || !createToolUrl.trim()}
                                            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                        >
                                            {createToolLoading && <Loader2 size={14} className="animate-spin" />}
                                            Create Tool
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </motion.div>

            {/* Add Tool to Project Confirmation Modal - Nested here for access to local state */}
            {selectedAppToAdd && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setSelectedAppToAdd(null)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                                <img
                                    src={selectedAppToAdd.logo_url || getLogoUrl(selectedAppToAdd.url) || ''}
                                    alt={selectedAppToAdd.name}
                                    className="w-7 h-7 object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 text-lg">Add {selectedAppToAdd.name}</h3>
                                <p className="text-sm text-gray-500">to your project stack</p>
                            </div>
                            <button
                                onClick={() => setSelectedAppToAdd(null)}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-5 space-y-5">
                            {/* Status Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setAddToolStatus('active')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${addToolStatus === 'active'
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                            }`}
                                    >
                                        <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                                        <span className="font-medium">Active</span>
                                    </button>
                                    <button
                                        onClick={() => setAddToolStatus('planned')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${addToolStatus === 'planned'
                                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                            }`}
                                    >
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                                        <span className="font-medium">Planned</span>
                                    </button>
                                </div>
                            </div>

                            {/* Note */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
                                <input
                                    type="text"
                                    value={addToolNote}
                                    onChange={(e) => setAddToolNote(e.target.value)}
                                    placeholder="e.g. Main IDE, CRM for enterprise clients..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 flex gap-3">
                            <button
                                onClick={() => setSelectedAppToAdd(null)}
                                className="flex-1 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setAddToolLoading(true);
                                    try {
                                        await addToolToProject(selectedAppToAdd.id, addToolStatus, addToolNote);
                                        toast.success(`${selectedAppToAdd.name} added to project!`);
                                        setSelectedAppToAdd(null);
                                        onClose(); // Close library modal
                                    } catch (err: any) {
                                        console.error('Failed to add tool:', err);
                                        toast.error(err.message || 'Failed to add tool');
                                    } finally {
                                        setAddToolLoading(false);
                                    }
                                }}
                                disabled={addToolLoading}
                                className="flex-1 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {addToolLoading && <Loader2 size={16} className="animate-spin" />}
                                Add to Project
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
