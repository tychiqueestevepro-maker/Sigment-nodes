import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { MemberSidebar } from '@/components/member/MemberSidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'SIGMENT - Member Area',
    description: 'Employee workspace for idea capture and tracking',
    manifest: '/manifest.json',
    themeColor: '#000000',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Providers>
                    <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
                        <MemberSidebar />
                        <main className="flex-1 bg-white h-full relative flex flex-col overflow-hidden">
                            {children}
                        </main>
                    </div>
                </Providers>
            </body>
        </html>
    )
}
