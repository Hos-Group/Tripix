'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { TripProvider } from '@/contexts/TripContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import ErrorBoundary from './ui/ErrorBoundary'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <TripProvider>
            {children}
          </TripProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  )
}
