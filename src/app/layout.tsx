import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'
import Providers from '@/components/Providers'
import LayoutWrapper from '@/components/layout/LayoutWrapper'
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
        <a href="#main-content" className="skip-link">דלג לתוכן הראשי</a>
        <Providers>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
          <Analytics />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              ariaProps: { role: 'status', 'aria-live': 'polite' },
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
