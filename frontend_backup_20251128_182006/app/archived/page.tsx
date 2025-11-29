'use client';

import React from 'react';
import { Archive } from 'lucide-react';

export default function ArchivedPage() {
    return (
        <div className="h-full w-full flex items-center justify-center p-10 animate-in fade-in duration-300">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center p-4 bg-gray-50 rounded-full mb-6">
                    <Archive size={32} className="text-gray-900" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Archived</h2>
                <p className="text-gray-500">
                    View archived ideas and discussions. Coming soon...
                </p>
            </div>
        </div>
    );
}
