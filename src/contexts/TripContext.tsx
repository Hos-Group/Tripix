'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Trip } from '@/types'
import { useAuth } from './AuthContext'

interface TripContextType {
  trips: Trip[]
  currentTrip: Trip | null
  setCurrentTripId: (id: string) => void
  loading: boolean
  refreshTrips: () => Promise<void>
}

const TripContext = createContext<TripContextType>({
  trips: [],
  currentTrip: null,
  setCurrentTripId: () => {},
  loading: true,
  refreshTrips: async () => {},
})

export function TripProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [currentTripId, setCurrentTripId] = useState<string | null>(() => {
    // Init from localStorage once — avoids dependency loop
    if (typeof window !== 'undefined') return localStorage.getItem('tripix_current_trip')
    return null
  })
  // Skip loading state if localStorage already has a trip ID — data arrives shortly
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    return !localStorage.getItem('tripix_current_trip')
  })

  // refreshTrips does NOT depend on currentTripId — avoids infinite loop
  const refreshTrips = useCallback(async () => {
    if (!user) {
      setTrips([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })

    if (error) {
      console.error('[TripContext] fetch error:', error.message)
      setLoading(false)
      return
    }

    const tripList = (data || []) as Trip[]
    setTrips(tripList)

    // Auto-select: prefer saved ID, else first trip — read localStorage here, not state
    setCurrentTripId(prev => {
      if (prev && tripList.find(t => t.id === prev)) return prev  // still valid
      const saved = typeof window !== 'undefined' ? localStorage.getItem('tripix_current_trip') : null
      if (saved && tripList.find(t => t.id === saved)) return saved
      return tripList[0]?.id ?? prev
    })

    setLoading(false)
  }, [user])   // ← only user, NOT currentTripId

  // Re-fetch only when user changes (login/logout)
  useEffect(() => { refreshTrips() }, [user, refreshTrips])

  // Persist selected trip to localStorage whenever it changes
  useEffect(() => {
    if (currentTripId) localStorage.setItem('tripix_current_trip', currentTripId)
  }, [currentTripId])

  const currentTrip = trips.find(t => t.id === currentTripId) || null

  return (
    <TripContext.Provider value={{ trips, currentTrip, setCurrentTripId, loading, refreshTrips }}>
      {children}
    </TripContext.Provider>
  )
}

export function useTrip() {
  return useContext(TripContext)
}
