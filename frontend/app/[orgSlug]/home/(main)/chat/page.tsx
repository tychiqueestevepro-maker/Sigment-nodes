'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function ChatPage() {
    return (
        <div className="h-full w-full flex items-center justify-center p-10 animate-in fade-in duration-300">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center p-4 bg-gray-50 rounded-full mb-6">
                    <MessageCircle size={32} className="text-gray-900" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Chat</h2>
                <p className="text-gray-500">
                    Direct messaging with team members. Coming soon...
                </p>
            </div>
        </div>
    );
}
