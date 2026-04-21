import { supabase } from './supabase'

export interface Traveler {
  id: string
  name: string
}

const cache: Record<string, Traveler[]> = {}

/**
 * Load travelers for a specific trip.
 * Falls back to the first available trip when no tripId provided (legacy compat).
 */
export async function loadTravelers(tripId?: string): Promise<Traveler[]> {
  const key = tripId || '__any__'
  if (cache[key]) return cache[key]

  try {
    const query = supabase.from('trips').select('travelers')
    if (tripId) {
      const { data } = await query.eq('id', tripId).maybeSingle()
      if (data?.travelers && Array.isArray(data.travelers) && data.travelers.length > 0) {
        cache[key] = data.travelers as Traveler[]
        return cache[key]
      }
    } else {
      const { data } = await query.limit(1).single()
      if (data?.travelers && Array.isArray(data.travelers) && data.travelers.length > 0) {
        cache[key] = data.travelers as Traveler[]
        return cache[key]
      }
    }
  } catch {
    // fallback below
  }

  // Return empty — caller should handle gracefully (e.g., show "all")
  return []
}

export function invalidateTravelersCache(tripId?: string) {
  if (tripId) delete cache[tripId]
  else Object.keys(cache).forEach(k => delete cache[k])
}

export function getTravelerName(travelers: Traveler[], id: string): string {
  if (!id || id === 'all') return 'כולם'
  const t = travelers.find(t => t.id === id)
  return t?.name || id
}
