'use client';

import React, { useState, useEffect } from 'react';
import { User, Briefcase, Building, ArrowRight, Check, Sparkles, Mail, Lock, Users, Award, Loader2, AlertCircle } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function InvitationPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams?.get('token');

    const [formData, setFormData] = useState({
        prenom: '',
        nom: '',
        email: '',
        password: '',
        organisation: '',
        department: '',
        poste: '',
        seniority: ''
    });

    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isValidating, setIsValidating] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError('Missing invitation token');
            setIsValidating(false);
            return;
        }

        const validateToken = async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/invitations/${token}`);
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || 'Invalid invitation');
                }

                const data = await response.json();
                setFormData(prev => ({
                    ...prev,
                    email: data.email,
                    organisation: data.organization_name
                }));
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsValidating(false);
            }
        };

        validateToken();
    }, [token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:8000/api/invitations/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    first_name: formData.prenom,
                    last_name: formData.nom,
                    password: formData.password,
                    job_title: formData.poste,
                    department: formData.department,
                    seniority: formData.seniority
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to create account');
            }

            setIsSubmitted(true);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isValidating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
                <div className="text-center space-y-4">
                    <div className="inline-flex p-4 rounded-full bg-red-500/10 text-red-500 mb-4">
                        <AlertCircle size={48} />
                    </div>
                    <h1 className="text-2xl font-bold">Invitation Invalid</h1>
                    <p className="text-gray-400">{error}</p>
                    <button
                        onClick={() => router.push('/login')}
                        className="text-sm text-white hover:underline mt-4"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="flex justify-center mb-8">
                        <div className="p-4 rounded-full border-2 border-white/20 bg-white/5">
                            <Check className="w-12 h-12 text-white" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-light tracking-tight">Account Created</h2>
                    <p className="text-gray-400">
                        Welcome aboard, {formData.prenom}! Your account has been successfully created and you are now a member of {formData.organisation}.
                    </p>
                    <button
                        onClick={() => router.push('/login')}
                        className="mt-8 bg-white text-black px-8 py-3 rounded-full font-medium hover:bg-gray-200 transition-colors"
                    >
                        Log In to Workspace
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row font-sans">

            {/* Left Panel - Branding */}
            <div className="w-full md:w-1/2 bg-black text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
                {/* Abstract Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gray-800 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>
                </div>

                <div className="relative z-10 flex flex-col justify-center h-full">
                    <div className="space-y-6 max-w-md">
                        <h1 className="text-4xl md:text-6xl font-light leading-tight">
                            Join <br />
                            <span className="font-bold">the future</span> of collaboration.
                        </h1>
                        <p className="text-gray-400 text-lg font-light leading-relaxed">
                            Connect with your teams, share ideas, and build together in a unified and secure space.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 mt-12 md:mt-0 flex items-center gap-2 text-sm text-gray-500">
                    <Sparkles className="w-4 h-4" />
                    <span>Exclusive invitation for collaborators</span>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="w-full md:w-1/2 bg-white text-black p-8 md:p-12 flex flex-col justify-center">
                <div className="w-full max-w-md mx-auto">
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold mb-2">Create your account</h2>
                        <p className="text-gray-500">Please fill in your professional information.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Personal Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label htmlFor="prenom" className="text-xs font-bold uppercase tracking-wider text-gray-500">First Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        id="prenom"
                                        name="prenom"
                                        required
                                        value={formData.prenom}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 border-b-2 border-gray-200 focus:border-black outline-none transition-colors bg-transparent placeholder-gray-300"
                                        placeholder="John"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="nom" className="text-xs font-bold uppercase tracking-wider text-gray-500">Last Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        id="nom"
                                        name="nom"
                                        required
                                        value={formData.nom}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 border-b-2 border-gray-200 focus:border-black outline-none transition-colors bg-transparent placeholder-gray-300"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Account Info */}
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-gray-500">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    required
                                    readOnly
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed focus:border-gray-200 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-gray-500">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-3 border-b-2 border-gray-200 focus:border-black outline-none transition-colors bg-transparent placeholder-gray-300"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {/* Professional Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label htmlFor="organisation" className="text-xs font-bold uppercase tracking-wider text-gray-500">Organization</label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        id="organisation"
                                        name="organisation"
                                        required
                                        readOnly
                                        value={formData.organisation}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed focus:border-gray-200 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="department" className="text-xs font-bold uppercase tracking-wider text-gray-500">Department</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        id="department"
                                        name="department"
                                        required
                                        value={formData.department}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 border-b-2 border-gray-200 focus:border-black outline-none transition-colors bg-transparent placeholder-gray-300"
                                        placeholder="Marketing"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label htmlFor="poste" className="text-xs font-bold uppercase tracking-wider text-gray-500">Job Title</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        id="poste"
                                        name="poste"
                                        required
                                        value={formData.poste}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 border-b-2 border-gray-200 focus:border-black outline-none transition-colors bg-transparent placeholder-gray-300"
                                        placeholder="Project Manager"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="seniority" className="text-xs font-bold uppercase tracking-wider text-gray-500">Seniority Level</label>
                                <div className="relative">
                                    <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <select
                                        id="seniority"
                                        name="seniority"
                                        required
                                        value={formData.seniority}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 border-b-2 border-gray-200 focus:border-black outline-none transition-colors bg-transparent text-gray-700 appearance-none"
                                    >
                                        <option value="" disabled>Select...</option>
                                        <option value="junior">Junior (0-2 years)</option>
                                        <option value="intermediate">Intermediate (2-5 years)</option>
                                        <option value="senior">Senior (5-8 years)</option>
                                        <option value="lead">Lead / Expert (+8 years)</option>
                                        <option value="executive">Director / C-Level</option>
                                    </select>
                                    {/* Custom arrow for select since appearance is none */}
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group w-full bg-black text-white h-14 rounded-none hover:bg-gray-900 transition-all flex items-center justify-between px-6 disabled:opacity-70"
                            >
                                <span className="text-lg font-medium">
                                    {isLoading ? 'Creating Account...' : 'Join Workspace'}
                                </span>
                                {!isLoading && (
                                    <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
                                )}
                            </button>
                        </div>

                        <p className="text-xs text-center text-gray-400 mt-4">
                            By clicking "Join Workspace", you agree to our Terms of Service.
                        </p>

                    </form>
                </div>
            </div>
        </div>
    );
}
