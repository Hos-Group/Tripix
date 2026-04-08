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
  const [currentTripId, setCurrentTripId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshTrips = useCallback(async () => {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .order('start_date', { ascending: false })

    const tripList = (data || []) as Trip[]
    setTrips(tripList)

    // Auto-select first trip if none selected
    if (!currentTripId && tripList.length > 0) {
      const saved = localStorage.getItem('tripix_current_trip')
      const validSaved = saved && tripList.find(t => t.id === saved)
      setCurrentTripId(validSaved ? saved : tripList[0].id)
    }

    setLoading(false)
  }, [currentTripId])

  useEffect(() => { refreshTrips() }, [refreshTrips])

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
