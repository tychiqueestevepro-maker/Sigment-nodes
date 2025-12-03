/**
 * Next.js Configuration
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        // Enable server actions if needed
    },
    // Allow images from external sources
    images: {
        domains: [],
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://127.0.0.1:8000/api/:path*',
            },
        ]
    },
}

module.exports = nextConfig
