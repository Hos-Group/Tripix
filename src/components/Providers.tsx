'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { TripProvider } from '@/contexts/TripContext'
import { LanguageProvider } from '@/contexts/LanguageContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <TripProvider>
          {children}
        </TripProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
