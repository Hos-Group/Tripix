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
  destination: string       // e.g. "Barcelona" or "bangkok, thailand"
  start_date: string        // YYYY-MM-DD
  end_date: string          // YYYY-MM-DD
  travelerNames?: string[]  // ["Omer Halevy", "Noa Cohen"] — for name scoring
  tripType?: string         // 'business' | 'beach' | 'ski' | 'family' | 'solo' etc.
  cities?: string[]         // specific cities in the trip
}

/** Known city/country aliases for fuzzy matching */
const DESTINATION_ALIASES: Record<string, string[]> = {
  // Europe
  barcelona:      ['barcelona', 'ברצלונה', 'bcn'],
  madrid:         ['madrid', 'מדריד', 'mad'],
  paris:          ['paris', 'פריז', 'cdg', 'ory'],
  london:         ['london', 'לונדון', 'lhr', 'lgw', 'stn'],
  rome:           ['rome', 'roma', 'רומא', 'fco'],
  milan:          ['milan', 'milano', 'מילאנו', 'mxp', 'lin'],
  venice:         ['venice', 'venezia', 'ונציה', 'vce'],
  florence:       ['florence', 'firenze', 'פירנצה', 'flr'],
  naples:         ['naples', 'napoli', 'נאפולי', 'nap'],
  amsterdam:      ['amsterdam', 'אמסטרדם', 'ams', 'schiphol'],
  berlin:         ['berlin', 'ברלין', 'ber', 'txl'],
  munich:         ['munich', 'münchen', 'מינכן', 'muc'],
  frankfurt:      ['frankfurt', 'פרנקפורט', 'fra'],
  hamburg:        ['hamburg', 'המבורג', 'ham'],
  lisbon:         ['lisbon', 'lisboa', 'ליסבון', 'lis'],
  porto:          ['porto', 'פורטו', 'opo'],
  prague:         ['prague', 'praha', 'פראג', 'prg'],
  vienna:         ['vienna', 'wien', 'וינה', 'vie'],
  budapest:       ['budapest', 'בודפשט', 'bud'],
  warsaw:         ['warsaw', 'warszawa', 'ורשה', 'waw'],
  krakow:         ['krakow', 'kraków', 'קרקוב', 'krk'],
  athens:         ['athens', 'athina', 'אתונה', 'ath'],
  santorini:      ['santorini', 'thira', 'סנטוריני', 'jtr'],
  mykonos:        ['mykonos', 'מיקונוס', 'jmk'],
  crete:          ['crete', 'heraklion', 'כרתים', 'her'],
  rhodes:         ['rhodes', 'רודוס', 'rho'],
  corfu:          ['corfu', 'קורפו', 'cfu'],
  istanbul:       ['istanbul', 'איסטנבול', 'ist', 'saw'],
  antalya:        ['antalya', 'אנטליה', 'ayt'],
  bodrum:         ['bodrum', 'בודרום', 'bjv'],
  zurich:         ['zurich', 'zürich', 'זוריך', 'zrh'],
  geneva:         ['geneva', 'genève', 'ז\'נבה', 'gva'],
  brussels:       ['brussels', 'bruxelles', 'בריסל', 'bru'],
  copenhagen:     ['copenhagen', 'københavn', 'קופנהגן', 'cph'],
  stockholm:      ['stockholm', 'סטוקהולם', 'arn'],
  oslo:           ['oslo', 'אוסלו', 'osl'],
  helsinki:       ['helsinki', 'הלסינקי', 'hel'],
  dublin:         ['dublin', 'דבלין', 'dub'],
  edinburgh:      ['edinburgh', 'אדינבורו', 'edi'],
  manchester:     ['manchester', 'מנצ\'סטר', 'man'],
  zagreb:         ['zagreb', 'זאגרב', 'zag'],
  split:          ['split', 'ספליט', 'spu'],
  dubrovnik:      ['dubrovnik', 'דוברובניק', 'dbv'],
  bucharest:      ['bucharest', 'bucurești', 'בוקרשט', 'otp'],
  sofia:          ['sofia', 'סופיה', 'sof'],
  riga:           ['riga', 'ריגה', 'rix'],
  tallinn:        ['tallinn', 'טאלין', 'tll'],
  vilnius:        ['vilnius', 'וילנה', 'vno'],
  reykjavik:      ['reykjavik', 'רייקיאוויק', 'kef'],
  // Middle East & Africa
  dubai:          ['dubai', 'דובאי', 'dxb'],
  'abu dhabi':    ['abu dhabi', 'אבו דאבי', 'auh'],
  'tel aviv':     ['tel aviv', 'תל אביב', 'tlv', 'ben gurion'],
  jerusalem:      ['jerusalem', 'ירושלים'],
  eilat:          ['eilat', 'אילת', 'etm'],
  cairo:          ['cairo', 'קהיר', 'cai'],
  'sharm el sheikh': ['sharm', 'שארם', 'ssh'],
  hurghada:       ['hurghada', 'הורגדה', 'hrg'],
  'marrakech':    ['marrakech', 'marrakesh', 'מרקש', 'rak'],
  casablanca:     ['casablanca', 'קזבלנקה', 'cmn'],
  amman:          ['amman', 'עמאן', 'amm'],
  petra:          ['petra', 'פטרה'],
  nairobi:        ['nairobi', 'נאירובי', 'nbo'],
  // Asia
  bangkok:        ['bangkok', 'בנגקוק', 'bkk', 'krung thep', 'suvarnabhumi', 'dmk'],
  phuket:         ['phuket', 'פוקט', 'hkt'],
  'chiang mai':   ['chiang mai', 'צ\'יאנג מאי', 'chiangmai', 'cnx'],
  'koh samui':    ['koh samui', 'ko samui', 'samui', 'קו סמוי', 'usm'],
  krabi:          ['krabi', 'קראבי', 'kbv'],
  pattaya:        ['pattaya', 'פטאיה'],
  tokyo:          ['tokyo', 'טוקיו', 'nrt', 'hnd'],
  osaka:          ['osaka', 'אוסקה', 'kix', 'itm'],
  kyoto:          ['kyoto', 'קיוטו'],
  singapore:      ['singapore', 'סינגפור', 'sin', 'changi'],
  bali:           ['bali', 'באלי', 'dps', 'denpasar', 'ngurah rai'],
  jakarta:        ['jakarta', 'ג\'קרטה', 'cgk'],
  'kuala lumpur': ['kuala lumpur', 'kl', 'קואלה לומפור', 'kul'],
  'ho chi minh':  ['ho chi minh', 'saigon', 'סייגון', 'hcmc', 'sgn'],
  hanoi:          ['hanoi', 'האנוי', 'han'],
  'da nang':      ['da nang', 'דה נאנג', 'dad'],
  'siem reap':    ['siem reap', 'angkor', 'אנגקור', 'rep'],
  'phnom penh':   ['phnom penh', 'פנום פן', 'pnh'],
  mumbai:         ['mumbai', 'bombay', 'מומבאי', 'bom'],
  delhi:          ['delhi', 'new delhi', 'דלהי', 'del'],
  goa:            ['goa', 'גואה', 'goi'],
  maldives:       ['maldives', 'מלדיביים', 'mle', 'male', 'velana'],
  // Americas
  'new york':     ['new york', 'ניו יורק', 'nyc', 'jfk', 'lga', 'ewr'],
  miami:          ['miami', 'מיאמי', 'mia'],
  'los angeles':  ['los angeles', 'לוס אנג\'לס', 'la', 'lax'],
  'las vegas':    ['las vegas', 'לאס וגאס', 'las', 'mccarran', 'harry reid'],
  chicago:        ['chicago', 'שיקגו', 'ord', 'mdw'],
  'san francisco':['san francisco', 'sf', 'סן פרנסיסקו', 'sfo'],
  'san diego':    ['san diego', 'סן דייגו', 'san'],
  orlando:        ['orlando', 'אורלנדו', 'mco'],
  cancun:         ['cancun', 'cancún', 'קנקון', 'cun'],
  'mexico city':  ['mexico city', 'cdmx', 'מקסיקו סיטי', 'mex'],
  'playa del carmen': ['playa del carmen', 'פלאיה', 'playa'],
  havana:         ['havana', 'havana', 'הוואנה', 'hav'],
  'rio de janeiro': ['rio', 'ריו', 'gig', 'galeao'],
  'sao paulo':    ['sao paulo', 'são paulo', 'סאו פאולו', 'gru'],
  'buenos aires': ['buenos aires', 'בואנוס איירס', 'eze'],
  toronto:        ['toronto', 'טורונטו', 'yyz'],
  vancouver:      ['vancouver', 'ונקובר', 'yvr'],
  montreal:       ['montreal', 'מונטריאול', 'yul'],
  // Oceania
  sydney:         ['sydney', 'סידני', 'syd'],
  melbourne:      ['melbourne', 'מלבורן', 'mel'],
  brisbane:       ['brisbane', 'בריסביין', 'bne'],
  auckland:       ['auckland', 'אוקלנד', 'akl'],
  // Countries (for trips with country-level destination)
  thailand:       ['thailand', 'תאילנד', 'thai'],
  japan:          ['japan', 'יפן'],
  austria:        ['austria', 'אוסטריה', 'österreich'],
  france:         ['france', 'צרפת'],
  spain:          ['spain', 'ספרד'],
  italy:          ['italy', 'איטליה'],
  germany:        ['germany', 'גרמניה'],
  greece:         ['greece', 'יוון'],
  uk:             ['united kingdom', 'uk', 'england', 'great britain', 'בריטניה'],
  usa:            ['united states', 'usa', 'us', 'america', 'ארצות הברית'],
  australia:      ['australia', 'אוסטרליה'],
  indonesia:      ['indonesia', 'אינדונזיה'],
  vietnam:        ['vietnam', 'וייטנאם'],
  cambodia:       ['cambodia', 'קמבודיה'],
  india:          ['india', 'הודו'],
  turkey:         ['turkey', 'türkiye', 'טורקיה'],
  portugal:       ['portugal', 'פורטוגל'],
  netherlands:    ['netherlands', 'holland', 'הולנד'],
  switzerland:    ['switzerland', 'שוויץ'],
  israel:         ['israel', 'ישראל'],
  jordan:         ['jordan', 'ירדן'],
  egypt:          ['egypt', 'מצרים'],
  uae:            ['united arab emirates', 'uae', 'emirates', 'איחוד האמירויות'],
  mexico:         ['mexico', 'מקסיקו'],
  brazil:         ['brazil', 'ברזיל'],
  canada:         ['canada', 'קנדה'],
  czech:          ['czech', 'czechia', 'czech republic', 'צ\'כיה'],
  hungary:        ['hungary', 'הונגריה'],
  poland:         ['poland', 'פולין'],
  croatia:        ['croatia', 'קרואטיה'],
  romania:        ['romania', 'רומניה'],
  singapore_country: ['singapore', 'סינגפור'],
  maldives_country:  ['maldives', 'מלדיביים'],
}

/**
 * Map canonical city keys → their country canonical key.
 * Used for: trip destination = country, booking destination = city in that country.
 */
const CITY_TO_COUNTRY: Record<string, string> = {
  // Thailand
  'bangkok':     'thailand', 'phuket': 'thailand', 'koh samui': 'thailand',
  'chiang mai':  'thailand', 'krabi':  'thailand', 'pattaya':   'thailand',
  // Japan
  'tokyo': 'japan', 'osaka': 'japan', 'kyoto': 'japan',
  // Austria
  'vienna': 'austria',
  // France
  'paris': 'france',
  // Spain
  'barcelona': 'spain', 'madrid': 'spain',
  // Italy
  'rome': 'italy', 'milan': 'italy', 'venice': 'italy', 'florence': 'italy', 'naples': 'italy',
  // Germany
  'berlin': 'germany', 'munich': 'germany', 'frankfurt': 'germany', 'hamburg': 'germany',
  // Greece
  'athens': 'greece', 'santorini': 'greece', 'mykonos': 'greece', 'crete': 'greece',
    'rhodes': 'greece', 'corfu': 'greece',
  // Turkey
  'istanbul': 'turkey', 'antalya': 'turkey', 'bodrum': 'turkey',
  // UK
  'london': 'uk', 'edinburgh': 'uk', 'manchester': 'uk',
  // USA
  'new york': 'usa', 'miami': 'usa', 'los angeles': 'usa', 'las vegas': 'usa',
  'chicago': 'usa', 'san francisco': 'usa', 'san diego': 'usa', 'orlando': 'usa',
  // Australia
  'sydney': 'australia', 'melbourne': 'australia', 'brisbane': 'australia',
  // Indonesia
  'bali': 'indonesia', 'jakarta': 'indonesia',
  // Vietnam
  'ho chi minh': 'vietnam', 'hanoi': 'vietnam', 'da nang': 'vietnam',
  // Cambodia
  'siem reap': 'cambodia', 'phnom penh': 'cambodia',
  // India
  'mumbai': 'india', 'delhi': 'india', 'goa': 'india',
  // Portugal
  'lisbon': 'portugal', 'porto': 'portugal',
  // Netherlands
  'amsterdam': 'netherlands',
  // Switzerland
  'zurich': 'switzerland', 'geneva': 'switzerland',
  // Israel
  'tel aviv': 'israel', 'jerusalem': 'israel', 'eilat': 'israel',
  // Egypt
  'cairo': 'egypt', 'sharm el sheikh': 'egypt', 'hurghada': 'egypt',
  // UAE
  'dubai': 'uae', 'abu dhabi': 'uae',
  // Mexico
  'cancun': 'mexico', 'mexico city': 'mexico', 'playa del carmen': 'mexico',
  // Czech
  'prague': 'czech',
  // Hungary
  'budapest': 'hungary',
  // Poland
  'warsaw': 'poland', 'krakow': 'poland',
  // Croatia
  'dubrovnik': 'croatia', 'split': 'croatia', 'zagreb': 'croatia',
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

/** Map booking_type → trip_type keywords for cross-scoring */
const BOOKING_TYPE_TO_TRIP_TYPE: Record<string, string[]> = {
  hotel:      ['beach', 'city', 'ski', 'family', 'couple', 'friends', 'solo'],
  flight:     ['business', 'beach', 'city', 'ski', 'family', 'couple', 'friends', 'solo'],
  car_rental: ['road trip', 'desert', 'family', 'solo'],
  activity:   ['beach', 'city', 'trekking', 'ski', 'family'],
  insurance:  ['business', 'beach', 'city', 'ski', 'family', 'couple', 'friends', 'solo'],
  tour:       ['city', 'family', 'friends'],
}

export interface MatchResult {
  trip: TripRecord | null
  score: number   // 0-100
  reason: string  // why matched / why not
}

/**
 * Check if any traveler name appears in the booking's traveler_names list.
 *
 * Matching logic (tiered):
 *   1. Exact full name match (case-insensitive) → strongest signal
 *   2. Last name + first name both appear (may be in different order)
 *   3. Either last name OR full first name (≥ 4 chars) appears → partial match
 *
 * Returns: 'full' | 'partial' | false
 */
function matchesTravelerNames(
  bookingNames: string[],
  tripNames:    string[],
): 'full' | 'partial' | false {
  if (!bookingNames.length || !tripNames.length) return false

  const bookingText = bookingNames.join(' ').toLowerCase()

  for (const name of tripNames) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const parts = trimmed.toLowerCase().split(/\s+/).filter(p => p.length >= 2)
    if (parts.length === 0) continue

    // 1. Full name exact match
    if (bookingText.includes(trimmed.toLowerCase())) return 'full'

    // 2. If 2+ parts: both first AND last appear
    if (parts.length >= 2) {
      const firstName = parts[0]
      const lastName  = parts[parts.length - 1]
      if (
        firstName.length >= 2 && lastName.length >= 2 &&
        bookingText.includes(firstName) && bookingText.includes(lastName)
      ) return 'full'
    }

    // 3. Partial: last name (≥ 3 chars) OR first name (≥ 4 chars)
    const lastName  = parts[parts.length - 1]
    const firstName = parts[0]
    if (lastName.length >= 3 && bookingText.includes(lastName)) return 'partial'
    if (firstName.length >= 4 && bookingText.includes(firstName)) return 'partial'
  }

  return false
}

/**
 * Find the best matching trip for a parsed booking.
 * Scoring breakdown (max 100+):
 *   60  — exact destination match
 *   40  — partial destination match
 *   40  — date overlap with trip
 *   20  — date within 365-day pre-trip window (insurance, visa, advance booking)
 *   30  — traveler name appears in booking
 *   10  — trip type compatible with booking type
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

    // Also check specific cities if the trip has them
    const tripCities = (trip.cities || []).map(c => canonicalize(c))
    const anyCity    = tripCities.some(c =>
      c === bookingDest || c.includes(bookingDest) || bookingDest.includes(c)
    )

    // Country of the booking's city (e.g. "koh samui" → "thailand")
    const bookingCityCountry = CITY_TO_COUNTRY[bookingDest] || null
    // Country extracted from the booking (e.g. "Thailand" → "thailand")
    const bookingCountry     = canonicalize(booking.destination_country || '')

    // Exact city/destination match
    if (tripDest === bookingDest || anyCity) {
      score += 60
      reasons.push('יעד זהה')
    // Trip is a country, booking is a city in that country (e.g. trip="תאילנד", booking city="Koh Samui")
    } else if (
      bookingCityCountry && tripDest === bookingCityCountry
    ) {
      score += 60
      reasons.push('יעד זהה (עיר במדינת הטיול)')
    // Booking's country field matches trip country destination
    } else if (
      bookingCountry && bookingCountry.length > 2 && tripDest === bookingCountry
    ) {
      score += 60
      reasons.push('מדינה זהה')
    } else if (
      tripDest.includes(bookingDest) ||
      bookingDest.includes(tripDest) ||
      trip.destination.toLowerCase().includes(booking.destination_city?.toLowerCase() || '__') ||
      trip.destination.toLowerCase().includes(booking.destination_country?.toLowerCase() || '__')
    ) {
      score += 40
      reasons.push('יעד דומה')
    // Trip is a country, booking country matches (partial)
    } else if (
      bookingCityCountry && (tripDest.includes(bookingCityCountry) || bookingCityCountry.includes(tripDest))
    ) {
      score += 40
      reasons.push('יעד דומה (מדינה)')
    }

    // ── Date overlap ──────────────────────────────────────────────────────────
    if (datesOverlap(trip.start_date, trip.end_date, bookingStart, bookingEnd)) {
      score += 40
      reasons.push('תאריכים חופפים')
    } else if (bookingStart) {
      const tripStartMs   = new Date(trip.start_date).getTime()
      const tripEndMs     = new Date(trip.end_date).getTime()
      const bookingMs     = new Date(bookingStart).getTime()

      // Pre-trip window: visa, insurance, hotels booked up to 365 days before departure
      const windowStartMs = tripStartMs - 365 * 86400000
      const windowEndMs   = tripEndMs   +   7 * 86400000

      if (bookingMs >= windowStartMs && bookingMs <= windowEndMs) {
        score += 20
        reasons.push('הזמנה מראש')
      }
    }

    // ── Traveler name match (+30 full, +15 partial) ───────────────────────────
    if (trip.travelerNames?.length) {
      const nameMatch = matchesTravelerNames(booking.traveler_names || [], trip.travelerNames)
      if (nameMatch === 'full') {
        score += 30
        reasons.push('שם נוסע תואם מלא')
      } else if (nameMatch === 'partial') {
        score += 15
        reasons.push('שם נוסע תואם חלקי')
      }
    }

    // ── Trip type bonus (+10) ─────────────────────────────────────────────────
    if (trip.tripType) {
      const compatibleTypes = BOOKING_TYPE_TO_TRIP_TYPE[booking.booking_type] || []
      if (compatibleTypes.some(t => trip.tripType!.toLowerCase().includes(t))) {
        score += 10
        reasons.push('סוג נסיעה תואם')
      }
    }

    if (score > bestScore) {
      bestScore  = score
      bestTrip   = trip
      bestReason = reasons.join(' + ')
    }
  }

  // Minimum score threshold to consider a match
  if (trips.length === 1 && bestScore > 0) {
    // Only 1 trip exists — auto-assign if any signal found
    return { trip: bestTrip, score: bestScore, reason: bestReason || 'טיול יחיד — שיוך אוטומטי' }
  }
  if (bestScore < 20) {
    return {
      trip: null,
      score: bestScore,
      reason: `לא נמצא טיול מתאים (ציון ${bestScore}) — דורש שיוך ידני`,
    }
  }

  return { trip: bestTrip, score: bestScore, reason: bestReason }
}
