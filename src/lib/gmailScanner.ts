/**
 * gmailScanner.ts
 * Core Gmail scanning logic extracted from the /api/gmail/scan route.
 * Called by both the manual scan API route and the daily auto-scan cron route.
 *
 * Supports multiple Gmail accounts per user — all connected accounts are
 * scanned and results are aggregated.
 *
 * Flow (per account):
 *   1. Load ALL gmail_connections for the user
 *   2. For each account: refresh access token if expired / near expiry
 *   3. Search last 30 days for booking confirmation emails
 *   4. For each email:
 *      a. Fetch body text
 *      b. Check for PDF attachments
 *      c. Parse with Claude (PDF-preferred, body as fallback/merge)
 *      d. Match to user's trips
 *      e. Auto-create expense if confidence >= 0.7
 *   5. Return aggregated stats across all accounts
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  refreshAccessToken,
  searchBookingEmails,
  getEmailBody,
  getEmailAttachments,
  downloadAttachment,
} from './gmailClient'
import { parseBookingEmail, htmlToText, ParsedBooking } from './emailParser'
import { matchTripToBooking, TripRecord } from './tripMatcher'

// ─────────────────────────────────────────────────────────────────────────────
// Trip relevance filter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map of country keys → all known city/region/airport-code aliases.
 * Used to check if a parsed booking matches the trip destination.
 */
const COUNTRY_CITY_MAP: Record<string, string[]> = {
  thailand:      ['thailand', 'thai', 'bangkok', 'bkk', 'phuket', 'hkt', 'koh samui',
                  'ko samui', 'samui', 'koh phangan', 'ko phangan', 'phangan', 'krabi',
                  'chiang mai', 'chiangmai', 'pattaya', 'hua hin', 'ayutthaya', 'sukhothai'],
  israel:        ['israel', 'tel aviv', 'tlv', 'jerusalem', 'haifa', 'eilat', 'ben gurion',
                  'ישראל', 'תל אביב', 'ירושלים', 'חיפה', 'אילת'],
  spain:         ['spain', 'barcelona', 'bcn', 'madrid', 'mad', 'seville', 'svq',
                  'valencia', 'vlc', 'malaga', 'agp', 'ibiza', 'ibz', 'majorca', 'mallorca', 'pmi'],
  france:        ['france', 'paris', 'cdg', 'ory', 'nice', 'nce', 'lyon', 'lys', 'marseille', 'mrs'],
  italy:         ['italy', 'rome', 'fco', 'milan', 'mxp', 'lin', 'venice', 'vce', 'florence', 'flr',
                  'naples', 'nap', 'sicily', 'sardinia'],
  japan:         ['japan', 'tokyo', 'nrt', 'hnd', 'osaka', 'kix', 'itm', 'kyoto', 'hiroshima', 'hiroshima'],
  usa:           ['usa', 'united states', 'america', 'new york', 'jfk', 'lga', 'ewr',
                  'los angeles', 'lax', 'miami', 'mia', 'chicago', 'ord', 'miami', 'las vegas', 'mccarran'],
  uk:            ['uk', 'united kingdom', 'england', 'london', 'lhr', 'lgw', 'stn', 'luton',
                  'manchester', 'man', 'edinburgh', 'edi'],
  germany:       ['germany', 'berlin', 'txl', 'ber', 'munich', 'muc', 'frankfurt', 'fra', 'hamburg', 'ham'],
  netherlands:   ['netherlands', 'holland', 'amsterdam', 'ams', 'schiphol'],
  greece:        ['greece', 'athens', 'ath', 'santorini', 'jtr', 'mykonos', 'jmk',
                  'thessaloniki', 'skg', 'crete', 'her', 'rhodes', 'rho', 'corfu', 'cfu'],
  portugal:      ['portugal', 'lisbon', 'lis', 'porto', 'opo', 'faro', 'fao', 'algarve'],
  uae:           ['uae', 'dubai', 'dxb', 'abu dhabi', 'auh', 'sharjah', 'shj'],
  turkey:        ['turkey', 'istanbul', 'ist', 'saw', 'antalya', 'ayt', 'ankara', 'esb', 'bodrum', 'bjv'],
  czechia:       ['czech', 'prague', 'prg', 'brno', 'czechia', 'czech republic'],
  hungary:       ['hungary', 'budapest', 'bud'],
  austria:       ['austria', 'vienna', 'vie', 'salzburg', 'szg'],
  switzerland:   ['switzerland', 'zurich', 'zrh', 'geneva', 'gva', 'basel', 'bsl'],
  poland:        ['poland', 'warsaw', 'waw', 'krakow', 'krk'],
  croatia:       ['croatia', 'zagreb', 'zag', 'split', 'spu', 'dubrovnik', 'dbv'],
  morocco:       ['morocco', 'marrakech', 'rak', 'casablanca', 'cmn', 'fez', 'fes', 'agadir', 'aga'],
  egypt:         ['egypt', 'cairo', 'cai', 'sharm', 'ssh', 'hurghada', 'hrg', 'luxor', 'lxr'],
  jordan:        ['jordan', 'amman', 'amm', 'petra', 'aqaba', 'aqj'],
  india:         ['india', 'mumbai', 'bom', 'delhi', 'del', 'goa', 'goi', 'bangalore', 'blr'],
  singapore:     ['singapore', 'sin', 'changi'],
  indonesia:     ['indonesia', 'bali', 'dps', 'jakarta', 'cgk', 'lombok', 'amm'],
  vietnam:       ['vietnam', 'hanoi', 'han', 'ho chi minh', 'sgn', 'da nang', 'dad', 'hoi an'],
  cambodia:      ['cambodia', 'phnom penh', 'pnh', 'siem reap', 'rep', 'angkor'],
  maldives:      ['maldives', 'male', 'mle'],
  mexico:        ['mexico', 'cancun', 'cun', 'mexico city', 'mex', 'los cabos', 'sjd', 'playa del carmen'],
  brazil:        ['brazil', 'rio', 'gig', 'sao paulo', 'gru', 'salvador', 'ssa'],
}

// ── Hebrew first-name → Latin hints (for traveler matching + Gmail query) ────
const HE_FIRST_NAME_HINTS: Record<string, string[]> = {
  'אומר': ['omer', 'omar'],
  'נועה': ['noa', 'noga'],
  'שרה': ['sara', 'sarah'],
  'יוסף': ['yosef', 'joseph'],
  'דוד': ['david', 'dave'],
  'יעל': ['yael'],
  'איתי': ['itai', 'itay'],
  'רון': ['ron'],
  'תמר': ['tamar'],
  'גל': ['gal'],
  'יונתן': ['yonatan', 'jonathan'],
  'נועם': ['noam'],
  'מיכל': ['michal'],
  'ליאור': ['lior'],
  'שירה': ['shira'],
  'עמית': ['amit'],
  'אביב': ['aviv'],
  'טל': ['tal'],
  'עדי': ['adi'],
  'לי': ['lee', 'li'],
  'ניר': ['nir'],
  'גלי': ['gali'],
  'הלל': ['hillel'],
  'אורן': ['oren'],
  'רות': ['ruth'],
  'אסף': ['assaf', 'asaf'],
  'בן': ['ben'],
  'ויקטוריה': ['victoria', 'vicky'],
  'מאיה': ['maya', 'maia'],
}

/** Map Hebrew destination words → English country key */
const HE_TO_COUNTRY: Record<string, string> = {
  'תאילנד': 'thailand', 'פוקט': 'thailand', 'בנגקוק': 'thailand',
  'קוסמוי': 'thailand', 'קוסאמוי': 'thailand',
  'ישראל': 'israel', 'ספרד': 'spain', 'ברצלונה': 'spain',
  'צרפת': 'france', 'פריז': 'france',
  'איטליה': 'italy', 'רומא': 'italy',
  'יפן': 'japan', 'טוקיו': 'japan',
  'ארצות הברית': 'usa', 'ניו יורק': 'usa', 'אמריקה': 'usa',
  'בריטניה': 'uk', 'לונדון': 'uk', 'אנגליה': 'uk',
  'גרמניה': 'germany', 'הולנד': 'netherlands', 'אמסטרדם': 'netherlands',
  'יוון': 'greece', 'פורטוגל': 'portugal',
  'דובאי': 'uae', 'איחוד האמירויות': 'uae',
  'טורקיה': 'turkey', 'איסטנבול': 'turkey',
  'צ\'כיה': 'czechia', 'פראג': 'czechia',
  'הונגריה': 'hungary', 'בודפשט': 'hungary',
  'אוסטריה': 'austria', 'וינה': 'austria',
  'שווייץ': 'switzerland', 'זוריך': 'switzerland',
  'פולין': 'poland', 'קרקוב': 'poland',
  'קרואטיה': 'croatia', 'דוברובניק': 'croatia',
  'מרוקו': 'morocco', 'מרקש': 'morocco',
  'מצרים': 'egypt', 'שארם': 'egypt', 'הורגדה': 'egypt',
  'ירדן': 'jordan', 'פטרה': 'jordan',
  'הודו': 'india', 'גואה': 'india',
  'סינגפור': 'singapore',
  'אינדונזיה': 'indonesia', 'באלי': 'indonesia',
  'וייטנאם': 'vietnam',
  'קמבודיה': 'cambodia',
  'מלדיביים': 'maldives',
  'מקסיקו': 'mexico', 'קנקון': 'mexico',
  'ברזיל': 'brazil',
}

/** Resolve trip destination string → internal country key */
function resolveTripCountry(destination: string): string | null {
  // Check Hebrew words first
  for (const [heb, key] of Object.entries(HE_TO_COUNTRY)) {
    if (destination.includes(heb)) return key
  }
  const lower = destination.toLowerCase()
  for (const key of Object.keys(COUNTRY_CITY_MAP)) {
    if (lower.includes(key)) return key
    // Check city aliases too
    if (COUNTRY_CITY_MAP[key].some(alias => lower.includes(alias))) return key
  }
  return null
}

/**
 * Soft traveler name check — logs only, never hard-rejects.
 * Trip travelers are Hebrew; booking emails use Latin names.
 * We use a hint table for common name mappings.
 */
function checkTravelerSoftMatch(
  parsedNames:   string[],
  tripTravelers: Array<{ id: string; name: string }>,
): 'match' | 'no_names' | 'mismatch' {
  if (!parsedNames.length || !tripTravelers.length) return 'no_names'
  const parsedLower = parsedNames.join(' ').toLowerCase()
  for (const t of tripTravelers) {
    const hints = HE_FIRST_NAME_HINTS[t.name] || []
    if (hints.some(h => parsedLower.includes(h))) return 'match'
    // Also try the Hebrew name itself (in case email is in Hebrew)
    if (parsedLower.includes(t.name)) return 'match'
  }
  const anyHintsAvailable = tripTravelers.some(t => HE_FIRST_NAME_HINTS[t.name])
  return anyHintsAvailable ? 'mismatch' : 'no_names'
}

/**
 * Build a Gmail search boost string from trip destination + traveler names.
 * Additive only — emails are never excluded if they don't match.
 */
function buildTripGmailQuery(
  trip:     Pick<TripRow, 'destination'>,
  travelers: Array<{ id: string; name: string }>,
): string {
  const terms: string[] = []
  // Destination aliases (no-space terms, max 5)
  const countryKey = resolveTripCountry(trip.destination)
  if (countryKey) {
    const aliases = COUNTRY_CITY_MAP[countryKey]
      .filter(a => a.length >= 3 && !/\s/.test(a))
      .slice(0, 5)
    terms.push(...aliases)
  }
  // Traveler name hints (max 2 travelers × 1 hint each)
  for (const t of travelers.slice(0, 3)) {
    const hint = (HE_FIRST_NAME_HINTS[t.name] || [])[0]
    if (hint) terms.push(hint)
  }
  return Array.from(new Set(terms)).join(' OR ')
}

/**
 * Extract candidate booking/confirmation URLs from email HTML.
 * Returns up to 3 unique https URLs whose href or anchor text looks like a booking link.
 */
function extractBookingUrls(html: string): string[] {
  const BOOKING_RE = /booking|ticket|confirmation|voucher|itinerary|manage|reservation|e-ticket|eticket/i
  const LINK_RE    = /<a\s[^>]*href=["'](https?:[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  const seen = new Set<string>()
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = LINK_RE.exec(html)) !== null && results.length < 3) {
    const href   = m[1].trim()
    const anchor = m[2].replace(/<[^>]+>/g, '').trim()
    if (seen.has(href)) continue
    if (href.length > 500) continue
    // Exclude tracking / unsubscribe / image links
    if (/unsubscribe|optout|pixel|tracking|click\.|email\.|track\./i.test(href)) continue
    if (BOOKING_RE.test(href) || BOOKING_RE.test(anchor)) {
      seen.add(href)
      results.push(href)
    }
  }
  return results
}

/**
 * Try to fetch a booking page URL and return its HTML body.
 * Returns null on timeout, error, or non-HTML response.
 */
async function fetchBookingPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer      = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal:   controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Tripix/1.0)',
        'Accept':     'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html')) return null
    return await res.text()
  } catch {
    return null
  }
}

/**
 * Check if a Claude-parsed booking is relevant to the given trip.
 * Returns 'ok' | 'wrong_dest' | 'wrong_date'
 */
function checkRelevance(booking: ParsedBooking, trip: TripRow): 'ok' | 'wrong_dest' | 'wrong_date' {
  const tripCountry = resolveTripCountry(trip.destination)

  if (tripCountry) {
    const aliases = COUNTRY_CITY_MAP[tripCountry]
    const city    = (booking.destination_city    || '').toLowerCase().trim()
    const country = (booking.destination_country || '').toLowerCase().trim()

    if (city.length >= 3 || country.length >= 3) {
      // At least one of city/country was extracted — must match trip destination
      const matchesAlias = (text: string) =>
        text.length >= 3 &&
        aliases.some(a => a.length >= 3 && (text.includes(a) || a.includes(text)))

      const destMatch = matchesAlias(city) || matchesAlias(country)

      if (!destMatch) {
        console.log(
          `[gmailScanner/trip] ✗ dest mismatch: "${booking.vendor}" ` +
          `city="${city}" country="${country}" ≠ trip="${trip.destination}"`,
        )
        return 'wrong_dest'
      }
    } else {
      // No destination extracted by AI — only accept if confidence is very high (≥ 0.8)
      // This prevents random high-confidence emails (newsletters, promos) from slipping through
      if (booking.confidence < 0.8) {
        console.log(
          `[gmailScanner/trip] ✗ no destination + conf ${booking.confidence} < 0.8: "${booking.vendor}"`,
        )
        return 'wrong_dest'
      }
    }
  }

  // ── Date window: 180 days before trip start → 7 days after trip end ───────
  const tripStart   = new Date(trip.start_date)
  const tripEnd     = new Date(trip.end_date)
  const windowStart = new Date(tripStart)
  windowStart.setDate(windowStart.getDate() - 180)
  const windowEnd   = new Date(tripEnd)
  windowEnd.setDate(windowEnd.getDate() + 7)

  const bookingDateStr = booking.check_in || booking.departure_date
  if (bookingDateStr) {
    const bd = new Date(bookingDateStr)
    if (bd < windowStart || bd > windowEnd) {
      console.log(
        `[gmailScanner/trip] ✗ date mismatch: "${booking.vendor}" ` +
        `"${bookingDateStr}" outside [${windowStart.toISOString().slice(0, 10)}, ` +
        `${windowEnd.toISOString().slice(0, 10)}]`,
      )
      return 'wrong_date'
    }
  }

  return 'ok'
}

export interface ScanStats {
  scanned:          number
  parsed:           number
  created:          number
  scannedWithPDF:   number
  scannedEmailOnly: number
}

export interface CreatedDoc {
  id:       string
  name:     string
  doc_type: string
}

export interface TripScanStats extends ScanStats {
  tripId:       string
  tripName:     string
  destination:  string
  daysSearched: number
  createdDocs:  CreatedDoc[]   // list of every document actually saved
  // Detailed breakdown — shown to user so they understand what happened
  filteredLowConf:   number   // dropped: AI confidence < 0.4
  filteredWrongDest: number   // dropped: destination didn't match trip
  filteredWrongDate: number   // dropped: dates outside trip window
  filteredDuplicate: number   // dropped: same booking_ref already in DB
  failedDB:          number   // tried to save but DB insert failed
  lastDbError?:      string   // last DB error message for debugging
}

interface GmailConnection {
  id:            string
  user_id:       string
  gmail_address: string
  access_token:  string
  refresh_token: string | null
  token_expiry:  string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper: get a valid access token for one connection
// ─────────────────────────────────────────────────────────────────────────────
async function getValidToken(
  supabase: SupabaseClient,
  conn: GmailConnection,
): Promise<string> {
  let accessToken = conn.access_token
  if (conn.token_expiry) {
    const isExpired = Date.now() >= new Date(conn.token_expiry).getTime() - 5 * 60 * 1000
    if (isExpired) {
      if (!conn.refresh_token) throw new Error(`חיבור ${conn.gmail_address} פג תוקף`)
      accessToken = await refreshAccessToken(conn.refresh_token)
      await supabase
        .from('gmail_connections')
        .update({
          access_token: accessToken,
          token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq('id', conn.id)
    }
  }
  return accessToken
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper: process one batch of messages for a user
// ─────────────────────────────────────────────────────────────────────────────
async function processMessages(
  supabase:    SupabaseClient,
  userId:      string,
  accessToken: string,
  messages:    Awaited<ReturnType<typeof searchBookingEmails>>,
  trips:       TripRecord[],
  stats:       ScanStats,
  source:      string,
  forceTripId: string | null = null,
): Promise<void> {
  for (const msg of messages) {
    try {
      let body = ''
      try { body = await getEmailBody(accessToken, msg.id) } catch { continue }
      const emailContent = body || msg.snippet

      let pdfBase64: string | undefined
      try {
        const attachments = await getEmailAttachments(accessToken, msg.id)
        if (attachments.length > 0) {
          const pdf = attachments.sort((a, b) => b.size - a.size)[0]
          pdfBase64 = await downloadAttachment(accessToken, msg.id, pdf.attachmentId)
          stats.scannedWithPDF++
        } else { stats.scannedEmailOnly++ }
      } catch { stats.scannedEmailOnly++ }

      const parsedBooking = await parseBookingEmail(emailContent, msg.subject, pdfBase64)
      if (!parsedBooking) continue
      stats.parsed++
      if (parsedBooking.confidence < 0.7) continue

      let matchedTripId = forceTripId
      let matchScore    = forceTripId ? 100 : 0
      let matchReason   = forceTripId ? 'ייבוא ידני לטיול' : 'לא נותח'

      if (!forceTripId && trips.length) {
        const result = matchTripToBooking(parsedBooking, trips)
        matchedTripId = result.trip?.id || null
        matchScore    = result.score
        matchReason   = result.reason
      }

      const rawText = htmlToText(emailContent).slice(0, 10000)
      const { data: ingestRecord } = await supabase
        .from('email_ingests')
        .insert({
          user_id:      userId,
          from_address: msg.from,
          subject:      msg.subject,
          raw_html:     null,
          raw_text:     rawText,
          parsed_data:  parsedBooking,
          trip_id:      matchedTripId,
          match_score:  matchScore,
          match_reason: matchReason,
          status:       matchedTripId ? 'matched' : 'unmatched',
          source,
        })
        .select('id')
        .single()

      if (matchedTripId && ingestRecord) {
        const categoryMap: Record<string, string> = {
          hotel: 'hotel', flight: 'flight', car_rental: 'taxi',
          activity: 'activity', tour: 'activity', insurance: 'other', other: 'other',
        }
        const expenseTitle =
          parsedBooking.hotel_name ||
          (parsedBooking.airline && parsedBooking.flight_number
            ? `${parsedBooking.airline} ${parsedBooking.flight_number}`
            : null) ||
          parsedBooking.summary || parsedBooking.vendor || msg.subject.slice(0, 60)

        const { data: expense, error: expenseError } = await supabase
          .from('expenses')
          .insert({
            trip_id:      matchedTripId,
            title:        expenseTitle,
            amount:       parsedBooking.amount || 0,
            currency:     parsedBooking.currency || 'ILS',
            amount_ils:   parsedBooking.amount || 0,
            category:     categoryMap[parsedBooking.booking_type] || 'other',
            expense_date:
              parsedBooking.check_in ||
              parsedBooking.departure_date ||
              new Date().toISOString().split('T')[0],
            notes:   `מספר אישור: ${parsedBooking.confirmation_number}\nיובא אוטומטית מ-Gmail: ${msg.from}`,
            source,
            is_paid: true,
          })
          .select('id')
          .single()

        if (expenseError) {
          console.error('[gmailScanner] Expense insert error:', expenseError)
        }

        if (expense) {
          await supabase.from('email_ingests')
            .update({ expense_id: expense.id, status: 'processed' })
            .eq('id', ingestRecord.id)
          stats.created++
        }
      }
    } catch (err) {
      console.error(`[gmailScanner] Error processing message ${msg.id}:`, err)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan ALL connected Gmail accounts for a user for booking emails,
 * auto-create expenses, and return aggregated stats.
 *
 * @param supabase  Supabase admin client (service-role)
 * @param userId    UUID of the user whose Gmail(s) to scan
 * @throws          if no Gmail is connected at all
 */
export async function scanUserGmail(
  supabase: SupabaseClient,
  userId:   string,
): Promise<ScanStats> {
  // ── 1. Load ALL Gmail connections for this user ───────────────────────────
  const { data: connections, error: connError } = await supabase
    .from('gmail_connections')
    .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)

  if (connError || !connections?.length) {
    throw new Error('לא נמצא חיבור Gmail — יש להתחבר תחילה')
  }

  // ── 2. Fetch user's trips for matching ────────────────────────────────────
  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })

  const tripList = (trips || []) as TripRecord[]

  const stats: ScanStats = {
    scanned: 0, parsed: 0, created: 0, scannedWithPDF: 0, scannedEmailOnly: 0,
  }

  // ── 3. Scan each connected Gmail account ─────────────────────────────────
  for (const conn of connections as GmailConnection[]) {
    try {
      const accessToken = await getValidToken(supabase, conn)
      const messages = await searchBookingEmails(accessToken, 30)
      stats.scanned += messages.length
      console.log(`[gmailScanner] ${conn.gmail_address}: ${messages.length} messages found`)
      await processMessages(supabase, userId, accessToken, messages, tripList, stats, 'gmail_scan')
    } catch (err) {
      console.error(`[gmailScanner] Error scanning ${conn.gmail_address}:`, err)
    }
  }

  return stats
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip-specific retroactive scan
// ─────────────────────────────────────────────────────────────────────────────

interface TripRow {
  id:          string
  name:        string
  destination: string
  start_date:  string
  end_date:    string
  travelers:   Array<{ id: string; name: string }>
}

/**
 * Scan ALL connected Gmail accounts for emails related to a given trip.
 * Searches up to 1 year back so early bookings made before the user
 * registered are captured.
 *
 * All found emails are force-matched to the specified trip, since the user
 * explicitly requested the import for this trip.
 *
 * @param supabase  Supabase admin client
 * @param userId    UUID of the user
 * @param tripId    UUID of the trip to import bookings into
 */
export async function scanTripGmail(
  supabase: SupabaseClient,
  userId:   string,
  tripId:   string,
): Promise<TripScanStats> {
  // ── 1. Load trip ──────────────────────────────────────────────────────────
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, travelers')
    .eq('id', tripId)
    .eq('user_id', userId)
    .single()

  if (tripError || !trip) throw new Error('טיול לא נמצא')
  const t = { ...trip, travelers: (trip.travelers as Array<{ id: string; name: string }>) || [] } as TripRow

  // ── 2. Load ALL Gmail connections ────────────────────────────────────────
  const { data: connections, error: connError } = await supabase
    .from('gmail_connections')
    .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)

  if (connError || !connections?.length) {
    throw new Error('לא נמצא חיבור Gmail — יש לחבר Gmail תחילה')
  }

  // ── 3. Search always 365 days back — bookings are made months in advance ──
  const daysSearched = 365

  // ── 4. Build a Gmail boost query from destination + traveler name hints ───
  // This is ADDITIVE — emails that don't match are not excluded.
  // searchBookingEmails wraps it as "(destQuery OR has:attachment)" so even
  // emails without these keywords are found if they have an attachment.
  const destQuery = buildTripGmailQuery(t, t.travelers)
  console.log(`[gmailScanner/trip] Gmail boost query: "${destQuery}"`)


  const stats: TripScanStats = {
    tripId: t.id, tripName: t.name, destination: t.destination, daysSearched,
    scanned: 0, parsed: 0, created: 0, scannedWithPDF: 0, scannedEmailOnly: 0,
    createdDocs: [],
    filteredLowConf: 0, filteredWrongDest: 0, filteredWrongDate: 0,
    filteredDuplicate: 0, failedDB: 0,
  }

  const categoryMap: Record<string, string> = {
    hotel: 'hotel', flight: 'flight', car_rental: 'taxi', taxi: 'taxi',
    activity: 'activity', tour: 'activity', insurance: 'other', other: 'other',
  }

  const docTypeMap: Record<string, string> = {
    hotel: 'hotel', flight: 'flight', car_rental: 'other', taxi: 'other',
    activity: 'activity', tour: 'activity', insurance: 'insurance', other: 'other',
  }

  // ── 5. Scan each connected Gmail account ─────────────────────────────────
  for (const conn of connections as GmailConnection[]) {
    try {
      const accessToken = await getValidToken(supabase, conn)
      // Fetch up to 20 emails — parallel processing keeps total time ~equal to 1 email
      const messages = await searchBookingEmails(accessToken, daysSearched, 20, destQuery)
      stats.scanned += messages.length
      console.log(`[gmailScanner/trip] ${conn.gmail_address}: ${messages.length} messages for "${t.name}"`)

      // ── PASS 1: Fetch bodies + parse with Claude (text-only, no PDFs yet) ──
      // Fast (~5-10s for 20 emails in parallel). PDFs downloaded only for relevant ones.
      type Pass1Item = { msg: typeof messages[0]; parsedBooking: ParsedBooking; emailContent: string; rawHtml: string }
      const pass1Results = await Promise.allSettled(
        messages.map(async (msg) => {
          let body = ''
          try { body = await getEmailBody(accessToken, msg.id) } catch { return { skip: 'fetch_error' as const } }
          const emailContent = body || msg.snippet

          // Text-only parse — fast, no PDF yet
          const parsedBooking = await parseBookingEmail(emailContent, msg.subject)
          if (!parsedBooking || parsedBooking.confidence < 0.4) {
            return { skip: 'low_conf' as const, conf: parsedBooking?.confidence ?? 0 }
          }

          const relevance = checkRelevance(parsedBooking, t)
          if (relevance !== 'ok') return { skip: relevance as 'wrong_dest' | 'wrong_date' }

          // Soft traveler name check — log only, never blocks
          const travelerMatch = checkTravelerSoftMatch(parsedBooking.traveler_names, t.travelers)
          console.log(
            `[gmailScanner/trip] ✓ RELEVANT: type=${parsedBooking.booking_type}` +
            ` vendor="${parsedBooking.vendor}" city="${parsedBooking.destination_city}"` +
            ` conf=${parsedBooking.confidence} traveler=${travelerMatch}` +
            (travelerMatch === 'mismatch'
              ? ` [parsed: ${parsedBooking.traveler_names.join(',')}]`
              : ''),
          )
          return { msg, parsedBooking, emailContent, rawHtml: body }
        }),
      )

      // Tally filter reasons and collect survivors
      const relevant: Pass1Item[] = []
      for (const r of pass1Results) {
        if (r.status !== 'fulfilled') continue
        const v = r.value
        if (!v || 'skip' in v) {
          if (v && 'skip' in v) {
            if      (v.skip === 'low_conf')    stats.filteredLowConf++
            else if (v.skip === 'wrong_dest')  stats.filteredWrongDest++
            else if (v.skip === 'wrong_date')  stats.filteredWrongDate++
          }
        } else {
          relevant.push(v as Pass1Item)
        }
      }

      console.log(
        `[gmailScanner/trip] Pass 1: ${messages.length} scanned, ${relevant.length} relevant ` +
        `(lowConf=${stats.filteredLowConf} wrongDest=${stats.filteredWrongDest} wrongDate=${stats.filteredWrongDate})`,
      )

      // ── PASS 2: For relevant emails only, download PDF attachments ────────
      // Typically 1-5 emails, so this adds very little time.
      const parsed = await Promise.allSettled(
        relevant.map(async ({ msg, parsedBooking, emailContent, rawHtml }) => {
          let pdfBase64: string | undefined
          let pdfFilename: string | undefined
          try {
            const attachments = await getEmailAttachments(accessToken, msg.id)
            // Only download PDFs up to 4 MB to stay fast
            const pdf = attachments
              .filter(a => a.size > 0 && a.size < 4 * 1024 * 1024)
              .sort((a, b) => b.size - a.size)[0]
            if (pdf) {
              pdfBase64   = await downloadAttachment(accessToken, msg.id, pdf.attachmentId)
              pdfFilename = pdf.filename
              stats.scannedWithPDF++
            } else {
              stats.scannedEmailOnly++
            }
          } catch { stats.scannedEmailOnly++ }

          // Re-parse with PDF if we got one (higher quality extraction)
          let finalBooking = parsedBooking
          if (pdfBase64) {
            try {
              const withPdf = await parseBookingEmail(emailContent, msg.subject, pdfBase64)
              if (withPdf && withPdf.confidence >= parsedBooking.confidence) {
                finalBooking = withPdf
              }
            } catch { /* keep text-only result */ }
          }

          // ── If no PDF: try extracting booking links from the email HTML ────
          // Some airlines/hotels send a "View your booking" link instead of PDF.
          // We fetch the page and re-parse for better data quality.
          if (!pdfBase64 && rawHtml) {
            const bookingUrls = extractBookingUrls(rawHtml)
            for (const url of bookingUrls) {
              try {
                console.log(`[gmailScanner/trip] Fetching booking URL: ${url.slice(0, 80)}…`)
                const pageHtml = await fetchBookingPage(url)
                if (!pageHtml) continue
                const urlBooking = await parseBookingEmail(pageHtml, msg.subject)
                if (urlBooking && urlBooking.confidence > finalBooking.confidence) {
                  console.log(
                    `[gmailScanner/trip] URL parse improved: ${finalBooking.confidence} → ${urlBooking.confidence}`,
                  )
                  finalBooking = urlBooking
                  break
                }
              } catch { /* ignore URL fetch errors */ }
            }
          }

          return { msg, parsedBooking: finalBooking, emailContent, rawHtml, pdfBase64, pdfFilename }
        }),
      )

      // ── Write successful parses to DB ─────────────────────────────────────
      for (const result of parsed) {
        if (result.status !== 'fulfilled' || !result.value) continue
        const { msg, parsedBooking, emailContent, rawHtml, pdfBase64, pdfFilename } = result.value
        stats.parsed++

        try {
          // Compute booking title first — used for both dedup and DB insert
          const bookingTitle =
            parsedBooking.hotel_name ||
            (parsedBooking.airline && parsedBooking.flight_number
              ? `${parsedBooking.airline} ${parsedBooking.flight_number}` : null) ||
            parsedBooking.vendor || msg.subject.slice(0, 60)

          const dedupDate = parsedBooking.check_in || parsedBooking.departure_date

          // ── Deduplication 1: same booking_ref ─────────────────────────────
          if (parsedBooking.confirmation_number && parsedBooking.confirmation_number !== 'N/A') {
            const { data: existingByRef } = await supabase
              .from('documents')
              .select('id')
              .eq('trip_id', tripId)
              .eq('booking_ref', parsedBooking.confirmation_number)
              .maybeSingle()
            if (existingByRef) {
              console.log(`[gmailScanner/trip] skip dup by ref: "${bookingTitle}" ref=${parsedBooking.confirmation_number}`)
              stats.filteredDuplicate++; continue
            }
          }

          // ── Deduplication 2: same name + same check-in/departure date ─────
          // Booking.com / airlines send 10+ emails per booking (confirmation,
          // payment, modification, reminder…). Without this check, each email
          // would create a separate document for the same reservation.
          if (bookingTitle && dedupDate) {
            const { data: existingByName } = await supabase
              .from('documents')
              .select('id')
              .eq('trip_id', tripId)
              .eq('name', bookingTitle)
              .eq('valid_from', dedupDate)
              .maybeSingle()
            if (existingByName) {
              console.log(`[gmailScanner/trip] skip dup by name+date: "${bookingTitle}" ${dedupDate}`)
              stats.filteredDuplicate++; continue
            }
          }

          const safeId = msg.id.replace(/[^a-zA-Z0-9]/g, '')
          let fileUrl: string | null = null
          let fileType = 'gmail'

          // ── 1. Prefer PDF attachment — save as actual PDF file ────────────
          if (pdfBase64) {
            try {
              const pdfName   = pdfFilename || `booking-${safeId}.pdf`
              const filePath  = `${tripId}/${pdfName}`
              const pdfBuffer = Buffer.from(pdfBase64, 'base64')
              const { error: pdfErr } = await supabase.storage
                .from('documents')
                .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
              if (!pdfErr) {
                const { data: urlData } = supabase.storage
                  .from('documents').getPublicUrl(filePath)
                fileUrl  = urlData?.publicUrl || null
                fileType = 'pdf'
                console.log(`[gmailScanner/trip] PDF saved: ${pdfName}`)
              } else {
                console.warn('[gmailScanner/trip] PDF upload error:', pdfErr.message)
              }
            } catch (pdfEx) {
              console.warn('[gmailScanner/trip] PDF upload exception:', pdfEx)
            }
          }

          // ── 2. Fallback: save email body as HTML snapshot ─────────────────
          if (!fileUrl && rawHtml) {
            try {
              const filePath = `${tripId}/email-${safeId}.html`
              const htmlFile = `<!DOCTYPE html><html dir="auto"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${bookingTitle || msg.subject}</title></head><body>${rawHtml}</body></html>`
              const blob     = Buffer.from(htmlFile, 'utf-8')
              const { error: uploadErr } = await supabase.storage
                .from('documents')
                .upload(filePath, blob, { contentType: 'text/html', upsert: true })
              if (uploadErr) {
                console.warn('[gmailScanner/trip] HTML upload error:', uploadErr.message)
              } else {
                const { data: urlData } = supabase.storage
                  .from('documents').getPublicUrl(filePath)
                fileUrl = urlData?.publicUrl || null
              }
            } catch (uploadEx) {
              console.warn('[gmailScanner/trip] HTML upload exception:', uploadEx)
            }
          }

          // ── Create a Document record so it shows in the documents page ──
          const { data: docRecord, error: docError } = await supabase
            .from('documents')
            .insert({
              trip_id:        tripId,
              name:           bookingTitle,
              doc_type:       docTypeMap[parsedBooking.booking_type] || 'other',
              file_type:      fileType,  // 'pdf' if attachment found, 'gmail' for HTML snapshot
              file_url:       fileUrl,
              booking_ref:    parsedBooking.confirmation_number !== 'N/A'
                                ? parsedBooking.confirmation_number : null,
              valid_from:     parsedBooking.check_in || parsedBooking.departure_date || null,
              valid_until:    parsedBooking.check_out || parsedBooking.return_date   || null,
              flight_number:  parsedBooking.flight_number || null,
              notes:          `ייובא מ-Gmail\nשולח: ${msg.from}\n${parsedBooking.summary || ''}`,
              extracted_data: parsedBooking as unknown as Record<string, unknown>,
            })
            .select('id')
            .single()

          if (docError) {
            const errMsg = `${docError.message}${docError.details ? ` — ${docError.details}` : ''}${docError.code ? ` (${docError.code})` : ''}`
            console.error('[gmailScanner/trip] Document insert error:', errMsg, '\nPayload:', {
              trip_id: tripId, name: bookingTitle, doc_type: docTypeMap[parsedBooking.booking_type] || 'other',
            })
            stats.failedDB++
            stats.lastDbError = errMsg
          } else if (docRecord) {
            // ── Document saved ✅ — record it and increment counter ──────────
            stats.createdDocs.push({
              id:       docRecord.id,
              name:     bookingTitle || msg.subject.slice(0, 60),
              doc_type: docTypeMap[parsedBooking.booking_type] || 'other',
            })
            stats.created++
          }

          // ── Create an Expense record (best-effort — never blocks) ─────────
          const { error: expenseError } = await supabase
            .from('expenses')
            .insert({
              trip_id:      tripId,
              title:        bookingTitle,
              amount:       parsedBooking.amount || 0,
              currency:     parsedBooking.currency || 'ILS',
              amount_ils:   parsedBooking.amount || 0,
              category:     categoryMap[parsedBooking.booking_type] || 'other',
              expense_date: parsedBooking.check_in || parsedBooking.departure_date || t.start_date,
              notes:        `מספר אישור: ${parsedBooking.confirmation_number}\nייובא מ-Gmail: ${msg.from}`,
              source:       'document',
              is_paid:      true,
            })
          if (expenseError) console.error('[gmailScanner/trip] Expense insert error:', expenseError)

          // ── Save to email_ingests for audit trail ─────────────────────────
          const rawText = htmlToText(emailContent).slice(0, 10000)
          await supabase.from('email_ingests').insert({
            user_id:      userId,
            from_address: msg.from,
            subject:      msg.subject,
            raw_text:     rawText,
            parsed_data:  parsedBooking,
            trip_id:      tripId,
            match_score:  100,
            match_reason: 'ייבוא ידני לטיול',
            status:       docRecord ? 'processed' : 'matched',
            source:       'gmail_trip_import',
          })
        } catch (err) {
          console.error(`[gmailScanner/trip] DB write error for ${msg.id}:`, err)
        }
      }
    } catch (err) {
      console.error(`[gmailScanner/trip] Error scanning ${conn.gmail_address}:`, err)
    }
  }

  return stats
}
