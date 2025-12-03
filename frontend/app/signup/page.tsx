'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SigmentLogo } from '@/components/board/SigmentLogo'
import { Mail, Lock, User } from 'lucide-react'

export default function SignupPage() {
    const [step, setStep] = useState(1); // 1: Identity, 2: Organization
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        orgName: '',
        jobTitle: 'CEO'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Generate slug from organization name
    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    };

    const orgSlug = generateSlug(formData.orgName);

    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email || !formData.password) {
            setError('Please fill in all fields');
            return;
        }
        setError('');
        setStep(2);
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.firstName || !formData.lastName || !formData.orgName) {
            setError('Please fill in all fields');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Call signup API endpoint
            const response = await fetch('http://localhost:8000/api/v1/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    organization_name: formData.orgName,
                    organization_slug: orgSlug,
                    job_title: formData.jobTitle
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Signup failed');
            }

            const data = await response.json();

            // Use signup data directly (don't call login to avoid ID mismatch)
            localStorage.setItem('sigment_user_id', data.user.id);
            localStorage.setItem('sigment_user_email', data.user.email);
            localStorage.setItem('sigment_user', JSON.stringify(data.user));

            // Redirect based on user role
            const redirectPath = data.user.role === 'OWNER' ? 'owner' :
                data.user.role === 'BOARD' ? 'board' : 'member';

            // Force a full page reload to ensure all contexts are refreshed
            window.location.href = `/${data.organization.slug}/${redirectPath}`;
        } catch (err: any) {
            setError(err.message || 'Signup failed. Please try again.');
            setIsLoading(false);
        }
    };

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-8">
                    <Link href="/">
                        <SigmentLogo className="w-48 h-12 text-white" />
                    </Link>
                </div>

                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className={`flex items-center gap-2 ${step === 1 ? 'text-white' : 'text-gray-500'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 1 ? 'border-white bg-white text-black' : 'border-gray-600'}`}>
                            1
                        </div>
                        <span className="text-sm font-medium">Identity</span>
                    </div>
                    <div className="w-12 h-px bg-gray-700"></div>
                    <div className={`flex items-center gap-2 ${step === 2 ? 'text-white' : 'text-gray-500'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 2 ? 'border-white bg-white text-black' : 'border-gray-600'}`}>
                            2
                        </div>
                        <span className="text-sm font-medium">Organization</span>
                    </div>
                </div>

                <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 shadow-xl backdrop-blur-sm animate-fade-in">
                    {step === 1 ? (
                        <>
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-white mb-2">Create your account</h2>
                                <p className="text-gray-400">Get started with SIGMENT</p>
                            </div>

                            <form onSubmit={handleStep1Submit}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" />
                                        </div>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => updateField('email', e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 bg-gray-900 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                                            placeholder="name@company.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" />
                                        </div>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => updateField('password', e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 bg-gray-900 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors mb-6">
                                    Continue
                                </button>

                                <div className="text-center text-sm text-gray-500">
                                    Already have an account?{' '}
                                    <Link href="/login" className="text-white font-medium hover:underline">
                                        Log in
                                    </Link>
                                </div>
                            </form>
                        </>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-white mb-2">Configure your workspace</h2>
                                <p className="text-gray-400">Set up your organization</p>
                            </div>

                            <form onSubmit={handleFinalSubmit}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">First Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.firstName}
                                            onChange={(e) => updateField('firstName', e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 bg-gray-900 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                                            placeholder="John"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Last Name</label>
                                    <input
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => updateField('lastName', e.target.value)}
                                        className="block w-full px-3 py-3 bg-gray-900 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                                        placeholder="Doe"
                                        required
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Organization Name</label>
                                    <input
                                        type="text"
                                        value={formData.orgName}
                                        onChange={(e) => updateField('orgName', e.target.value)}
                                        className="block w-full px-3 py-3 bg-gray-900 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                                        placeholder="Acme Corp"
                                        required
                                    />
                                    {formData.orgName && (
                                        <div className="mt-2 text-xs text-gray-500">
                                            Your workspace URL: <span className="text-white font-mono">sigment.com/{orgSlug}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Your Position</label>
                                    <select
                                        value={formData.jobTitle}
                                        onChange={(e) => updateField('jobTitle', e.target.value)}
                                        className="block w-full px-3 py-3 bg-gray-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                                    >
                                        <option value="CEO">CEO</option>
                                        <option value="Founder">Founder</option>
                                        <option value="Co-Founder">Co-Founder</option>
                                        <option value="CTO">CTO</option>
                                        <option value="Product Manager">Product Manager</option>
                                        <option value="Director">Director</option>
                                        <option value="Manager">Manager</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 border border-white/30 text-white font-medium py-3 rounded-lg hover:bg-white/10 transition-colors"
                                        disabled={isLoading}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Creating...' : 'Create Account'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
