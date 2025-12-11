'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Building2,
    Camera,
    Save,
    MapPin,
    Calendar,
    Users,
    CheckCircle,
    ArrowLeft
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUser } from '@/contexts/UserContext';
import { ImageCropper } from '@/components/shared/ImageCropper';

export default function WorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const { organization, userRole } = useOrganization();
    const { user } = useUser();

    const isOwner = userRole === 'OWNER';

    // Form state
    const [formData, setFormData] = React.useState({
        name: '',
        slug: '',
        description: '',
        location: '',
        logo_url: ''
    });
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [stats, setStats] = React.useState({ members: 0, created: '' });

    // Image cropper state
    const [showCropper, setShowCropper] = React.useState(false);
    const [tempImageSrc, setTempImageSrc] = React.useState<string | null>(null);
    const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);

    // Load organization data
    React.useEffect(() => {
        if (organization?.id) {
            fetchOrganizationDetails();
        }
    }, [organization?.id]);

    const fetchOrganizationDetails = async () => {
        try {
            // Fetch org details
            const response = await fetch(`http://localhost:8000/api/v1/organizations/${orgSlug}/details`);
            if (response.ok) {
                const data = await response.json();
                setFormData({
                    name: data.name || '',
                    slug: data.slug || orgSlug,
                    description: data.description || '',
                    location: data.location || '',
                    logo_url: data.logo_url || ''
                });
                setStats({
                    members: data.member_count || 0,
                    created: data.created_at || ''
                });
            } else {
                // Fallback to context data
                setFormData(prev => ({
                    ...prev,
                    name: organization?.name || '',
                    slug: organization?.slug || orgSlug,
                    logo_url: organization?.logo_url || ''
                }));
            }
        } catch (error) {
            console.error('Error fetching organization details:', error);
            // Use context data as fallback
            setFormData(prev => ({
                ...prev,
                name: organization?.name || '',
                slug: organization?.slug || orgSlug,
                logo_url: organization?.logo_url || ''
            }));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!isOwner) return;

        setIsSaving(true);
        try {
            const response = await fetch(`http://localhost:8000/api/v1/organizations/${orgSlug}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    location: formData.location
                })
            });

            if (response.ok) {
                alert('Workspace settings saved successfully!');
            } else {
                alert('Failed to save settings. Please try again.');
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('Failed to save settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle file selection for logo
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !isOwner) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('Image size must be less than 10MB');
            return;
        }

        // Read file and show cropper
        const reader = new FileReader();
        reader.onload = () => {
            setTempImageSrc(reader.result as string);
            setShowCropper(true);
        };
        reader.readAsDataURL(file);

        // Reset input
        e.target.value = '';
    };

    // Handle cropped image upload
    const handleCropComplete = async (croppedBlob: Blob) => {
        setShowCropper(false);
        setTempImageSrc(null);
        setIsUploadingLogo(true);

        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', croppedBlob, 'logo.jpg');

            const response = await fetch(`http://localhost:8000/api/v1/organizations/${orgSlug}/logo`, {
                method: 'POST',
                body: formDataUpload
            });

            if (response.ok) {
                const data = await response.json();
                setFormData(prev => ({ ...prev, logo_url: data.logo_url }));
            } else {
                alert('Failed to upload logo. Please try again.');
            }
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Failed to upload logo. Please try again.');
        } finally {
            setIsUploadingLogo(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Image Cropper Modal */}
            {showCropper && tempImageSrc && (
                <ImageCropper
                    imageSrc={tempImageSrc}
                    onCropComplete={handleCropComplete}
                    onCancel={() => {
                        setShowCropper(false);
                        setTempImageSrc(null);
                    }}
                    aspectRatio={1}
                />
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
                    <h1 className="text-3xl font-bold text-gray-900">Workspace Settings</h1>
                    <p className="text-lg text-gray-500 mt-1">
                        Manage your organization's profile and settings.
                    </p>
                </div>
                <button
                    onClick={() => router.push(`/${orgSlug}/home`)}
                    className="flex items-center gap-2 text-gray-600 hover:text-black bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all group"
                >
                    <span className="font-medium text-sm">Back to Workspace</span>
                    <ArrowLeft size={18} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-3 gap-6">
                {/* Logo Card */}
                <div className="col-span-1">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Workspace Logo</h3>
                        <div className="flex flex-col items-center">
                            <div className="relative group">
                                {/* Round logo container */}
                                <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                                    {isUploadingLogo ? (
                                        <div className="animate-spin w-8 h-8 border-2 border-gray-400 border-t-black rounded-full"></div>
                                    ) : formData.logo_url ? (
                                        <img
                                            src={formData.logo_url}
                                            alt="Workspace logo"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Building2 size={40} className="text-gray-400" />
                                    )}
                                </div>
                                {isOwner && !isUploadingLogo && (
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
                                        <Camera size={24} className="text-white" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                    </label>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-4 text-center">
                                {isOwner ? 'Click to upload a new logo' : 'Workspace logo'}
                            </p>
                        </div>

                        {/* Quick Stats */}
                        <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Users size={14} /> Members
                                </span>
                                <span className="font-medium text-gray-900">{stats.members}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Calendar size={14} /> Created
                                </span>
                                <span className="font-medium text-gray-900">
                                    {stats.created ? new Date(stats.created).toLocaleDateString('en-US', {
                                        month: 'short',
                                        year: 'numeric'
                                    }) : '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Details Form */}
                <div className="col-span-2">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900 mb-6">Workspace Details</h3>

                        <div className="space-y-5">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Workspace Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    disabled={!isOwner}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 disabled:bg-gray-50 disabled:text-gray-500"
                                    placeholder="Enter workspace name"
                                />
                            </div>

                            {/* Slug (read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Workspace URL
                                </label>
                                <div className="flex items-center">
                                    <span className="px-4 py-2.5 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-gray-500 text-sm">
                                        sigment.app/
                                    </span>
                                    <input
                                        type="text"
                                        value={formData.slug}
                                        disabled
                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-r-lg bg-gray-50 text-gray-500"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    disabled={!isOwner}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                                    placeholder="Describe your workspace..."
                                />
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Location
                                </label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                        disabled={!isOwner}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="Paris, France"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        {isOwner && (
                            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 bg-black text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
