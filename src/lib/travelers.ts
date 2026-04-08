import { supabase } from './supabase'

export interface Traveler {
  id: string
  name: string
}

let cachedTravelers: Traveler[] | null = null

export async function loadTravelers(): Promise<Traveler[]> {
  if (cachedTravelers) return cachedTravelers
  try {
    const { data } = await supabase.from('trips').select('travelers').limit(1).single()
    if (data?.travelers) {
      cachedTravelers = data.travelers as Traveler[]
      return cachedTravelers
    }
  } catch {
    // fallback
  }
  return [
    { id: 'omer', name: 'Omer' },
    { id: 'wife', name: 'Wife' },
    { id: 'baby', name: 'Baby' },
  ]
}

export function invalidateTravelersCache() {
  cachedTravelers = null
}

export function getTravelerName(travelers: Traveler[], id: string): string {
  if (id === 'all') return 'כולם'
  const t = travelers.find(t => t.id === id)
  return t?.name || id
}
