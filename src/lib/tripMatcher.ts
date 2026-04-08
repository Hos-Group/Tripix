/**
 * tripMatcher.ts
 * Matches a parsed booking email to an existing trip.
 * Algorithm:
 *   1. Normalize destination names (aliases + Hebrew)
 *   2. Check if booking dates overlap with trip dates
 *   3. Score each trip and return the best match (or null)
 */

import { ParsedBooking } from './emailParser'

export interface TripRecord {
  id: string
  name: string
  destination: string   // e.g. "Barcelona" or "bangkok, thailand"
  start_date: string    // YYYY-MM-DD
  end_date: string      // YYYY-MM-DD
}

/** Known city/country aliases for fuzzy matching */
const DESTINATION_ALIASES: Record<string, string[]> = {
  barcelona:  ['barcelona', 'ברצלונה', 'bcn'],
  madrid:     ['madrid', 'מדריד'],
  paris:      ['paris', 'פריז', 'cdg'],
  london:     ['london', 'לונדון', 'lhr', 'lgw'],
  rome:       ['rome', 'roma', 'רומא'],
  milan:      ['milan', 'milano', 'מילאנו'],
  amsterdam:  ['amsterdam', 'אמסטרדם', 'ams'],
  berlin:     ['berlin', 'ברלין'],
  lisbon:     ['lisbon', 'lisboa', 'ליסבון'],
  prague:     ['prague', 'praha', 'פראג'],
  vienna:     ['vienna', 'wien', 'וינה'],
  budapest:   ['budapest', 'בודפשט'],
  athens:     ['athens', 'athen', 'אתונה'],
  istanbul:   ['istanbul', 'איסטנבול', 'ist'],
  bangkok:    ['bangkok', 'בנגקוק', 'bkk', 'krung thep'],
  phuket:     ['phuket', 'פוקט'],
  'chiang mai': ['chiang mai', 'צ\'יאנג מאי', 'chiangmai'],
  dubai:      ['dubai', 'דובאי', 'dxb'],
  'abu dhabi':['abu dhabi', 'אבו דאבי', 'auh'],
  'new york': ['new york', 'ניו יורק', 'nyc', 'jfk', 'lga'],
  miami:      ['miami', 'מיאמי', 'mia'],
  'los angeles': ['los angeles', 'לוס אנג\'לס', 'la', 'lax'],
  tokyo:      ['tokyo', 'טוקיו', 'nrt', 'hnd'],
  bali:       ['bali', 'באלי', 'dps', 'denpasar'],
  'tel aviv': ['tel aviv', 'תל אביב', 'tlv'],
}

/** Find canonical key for a destination string */
function canonicalize(dest: string): string {
  const d = dest.toLowerCase().trim()
  for (const [canonical, aliases] of Object.entries(DESTINATION_ALIASES)) {
    if (aliases.some(a => d.includes(a) || a.includes(d))) {
      return canonical
    }
  }
  return d
}

/** Check if two date ranges overlap */
function datesOverlap(
  tripStart: string, tripEnd: string,
  bookingStart: string | undefined, bookingEnd: string | undefined,
): boolean {
  if (!bookingStart) return false
  const ts = new Date(tripStart).getTime()
  const te = new Date(tripEnd).getTime()
  const bs = new Date(bookingStart).getTime()
  const be = bookingEnd ? new Date(bookingEnd).getTime() : bs

  // Overlap: trip ends after booking starts AND trip starts before booking ends
  return te >= bs && ts <= be
}

export interface MatchResult {
  trip: TripRecord | null
  score: number   // 0-100
  reason: string  // why matched / why not
}

/**
 * Find the best matching trip for a parsed booking.
 */
export function matchTripToBooking(
  booking: ParsedBooking,
  trips: TripRecord[],
): MatchResult {
  if (!trips.length) {
    return { trip: null, score: 0, reason: 'אין טיולים קיימים' }
  }

  const bookingDest = canonicalize(
    [booking.destination_city, booking.destination_country].filter(Boolean).join(' ')
  )

  // Determine booking dates
  const bookingStart = booking.check_in || booking.departure_date
  const bookingEnd   = booking.check_out || booking.return_date

  let bestTrip: TripRecord | null = null
  let bestScore = 0
  let bestReason = ''

  for (const trip of trips) {
    let score = 0
    const reasons: string[] = []

    // ── Destination match ──────────────────────────────────────────────────────
    const tripDest = canonicalize(trip.destination)
    if (tripDest === bookingDest) {
      score += 60
      reasons.push('יעד זהה')
    } else if (
      tripDest.includes(bookingDest) ||
      bookingDest.includes(tripDest) ||
      trip.destination.toLowerCase().includes(booking.destination_city?.toLowerCase() || '__') ||
      trip.destination.toLowerCase().includes(booking.destination_country?.toLowerCase() || '__')
    ) {
      score += 40
      reasons.push('יעד דומה')
    }

    // ── Date overlap ──────────────────────────────────────────────────────────
    if (datesOverlap(trip.start_date, trip.end_date, bookingStart, bookingEnd)) {
      score += 40
      reasons.push('תאריכים חופפים')
    } else if (bookingStart) {
      // Booking date is close to trip (within 3 days)
      const tripStartMs = new Date(trip.start_date).getTime()
      const bookingMs   = new Date(bookingStart).getTime()
      const diffDays    = Math.abs(tripStartMs - bookingMs) / 86400000
      if (diffDays <= 3) {
        score += 20
        reasons.push('תאריכים קרובים')
      }
    }

    if (score > bestScore) {
      bestScore  = score
      bestTrip   = trip
      bestReason = reasons.join(' + ')
    }
  }

  // Minimum score threshold to consider a match
  if (bestScore < 40) {
    return {
      trip: null,
      score: bestScore,
      reason: `לא נמצא טיול מתאים (ציון ${bestScore}) — דורש שיוך ידני`,
    }
  }

  return { trip: bestTrip, score: bestScore, reason: bestReason }
}
