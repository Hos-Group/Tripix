import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'
import Providers from '@/components/Providers'
import LayoutWrapper from '@/components/layout/LayoutWrapper'
import SkipLink from '@/components/ui/SkipLink'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Tripix — מנהל נסיעות',
  description: 'מנהל נסיעות חכם — ניהול הוצאות, מסמכים, ציר זמן וכלים לנסיעה מושלמת',
  manifest: '/manifest.json',
  other: {
    'impact-site-verification': 'd06b618e-7803-4c8e-b31e-49c6aad02b22',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tripix',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Default: no pinch-zoom (prevents accidental zoom during tap interactions).
  // Overridden dynamically to 5× inside DocumentViewer via useViewerZoom().
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#6C47FF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={inter.variable}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Tripix" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-surface-secondary text-gray-900 antialiased">
        <Providers>
          <SkipLink />
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
          <Analytics />
          <Toaster
            position="top-center"
            gutter={10}
            containerStyle={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
            toastOptions={{
              duration: 3200,
              ariaProps: { role: 'status', 'aria-live': 'polite' },
              style: {
                direction: 'rtl',
                borderRadius: '18px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#1F2937',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 12px 40px rgba(15,12,40,0.18), 0 0 0 1px rgba(255,255,255,0.7) inset',
                border: '1px solid rgba(108,71,255,0.10)',
                padding: '14px 18px',
                maxWidth: '92vw',
              },
              success: {
                duration: 2800,
                iconTheme: { primary: '#10B981', secondary: '#ECFDF5' },
              },
              error: {
                duration: 4500,
                iconTheme: { primary: '#EF4444', secondary: '#FEF2F2' },
                style: {
                  background: 'rgba(254,242,242,0.95)',
                  border: '1px solid rgba(239,68,68,0.20)',
                  color: '#7F1D1D',
                },
              },
              loading: {
                iconTheme: { primary: '#6C47FF', secondary: '#F3F0FF' },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
