import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navigation } from '@/components/Navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SIGMENT - AI Smart Notes',
  description: 'Fire & Forget Idea Capture for Strategic Decision Making',
  manifest: '/manifest.json',
  themeColor: '#3b82f6',
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
          <Navigation />
          <div className="pt-16">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}

