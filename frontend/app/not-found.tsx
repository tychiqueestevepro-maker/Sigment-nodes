'use client'

import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-black text-white">
            <div className="text-center">
                <h1 className="text-6xl font-bold mb-4">404</h1>
                <p className="text-xl mb-8">Page Not Found</p>
                <Link href="/" className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200">
                    Go Home
                </Link>
            </div>
        </div>
    )
}
