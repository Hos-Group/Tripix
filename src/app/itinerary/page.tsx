'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, MapPin } from 'lucide-react'
import { useTrip } from '@/contexts/TripContext'
import { supabase } from '@/lib/supabase'
import { Document as TripDoc } from '@/types'

// ── Comprehensive IATA airport code → [lat, lng] mapping ─────────────────────
const AIRPORT_COORDS: Record<string, [number, number]> = {
  // Israel
  TLV: [32.0055, 34.8854], ETH: [29.5613, 34.9596], HFA: [32.8094, 35.0431],
  // Thailand
  BKK: [13.6811, 100.7472], DMK: [13.9126, 100.6069], HKT: [8.1132, 98.3017],
  USM: [9.5279, 100.0624], CNX: [18.7669, 98.9625], KBV: [8.0986, 98.9842],
  CEI: [20.2432, 99.8828], UTP: [12.6800, 101.0049], HDY: [6.9332, 100.3930],
  // Southeast Asia
  SIN: [1.3644, 103.9915], DPS: [-8.7482, 115.1673], KUL: [2.7456, 101.7072],
  SGN: [10.8188, 106.6520], HAN: [21.2187, 105.8047], PNH: [11.5546, 104.8440],
  REP: [13.4110, 103.8123], VTE: [17.9883, 102.5633], RGN: [16.9073, 96.1332],
  MNL: [14.5086, 121.0197], CEB: [10.3075, 123.9795], BKI: [5.9374, 116.0514],
  CGK: [-6.1256, 106.6559], SUB: [-7.3798, 112.7869],
  // Europe
  CDG: [49.0097, 2.5479], ORY: [48.7233, 2.3794],
  LHR: [51.4775, -0.4614], LGW: [51.1537, -0.1821], STN: [51.8860, 0.2389], LTN: [51.8747, -0.3683],
  AMS: [52.3086, 4.7639],
  FCO: [41.8003, 12.2389], MXP: [45.6306, 8.7281], BGY: [45.6739, 9.7042],
  MAD: [40.4936, -3.5668], BCN: [41.2974, 2.0833], AGP: [36.6749, -4.4991],
  BER: [52.3514, 13.4939], MUC: [48.3538, 11.7861], FRA: [50.0333, 8.5706],
  HAM: [53.6304, 9.9882], CGN: [50.8659, 7.1427], DUS: [51.2895, 6.7668],
  ZRH: [47.4647, 8.5492], GVA: [46.2381, 6.1089], BSL: [47.5895, 7.5299],
  ATH: [37.9364, 23.9445], JTR: [36.3932, 25.4615], JMK: [37.4415, 25.3285],
  SKG: [40.5197, 22.9709], HER: [35.3397, 25.1803], CFU: [39.6019, 19.9117],
  LIS: [38.7813, -9.1359], OPO: [41.2481, -8.6814], FAO: [37.0144, -7.9659],
  PRG: [50.1008, 14.2632], BUD: [47.4298, 19.2611], VIE: [48.1103, 16.5697],
  WAW: [52.1657, 20.9671], KRK: [50.0778, 19.7848],
  DBV: [42.5614, 18.2682], SPU: [43.5389, 16.2980], ZAG: [45.7429, 16.0688],
  BRU: [50.9014, 4.4844], LUX: [49.6234, 6.2044],
  OSL: [60.1976, 11.1004], CPH: [55.6179, 12.6561], ARN: [59.6519, 17.9186],
  HEL: [60.3172, 24.9633],
  DUB: [53.4213, -6.2701], EDI: [55.9508, -3.3725], BHX: [52.4539, -1.7480],
  VCE: [45.5053, 12.3520], BLQ: [44.5354, 11.2887], NAP: [40.8860, 14.2908],
  PMI: [39.5517, 2.7388], IBZ: [38.8729, 1.3731],
  KBP: [50.3450, 30.8947], OTP: [44.5722, 26.1020],
  SOF: [42.6952, 23.4114], SKP: [41.9616, 21.6214], TIA: [41.4147, 19.7206],
  // Middle East / UAE
  DXB: [25.2532, 55.3657], DWC: [24.8966, 55.1614], AUH: [24.4330, 54.6511],
  IST: [41.2753, 28.7519], SAW: [40.8985, 29.3092], ADB: [38.2924, 27.1570],
  AMM: [31.7227, 35.9932], AQJ: [29.6116, 35.0181],
  BEY: [33.8209, 35.4882], KWI: [29.2266, 47.9689],
  BAH: [26.2708, 50.6336], DOH: [25.2731, 51.6081],
  MCT: [23.5933, 58.2844], RUH: [24.9576, 46.6988], JED: [21.6796, 39.1565],
  // Egypt / North Africa / Morocco
  CAI: [30.1219, 31.4056], HRG: [27.1783, 33.7994], SSH: [27.9158, 34.3299],
  LXR: [25.6710, 32.7066], ASW: [23.9644, 32.8200],
  RAK: [31.6069, -8.0363], CMN: [33.3675, -7.5899], FEZ: [33.9273, -4.9779],
  TNG: [35.7269, -5.9189], AGA: [30.3250, -9.4130],
  TUN: [36.8510, 10.2272], DJE: [33.8750, 10.7755],
  // USA
  JFK: [40.6413, -73.7781], LGA: [40.7773, -73.8726], EWR: [40.6895, -74.1745],
  LAX: [33.9425, -118.4081], SFO: [37.6213, -122.3790], SJC: [37.3626, -121.9290],
  MIA: [25.7959, -80.2870], FLL: [26.0726, -80.1527],
  LAS: [36.0840, -115.1537], ORD: [41.9742, -87.9073], MDW: [41.7868, -87.7522],
  BOS: [42.3656, -71.0096], ATL: [33.6407, -84.4277], DFW: [32.8998, -97.0403],
  DEN: [39.8561, -104.6737], PHX: [33.4373, -112.0078], SEA: [47.4502, -122.3088],
  HNL: [21.3245, -157.9251], MCO: [28.4312, -81.3081],
  // Canada
  YYZ: [43.6777, -79.6248], YVR: [49.1967, -123.1815], YUL: [45.4706, -73.7408],
  YYC: [51.1315, -114.0106],
  // Latin America
  GRU: [-23.4356, -46.4731], EZE: [-34.8222, -58.5358], GIG: [-22.8099, -43.2505],
  LIM: [-12.0219, -77.1143], BOG: [4.7016, -74.1469], CUN: [21.0365, -86.8771],
  MEX: [19.4363, -99.0721],
  // India / Maldives / Sri Lanka
  BOM: [19.0896, 72.8656], DEL: [28.5562, 77.1000], GOI: [15.3799, 73.8314],
  BLR: [13.1986, 77.7066], MAA: [12.9900, 80.1693], CCU: [22.6453, 88.4467],
  MLE: [4.1755, 73.5093], CMB: [7.1807, 79.8841],
  // East Asia
  NRT: [35.7653, 140.3856], HND: [35.5494, 139.7798], KIX: [34.4271, 135.2440],
  ICN: [37.4602, 126.4407], GMP: [37.5583, 126.7906],
  PEK: [40.0799, 116.5833], PVG: [31.1443, 121.8083], CAN: [23.3959, 113.3080],
  HKG: [22.3080, 113.9185], MFM: [22.1496, 113.5922],
  TPE: [25.0777, 121.2328], RMQ: [24.2647, 120.6205],
  // Australia / NZ
  SYD: [-33.9399, 151.1753], MEL: [-37.6690, 144.8410], BNE: [-27.3842, 153.1175],
  PER: [-31.9403, 115.9669], ADL: [-34.9450, 138.5300], CNS: [-16.8858, 145.7479],
  AKL: [-37.0082, 174.7917], CHC: [-43.4894, 172.5322],
  // Sub-Saharan Africa
  JNB: [-26.1392, 28.2460], CPT: [-33.9648, 18.6017], NBO: [-1.3192, 36.9275],
  ADD: [8.9779, 38.7993], ACC: [5.6052, -0.1669], LOS: [6.5774, 3.3216],
  DAR: [-6.8781, 39.2026], EBB: [0.0424, 32.4435],
}

// City-level fallback
const CITY_COORDS: Record<string, [number, number]> = {
  'tel aviv': [32.0055, 34.8854], 'tlv': [32.0055, 34.8854],
  'ben gurion': [32.0055, 34.8854], 'israel': [31.5, 34.75],
  'bangkok': [13.6811, 100.7472], 'bkk': [13.6811, 100.7472],
  'phuket': [8.1132, 98.3017], 'hkt': [8.1132, 98.3017],
  'koh samui': [9.5279, 100.0624], 'samui': [9.5279, 100.0624], 'usm': [9.5279, 100.0624],
  'koh phangan': [9.7382, 100.0144], 'phangan': [9.7382, 100.0144],
  'chiang mai': [18.7669, 98.9625], 'cnx': [18.7669, 98.9625],
  'krabi': [8.0986, 98.9842], 'kbv': [8.0986, 98.9842],
  'thailand': [13.0, 101.0],
  'singapore': [1.3644, 103.9915], 'sin': [1.3644, 103.9915],
  'bali': [-8.7482, 115.1673], 'dps': [-8.7482, 115.1673],
  'kuala lumpur': [2.7456, 101.7072], 'kul': [2.7456, 101.7072],
  'ho chi minh': [10.8188, 106.6520], 'sgn': [10.8188, 106.6520],
  'hanoi': [21.2187, 105.8047], 'han': [21.2187, 105.8047],
  'phnom penh': [11.5546, 104.8440], 'pnh': [11.5546, 104.8440],
  'siem reap': [13.4110, 103.8123], 'rep': [13.4110, 103.8123],
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
  'dubai': [25.2048, 55.2708], 'dxb': [25.2532, 55.3657],
  'abu dhabi': [24.4539, 54.3773], 'auh': [24.4330, 54.6511],
  'istanbul': [41.0082, 28.9784], 'ist': [41.2753, 28.7519],
  'amman': [31.9539, 35.9106], 'amm': [31.7227, 35.9932],
  'cairo': [30.0444, 31.2357], 'cai': [30.1219, 31.4056],
  'sharm': [27.9158, 34.3299], 'ssh': [27.9158, 34.3299],
  'marrakech': [31.6295, -7.9811], 'rak': [31.6069, -8.0363],
  'new york': [40.7128, -74.0060], 'jfk': [40.6413, -73.7781],
  'los angeles': [34.0522, -118.2437], 'lax': [33.9425, -118.4081],
  'miami': [25.7617, -80.1918], 'mia': [25.7959, -80.2870],
  'las vegas': [36.1699, -115.1398], 'las': [36.0840, -115.1537],
  'mumbai': [19.0760, 72.8777], 'bom': [19.0896, 72.8656],
  'delhi': [28.6139, 77.2090], 'del': [28.5562, 77.1000],
  'goa': [15.2993, 74.1240], 'goi': [15.3799, 73.8314],
  'maldives': [3.2028, 73.2207], 'male': [4.1755, 73.5093], 'mle': [4.1755, 73.5093],
}

function getCoords(cityOrCode: string): [number, number] | null {
  if (!cityOrCode) return null
  const trimmed = cityOrCode.trim()
  // Try IATA airport code first (exact uppercase match, 3 chars)
  const upper = trimmed.toUpperCase()
  if (upper.length === 3 && AIRPORT_COORDS[upper]) return AIRPORT_COORDS[upper]
  // Try city dictionary (lowercase)
  const key = trimmed.toLowerCase()
  if (CITY_COORDS[key]) return CITY_COORDS[key]
  // Partial match
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

// ── Geocoding (Nominatim — free, no API key) ─────────────────────────────────
const geocodeCache = new Map<string, [number, number] | null>()

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (!address) return null
  const key = address.toLowerCase().trim()
  if (geocodeCache.has(key)) return geocodeCache.get(key)!
  try {
    await sleep(200)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Tripix/1.0 (trip planning app)' },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)]
        geocodeCache.set(key, coords)
        return coords
      }
    }
  } catch {
    // ignore network errors
  }
  geocodeCache.set(key, null)
  return null
}

// ── IATA → Airport name ──────────────────────────────────────────────────────
const AIRPORT_NAMES: Record<string, string> = {
  TLV: 'Ben Gurion International', ETH: 'Eilat Ramon Airport',
  BKK: 'Suvarnabhumi Airport', DMK: 'Don Mueang International', HKT: 'Phuket International',
  USM: 'Koh Samui Airport', CNX: 'Chiang Mai International', KBV: 'Krabi Airport',
  SIN: 'Changi Airport', DPS: 'Ngurah Rai International', KUL: 'KLIA',
  SGN: 'Tan Son Nhat International', HAN: 'Noi Bai International',
  CDG: 'Charles de Gaulle Airport', ORY: 'Paris Orly Airport',
  LHR: 'Heathrow Airport', LGW: 'Gatwick Airport', STN: 'Stansted Airport',
  AMS: 'Amsterdam Airport Schiphol', FCO: 'Leonardo da Vinci Airport',
  MAD: 'Adolfo Suárez Madrid–Barajas', BCN: 'Barcelona–El Prat Airport',
  BER: 'Berlin Brandenburg Airport', MUC: 'Munich Airport', FRA: 'Frankfurt Airport',
  ZRH: 'Zurich Airport', ATH: 'Athens International', JTR: 'Santorini Airport',
  LIS: 'Humberto Delgado Airport', PRG: 'Václav Havel Airport', BUD: 'Budapest Ferenc Liszt',
  VIE: 'Vienna International Airport', WAW: 'Warsaw Chopin Airport',
  DXB: 'Dubai International Airport', AUH: 'Abu Dhabi International',
  IST: 'Istanbul Airport', SAW: 'Sabiha Gökçen International',
  CAI: 'Cairo International Airport', SSH: 'Sharm el-Sheikh International',
  JFK: 'John F. Kennedy International', LAX: 'Los Angeles International',
  MIA: 'Miami International Airport', LAS: 'Harry Reid International',
  BOM: 'Chhatrapati Shivaji Maharaj', DEL: 'Indira Gandhi International',
  MLE: 'Velana International Airport', NRT: 'Narita International Airport',
  HND: 'Haneda Airport', ICN: 'Incheon International Airport',
  PEK: 'Beijing Capital International', PVG: 'Shanghai Pudong International',
  SYD: 'Sydney Kingsford Smith', MEL: 'Melbourne Airport',
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
  depAirport:  string
  arrAirport:  string
  depTime:     string
  arrTime:     string
  date:        string
  seqNum?:     number
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
  address:     string
  checkIn:     string
  checkOut:    string
  nights:      number
  seqNum?:     number
}

interface CarRentalMarker {
  id:              string
  pickupCoords:    [number, number] | null
  dropoffCoords:   [number, number] | null
  company:         string
  carType:         string
  pickupDate:      string
  dropoffDate:     string
  pickupLocation:  string
  dropoffLocation: string
  pickupSeqNum?:   number
  dropoffSeqNum?:  number
}

// ── Leaflet Map Component (dynamic — no SSR) ────────────────────────────────

const LeafletMap = dynamic(() => import('@/components/TripMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 text-primary animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
})

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ItineraryPage() {
  const router          = useRouter()
  const { currentTrip } = useTrip()
  const [flights,    setFlights]    = useState<FlightMarker[]>([])
  const [paths,      setPaths]      = useState<FlightPath[]>([])
  const [hotels,     setHotels]     = useState<HotelMarker[]>([])
  const [carRentals, setCarRentals] = useState<CarRentalMarker[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (currentTrip) loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrip])

  async function loadData() {
    if (!currentTrip) return
    setLoading(true)

    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('trip_id', currentTrip.id)
      .in('doc_type', ['flight', 'hotel', 'car_rental'])

    const flightMarkers:    FlightMarker[]    = []
    const flightPaths:      FlightPath[]      = []
    const hotelMarkers:     HotelMarker[]     = []
    const carRentalMarkers: CarRentalMarker[] = []

    const flightDocs    = (docs || []).filter(d => d.doc_type === 'flight')
    const hotelDocs     = (docs || []).filter(d => d.doc_type === 'hotel')
    const carRentalDocs = (docs || []).filter(d => d.doc_type === 'car_rental')

    // ── Flights ──────────────────────────────────────────────────────────
    const byDate: Record<string, TripDoc[]> = {}
    for (const doc of flightDocs) {
      const ext  = doc.extracted_data as Record<string, string> | null
      const date = ext?.departure_date || ext?.check_in || doc.valid_from || ''
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(doc)
    }

    for (const [date, dayFlights] of Object.entries(byDate)) {
      const isConnection = dayFlights.length > 1
      for (const doc of dayFlights) {
        const ext      = (doc.extracted_data || {}) as Record<string, string>
        const depCity  = ext.departure_city   || ext.departure || ''
        const arrCity  = ext.destination_city || ext.arrival  || ''
        const flightNo = doc.flight_number    || ext.flight_number || 'Flight'
        const airline  = ext.airline  || ''
        const depTime  = ext.departure_time   || ext.dep_time || ''
        const arrTime  = ext.arrival_time     || ext.arr_time || ''

        // Try IATA code fields first, then city name
        const depCode    = ext.departure_iata || ext.dep_iata || depCity
        const arrCode    = ext.arrival_iata   || ext.arr_iata || arrCity
        const depCoords  = getCoords(depCode) || getCoords(depCity)
        const arrCoords  = getCoords(arrCode) || getCoords(arrCity)
        const depAirport = AIRPORT_NAMES[depCode.toUpperCase()] || ext.departure_airport || ''
        const arrAirport = AIRPORT_NAMES[arrCode.toUpperCase()] || ext.arrival_airport   || ''

        if (depCoords) {
          flightMarkers.push({
            id: `${doc.id}-dep`, type: 'departure',
            coords: depCoords, flightNo, airline,
            depCity, arrCity, depAirport, arrAirport, depTime, arrTime, date, isConnection,
          })
        }
        if (arrCoords) {
          flightMarkers.push({
            id: `${doc.id}-arr`, type: 'arrival',
            coords: arrCoords, flightNo, airline,
            depCity, arrCity, depAirport, arrAirport, depTime, arrTime, date, isConnection,
          })
        }
        if (depCoords && arrCoords) {
          flightPaths.push({ id: doc.id, from: depCoords, to: arrCoords, flightNo, isConnection })
        }
      }
    }

    // ── Hotels (with Nominatim geocoding) ────────────────────────────────
    for (const doc of hotelDocs) {
      const ext       = (doc.extracted_data || {}) as Record<string, string>
      const city      = ext.destination_city || ext.hotel_city || ext.city || ''
      const hotelName = ext.hotel_name || doc.name || ''
      const street    = ext.address || ext.hotel_address || ext.street || ''

      let coords: [number, number] | null = null
      if (hotelName && city) coords = await geocodeAddress(`${hotelName}, ${city}`)
      if (!coords && city)   coords = await geocodeAddress(city)
      if (!coords)           coords = getCoords(city)
      if (!coords) continue

      const checkIn  = ext.check_in  || doc.valid_from  || ''
      const checkOut = ext.check_out || doc.valid_until || ''
      const nights   = (checkIn && checkOut)
        ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
        : 0

      // Build display address: street if available, else "hotelName, city"
      const address = street
        ? `${street}${city ? ', ' + city : ''}`
        : `${hotelName ? hotelName + ', ' : ''}${city}`

      hotelMarkers.push({ id: doc.id, coords, name: hotelName || city, address, checkIn, checkOut, nights })
    }

    // ── Car Rentals ───────────────────────────────────────────────────────
    for (const doc of carRentalDocs) {
      const ext             = (doc.extracted_data || {}) as Record<string, string>
      const pickupLocation  = ext.pickup_location  || ext.pickup_address  || ''
      const dropoffLocation = ext.dropoff_location || ext.dropoff_address || ''
      const company         = ext.company          || ext.rental_company  || ''
      const carType         = ext.car_type         || ext.vehicle_type    || ''
      const pickupDate      = ext.pickup_date      || doc.valid_from      || ''
      const dropoffDate     = ext.dropoff_date     || doc.valid_until     || ''

      let pickupCoords:  [number, number] | null = null
      let dropoffCoords: [number, number] | null = null

      if (pickupLocation) {
        pickupCoords = await geocodeAddress(pickupLocation)
        if (!pickupCoords) pickupCoords = getCoords(pickupLocation)
      }
      if (dropoffLocation && dropoffLocation !== pickupLocation) {
        dropoffCoords = await geocodeAddress(dropoffLocation)
        if (!dropoffCoords) dropoffCoords = getCoords(dropoffLocation)
      } else if (dropoffLocation === pickupLocation) {
        dropoffCoords = pickupCoords
      }

      if (pickupCoords || dropoffCoords) {
        carRentalMarkers.push({
          id: doc.id,
          pickupCoords, dropoffCoords,
          company, carType, pickupDate, dropoffDate,
          pickupLocation, dropoffLocation,
        })
      }
    }

    // ── Timeline sequence numbers ─────────────────────────────────────────
    interface TLEvent { date: string; type: 'flight' | 'hotel' | 'car_pickup' | 'car_dropoff'; index: number }
    const timeline: TLEvent[] = []

    flightMarkers.forEach((f, i) => { if (f.date) timeline.push({ date: f.date, type: 'flight', index: i }) })
    hotelMarkers.forEach((h, i)  => { if (h.checkIn) timeline.push({ date: h.checkIn, type: 'hotel', index: i }) })
    carRentalMarkers.forEach((c, i) => {
      if (c.pickupDate)  timeline.push({ date: c.pickupDate,  type: 'car_pickup',  index: i })
      if (c.dropoffDate && c.dropoffDate !== c.pickupDate)
        timeline.push({ date: c.dropoffDate, type: 'car_dropoff', index: i })
    })

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let seq = 1
    for (const ev of timeline) {
      if      (ev.type === 'flight')      flightMarkers[ev.index].seqNum         = seq++
      else if (ev.type === 'hotel')       hotelMarkers[ev.index].seqNum          = seq++
      else if (ev.type === 'car_pickup')  carRentalMarkers[ev.index].pickupSeqNum  = seq++
      else if (ev.type === 'car_dropoff') carRentalMarkers[ev.index].dropoffSeqNum = seq++
    }

    setFlights(flightMarkers)
    setPaths(flightPaths)
    setHotels(hotelMarkers)
    setCarRentals(carRentalMarkers)
    setLoading(false)
  }

  const hasData = flights.length > 0 || hotels.length > 0 || carRentals.length > 0

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="bg-gradient-to-bl from-[#185FA5] to-[#0D3B6E] text-white px-4 pt-safe pb-3 flex-shrink-0"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-bold">Trip Map</h1>
            {currentTrip && <p className="text-xs opacity-60">{currentTrip.name}</p>}
          </div>
          <div className="flex items-center gap-2 text-[10px] opacity-70">
            <span>✈️ Flight</span>
            <span>🏨 Hotel</span>
            <span>🚗 Car</span>
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
            carRentals={carRentals}
          />
        )}
      </div>
    </div>
  )
}
