'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Lightbulb, TrendingUp, Menu, X, ArrowRight } from 'lucide-react';
import { SigmentLogo } from '@/components/board/SigmentLogo';

export default function LandingPage() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col">

            {/* --- HEADER / NAVIGATION --- */}
            <header className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

                    {/* Logo (Home Link) */}
                    <Link href="/" className="flex items-center hover:opacity-80 transition-opacity cursor-pointer">
                        <SigmentLogo className="w-14 h-14 text-white" />
                    </Link>

                    {/* Navigation Desktop */}
                    <nav className="hidden md:flex gap-8 text-sm font-medium text-gray-400 absolute left-1/2 transform -translate-x-1/2">
                        <a href="#product" className="hover:text-white transition-colors">Product</a>
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#philosophy" className="hover:text-white transition-colors">Philosophy</a>
                    </nav>

                    {/* Auth Buttons Desktop */}
                    <div className="hidden md:flex items-center gap-4">
                        <Link
                            href="/login"
                            className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            Log In
                        </Link>
                        <Link
                            href="/signup"
                            className="bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-all transform hover:scale-105"
                        >
                            Sign Up
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>

                {/* Mobile Menu Overlay */}
                {isMenuOpen && (
                    <div className="md:hidden absolute top-20 left-0 w-full bg-black border-b border-white/10 p-6 flex flex-col gap-4 animate-fade-in">
                        <a href="#product" className="text-lg text-gray-300" onClick={() => setIsMenuOpen(false)}>Product</a>
                        <a href="#features" className="text-lg text-gray-300" onClick={() => setIsMenuOpen(false)}>Features</a>
                        <div className="h-px bg-white/10 my-2"></div>
                        <Link href="/login" className="text-lg text-left text-gray-300 hover:text-white">Log In</Link>
                        <Link href="/signup" className="bg-white text-black px-6 py-3 rounded text-center font-bold mt-2">
                            Sign Up
                        </Link>
                    </div>
                )}
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-grow">
                {/* --- HERO SECTION --- */}
                <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto text-center flex flex-col items-center animate-fade-in">
                    <div className="inline-block px-4 py-1 mb-6 border border-white/20 rounded-full text-xs uppercase tracking-widest text-gray-400">
                        Collaboration & Collective Intelligence
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
                        Turn ideas into <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-white">
                            innovations.
                        </span>
                    </h1>

                    <p className="text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
                        Sigment offers your team a dedicated space to submit ideas,
                        debate openly, and build the future of your company.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                        <Link
                            href="/signup"
                            className="bg-white text-black h-12 px-8 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                        >
                            Get Started <ArrowRight size={18} />
                        </Link>
                        <button className="border border-white/30 h-12 px-8 rounded-full font-medium hover:bg-white/10 transition-colors">
                            Watch Demo
                        </button>
                    </div>

                    {/* Abstract UI Preview */}
                    <div className="mt-20 w-full max-w-5xl border border-white/10 rounded-xl bg-gray-900/50 p-2 shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10 pointer-events-none"></div>
                        <div className="bg-black rounded-lg border border-white/5 p-6 md:p-10 text-left grid md:grid-cols-3 gap-8">
                            <div className="hidden md:flex flex-col gap-4 border-r border-white/10 pr-6">
                                <div className="h-3 w-20 bg-gray-800 rounded mb-4"></div>
                                <div className="h-8 w-full bg-white/10 rounded flex items-center px-3 text-xs text-white">Recent Ideas</div>
                                <div className="h-8 w-full rounded flex items-center px-3 text-xs text-gray-500">In Debate</div>
                                <div className="h-8 w-full rounded flex items-center px-3 text-xs text-gray-500">Approved</div>
                            </div>
                            <div className="col-span-2 flex flex-col gap-6">
                                <div className="border border-white/10 rounded p-4 bg-gray-900">
                                    <div className="flex justify-between mb-3">
                                        <div className="h-3 w-32 bg-gray-700 rounded"></div>
                                        <div className="h-3 w-12 bg-gray-800 rounded"></div>
                                    </div>
                                    <div className="h-4 w-3/4 bg-gray-600 rounded mb-2"></div>
                                    <div className="h-4 w-1/2 bg-gray-600 rounded mb-4"></div>
                                    <div className="flex gap-2 mt-2">
                                        <div className="h-6 w-16 bg-white/10 rounded"></div>
                                        <div className="h-6 w-16 bg-white/5 rounded"></div>
                                    </div>
                                </div>
                                <div className="border border-white/5 rounded p-4 bg-black opacity-50">
                                    <div className="flex justify-between mb-3">
                                        <div className="h-3 w-24 bg-gray-800 rounded"></div>
                                    </div>
                                    <div className="h-4 w-2/3 bg-gray-800 rounded mb-2"></div>
                                    <div className="h-4 w-1/2 bg-gray-800 rounded"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- FEATURES SECTION --- */}
                <section id="features" className="py-24 bg-white text-black">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="mb-16">
                            <h2 className="text-4xl font-bold mb-4">The Innovation Cycle.</h2>
                            <p className="text-gray-600 text-lg">Simple, transparent, and effective.</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-12">
                            <div className="flex flex-col gap-4 group">
                                <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <Lightbulb size={24} />
                                </div>
                                <h3 className="text-xl font-bold">Submit</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    A streamlined interface allowing every employee to capture an idea in seconds. No more dusty suggestion boxes.
                                </p>
                            </div>
                            <div className="flex flex-col gap-4 group">
                                <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <MessageSquare size={24} />
                                </div>
                                <h3 className="text-xl font-bold">Debate</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    Discuss, enrich, and challenge proposals constructively using our structured feedback tools.
                                </p>
                            </div>
                            <div className="flex flex-col gap-4 group">
                                <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <TrendingUp size={24} />
                                </div>
                                <h3 className="text-xl font-bold">Optimize</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    Identify the best ideas through voting and track their implementation. Turn collective thought into results.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* --- FOOTER --- */}
            <footer className="bg-black py-12 px-6 border-t border-white/10 text-sm text-gray-500">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <SigmentLogo className="w-6 h-6 text-gray-500" />
                        <span className="font-bold tracking-widest text-white">SIGMENT</span>
                    </div>

                    <div className="flex gap-6">
                        <button className="hover:text-white transition-colors">About</button>
                        <button className="hover:text-white transition-colors">Privacy</button>
                        <button className="hover:text-white transition-colors">Contact</button>
                    </div>

                    <div>
                        &copy; {new Date().getFullYear()} Sigment Inc.
                    </div>
                </div>
            </footer>
        </div>
    );
}
