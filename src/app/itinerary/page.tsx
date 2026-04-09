'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plane, Hotel, Loader2, MapPin } from 'lucide-react'
import { useTrip } from '@/contexts/TripContext'
import { supabase } from '@/lib/supabase'
import { Document as TripDoc } from '@/types'

// ── Coordinate database ─────────────────────────────────────────────────────
// Major airports and cities used in Israeli travel bookings
const CITY_COORDS: Record<string, [number, number]> = {
  // Israel
  'tel aviv': [32.0055, 34.8854], 'tlv': [32.0055, 34.8854],
  'ben gurion': [32.0055, 34.8854], 'israel': [31.5, 34.75],
  // Thailand
  'bangkok': [13.6811, 100.7472], 'bkk': [13.6811, 100.7472],
  'phuket': [8.1132, 98.3017], 'hkt': [8.1132, 98.3017],
  'koh samui': [9.5279, 100.0624], 'samui': [9.5279, 100.0624], 'usm': [9.5279, 100.0624],
  'koh phangan': [9.7382, 100.0144], 'phangan': [9.7382, 100.0144],
  'chiang mai': [18.7669, 98.9625], 'cnx': [18.7669, 98.9625],
  'krabi': [8.0986, 98.9842], 'kbv': [8.0986, 98.9842],
  'thailand': [13.0, 101.0],
  // Southeast Asia
  'singapore': [1.3644, 103.9915], 'sin': [1.3644, 103.9915],
  'bali': [-8.7482, 115.1673], 'dps': [-8.7482, 115.1673],
  'kuala lumpur': [2.7456, 101.7072], 'kul': [2.7456, 101.7072],
  'ho chi minh': [10.8188, 106.6520], 'sgn': [10.8188, 106.6520],
  'hanoi': [21.2187, 105.8047], 'han': [21.2187, 105.8047],
  'phnom penh': [11.5546, 104.8440], 'pnh': [11.5546, 104.8440],
  'siem reap': [13.4110, 103.8123], 'rep': [13.4110, 103.8123],
  // Europe
  'paris': [48.8566, 2.3522], 'cdg': [49.0097, 2.5479], 'ory': [48.7233, 2.3794],
  'london': [51.5074, -0.1278], 'lhr': [51.4775, -0.4614], 'lgw': [51.1537, -0.1821],
  'amsterdam': [52.3676, 4.9041], 'ams': [52.3086, 4.7639],
  'rome': [41.9028, 12.4964], 'fco': [41.8003, 12.2389],
  'madrid': [40.4168, -3.7038], 'mad': [40.4936, -3.5668],
  'barcelona': [41.3851, 2.1734], 'bcn': [41.2974, 2.0833],
  'berlin': [52.5200, 13.4050], 'ber': [52.3514, 13.4939],
  'munich': [48.1351, 11.5820], 'muc': [48.3538, 11.7861],
  'frankfurt': [50.1109, 8.6821], 'fra': [50.0333, 8.5706],
  'zurich': [47.3769, 8.5417], 'zrh': [47.4647, 8.5492],
  'athens': [37.9838, 23.7275], 'ath': [37.9364, 23.9445],
  'santorini': [36.3932, 25.4615], 'jtr': [36.3932, 25.4615],
  'mykonos': [37.4415, 25.3285], 'jmk': [37.4415, 25.3285],
  'lisbon': [38.7223, -9.1393], 'lis': [38.7813, -9.1359],
  'prague': [50.0755, 14.4378], 'prg': [50.1008, 14.2632],
  'budapest': [47.4979, 19.0402], 'bud': [47.4298, 19.2611],
  'vienna': [48.2082, 16.3738], 'vie': [48.1103, 16.5697],
  'warsaw': [52.2297, 21.0122], 'waw': [52.1657, 20.9671],
  'dubrovnik': [42.6507, 18.0944], 'dbv': [42.5614, 18.2682],
  // Middle East / UAE
  'dubai': [25.2048, 55.2708], 'dxb': [25.2532, 55.3657],
  'abu dhabi': [24.4539, 54.3773], 'auh': [24.4330, 54.6511],
  'istanbul': [41.0082, 28.9784], 'ist': [41.2753, 28.7519],
  'amman': [31.9539, 35.9106], 'amm': [31.7227, 35.9932],
  // Egypt / Morocco
  'cairo': [30.0444, 31.2357], 'cai': [30.1219, 31.4056],
  'sharm': [27.9158, 34.3299], 'ssh': [27.9158, 34.3299],
  'marrakech': [31.6295, -7.9811], 'rak': [31.6069, -8.0363],
  // USA
  'new york': [40.7128, -74.0060], 'jfk': [40.6413, -73.7781],
  'los angeles': [34.0522, -118.2437], 'lax': [33.9425, -118.4081],
  'miami': [25.7617, -80.1918], 'mia': [25.7959, -80.2870],
  'las vegas': [36.1699, -115.1398], 'las': [36.0840, -115.1537],
  // India / Maldives
  'mumbai': [19.0760, 72.8777], 'bom': [19.0896, 72.8656],
  'delhi': [28.6139, 77.2090], 'del': [28.5562, 77.1000],
  'goa': [15.2993, 74.1240], 'goi': [15.3799, 73.8314],
  'maldives': [3.2028, 73.2207], 'male': [4.1755, 73.5093], 'mle': [4.1755, 73.5093],
}

function getCoords(cityOrCode: string): [number, number] | null {
  if (!cityOrCode) return null
  const key = cityOrCode.toLowerCase().trim()
  // Direct lookup
  if (CITY_COORDS[key]) return CITY_COORDS[key]
  // Partial match — find first key that contains the query or vice versa
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

// ── Types ───────────────────────────────────────────────────────────────────

interface FlightMarker {
  id:          string
  type:        'departure' | 'arrival' | 'connection'
  coords:      [number, number]
  flightNo:    string
  airline:     string
  depCity:     string
  arrCity:     string
  depTime:     string
  arrTime:     string
  date:        string
  isConnection?: boolean
}

interface FlightPath {
  id:          string
  from:        [number, number]
  to:          [number, number]
  flightNo:    string
  isConnection?: boolean
}

interface HotelMarker {
  id:          string
  coords:      [number, number]
  name:        string
  checkIn:     string
  checkOut:    string
  nights:      number
}

// ── Leaflet Map Component (dynamic — no SSR) ────────────────────────────────

const LeafletMap = dynamic(() => import('@/components/TripMap'), { ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
})

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ItineraryPage() {
  const router      = useRouter()
  const { currentTrip } = useTrip()
  const [flights,   setFlights]   = useState<FlightMarker[]>([])
  const [paths,     setPaths]     = useState<FlightPath[]>([])
  const [hotels,    setHotels]    = useState<HotelMarker[]>([])
  const [loading,   setLoading]   = useState(true)

  const fmtDate = (d: string) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''

  useEffect(() => {
    if (currentTrip) loadData()
  }, [currentTrip])

  async function loadData() {
    if (!currentTrip) return
    setLoading(true)

    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('trip_id', currentTrip.id)
      .in('doc_type', ['flight', 'hotel'])

    const flightMarkers: FlightMarker[] = []
    const flightPaths:   FlightPath[]   = []
    const hotelMarkers:  HotelMarker[]  = []

    const flightDocs = (docs || []).filter(d => d.doc_type === 'flight')
    const hotelDocs  = (docs || []).filter(d => d.doc_type === 'hotel')

    // ── Flights ──────────────────────────────────────────────────────────
    // Group by date to detect connections (2+ flights same day)
    const byDate: Record<string, TripDoc[]> = {}
    for (const doc of flightDocs) {
      const ext = doc.extracted_data as Record<string, string> | null
      const date = ext?.departure_date || ext?.check_in || doc.valid_from || ''
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(doc)
    }

    for (const [date, dayFlights] of Object.entries(byDate)) {
      const isConnection = dayFlights.length > 1

      for (const doc of dayFlights) {
        const ext      = (doc.extracted_data || {}) as Record<string, string>
        const depCity  = ext.departure_city  || ext.departure  || ''
        const arrCity  = ext.destination_city || ext.arrival   || ''
        const flightNo = doc.flight_number || ext.flight_number || 'טיסה'
        const airline  = ext.airline || ''
        const depTime  = ext.departure_time || ext.dep_time    || ''
        const arrTime  = ext.arrival_time   || ext.arr_time    || ''

        const depCoords = getCoords(depCity)
        const arrCoords = getCoords(arrCity)

        if (depCoords) {
          flightMarkers.push({
            id: `${doc.id}-dep`, type: 'departure',
            coords: depCoords, flightNo, airline,
            depCity, arrCity, depTime, arrTime, date,
            isConnection,
          })
        }
        if (arrCoords) {
          flightMarkers.push({
            id: `${doc.id}-arr`, type: 'arrival',
            coords: arrCoords, flightNo, airline,
            depCity, arrCity, depTime, arrTime, date,
            isConnection,
          })
        }
        if (depCoords && arrCoords) {
          flightPaths.push({
            id: doc.id, from: depCoords, to: arrCoords,
            flightNo, isConnection,
          })
        }
      }
    }

    // ── Hotels ───────────────────────────────────────────────────────────
    for (const doc of hotelDocs) {
      const ext      = (doc.extracted_data || {}) as Record<string, string>
      const city     = ext.destination_city || ext.hotel_city || ext.city || ''
      const coords   = getCoords(city)
      if (!coords) continue

      const checkIn  = ext.check_in  || doc.valid_from  || ''
      const checkOut = ext.check_out || doc.valid_until || ''
      let nights = 0
      if (checkIn && checkOut) {
        nights = Math.round(
          (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
        )
      }

      hotelMarkers.push({
        id: doc.id,
        coords,
        name:    ext.hotel_name || doc.name,
        checkIn, checkOut, nights,
      })
    }

    setFlights(flightMarkers)
    setPaths(flightPaths)
    setHotels(hotelMarkers)
    setLoading(false)
  }

  const hasData = flights.length > 0 || hotels.length > 0

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-bl from-[#185FA5] to-[#0D3B6E] text-white px-4 pt-safe pb-3 flex-shrink-0"
           style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-bold">Trip Map</h1>
            {currentTrip && (
              <p className="text-xs opacity-60">{currentTrip.name}</p>
            )}
          </div>
          {/* Legend pill */}
          <div className="flex items-center gap-2 text-[10px] opacity-70">
            <span>✈️ Flight</span>
            <span>🏨 Hotel</span>
          </div>
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-100">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm text-gray-500">Loading trip data...</p>
          </div>
        ) : !currentTrip ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50">
            <MapPin className="w-12 h-12 text-gray-300" />
            <p className="text-gray-400">Select a trip to view the map</p>
          </div>
        ) : !hasData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50">
            <div className="text-5xl mb-2">✈️</div>
            <p className="text-gray-500 text-sm font-medium">No flight / hotel documents yet</p>
            <p className="text-gray-400 text-xs">Scan Gmail to import documents</p>
          </div>
        ) : (
          <LeafletMap
            flights={flights}
            paths={paths}
            hotels={hotels}
          />
        )}
      </div>
    </div>
  )
}
