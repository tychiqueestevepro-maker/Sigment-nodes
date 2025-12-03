import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { UserProvider } from '@/contexts'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'SIGMENT - Strategic Idea Management',
    description: 'Multi-tenant platform for idea capture and strategic decision making',
    manifest: '/manifest.json',
    themeColor: '#000000',
}

/**
 * Root Layout - Niveau 1 du sandwich
 * Enveloppe toute l'app avec UserProvider (Auth globale)
 * withAuth appliqué ici protège toutes les routes sauf (auth)
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Providers>
                    <UserProvider>
                        {children}
                    </UserProvider>
                </Providers>
            </body>
        </html>
    )
}
