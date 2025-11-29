'use client';

import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function NodePage() {
    const [text, setText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!text.trim()) {
            toast.error('Please enter your idea');
            return;
        }

        setIsSaving(true);
        try {
            const userId = localStorage.getItem('sigment_user_id');
            const response = await fetch(`${api.baseURL}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    content: text,
                    source: 'web',
                }),
            });

            if (!response.ok) throw new Error('Failed to save node');

            toast.success('Node captured successfully!');
            setText('');
        } catch (error) {
            toast.error('Failed to save node');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full w-full bg-white relative flex items-center justify-center overflow-hidden animate-in fade-in duration-500">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-50 via-white to-white opacity-80"></div>
            <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {/* The Sphere Container */}
            <div className="relative w-[500px] h-[500px] flex items-center justify-center group">
                {/* Sphere Visuals - CSS gradients for 3D effect */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-50 to-purple-50 shadow-[inset_-20px_-20px_60px_rgba(0,0,0,0.05),_20px_20px_60px_rgba(255,255,255,0.8)] animate-pulse-slow"></div>
                <div className="absolute inset-0 rounded-full border border-white/50 backdrop-blur-3xl shadow-2xl"></div>

                {/* Orbit rings for style */}
                <div className="absolute inset-[-40px] rounded-full border border-gray-200/40 animate-spin-slow-reverse pointer-events-none"></div>
                <div className="absolute inset-[-80px] rounded-full border border-gray-100/40 animate-spin-slow pointer-events-none"></div>

                {/* Input Area */}
                <div className="relative z-10 w-3/4 text-center flex flex-col items-center">
                    <div className="mb-6 p-4 bg-white/80 rounded-full shadow-sm backdrop-blur-sm">
                        <Edit3 size={32} className="text-gray-600" />
                    </div>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Capture your thought node..."
                        className="w-full bg-transparent border-none text-center text-gray-800 text-2xl font-medium placeholder-gray-300 focus:ring-0 resize-none outline-none overflow-hidden leading-relaxed"
                        rows={3}
                        style={{ minHeight: '120px' }}
                    />
                    <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2 bg-black text-white rounded-full text-sm font-bold shadow-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save Node'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Add custom animations */}
            <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.9; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-slow-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .animate-spin-slow-reverse {
          animation: spin-slow-reverse 15s linear infinite;
        }
      `}</style>
        </div>
    );
}
