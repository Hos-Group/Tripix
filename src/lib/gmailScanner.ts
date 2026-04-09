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
 * Decide if a Claude-parsed booking is relevant to the given trip.
 *
 * Rules (both must pass):
 *  1. Destination: if we know the trip country AND Claude extracted a destination,
 *     the extracted destination must match (any alias). If Claude gave no destination
 *     at all we rely solely on the confidence score.
 *  2. Dates: booking date must fall in [tripStart-180d, tripEnd+7d].
 */
function isRelevantToTrip(booking: ParsedBooking, trip: TripRow): boolean {
  const tripCountry = resolveTripCountry(trip.destination)

  if (tripCountry) {
    const aliases = COUNTRY_CITY_MAP[tripCountry]
    const city    = (booking.destination_city    || '').toLowerCase().trim()
    const country = (booking.destination_country || '').toLowerCase().trim()

    // Only run the destination filter when Claude actually extracted something
    if (city || country) {
      const matchesAlias = (text: string) =>
        text.length >= 3 &&              // ignore noise like "go", "la", "us"
        aliases.some(a => a.length >= 3 && (text.includes(a) || a.includes(text)))

      const destMatch = matchesAlias(city) || matchesAlias(country)

      if (!destMatch) {
        console.log(
          `[gmailScanner/trip] ✗ "${booking.vendor}" — ` +
          `destination "${city || '?'}/${country || '?'}" ≠ trip "${trip.destination}"`,
        )
        return false
      }
    }
    // If Claude extracted no destination, fall through (confidence filter is enough)
  }

  // ── Date window ────────────────────────────────────────────────────────────
  // Allow bookings from 180 days before trip start to 7 days after trip end.
  const tripStart   = new Date(trip.start_date)
  const tripEnd     = new Date(trip.end_date)
  const windowStart = new Date(tripStart)
  windowStart.setDate(windowStart.getDate() - 180)
  const windowEnd = new Date(tripEnd)
  windowEnd.setDate(windowEnd.getDate() + 7)

  const bookingDateStr = booking.check_in || booking.departure_date
  if (bookingDateStr) {
    const bd = new Date(bookingDateStr)
    if (bd < windowStart || bd > windowEnd) {
      console.log(
        `[gmailScanner/trip] ✗ "${booking.vendor}" — ` +
        `date "${bookingDateStr}" outside [${windowStart.toISOString().slice(0, 10)}, ` +
        `${windowEnd.toISOString().slice(0, 10)}]`,
      )
      return false
    }
  }

  return true
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
  id:         string
  name:       string
  destination: string
  start_date: string
  end_date:   string
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
    .select('id, name, destination, start_date, end_date')
    .eq('id', tripId)
    .eq('user_id', userId)
    .single()

  if (tripError || !trip) throw new Error('טיול לא נמצא')
  const t = trip as TripRow

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

  // ── 4. No destination filtering in Gmail query ────────────────────────────
  // Flight confirmation emails often use airport codes (BCN, HKT, BKK) rather
  // than city names, so destination-based filtering misses them.
  // We cast a wide net here and let Claude's confidence score filter relevance.
  const destQuery = ''

  const stats: TripScanStats = {
    tripId: t.id, tripName: t.name, destination: t.destination, daysSearched,
    scanned: 0, parsed: 0, created: 0, scannedWithPDF: 0, scannedEmailOnly: 0,
    createdDocs: [],
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
      // This is fast (~5-8s for 20 emails in parallel).
      // We avoid downloading PDFs until we know an email is relevant.
      const pass1 = await Promise.allSettled(
        messages.map(async (msg) => {
          let body = ''
          try { body = await getEmailBody(accessToken, msg.id) } catch { return null }
          const emailContent = body || msg.snippet

          // Text-only parse — fast, no PDF needed yet
          const parsedBooking = await parseBookingEmail(emailContent, msg.subject)
          if (!parsedBooking || parsedBooking.confidence < 0.5) return null
          if (!isRelevantToTrip(parsedBooking, t))              return null

          return { msg, parsedBooking, emailContent, rawHtml: body }
        }),
      )

      // Collect emails that survived text-only filtering
      type Pass1Item = { msg: typeof messages[0]; parsedBooking: ParsedBooking; emailContent: string; rawHtml: string }
      const relevant: Pass1Item[] = []
      for (const r of pass1) {
        if (r.status === 'fulfilled' && r.value !== null) relevant.push(r.value as Pass1Item)
      }

      console.log(`[gmailScanner/trip] Pass 1 done: ${relevant.length}/${messages.length} relevant`)

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

          return { msg, parsedBooking: finalBooking, emailContent, rawHtml, pdfBase64, pdfFilename }
        }),
      )

      // ── Write successful parses to DB ─────────────────────────────────────
      for (const result of parsed) {
        if (result.status !== 'fulfilled' || !result.value) continue
        const { msg, parsedBooking, emailContent, rawHtml, pdfBase64, pdfFilename } = result.value
        stats.parsed++

        try {
          // Deduplication: skip if a document with same booking_ref already exists
          if (parsedBooking.confirmation_number && parsedBooking.confirmation_number !== 'N/A') {
            const { data: existingDoc } = await supabase
              .from('documents')
              .select('id')
              .eq('trip_id', tripId)
              .eq('booking_ref', parsedBooking.confirmation_number)
              .maybeSingle()
            if (existingDoc) continue
          }

          const bookingTitle =
            parsedBooking.hotel_name ||
            (parsedBooking.airline && parsedBooking.flight_number
              ? `${parsedBooking.airline} ${parsedBooking.flight_number}` : null) ||
            parsedBooking.summary || parsedBooking.vendor || msg.subject.slice(0, 60)

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
            console.error('[gmailScanner/trip] Document insert error:', docError)
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
