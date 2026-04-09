import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import BottomNav from '@/components/layout/BottomNav'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Providers from '@/components/Providers'
import TourGuideWrapper from '@/components/TourGuideWrapper'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Tripix — מנהל טיול חכם',
  description: 'מערכת לניהול נסיעות אוטומטי',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tripix',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#6C47FF',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-surface-secondary text-gray-900 antialiased">
        <Providers>
          <GlobalHeader />
          <main className="min-h-screen max-w-lg mx-auto px-4 pt-16 pb-24">
            {children}
          </main>
          <BottomNav />
          <TourGuideWrapper />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                direction: 'rtl',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                border: 'none',
                padding: '12px 16px',
              },
              success: {
                iconTheme: { primary: '#6C47FF', secondary: '#fff' },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
