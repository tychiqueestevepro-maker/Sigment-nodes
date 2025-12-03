import React from 'react';

export const SigmentLogo: React.FC<{ className?: string }> = ({ className = "h-8 w-8 text-black fill-current" }) => (
    <svg viewBox="0 0 100 100" className={className} aria-label="SIGMENT Logo">
        <path d="M30 25 L55 25 L67.5 46.65 L55 68.3 L30 68.3 L17.5 46.65 Z" fill="currentColor" />
        <path d="M60 35 Q80 35 85 20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle cx="85" cy="15" r="5" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M67.5 46.65 L85 46.65" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle cx="92" cy="46.65" r="5" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M60 58 Q80 58 85 73" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle cx="85" cy="78" r="5" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
);
