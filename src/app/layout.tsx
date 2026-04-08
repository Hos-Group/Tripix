import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import BottomNav from '@/components/layout/BottomNav'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Providers from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tripix — מנהל טיול חכם',
  description: 'מערכת ניהול טיול חכמה לתאילנד',
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
  themeColor: '#185FA5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Providers>
        <GlobalHeader />
        <main className="min-h-screen max-w-lg mx-auto px-4 pt-16 pb-24">
          {children}
        </main>
        <BottomNav />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              direction: 'rtl',
              borderRadius: '12px',
              fontSize: '14px',
            },
          }}
        />
        </Providers>
      </body>
    </html>
  )
}
