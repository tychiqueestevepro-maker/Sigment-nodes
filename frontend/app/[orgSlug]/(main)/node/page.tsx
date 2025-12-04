'use client';

import React, { useState } from 'react';
import { Edit3, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useApiClient } from '@/hooks/useApiClient';

export default function NodePage() {
    const [text, setText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [size, setSize] = useState(500); // Base size
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const apiClient = useApiClient();

    // Zoom & Pan State
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Dynamic resizing & Adaptive Scaling logic
    React.useEffect(() => {
        const BASE_SIZE = 500;
        const GROWTH_FACTOR = 1.2; // Pixels per character

        if (textareaRef.current) {
            // Auto-resize textarea
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;

            // Calculate bubble size
            const lengthBasedSize = BASE_SIZE + (text.length * GROWTH_FACTOR);
            const heightBasedSize = scrollHeight + 300;

            const newSize = Math.max(lengthBasedSize, heightBasedSize);
            setSize(newSize);

            // Adaptive Scaling
            // Automatically zoom out if the bubble gets too big for the viewport
            // Assuming a safe viewport height of around 800px for calculation
            const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
            const padding = 100;
            const availableHeight = viewportHeight - padding;

            if (newSize > availableHeight) {
                const targetScale = availableHeight / newSize;
                // Only scale down, don't scale up automatically
                setTransform(prev => ({ ...prev, scale: Math.min(1, targetScale) }));
            } else {
                // Reset to 1 if it fits, but maybe user wants to stay zoomed out? 
                // Let's reset to 1 only if we are currently < 1 and it fits now (e.g. deleted text)
                setTransform(prev => {
                    if (prev.scale < 1 && newSize <= availableHeight) return { ...prev, scale: 1 };
                    return prev;
                });
            }
        }
    }, [text]);

    // --- Event Handlers ---

    const handleWheel = (e: React.WheelEvent) => {
        const scaleAdjustment = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.1, transform.scale + scaleAdjustment), 4);
        setTransform(prev => ({ ...prev, scale: newScale }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        setTransform(prev => ({ ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
    };

    const handleMouseUp = () => { setIsDragging(false); };

    const zoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.2, 4) }));
    const zoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.2, 0.1) }));
    const resetZoom = () => setTransform({ x: 0, y: 0, scale: 1 });


    const handleSave = async () => {
        if (!text.trim()) {
            toast.error('Please enter your idea');
            return;
        }

        setIsSaving(true);
        try {
            const userId = apiClient.auth.userId;

            await apiClient.post('/notes', {
                user_id: userId,
                content_raw: text,
                source: 'web',
            });

            toast.success('Node captured successfully!');
            setText('');
            setTransform({ x: 0, y: 0, scale: 1 }); // Reset zoom on save
        } catch (error) {
            console.error('Error saving node:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save node');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full w-full bg-white relative overflow-hidden animate-in fade-in duration-500">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-50 via-white to-white opacity-80 pointer-events-none"></div>
            <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {/* Zoom Controls */}
            <div className="absolute bottom-8 right-8 z-50 flex flex-col gap-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2">
                <button onClick={zoomIn} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><ZoomIn size={20} /></button>
                <button onClick={zoomOut} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><ZoomOut size={20} /></button>
                <div className="h-px bg-gray-200 my-1"></div>
                <button onClick={resetZoom} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><Maximize size={20} /></button>
            </div>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                className={`w-full h-full cursor-${isDragging ? 'grabbing' : 'grab'} touch-none flex items-center justify-center`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                {/* Transformable Content */}
                <div
                    className="flex items-center justify-center transition-transform duration-75 ease-out origin-center"
                    style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
                >
                    {/* The Sphere Container */}
                    <div
                        className="relative flex items-center justify-center group transition-all duration-500 ease-out"
                        style={{ width: `${size}px`, height: `${size}px` }}
                    >
                        {/* Sphere Visuals - CSS gradients for 3D effect */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-50 to-purple-50 shadow-[inset_-20px_-20px_60px_rgba(0,0,0,0.05),_20px_20px_60px_rgba(255,255,255,0.8)] animate-pulse-slow transition-all duration-500"></div>
                        <div className="absolute inset-0 rounded-full border border-white/50 backdrop-blur-3xl shadow-2xl transition-all duration-500"></div>

                        {/* Orbit rings for style */}
                        <div className="absolute inset-[-8%] rounded-full border border-gray-200/40 animate-spin-slow-reverse pointer-events-none transition-all duration-500"></div>
                        <div className="absolute inset-[-16%] rounded-full border border-gray-100/40 animate-spin-slow pointer-events-none transition-all duration-500"></div>

                        {/* Input Area */}
                        <div className="relative z-10 w-3/4 text-center flex flex-col items-center">
                            <div className="mb-6 p-4 bg-white/80 rounded-full shadow-sm backdrop-blur-sm">
                                <Edit3 size={32} className="text-gray-600" />
                            </div>
                            <textarea
                                ref={textareaRef}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Capture your thought node..."
                                className="w-full bg-transparent border-none text-center text-gray-800 text-2xl font-medium placeholder-gray-300 focus:ring-0 resize-none outline-none overflow-hidden leading-relaxed transition-all duration-500"
                                rows={1}
                                style={{ minHeight: '60px' }}
                                onMouseDown={(e) => e.stopPropagation()} // Prevent dragging when clicking textarea
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
