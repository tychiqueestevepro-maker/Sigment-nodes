'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    Camera,
    Check,
    Loader2,
    Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUser } from '@/contexts';
import { useApiClient } from '@/hooks/useApiClient';
import { ImageCropper } from './ImageCropper';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
    const { user, updateUser } = useUser();
    const apiClient = useApiClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [showCropper, setShowCropper] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [profileForm, setProfileForm] = useState({
        first_name: '',
        last_name: '',
        job_title: '',
        department: '',
        seniority_level: 3,
        avatar_url: ''
    });

    // Initialize form with user data when modal opens
    useEffect(() => {
        if (isOpen && user) {
            setProfileForm({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                job_title: user.job_title || '',
                department: user.department || '',
                seniority_level: user.seniority_level || 3,
                avatar_url: user.avatar_url || ''
            });
        }
    }, [isOpen, user]);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            toast.error('Please select a valid image (JPEG, PNG, GIF, or WebP)');
            return;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image must be less than 10MB');
            return;
        }

        // Convert file to data URL for cropper
        const reader = new FileReader();
        reader.onload = () => {
            setImageToCrop(reader.result as string);
            setShowCropper(true);
        };
        reader.readAsDataURL(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setShowCropper(false);
        setImageToCrop(null);
        setIsUploadingAvatar(true);

        try {
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('file', croppedBlob, 'avatar.jpg');

            // Get auth token
            const token = localStorage.getItem('access_token');
            const orgId = localStorage.getItem('sigment_org_id');

            // Upload avatar
            const response = await fetch('/api/v1/users/me/avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Organization-Id': orgId || '',
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }

            const data = await response.json();

            // Update local form state
            setProfileForm(prev => ({ ...prev, avatar_url: data.avatar_url }));

            // Update user context
            await updateUser({ avatar_url: data.avatar_url });

            toast.success('Avatar uploaded successfully!');
        } catch (error) {
            console.error('Avatar upload error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to upload avatar');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleCropCancel = () => {
        setShowCropper(false);
        setImageToCrop(null);
    };

    const handleProfileUpdate = async () => {
        setIsSaving(true);
        try {
            await apiClient.patch('/users/me', profileForm);

            // Update local user context
            await updateUser({
                ...profileForm,
                name: `${profileForm.first_name} ${profileForm.last_name}`.trim()
            });

            // Also update localStorage for persistence
            const storedUser = localStorage.getItem('sigment_user');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                const updatedUserData = { ...userData, ...profileForm };
                localStorage.setItem('sigment_user', JSON.stringify(updatedUserData));
            }

            toast.success('Profile updated successfully!');
            onClose();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const userInitials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : profileForm.first_name && profileForm.last_name
            ? `${profileForm.first_name[0]}${profileForm.last_name[0]}`.toUpperCase()
            : 'U';

    if (!isOpen) return null;

    return (
        <>
            {/* Image Cropper Modal */}
            {showCropper && imageToCrop && (
                <ImageCropper
                    imageSrc={imageToCrop}
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                    aspectRatio={1}
                />
            )}

            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-300">
                <div className="bg-white w-[480px] rounded-3xl shadow-2xl border border-white/50 overflow-hidden animate-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Update your personal information</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {/* Avatar Section */}
                        <div className="flex items-center gap-5">
                            <div className="relative group">
                                <button
                                    onClick={handleAvatarClick}
                                    disabled={isUploadingAvatar}
                                    className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white text-2xl font-bold overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
                                >
                                    {isUploadingAvatar ? (
                                        <Loader2 size={28} className="animate-spin" />
                                    ) : profileForm.avatar_url ? (
                                        <img src={profileForm.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        userInitials
                                    )}

                                    {/* Hover overlay */}
                                    {!isUploadingAvatar && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Upload size={20} className="text-white" />
                                        </div>
                                    )}
                                </button>
                                <div className="absolute bottom-0 right-0 w-7 h-7 bg-black text-white rounded-full flex items-center justify-center shadow-lg pointer-events-none">
                                    <Camera size={14} />
                                </div>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-900 text-sm">Profile Picture</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Click to upload • JPEG, PNG, GIF, WebP • Max 10MB</p>
                                <button
                                    onClick={handleAvatarClick}
                                    disabled={isUploadingAvatar}
                                    className="mt-2 text-xs font-medium text-black hover:text-gray-700 underline underline-offset-2 disabled:opacity-50"
                                >
                                    {isUploadingAvatar ? 'Uploading...' : 'Upload new picture'}
                                </button>
                            </div>
                        </div>

                        {/* Name Fields - Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">First Name</label>
                                <input
                                    type="text"
                                    value={profileForm.first_name}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, first_name: e.target.value }))}
                                    placeholder="John"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-black transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Last Name</label>
                                <input
                                    type="text"
                                    value={profileForm.last_name}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, last_name: e.target.value }))}
                                    placeholder="Doe"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-black transition-all"
                                />
                            </div>
                        </div>

                        {/* Email - Read Only */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Email</label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                        </div>

                        {/* Job Title */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Job Title</label>
                            <input
                                type="text"
                                value={profileForm.job_title}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, job_title: e.target.value }))}
                                placeholder="Senior Product Manager"
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-black transition-all"
                            />
                        </div>

                        {/* Department */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Department</label>
                            <select
                                value={profileForm.department}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, department: e.target.value }))}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-black transition-all cursor-pointer"
                            >
                                <option value="">Select Department</option>
                                <option value="Engineering">Engineering</option>
                                <option value="Product">Product</option>
                                <option value="Design">Design</option>
                                <option value="Marketing">Marketing</option>
                                <option value="Sales">Sales</option>
                                <option value="Operations">Operations</option>
                                <option value="Human Resources">Human Resources</option>
                                <option value="Finance">Finance</option>
                                <option value="Legal">Legal</option>
                                <option value="Executive">Executive</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* Seniority Level */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Seniority Level</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => setProfileForm(prev => ({ ...prev, seniority_level: level }))}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${profileForm.seniority_level === level
                                            ? 'bg-black text-white shadow-md'
                                            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1.5 px-1">
                                <span>Junior</span>
                                <span>Executive</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-100 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleProfileUpdate}
                            disabled={isSaving}
                            className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check size={16} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
