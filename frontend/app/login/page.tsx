'use client'

import { useState } from 'react'
import { useUser } from '@/contexts'
import Link from 'next/link'
import { SigmentLogo } from '@/components/board/SigmentLogo'
import { Mail, Lock } from 'lucide-react'

// Generic Input Field
const InputField = ({ label, type, placeholder, icon: Icon, value, onChange, required = false }: { label: string, type: string, placeholder: string, icon: any, value?: string, onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void, required?: boolean }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon className="h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" />
            </div>
            <input
                type={type}
                className="block w-full pl-10 pr-3 py-3 bg-gray-900 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
            />
        </div>
    </div>
);

export default function LoginPage() {
    const { login, isLoading } = useUser()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        try {
            await login(email, password)
        } catch (err: any) {
            setError(err.message || 'Invalid email or password')
        }
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-8">
                    <Link href="/">
                        <SigmentLogo className="w-48 h-12 text-white" />
                    </Link>
                </div>

                <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-white mb-2">Welcome back.</h2>
                        <p className="text-gray-400">Log in to your Sigment workspace.</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <InputField
                            label="Email Address"
                            type="email"
                            placeholder="name@company.com"
                            icon={Mail}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <InputField
                            label="Password"
                            type="password"
                            placeholder="••••••••"
                            icon={Lock}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <div className="flex items-center justify-between mb-6 text-sm">
                            <label className="flex items-center text-gray-400 cursor-pointer hover:text-gray-300">
                                <input type="checkbox" className="mr-2 rounded bg-gray-800 border-white/10" />
                                Remember me
                            </label>
                            <button type="button" className="text-white hover:underline">Forgot password?</button>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Logging in...' : 'Log In'}
                        </button>

                        <div className="text-center text-sm text-gray-500">
                            No account yet?{' '}
                            <Link href="/signup" className="text-white font-medium hover:underline">
                                Sign up
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
