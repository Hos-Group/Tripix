'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { TripProvider } from '@/contexts/TripContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TripProvider>
        {children}
      </TripProvider>
    </AuthProvider>
  )
}
