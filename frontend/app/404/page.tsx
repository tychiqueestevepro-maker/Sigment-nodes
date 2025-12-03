'use client'

import Link from 'next/link'

export default function Custom404() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-black text-white">
            <div className="text-center">
                <h1 className="text-6xl font-bold mb-4">404</h1>
                <p className="text-xl mb-8">Organization Not Found</p>
                <div className="space-x-4">
                    <Link href="/" className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200">
                        Go Home
                    </Link>
                    <Link href="/login" className="px-6 py-3 border border-white text-white rounded-lg hover:bg-gray-900">
                        Login
                    </Link>
                </div>
            </div>
        </div>
    )
}
