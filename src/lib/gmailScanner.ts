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
  getMessageMetadata,
  getGmailHistory,
  getCurrentHistoryId,
} from './gmailClient'
import {
  parseBookingEmail,
  parseTripBookingEmail,
  quickPreFilter,
  isKnownBookingSender,
  htmlToText,
  ParsedBooking,
  TripContext,
} from './emailParser'
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
 * Extract all searchable name tokens from a traveler's name.
 * The name field is in English/Latin (e.g. "OMER HALEVY" or "Omer Halevy").
 * Also tries HE_FIRST_NAME_HINTS in case the name is stored in Hebrew.
 */
function travelerNameTokens(traveler: { name: string }): string[] {
  const tokens: string[] = []
  const name = traveler.name.trim()
  if (!name) return tokens

  // Try Hebrew hints first (backward compat)
  const heHints = HE_FIRST_NAME_HINTS[name]
  if (heHints) {
    tokens.push(...heHints)
  } else {
    // Name is in Latin — split by spaces and use each word (≥ 2 chars)
    const parts = name.toLowerCase().split(/\s+/).filter(p => p.length >= 2)
    tokens.push(...parts)
  }
  return Array.from(new Set(tokens))
}

/**
 * Soft traveler name check — logs only, never hard-rejects.
 * Handles both Hebrew-stored names (via HE_FIRST_NAME_HINTS) and
 * Latin-stored names (direct match on name parts).
 */
function checkTravelerSoftMatch(
  parsedNames:   string[],
  tripTravelers: Array<{ id: string; name: string }>,
): 'match' | 'no_names' | 'mismatch' {
  if (!parsedNames.length || !tripTravelers.length) return 'no_names'
  const parsedLower = parsedNames.join(' ').toLowerCase()
  for (const t of tripTravelers) {
    const tokens = travelerNameTokens(t)
    if (tokens.some(tok => parsedLower.includes(tok))) return 'match'
  }
  const anyTokensAvailable = tripTravelers.some(t => travelerNameTokens(t).length > 0)
  return anyTokensAvailable ? 'mismatch' : 'no_names'
}

/**
 * Build a Gmail search boost string from trip destination + traveler names.
 * Additive only — emails are never excluded if they don't match.
 *
 * Traveler names are stored in Latin (e.g. "Omer Halevy") — we use the first
 * name token (e.g. "omer") as a Gmail search term so emails addressed to any
 * trip participant are found even when they have different surnames.
 */
function buildTripGmailQuery(
  trip:      Pick<TripRow, 'destination' | 'cities' | 'businessInfo'>,
  travelers: Array<{ id: string; name: string }>,
): string {
  const terms: string[] = []

  // ── Destination aliases (single-word, max 6) ─────────────────────────────
  const countryKey = resolveTripCountry(trip.destination)
  if (countryKey) {
    const aliases = COUNTRY_CITY_MAP[countryKey]
      .filter(a => a.length >= 3 && !/\s/.test(a))
      .slice(0, 6)
    terms.push(...aliases)
  }

  // ── Destination string itself (e.g. "Thailand", "Spain") ─────────────────
  // Useful when COUNTRY_CITY_MAP doesn't have the destination (e.g. rare countries)
  const destWords = trip.destination.split(/[\s,]+/).filter(w => w.length >= 4)
  terms.push(...destWords.slice(0, 2))

  // ── Specific cities in the trip (e.g. Bangkok, Chiang Mai) ───────────────
  for (const city of (trip.cities || []).slice(0, 3)) {
    const cityWords = city.split(/\s+/).filter(w => w.length >= 3)
    if (cityWords.length === 1) {
      terms.push(cityWords[0])
    } else if (cityWords.length > 1) {
      // Multi-word city: use first word as it's usually unique enough
      terms.push(cityWords[0])
    }
  }

  // ── Traveler name tokens (first name of each traveler) ───────────────────
  // We use the first token only (first name) since Gmail search is partial.
  // E.g. "OMER HALEVY" → "omer", "NOA COHEN" → "noa"
  for (const t of travelers.slice(0, 5)) {
    const tokens = travelerNameTokens(t)
    if (tokens.length > 0) terms.push(tokens[0])   // first name only → avoids false positives
  }

  // ── Business trip: company name words as additional search terms ──────────
  // Helps find company invoices, receipts, and hotel confirmations sent to/about the company.
  if (trip.businessInfo?.companyName) {
    const companyWords = trip.businessInfo.companyName
      .split(/[\s,./&-]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 3 && !/^(ltd|inc|llc|בע"מ|ומה|בעמ)$/.test(w))
    terms.push(...companyWords.slice(0, 3))
  }

  return Array.from(new Set(terms.map(s => s.toLowerCase()))).join(' OR ')
}

/**
 * Build a self-contained HTML file from a raw email body.
 *
 * Handles two cases:
 *  a) rawHtml is already a full document (has <html>/<DOCTYPE>) →
 *     inject <base target="_blank"> + viewport override into <head>
 *     so links open in new tab and it scales on mobile.
 *  b) rawHtml is an HTML fragment (just table/div email body) →
 *     wrap it in a minimal but correct HTML shell with proper meta tags,
 *     a CSS reset and font normalisation so it renders cleanly.
 */
function buildEmailHtml(rawHtml: string, title: string): string {
  const isFullDoc = /<html[\s>]/i.test(rawHtml) || /<!doctype/i.test(rawHtml)

  if (isFullDoc) {
    // ── Inject into existing document ────────────────────────────────────
    let html = rawHtml

    // Ensure UTF-8 charset (some emails omit it)
    if (!/<meta[^>]+charset/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, '<head$1>\n<meta charset="utf-8">')
    }

    // Ensure viewport (so it scales on mobile inside the iframe)
    if (!/<meta[^>]+viewport/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i,
        '<head$1>\n<meta name="viewport" content="width=device-width, initial-scale=1">')
    }

    // Inject <base target="_blank"> so all links open in new tab (not inside iframe)
    if (!/<base/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, '<head$1>\n<base target="_blank">')
    }

    // Inject responsive image + table overrides so emails don't overflow horizontally
    const responsiveCss = `
<style id="tripix-responsive">
  body{max-width:100%!important;overflow-x:hidden!important;}
  img{max-width:100%!important;height:auto!important;}
  table{max-width:100%!important;}
  *{word-break:break-word;}
</style>`
    html = html.replace('</head>', `${responsiveCss}\n</head>`)

    return html
  }

  // ── Wrap bare HTML fragment ───────────────────────────────────────────
  return `<!DOCTYPE html>
<html dir="auto" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base target="_blank">
  <title>${title.replace(/</g, '&lt;')}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
      font-size: 15px; line-height: 1.5;
      background: #ffffff; color: #1a1a1a;
      max-width: 100%; overflow-x: hidden;
    }
    body { padding: 16px; }
    img  { max-width: 100%; height: auto; display: block; }
    a    { color: #1a73e8; }
    table { border-collapse: collapse; max-width: 100%; width: 100%; }
    td, th { padding: 4px 8px; }
    p { margin: 0 0 8px; }
  </style>
</head>
<body>
${rawHtml}
</body>
</html>`
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

// ── Travel-core booking types — always linked to a specific place ─────────────
// These MUST have a destination that matches the trip, or be explicitly linked
// to it via date + traveler name evidence.
const TRAVEL_CORE_TYPES = new Set(['hotel', 'flight', 'car_rental', 'ferry', 'activity', 'tour', 'insurance', 'inflight', 'sim', 'visa'])

// ── Non-travel types — receipts, food, misc purchases ─────────────────────────
// These are almost never relevant to a specific trip unless they're geo-tagged
// to the exact destination country/city.
const NON_TRAVEL_TYPES = new Set(['food', 'other'])

/**
 * Check if a Claude-parsed booking is relevant to the given trip.
 *
 * Rules (in order):
 *  1. Non-travel types (food/other) MUST have destination match — no destination = reject
 *  2. Travel-core types with destination extracted — destination MUST match
 *  3. Travel-core types with NO destination — must be within trip date window
 *  4. Date window check — booking date must be within 365d before trip start .. 30d after end
 *
 * Returns 'ok' | 'wrong_dest' | 'wrong_date'
 */
function checkRelevance(booking: ParsedBooking, trip: TripRow): 'ok' | 'wrong_dest' | 'wrong_date' {
  const city    = (booking.destination_city    || '').toLowerCase().trim()
  const country = (booking.destination_country || '').toLowerCase().trim()
  const hasExtractedDest = city.length >= 3 || country.length >= 3

  const tripCountry = resolveTripCountry(trip.destination)
  const aliases     = tripCountry ? COUNTRY_CITY_MAP[tripCountry] : []

  const destMatches = (text: string) =>
    text.length >= 3 &&
    aliases.some(a => a.length >= 3 && (text.includes(a) || a.includes(text)))

  const destOk = hasExtractedDest
    ? (destMatches(city) || destMatches(country))
    : false  // no destination extracted → not confirmed

  // ── Rule 1: Non-travel types need explicit destination match ──────────────
  if (NON_TRAVEL_TYPES.has(booking.booking_type)) {
    if (!destOk) {
      console.log(
        `[checkRelevance] ✗ non-travel type="${booking.booking_type}" no dest match: "${booking.vendor}" ` +
        `city="${city}" country="${country}" ≠ trip="${trip.destination}"`,
      )
      return 'wrong_dest'
    }
  }

  // ── Rule 2: Travel-core types with extracted destination — must match ──────
  if (TRAVEL_CORE_TYPES.has(booking.booking_type) && hasExtractedDest && !destOk) {
    console.log(
      `[checkRelevance] ✗ dest mismatch: "${booking.vendor}" ` +
      `city="${city}" country="${country}" ≠ trip="${trip.destination}"`,
    )
    return 'wrong_dest'
  }

  // ── Rule 3: Travel-core with NO destination — require high confidence ──────
  if (TRAVEL_CORE_TYPES.has(booking.booking_type) && !hasExtractedDest) {
    if (booking.confidence < 0.60) {
      console.log(
        `[checkRelevance] ✗ no dest extracted + conf=${booking.confidence} < 0.60: "${booking.vendor}"`,
      )
      return 'wrong_dest'
    }
  }

  // ── Rule 4: Date window ───────────────────────────────────────────────────
  // 365 days before trip start → 30 days after end
  // (covers visa applications, travel insurance, advance bookings)
  const tripStart   = new Date(trip.start_date)
  const tripEnd     = new Date(trip.end_date)
  const windowStart = new Date(tripStart)
  windowStart.setDate(windowStart.getDate() - 365)
  const windowEnd   = new Date(tripEnd)
  windowEnd.setDate(windowEnd.getDate() + 30)

  const bookingDateStr = booking.check_in || booking.departure_date
  if (bookingDateStr) {
    const bd = new Date(bookingDateStr)
    if (bd < windowStart || bd > windowEnd) {
      console.log(
        `[checkRelevance] ✗ date outside window: "${booking.vendor}" ` +
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
  /** Accounts that need re-authorization (invalid_grant / revoked token) */
  revokedAccounts?: string[]
  /** Human-readable error for the last scan, if any */
  scanError?:       string
}

export interface CreatedDoc {
  id:       string
  name:     string
  doc_type: string
}

/** A borderline email shown to the user for manual confirmation */
export interface PendingReviewItem {
  ingestId:       string   // email_ingests.id — used when user confirms
  gmailMessageId: string
  subject:        string
  from:           string
  date:           string
  summary:        string
  bookingType:    string
  vendor:         string
  confidence:     number
}

export interface TripScanStats extends ScanStats {
  tripId:       string
  tripName:     string
  destination:  string
  daysSearched: number
  createdDocs:  CreatedDoc[]           // list of every document actually saved
  pendingReview: PendingReviewItem[]   // borderline emails awaiting user confirmation
  // Detailed breakdown — shown to user so they understand what happened
  filteredLowConf:   number   // dropped: AI confidence < 0.35
  filteredWrongDest: number   // dropped: destination didn't match trip
  filteredWrongDate: number   // dropped: dates outside trip window
  filteredDuplicate: number   // dropped: same booking_ref already in DB
  failedDB:          number   // tried to save but DB insert failed
  lastDbError?:      string   // last DB error message for debugging
  connectionError?:  string   // set when Gmail auth/token failed — user must reconnect
}

interface GmailConnection {
  id:            string
  user_id:       string
  gmail_address: string
  access_token:  string
  refresh_token: string | null
  token_expiry:  string | null
  history_id?:   string | null
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

// ── Shared maps used by processMessages ──────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  hotel:      'hotel',
  flight:     'flight',
  car_rental: 'car_rental',
  taxi:       'taxi',
  activity:   'activity',
  tour:       'activity',
  insurance:  'insurance',
  inflight:   'flight',
  food:       'food',
  sim:        'sim',
  visa:       'visa',
  ferry:      'ferry',
  train:      'train',
  other:      'other',
}

const DOC_TYPE_MAP: Record<string, string> = {
  hotel:      'hotel',
  flight:     'flight',
  car_rental: 'other',
  taxi:       'other',
  activity:   'activity',
  tour:       'activity',
  insurance:  'insurance',
  inflight:   'flight',
  food:       'other',
  sim:        'other',
  visa:       'visa',
  ferry:      'ferry',
  train:      'other',
  other:      'other',
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper: process one batch of messages for a user
// Creates: email_ingests + documents + expenses (all three tables)
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
      // ── Fetch full email body ───────────────────────────────────────────
      let rawHtml = ''
      let body    = ''
      try {
        rawHtml = await getEmailBody(accessToken, msg.id)
        body    = rawHtml
      } catch { continue }
      const emailContent = body || msg.snippet

      // ── Check for PDF attachments ───────────────────────────────────────
      let pdfBase64: string | undefined
      try {
        const attachments = await getEmailAttachments(accessToken, msg.id)
        if (attachments.length > 0) {
          const pdf = attachments.sort((a, b) => b.size - a.size)[0]
          pdfBase64 = await downloadAttachment(accessToken, msg.id, pdf.attachmentId)
          stats.scannedWithPDF++
        } else { stats.scannedEmailOnly++ }
      } catch { stats.scannedEmailOnly++ }

      // ── Claude parse — trip-context-aware when possible ──────────────────
      // Strategy:
      //   1. If exactly 1 trip: use trip-context parse (higher accuracy, no double API call)
      //   2. If forceTripId: use that trip's context
      //   3. Multiple trips: generic parse (can't know which trip before parsing)
      //      → lower threshold so borderline real bookings aren't silently dropped

      let parsedBooking: ParsedBooking | null = null

      const forcedOrSingleTrip: TripRecord | null =
        forceTripId ? (trips.find(t => t.id === forceTripId) ?? trips[0] ?? null)
        : trips.length === 1 ? trips[0]
        : null

      if (forcedOrSingleTrip) {
        const ctx: TripContext = {
          destination:   forcedOrSingleTrip.destination,
          startDate:     forcedOrSingleTrip.start_date,
          endDate:       forcedOrSingleTrip.end_date,
          travelerNames: forcedOrSingleTrip.travelerNames || [],
          cities:        forcedOrSingleTrip.cities,
          tripType:      forcedOrSingleTrip.tripType,
          tripName:      forcedOrSingleTrip.name,
        }
        parsedBooking = await parseTripBookingEmail(emailContent, msg.subject, ctx, pdfBase64)
        // If Claude says explicitly not relevant to this trip and confidence is low,
        // skip — saves storing unrelated bookings under the wrong trip.
        if (parsedBooking?.trip_relevant === false && !forceTripId && parsedBooking.confidence < 0.70) {
          console.log(
            `[processMessages] ✗ trip-context: not relevant to "${forcedOrSingleTrip.name}"` +
            ` (${parsedBooking.vendor}, conf=${parsedBooking.confidence})`,
          )
          continue
        }
      } else {
        // Multiple trips: generic parse
        parsedBooking = await parseBookingEmail(emailContent, msg.subject, pdfBase64)
      }

      if (!parsedBooking) continue
      stats.parsed++

      // Confidence threshold: trip-context parse is more reliable → allow 0.55+
      // Generic parse keeps 0.65+ to avoid noisy false positives
      const confThreshold = forcedOrSingleTrip ? 0.55 : 0.65
      if (parsedBooking.confidence < confThreshold) continue

      // ── Deduplication: check email_ingests.gmail_message_id ────────────
      const gmidKey = `GMID:${msg.id}`
      const { data: existingIngest } = await supabase
        .from('email_ingests')
        .select('id, status')
        .eq('user_id', userId)
        .eq('gmail_message_id', msg.id)
        .maybeSingle()
      if (existingIngest) {
        console.log(`[processMessages] dup skip GMID=${msg.id} (status=${existingIngest.status})`)
        continue
      }

      // ── Match to a trip ─────────────────────────────────────────────────
      let matchedTripId = forceTripId
      let matchScore    = forceTripId ? 100 : 0
      let matchReason   = forceTripId ? 'ייבוא ידני לטיול' : 'לא נותח'

      if (!forceTripId && trips.length) {
        const result = matchTripToBooking(parsedBooking, trips)
        matchedTripId = result.trip?.id || null
        matchScore    = result.score
        matchReason   = result.reason
      }

      // ── Relevance check: verify booking is actually related to the matched trip ──
      // Prevents non-travel receipts (food, shopping) and wrong-destination bookings
      // from being saved under an unrelated trip.
      if (matchedTripId && !forceTripId) {
        const matchedTrip = trips.find(t => t.id === matchedTripId)
        if (matchedTrip) {
          // Build a minimal TripRow for checkRelevance
          const tripRow = {
            id:          matchedTrip.id,
            name:        matchedTrip.name,
            destination: matchedTrip.destination,
            start_date:  matchedTrip.start_date,
            end_date:    matchedTrip.end_date,
            travelers:   (matchedTrip.travelerNames || []).map((n, i) => ({ id: String(i), name: n })),
          }
          const relevance = checkRelevance(parsedBooking, tripRow)
          if (relevance !== 'ok') {
            console.log(
              `[processMessages] ✗ relevance="${relevance}" for "${parsedBooking.vendor}" → skipping`,
            )
            continue
          }
        }
      }

      const rawText = htmlToText(emailContent).slice(0, 10000)

      // ── Build booking title ─────────────────────────────────────────────
      const bookingTitle =
        parsedBooking.hotel_name ||
        (parsedBooking.airline && parsedBooking.flight_number
          ? `${parsedBooking.airline} ${parsedBooking.flight_number}`
          : null) ||
        parsedBooking.vendor || msg.subject.slice(0, 60)

      // ── 1. email_ingests record ─────────────────────────────────────────
      // Try with gmail_message_id (migration 007), fall back without it if column missing
      let ingestRecord: { id: string } | null = null
      {
        const basePayload = {
          user_id:      userId,
          from_address: msg.from,
          subject:      msg.subject,
          raw_html:     rawHtml?.slice(0, 50000) || null,
          raw_text:     rawText,
          parsed_data:  parsedBooking,
          trip_id:      matchedTripId,
          match_score:  matchScore,
          match_reason: matchReason,
          status:       matchedTripId ? 'matched' : 'unmatched',
          source,
        }
        const { data: r1, error: e1 } = await supabase
          .from('email_ingests')
          .insert({ ...basePayload, gmail_message_id: msg.id })
          .select('id')
          .single()
        if (r1) {
          ingestRecord = r1
        } else if (e1?.code === 'PGRST204' || e1?.message?.includes('gmail_message_id')) {
          // Column missing — retry without it (migration 007 not yet applied)
          const { data: r2 } = await supabase
            .from('email_ingests')
            .insert(basePayload)
            .select('id')
            .single()
          ingestRecord = r2
        } else if (e1) {
          console.error('[processMessages] Ingest insert error:', e1.message)
        }
      }

      // If no trip matched, still save ingest for manual assignment — don't discard
      if (!ingestRecord) continue
      if (!matchedTripId) {
        // Saved to email_ingests with status='unmatched' — user can assign manually
        console.log(`[processMessages] ✓ saved unmatched ingest: "${bookingTitle}" (no trip found)`)
        continue
      }

      // ── 2. documents record — visible in Documents page ─────────────────
      const { data: docRecord, error: docError } = await supabase
        .from('documents')
        .insert({
          trip_id:          matchedTripId,
          user_id:          userId,
          name:             bookingTitle,
          doc_type:         DOC_TYPE_MAP[parsedBooking.booking_type] || 'other',
          file_url:         null,
          file_type:        'gmail',
          extracted_data:   parsedBooking,
          booking_ref:      parsedBooking.confirmation_number || null,
          flight_number:    parsedBooking.flight_number || null,
          valid_from:       parsedBooking.check_in || parsedBooking.departure_date || null,
          valid_until:      parsedBooking.check_out || parsedBooking.return_date || null,
          notes:            `${gmidKey}\nמ: ${msg.from}\nתאריך: ${msg.date}`,
          gmail_message_id: msg.id,  // migration 013 — DB-level dedup
        })
        .select('id')
        .single()

      if (docError) {
        // Unique constraint violation = duplicate → skip silently
        if (docError.code === '23505') {
          console.log(`[processMessages] dup doc skipped (DB unique): GMID=${msg.id}`)
          continue
        }
        console.error('[processMessages] Document insert error:', docError.message)
      }

      // ── 3. expenses record — visible in Expenses page ───────────────────
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          trip_id:      matchedTripId,
          title:        bookingTitle,
          amount:       parsedBooking.amount || 0,
          currency:     parsedBooking.currency || 'ILS',
          amount_ils:   parsedBooking.amount || 0,
          category:     CATEGORY_MAP[parsedBooking.booking_type] || 'other',
          expense_date:
            parsedBooking.check_in ||
            parsedBooking.departure_date ||
            new Date().toISOString().split('T')[0],
          notes:        `${gmidKey}\nמספר אישור: ${parsedBooking.confirmation_number || '—'}\nמ: ${msg.from}`,
          source:       'scan',
          is_paid:      true,
        })
        .select('id')
        .single()

      if (expenseError) {
        console.error('[processMessages] Expense insert error:', expenseError.message)
      }

      // ── Link expense + document to ingest record ────────────────────────
      await supabase.from('email_ingests')
        .update({
          expense_id: expense?.id  || null,
          status:     'processed',
        })
        .eq('id', ingestRecord.id)

      stats.created++
      console.log(
        `[processMessages] ✓ created doc+expense: "${bookingTitle}" ` +
        `(trip=${matchedTripId}, conf=${parsedBooking.confidence}, source=${source})`,
      )
    } catch (err) {
      console.error(`[processMessages] Error processing ${msg.id}:`, err)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract city names from a trip destination string and trip name.
 * Handles formats like "Bangkok, Thailand", "Paris / Lyon", "תאילנד - פוקט ובנגקוק"
 */
function extractCitiesFromDestination(destination: string, tripName?: string): string[] {
  const cities: string[] = []
  const text = [destination, tripName].filter(Boolean).join(' ')

  // Split by common separators
  const parts = text.split(/[,/|•\-–—+&;]+/).map(p => p.trim()).filter(p => p.length >= 3)

  for (const part of parts) {
    // Skip country-level words that aren't cities
    const lower = part.toLowerCase()
    if (['and', 'or', 'the', 'in', 'to', 'from', 'via', 'with'].includes(lower)) continue
    cities.push(part)
  }

  return Array.from(new Set(cities)).slice(0, 6)
}

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
    .select('id, name, destination, start_date, end_date, travelers, notes')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })

  const tripList: TripRecord[] = (trips || []).map(tr => ({
    id:             tr.id,
    name:           tr.name,
    destination:    tr.destination,
    start_date:     tr.start_date,
    end_date:       tr.end_date,
    travelerNames:  ((tr.travelers as Array<{ name: string }> | null) || []).map(t => t.name).filter(Boolean),
    tripType:       undefined,
    cities:         extractCitiesFromDestination(tr.destination, tr.name),
  }))

  // ── Build a combined Gmail boost query from ALL active/upcoming trips ──────
  // Includes: destination words, traveler first names — ensures trip emails
  // are found even when they lack classic booking subject keywords.
  const allTravelers: Array<{ id: string; name: string }> = []
  const destTerms: string[] = []
  const now = new Date()
  const scanWindowEnd = new Date(now)
  scanWindowEnd.setDate(scanWindowEnd.getDate() + 365) // upcoming year

  for (const trip of tripList) {
    // Include all trips active in the past 30 days or upcoming
    const tripEnd = new Date(trip.end_date)
    const tripStart = new Date(trip.start_date)
    const windowStart = new Date(now)
    windowStart.setDate(windowStart.getDate() - 30)
    if (tripEnd < windowStart) continue // trip ended more than 30 days ago

    // Destination words (skip very short words)
    const countryKey = resolveTripCountry(trip.destination)
    if (countryKey) {
      const aliases = (COUNTRY_CITY_MAP[countryKey] || [])
        .filter(a => a.length >= 4 && !/\s/.test(a))
        .slice(0, 4)
      destTerms.push(...aliases)
    }
    const destWords = trip.destination.split(/[\s,]+/).filter(w => w.length >= 4)
    destTerms.push(...destWords.slice(0, 2))

    // Traveler names
    for (const t of ((trip as unknown as { travelerNames?: string[] }).travelerNames || [])) {
      allTravelers.push({ id: trip.id + '-' + t, name: t })
    }
  }

  // Build combined query: destinations OR traveler first names
  const travelerTokens: string[] = []
  for (const t of allTravelers) {
    const tokens = travelerNameTokens(t)
    if (tokens.length > 0) travelerTokens.push(tokens[0])
  }
  const combinedTerms = Array.from(new Set([...destTerms, ...travelerTokens].map(s => s.toLowerCase())))
  const combinedQuery = combinedTerms.length > 0 ? combinedTerms.join(' OR ') : ''

  if (combinedQuery) {
    console.log(`[gmailScanner] Combined trip query (${combinedTerms.length} terms): "${combinedQuery.slice(0, 120)}…"`)
  }

  const stats: ScanStats = {
    scanned: 0, parsed: 0, created: 0, scannedWithPDF: 0, scannedEmailOnly: 0,
  }

  // ── 3. Scan each connected Gmail account ─────────────────────────────────
  for (const conn of connections as GmailConnection[]) {
    try {
      const accessToken = await getValidToken(supabase, conn)
      // Use combined trip query so trip-specific emails are prioritised
      const messages = await searchBookingEmails(accessToken, 30, 100, combinedQuery)
      stats.scanned += messages.length
      console.log(`[gmailScanner] ${conn.gmail_address}: ${messages.length} messages found`)
      await processMessages(supabase, userId, accessToken, messages, tripList, stats, 'gmail_scan')

      // ── Save current historyId for future incremental scans ──────────────
      // After the initial full scan, we record the current position in the
      // Gmail history so the next scan only fetches NEW emails (not 30 days again).
      // Requires migration 011 (history_id column). Non-fatal if missing.
      try {
        const histId = await getCurrentHistoryId(accessToken)
        if (histId) {
          const { error: hErr } = await supabase
            .from('gmail_connections')
            .update({ history_id: histId })
            .eq('id', conn.id)
          if (!hErr) {
            console.log(`[gmailScanner] Saved initial historyId=${histId} for ${conn.gmail_address}`)
          } else if (hErr.code !== 'PGRST204' && !hErr.message?.includes('history_id')) {
            console.warn('[gmailScanner] Could not save historyId:', hErr.message)
          }
        }
      } catch { /* non-fatal */ }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[gmailScanner] Error scanning ${conn.gmail_address}:`, err)

      // Detect revoked / invalid refresh token → mark in DB so UI can prompt re-auth
      if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
        console.warn(`[gmailScanner] Token revoked for ${conn.gmail_address} — marking needs_reauth`)
        try {
          await supabase
            .from('gmail_connections')
            .update({ needs_reauth: true })
            .eq('id', conn.id)
        } catch { /* non-fatal if column missing */ }

        if (!stats.revokedAccounts) stats.revokedAccounts = []
        stats.revokedAccounts.push(conn.gmail_address)
        stats.scanError = `חיבור Gmail ל-${conn.gmail_address} פג תוקף — יש להתחבר מחדש`
      } else {
        stats.scanError = msg
      }
    }
  }

  return stats
}

// ─────────────────────────────────────────────────────────────────────────────
// Incremental scan: only new emails since last check (via Gmail History API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Incremental Gmail scan — called every minute by the fast-scan cron.
 *
 * For each connected Gmail account:
 *   - If history_id is stored: fetch only NEW messages since last scan (History API)
 *   - If no history_id: run a 7-day full scan to bootstrap, then save historyId
 *
 * This is extremely lightweight: most runs return 0 new booking emails and
 * complete in under 200ms (one History API call per account, no Claude).
 * Claude only runs when a new booking-like email is detected.
 *
 * @returns aggregated stats across all accounts
 */
export async function scanIncrementalGmail(
  supabase: SupabaseClient,
  userId:   string,
): Promise<ScanStats & { accountsChecked: number; newEmailsFound: number }> {
  const stats = {
    scanned: 0, parsed: 0, created: 0,
    scannedWithPDF: 0, scannedEmailOnly: 0,
    accountsChecked: 0, newEmailsFound: 0,
  }

  // ── Load connections ──────────────────────────────────────────────────────
  // Try to select history_id (migration 011). If column missing, fall back
  // to base columns and treat history_id as null (bootstrap mode every run).
  let connections: Record<string, unknown>[] | null = null
  let hasHistoryIdCol = true
  {
    const { data: c1, error: e1 } = await supabase
      .from('gmail_connections')
      .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry, history_id')
      .eq('user_id', userId)
    if (e1?.code === 'PGRST204' || e1?.message?.includes('history_id')) {
      hasHistoryIdCol = false
      console.warn('[incremental] history_id column missing — run migration 011. Running in bootstrap mode.')
      const { data: c2 } = await supabase
        .from('gmail_connections')
        .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry')
        .eq('user_id', userId)
      connections = c2
    } else {
      connections = c1
    }
  }

  if (!connections?.length) return stats

  // ── Load trips once ───────────────────────────────────────────────────────
  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, travelers, notes')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })

  const tripList: TripRecord[] = (trips || []).map(tr => ({
    id:            tr.id,
    name:          tr.name,
    destination:   tr.destination,
    start_date:    tr.start_date,
    end_date:      tr.end_date,
    travelerNames: ((tr.travelers as Array<{ name: string }> | null) || [])
                     .map(t => t.name).filter(Boolean),
    tripType:      undefined,
    cities:        extractCitiesFromDestination(tr.destination, tr.name),
  }))

  // ── Process each account ──────────────────────────────────────────────────
  for (const conn of connections as unknown as GmailConnection[]) {
    stats.accountsChecked++
    try {
      const accessToken = await getValidToken(supabase, conn)

      const connHistoryId = hasHistoryIdCol ? ((conn as unknown as Record<string, unknown>).history_id as string | null) : null

      if (!connHistoryId) {
        // ── Bootstrap: no historyId yet → 7-day scan + save historyId ──────
        console.log(`[incremental] ${conn.gmail_address}: no historyId — bootstrapping with 7d scan`)
        const messages = await searchBookingEmails(accessToken, 7, 30)
        if (messages.length) {
          stats.scanned     += messages.length
          stats.newEmailsFound += messages.length
          await processMessages(supabase, userId, accessToken, messages, tripList, stats, 'gmail_incremental')
        }
        // Save current historyId so next run uses incremental path (requires migration 011)
        if (hasHistoryIdCol) {
          const histId = await getCurrentHistoryId(accessToken)
          if (histId) {
            await supabase
              .from('gmail_connections')
              .update({ history_id: histId })
              .eq('id', conn.id)
          }
        }
        continue
      }

      // ── Incremental: fetch only new messages since last historyId ─────────
      const { messageIds, latestHistoryId } = await getGmailHistory(accessToken, connHistoryId)
      console.log(`[incremental] ${conn.gmail_address}: ${messageIds.length} new since historyId=${connHistoryId}`)

      // Always update historyId so we don't re-process on next run
      if (hasHistoryIdCol && latestHistoryId !== connHistoryId) {
        await supabase
          .from('gmail_connections')
          .update({ history_id: latestHistoryId })
          .eq('id', conn.id)
      }

      if (!messageIds.length) continue
      stats.newEmailsFound += messageIds.length

      // ── Fetch metadata + pre-filter (no body fetch yet) ─────────────────
      const BATCH = 5
      const candidates: Array<NonNullable<Awaited<ReturnType<typeof getMessageMetadata>>>> = []
      for (let i = 0; i < messageIds.length; i += BATCH) {
        const batch   = messageIds.slice(i, i + BATCH)
        const fetched = await Promise.all(batch.map(id => getMessageMetadata(accessToken, id)))
        for (const m of fetched) if (m) candidates.push(m)
      }

      const bookingCandidates = candidates.filter(msg => {
        const verdict = quickPreFilter(msg.subject, msg.from, msg.snippet)
        return verdict !== 'skip'
      })

      if (!bookingCandidates.length) {
        console.log(`[incremental] ${conn.gmail_address}: all ${messageIds.length} new emails filtered out`)
        continue
      }

      console.log(
        `[incremental] ${conn.gmail_address}: ${bookingCandidates.length} of ${messageIds.length} pass pre-filter`,
      )

      stats.scanned += bookingCandidates.length
      await processMessages(
        supabase, userId, accessToken,
        bookingCandidates, tripList, stats,
        'gmail_incremental',
      )
    } catch (err) {
      console.error(`[incremental] Error for ${conn.gmail_address}:`, err)
    }
  }

  return stats
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-time push: process specific message IDs from Gmail History API
// ─────────────────────────────────────────────────────────────────────────────

/** Connection row shape needed by scanPushMessages */
export interface GmailConnectionRow {
  id:            string
  user_id:       string
  gmail_address: string
  access_token:  string
  refresh_token: string | null
  token_expiry:  string | null
}

/**
 * Process specific Gmail message IDs from a Pub/Sub push notification.
 *
 * This is the real-time counterpart of scanUserGmail — it processes only the
 * new messages delivered by Gmail's push mechanism, so we never re-scan the
 * entire inbox. Called by /api/gmail/webhook on every incoming notification.
 *
 * Flow:
 *   1. Refresh access token if needed
 *   2. Fetch lightweight metadata for each new message ID
 *   3. Quick pre-filter (subject + sender) — discard obvious non-bookings
 *   4. Load user's trips for matching
 *   5. Run processMessages (full pipeline: body fetch → Claude → expense insert)
 *
 * @param supabase    Supabase admin client
 * @param userId      User whose Gmail triggered the push
 * @param connection  The gmail_connections row for this account
 * @param messageIds  New message IDs from Gmail history.list
 */
export async function scanPushMessages(
  supabase:    SupabaseClient,
  userId:      string,
  connection:  GmailConnectionRow,
  messageIds:  string[],
): Promise<ScanStats> {
  const stats: ScanStats = {
    scanned: 0, parsed: 0, created: 0,
    scannedWithPDF: 0, scannedEmailOnly: 0,
  }

  if (!messageIds.length) return stats

  // ── 1. Get a valid access token ───────────────────────────────────────────
  const accessToken = await getValidToken(supabase, connection as GmailConnection)

  // ── 2. Fetch metadata for each new message (in parallel, batched) ─────────
  const BATCH = 5
  const candidates: Array<NonNullable<Awaited<ReturnType<typeof getMessageMetadata>>>> = []

  for (let i = 0; i < messageIds.length; i += BATCH) {
    const batch   = messageIds.slice(i, i + BATCH)
    const fetched = await Promise.all(batch.map(id => getMessageMetadata(accessToken, id)))
    for (const m of fetched) if (m) candidates.push(m)
  }

  // ── 3. Quick pre-filter — drop obvious non-booking emails ─────────────────
  const bookingCandidates = candidates.filter(msg => {
    const verdict = quickPreFilter(msg.subject, msg.from, msg.snippet)
    if (verdict === 'skip') {
      console.log(`[push] pre-filter skip: "${msg.subject.slice(0, 60)}"`)
      return false
    }
    return true
  })

  if (!bookingCandidates.length) {
    console.log(`[push] ${connection.gmail_address}: ${candidates.length} new → all filtered out`)
    return stats
  }

  console.log(
    `[push] ${connection.gmail_address}: ${candidates.length} new, ` +
    `${bookingCandidates.length} pass pre-filter → processing`,
  )
  stats.scanned = bookingCandidates.length

  // ── 4. Load user's trips for matching ────────────────────────────────────
  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, travelers, notes')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })

  const tripList: TripRecord[] = (trips || []).map(tr => ({
    id:            tr.id,
    name:          tr.name,
    destination:   tr.destination,
    start_date:    tr.start_date,
    end_date:      tr.end_date,
    travelerNames: ((tr.travelers as Array<{ name: string }> | null) || [])
                     .map(t => t.name).filter(Boolean),
    tripType:      undefined,
    cities:        extractCitiesFromDestination(tr.destination, tr.name),
  }))

  // ── 5. Full pipeline via existing processMessages helper ─────────────────
  await processMessages(
    supabase, userId, accessToken,
    bookingCandidates, tripList, stats,
    'gmail_push',
  )

  console.log(
    `[push] done — scanned=${stats.scanned} parsed=${stats.parsed} created=${stats.created}`,
  )
  return stats
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip-specific retroactive scan
// ─────────────────────────────────────────────────────────────────────────────

interface TripRow {
  id:              string
  name:            string
  destination:     string
  start_date:      string
  end_date:        string
  travelers:       Array<{ id: string; name: string }>
  trip_type?:      string   // 'business' | 'beach' | 'ski' | 'family' | 'couple' | etc.
  budget_currency?: string  // 'ILS' | 'USD' | 'EUR' etc.
  cities?:         string[] // specific cities if multi-city trip
  businessInfo?: {          // for business trips — helps match company invoices
    companyName?: string
    businessId?:  string
    department?:  string
  }
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
    .select('id, name, destination, start_date, end_date, travelers, notes')
    .eq('id', tripId)
    .eq('user_id', userId)
    .single()

  if (tripError || !trip) throw new Error('טיול לא נמצא')

  // Parse business info from notes JSON (stored as { type, cities, business: { companyName, businessId, department } })
  let businessInfo: TripRow['businessInfo'] | undefined
  try {
    const notesObj = typeof trip.notes === 'string' ? JSON.parse(trip.notes) : (trip.notes as Record<string, unknown> | null)
    if (notesObj?.business && typeof notesObj.business === 'object') {
      const biz = notesObj.business as Record<string, unknown>
      businessInfo = {
        companyName: typeof biz.companyName === 'string' ? biz.companyName : undefined,
        businessId:  typeof biz.businessId  === 'string' ? biz.businessId  : undefined,
        department:  typeof biz.department  === 'string' ? biz.department  : undefined,
      }
    }
  } catch { /* notes not JSON — ignore */ }

  // Also try to extract cities from notes JSON
  let tripCities: string[] | undefined
  try {
    const notesObj2 = typeof trip.notes === 'string' ? JSON.parse(trip.notes) : (trip.notes as Record<string, unknown> | null)
    if (Array.isArray(notesObj2?.cities)) tripCities = notesObj2.cities as string[]
  } catch { /* ignore */ }

  const t: TripRow = {
    ...trip,
    travelers:       (trip.travelers as Array<{ id: string; name: string }>) || [],
    trip_type:       undefined,
    budget_currency: undefined,
    cities:          tripCities,
    businessInfo,
  }

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
    createdDocs: [], pendingReview: [],
    filteredLowConf: 0, filteredWrongDest: 0, filteredWrongDate: 0,
    filteredDuplicate: 0, failedDB: 0,
  }

  const categoryMap: Record<string, string> = {
    hotel:      'hotel',
    flight:     'flight',
    car_rental: 'car_rental',
    taxi:       'taxi',
    activity:   'activity',
    tour:       'activity',
    insurance:  'insurance',
    inflight:   'flight',
    food:       'food',
    sim:        'sim',
    visa:       'visa',
    ferry:      'ferry',
    train:      'train',
    other:      'other',
  }

  const docTypeMap: Record<string, string> = {
    hotel:      'hotel',
    flight:     'flight',
    car_rental: 'other',
    taxi:       'other',
    activity:   'activity',
    tour:       'activity',
    insurance:  'insurance',
    inflight:   'other',
    food:       'other',
    sim:        'other',
    other:      'other',
  }

  // ── 5. Scan each connected Gmail account ─────────────────────────────────
  for (const conn of connections as GmailConnection[]) {
    try {
      // getValidToken throws with "פג תוקף" if refresh token is missing/expired
      const accessToken = await getValidToken(supabase, conn)
      // Fetch up to 100 emails — larger cap to avoid missing trip-specific emails
      // when the user has many booking emails from other trips in the same period
      const messages = await searchBookingEmails(accessToken, daysSearched, 100, destQuery)
      stats.scanned += messages.length
      console.log(`[gmailScanner/trip] ${conn.gmail_address}: ${messages.length} messages for "${t.name}"`)

      // ── Pre-filter: skip Gmail messages already processed for this trip ───
      // This is the most reliable dedup — Claude may extract different names
      // for the same hotel across runs, so name+date matching is fragile.
      // Storing the raw Gmail message ID gives a deterministic skip.
      // Note: gmail_message_id column requires migration 007. If missing, dedup
      // falls back to empty set (all messages processed, no dedup).
      const { data: alreadyIngested, error: dedupErr } = await supabase
        .from('email_ingests')
        .select('gmail_message_id')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .not('gmail_message_id', 'is', null)

      if (dedupErr && (dedupErr.code === 'PGRST204' || dedupErr.message?.includes('gmail_message_id'))) {
        console.warn('[gmailScanner] gmail_message_id column missing — run migration 007. Dedup disabled.')
      }

      const processedIds = new Set(
        (alreadyIngested || []).map(r => r.gmail_message_id as string)
      )

      const newMessages = messages.filter(m => !processedIds.has(m.id))
      const skippedByMsgId = messages.length - newMessages.length
      if (skippedByMsgId > 0) {
        console.log(
          `[gmailScanner/trip] Skipped ${skippedByMsgId} already-processed message(s) by Gmail ID`,
        )
        stats.filteredDuplicate += skippedByMsgId
      }

      // ── PASS 1: Pre-filter + context-aware Claude parse ───────────────────
      // Steps per email:
      //   a. quickPreFilter — heuristic check (subject/sender) before calling Claude
      //      → 'skip' exits immediately, saving 60-70% of Claude API calls
      //   b. parseTripBookingEmail — context-aware Claude parse with trip destination,
      //      date range and traveler names → much more accurate trip_relevant detection
      //
      // Confidence tiers (with known-sender boost):
      //   < LOW_CONF_FLOOR  → filteredLowConf (clear marketing / non-booking)
      //   LOW_CONF_FLOOR–AUTO_THRESHOLD → borderline → pending_review (ask user)
      //   ≥ AUTO_THRESHOLD  → auto-import (pass to Pass 2 for PDF download)
      //
      // Known-sender boost: emails from booking.com / elal / etc. get a 0.10
      // confidence boost applied before threshold comparison, because their emails
      // are structurally valid bookings even when text is light.

      const tripCtx: TripContext = {
        destination:   t.destination,
        startDate:     t.start_date,
        endDate:       t.end_date,
        travelerNames: t.travelers.map(tr => tr.name).filter(Boolean),
        tripType:      t.trip_type,
        cities:        t.cities,
        numTravelers:  t.travelers.length || undefined,
        currency:      t.budget_currency,
        tripName:      t.name,
        companyName:   t.businessInfo?.companyName,
      }

      // Thresholds — slightly lower for known senders
      const AUTO_THRESHOLD  = 0.70   // ≥ this → auto-import
      const PENDING_FLOOR   = 0.35   // ≥ this → pending review
      const KNOWN_BOOST     = 0.10   // added to confidence for known booking domains

      type Pass1Item       = { msg: typeof messages[0]; parsedBooking: ParsedBooking; emailContent: string; rawHtml: string }
      type BorderlineItem  = { skip: 'borderline'; msg: typeof messages[0]; parsedBooking: ParsedBooking; emailContent: string }

      const pass1Results = await Promise.allSettled(
        newMessages.map(async (msg) => {
          // ── a. Quick heuristic pre-filter (no API call) ─────────────────
          const preFilter = quickPreFilter(msg.subject, msg.from, msg.snippet)
          if (preFilter === 'skip') {
            console.log(`[gmailScanner/trip] ⏭ pre-filter SKIP: "${msg.subject.slice(0, 60)}"`)
            return { skip: 'low_conf' as const, conf: 0 }
          }

          // ── b. Fetch email body ──────────────────────────────────────────
          let body = ''
          try { body = await getEmailBody(accessToken, msg.id) } catch { return { skip: 'fetch_error' as const } }
          const emailContent = body || msg.snippet

          // ── c. Context-aware Claude parse ────────────────────────────────
          // Uses trip destination/dates/travelers for much better accuracy.
          const parsed = await parseTripBookingEmail(emailContent, msg.subject, tripCtx)
          if (!parsed) return { skip: 'low_conf' as const, conf: 0 }

          // ── d. Sender confidence boost ───────────────────────────────────
          const knownSender = isKnownBookingSender(msg.from)
          const effectiveConf = knownSender
            ? Math.min(1.0, parsed.confidence + KNOWN_BOOST)
            : parsed.confidence

          if (knownSender && effectiveConf !== parsed.confidence) {
            console.log(
              `[gmailScanner/trip] 🔑 known sender boost: ${parsed.confidence} → ${effectiveConf} (${msg.from.split('@')[1]})`,
            )
          }

          // ── e. Confidence floor check ────────────────────────────────────
          if (effectiveConf < PENDING_FLOOR) {
            return { skip: 'low_conf' as const, conf: effectiveConf }
          }

          // ── f. Trip relevance check ──────────────────────────────────────
          // Context-aware parse sets trip_relevant directly.
          // Fall back to destination/date check for safety.
          const tripRelevant = parsed.trip_relevant !== false
          if (!tripRelevant) {
            const relevance = checkRelevance(parsed, t)
            if (relevance !== 'ok') {
              return { skip: relevance as 'wrong_dest' | 'wrong_date' }
            }
          }

          // Update parsed booking with effective confidence for downstream use
          const parsedBooking: ParsedBooking = { ...parsed, confidence: effectiveConf }

          // ── g. Borderline → pending review ──────────────────────────────
          if (effectiveConf < AUTO_THRESHOLD) {
            console.log(
              `[gmailScanner/trip] ⚠ BORDERLINE: type=${parsedBooking.booking_type}` +
              ` vendor="${parsedBooking.vendor}" conf=${effectiveConf}` +
              ` tripRelevant=${tripRelevant} → pending_review`,
            )
            return { skip: 'borderline' as const, msg, parsedBooking, emailContent } as BorderlineItem
          }

          // ── h. High confidence → auto-import ────────────────────────────
          const travelerMatch = checkTravelerSoftMatch(parsedBooking.traveler_names, t.travelers)
          console.log(
            `[gmailScanner/trip] ✓ AUTO-IMPORT: type=${parsedBooking.booking_type}` +
            ` vendor="${parsedBooking.vendor}" city="${parsedBooking.destination_city}"` +
            ` conf=${effectiveConf} traveler=${travelerMatch}` +
            (travelerMatch === 'mismatch' ? ` [${parsedBooking.traveler_names.join(',')}]` : ''),
          )
          return { msg, parsedBooking, emailContent, rawHtml: body }
        }),
      )

      // Tally filter reasons and collect survivors / borderline items
      const relevant:  Pass1Item[]      = []
      const borderline: BorderlineItem[] = []
      for (const r of pass1Results) {
        if (r.status !== 'fulfilled') continue
        const v = r.value
        if (!v || 'skip' in v) {
          if (v && 'skip' in v) {
            if      (v.skip === 'low_conf')   stats.filteredLowConf++
            else if (v.skip === 'wrong_dest') stats.filteredWrongDest++
            else if (v.skip === 'wrong_date') stats.filteredWrongDate++
            else if (v.skip === 'borderline') borderline.push(v as BorderlineItem)
          }
        } else {
          relevant.push(v as Pass1Item)
        }
      }

      console.log(
        `[gmailScanner/trip] Pass 1: ${messages.length} scanned, ${relevant.length} high-conf, ` +
        `${borderline.length} borderline ` +
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
          const isFlight = parsedBooking.booking_type === 'flight'
          const isBoardingPass = parsedBooking.document_subtype === 'boarding_pass'

          // ── Build the list of passengers to create documents for ──────────
          // For flights with multiple passengers: create one document per passenger.
          // For boarding passes: only the specific traveler on that pass.
          // For hotels/activities/etc: single document (not per-person).
          const passengers: string[] = isFlight && (parsedBooking.traveler_names?.length ?? 0) > 0
            ? parsedBooking.traveler_names!.map(n => n.trim()).filter(Boolean)
            : ['']  // empty string = no passenger suffix

          // ── Base title (without passenger name) ───────────────────────────
          const baseTitle =
            parsedBooking.hotel_name ||
            (parsedBooking.airline && parsedBooking.flight_number
              ? `${parsedBooking.airline} ${parsedBooking.flight_number}` : null) ||
            parsedBooking.vendor || msg.subject.slice(0, 60)

          const dedupDate = parsedBooking.check_in || parsedBooking.departure_date

          // ── Deduplication 0: same Gmail message ID (DB-level) ────────────
          // Use the indexed gmail_message_id column (migration 013).
          // Falls back to notes LIKE check if column doesn't exist yet.
          {
            const { data: existingByGmid, error: gmidErr } = await supabase
              .from('documents')
              .select('id')
              .eq('trip_id', tripId)
              .eq('gmail_message_id', msg.id)
              .maybeSingle()

            if (gmidErr?.code === 'PGRST204' || gmidErr?.message?.includes('gmail_message_id')) {
              // Column not yet migrated — fall back to notes LIKE (migration 013 pending)
              const { data: fallback } = await supabase
                .from('documents')
                .select('id')
                .eq('trip_id', tripId)
                .like('notes', `GMID:${msg.id}%`)
                .maybeSingle()
              if (fallback) {
                console.log(`[gmailScanner/trip] skip dup by GMID (fallback notes): ${msg.id}`)
                stats.filteredDuplicate++; continue
              }
            } else if (existingByGmid) {
              console.log(`[gmailScanner/trip] skip dup by gmail_message_id: ${msg.id}`)
              stats.filteredDuplicate++; continue
            }
          }

          const safeId = msg.id.replace(/[^a-zA-Z0-9]/g, '')

          // ── Upload the file once (PDF or HTML snapshot) ───────────────────
          // The same file is reused across all per-passenger documents
          let sharedFileUrl: string | null = null
          let sharedFileType = 'gmail'

          if (pdfBase64) {
            try {
              const pdfName  = pdfFilename || `booking-${safeId}.pdf`
              const filePath = `${tripId}/${pdfName}`
              const pdfBuf   = Buffer.from(pdfBase64, 'base64')
              const { error: pdfErr } = await supabase.storage
                .from('documents')
                .upload(filePath, pdfBuf, { contentType: 'application/pdf', upsert: true })
              if (!pdfErr) {
                const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
                sharedFileUrl  = urlData?.publicUrl || null
                sharedFileType = 'pdf'
                console.log(`[gmailScanner/trip] PDF saved: ${pdfName}`)
              } else {
                console.warn('[gmailScanner/trip] PDF upload error:', pdfErr.message)
              }
            } catch (pdfEx) { console.warn('[gmailScanner/trip] PDF upload exception:', pdfEx) }
          }

          if (!sharedFileUrl && rawHtml) {
            try {
              const filePath = `${tripId}/email-${safeId}.html`
              const htmlFile = buildEmailHtml(rawHtml, baseTitle || msg.subject)
              const blob     = Buffer.from(htmlFile, 'utf-8')
              const { error: uploadErr } = await supabase.storage
                .from('documents')
                .upload(filePath, blob, { contentType: 'text/html; charset=utf-8', upsert: true })
              if (!uploadErr) {
                const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
                sharedFileUrl = urlData?.publicUrl || null
              } else {
                console.warn('[gmailScanner/trip] HTML upload error:', uploadErr.message)
              }
            } catch (uploadEx) { console.warn('[gmailScanner/trip] HTML upload exception:', uploadEx) }
          }

          // ── Create one Document per passenger (for flights) ───────────────
          // For non-flights: passengers = [''] → one document, no suffix
          let firstDocCreated = false
          for (const passenger of passengers) {
            const bookingTitle = isFlight && passenger
              ? `${baseTitle} – ${passenger}`
              : baseTitle
            const safePassenger = passenger
              ? `-${passenger.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}`
              : ''

            // ── Per-passenger dedup: same booking_ref + passenger ─────────
            if (parsedBooking.confirmation_number && parsedBooking.confirmation_number !== 'N/A') {
              const refQuery = supabase
                .from('documents')
                .select('id')
                .eq('trip_id', tripId)
                .eq('booking_ref', parsedBooking.confirmation_number)
              if (isFlight && passenger) refQuery.eq('name', bookingTitle)
              const { data: existingByRef } = await refQuery.maybeSingle()
              if (existingByRef) {
                console.log(`[gmailScanner/trip] skip dup by ref+passenger: "${bookingTitle}"`)
                stats.filteredDuplicate++; continue
              }
            }

            // ── Per-passenger dedup: same name + same date ────────────────
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

            // ── Insert document ───────────────────────────────────────────
            const passengerNote = passenger ? `\nנוסע: ${passenger}` : ''
            const boardingNote  = isBoardingPass && parsedBooking.seat_number
              ? `\nמושב: ${parsedBooking.seat_number}${parsedBooking.gate ? ` | שער: ${parsedBooking.gate}` : ''}`
              : ''

            const { data: docRecord, error: docError } = await supabase
              .from('documents')
              .insert({
                trip_id:          tripId,
                user_id:          userId,
                name:             bookingTitle,
                doc_type:         docTypeMap[parsedBooking.booking_type] || 'other',
                file_type:        sharedFileType,
                file_url:         sharedFileUrl,
                booking_ref:      parsedBooking.confirmation_number !== 'N/A'
                                    ? parsedBooking.confirmation_number : null,
                valid_from:       parsedBooking.check_in || parsedBooking.departure_date || null,
                valid_until:      parsedBooking.check_out || parsedBooking.return_date || null,
                flight_number:    parsedBooking.flight_number || null,
                notes:            `GMID:${msg.id}\nייובא מ-Gmail\nשולח: ${msg.from}${passengerNote}${boardingNote}\n${parsedBooking.summary || ''}`,
                extracted_data:   parsedBooking as unknown as Record<string, unknown>,
                gmail_message_id: msg.id,  // migration 013 — DB-level dedup
              })
              .select('id')
              .single()

            if (docError) {
              // Unique constraint violation = already imported → skip silently
              if (docError.code === '23505') {
                console.log(`[gmailScanner/trip] dup doc skipped (DB unique): "${bookingTitle}" GMID=${msg.id}`)
                stats.filteredDuplicate++; continue
              }
              const errMsg = `${docError.message}${docError.details ? ` — ${docError.details}` : ''}${docError.code ? ` (${docError.code})` : ''}`
              console.error('[gmailScanner/trip] Document insert error:', errMsg)
              stats.failedDB++
              stats.lastDbError = errMsg
            } else if (docRecord) {
              stats.createdDocs.push({
                id:       docRecord.id,
                name:     bookingTitle || msg.subject.slice(0, 60),
                doc_type: docTypeMap[parsedBooking.booking_type] || 'other',
              })
              stats.created++
              firstDocCreated = true
              console.log(
                `[gmailScanner/trip] ✓ doc saved: "${bookingTitle}"` +
                (isBoardingPass ? ' [boarding pass]' : '') +
                (passenger ? ` [pax: ${passenger}]` : ''),
              )
            }
          }  // end for passengers

          // ── Create ONE Expense record (regardless of number of passengers) ─
          if (firstDocCreated) {
            const expenseTitle = isFlight && passengers.length > 1
              ? `${baseTitle} (${passengers.length} נוסעים)`
              : (isFlight && passengers[0] ? `${baseTitle} – ${passengers[0]}` : baseTitle)

            const { error: expenseError } = await supabase
              .from('expenses')
              .insert({
                trip_id:      tripId,
                title:        expenseTitle,
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
          }

          // ── Save to email_ingests for audit trail + dedup key ─────────────
          const rawText = htmlToText(emailContent).slice(0, 10000)
          const baseIngest = {
            user_id:      userId,
            from_address: msg.from,
            subject:      msg.subject,
            raw_text:     rawText,
            parsed_data:  parsedBooking,
            trip_id:      tripId,
            match_score:  100,
            match_reason: 'ייבוא ידני לטיול',
            status:       firstDocCreated ? 'processed' : 'matched',
            source:       'gmail_trip_import',
          }
          const { error: i1 } = await supabase.from('email_ingests')
            .insert({ ...baseIngest, gmail_message_id: msg.id })
          if (i1?.code === 'PGRST204' || i1?.message?.includes('gmail_message_id')) {
            await supabase.from('email_ingests').insert(baseIngest)
          }
        } catch (err) {
          console.error(`[gmailScanner/trip] DB write error for ${msg.id}:`, err)
        }
      }

      // ── PASS 3: Save borderline items as pending_review ───────────────────
      // These are emails with confidence 0.35–0.7 that match the trip destination
      // and date window. We save them to email_ingests and surface them to the user
      // so they can decide whether to add them manually.
      for (const { msg, parsedBooking, emailContent } of borderline) {
        try {
          const rawText = htmlToText(emailContent).slice(0, 10000)
          const borderlineBase = {
            user_id:      userId,
            from_address: msg.from,
            subject:      msg.subject,
            raw_text:     rawText,
            parsed_data:  parsedBooking,
            trip_id:      tripId,
            match_score:  Math.round(parsedBooking.confidence * 100),
            match_reason: 'ממתין לאישור משתמש',
            status:       'pending_review',
            source:       'gmail_trip_import',
          }
          let { data: ingestRecord, error: ingestError } = await supabase
            .from('email_ingests')
            .insert({ ...borderlineBase, gmail_message_id: msg.id })
            .select('id')
            .single()
          if (ingestError?.code === 'PGRST204' || ingestError?.message?.includes('gmail_message_id')) {
            const res = await supabase.from('email_ingests')
              .insert(borderlineBase).select('id').single()
            ingestRecord = res.data
            ingestError  = res.error
          }

          if (!ingestError && ingestRecord) {
            stats.pendingReview.push({
              ingestId:       ingestRecord.id,
              gmailMessageId: msg.id,
              subject:        msg.subject,
              from:           msg.from,
              date:           msg.date,
              summary:        parsedBooking.summary || `${parsedBooking.vendor} — ${parsedBooking.booking_type}`,
              bookingType:    parsedBooking.booking_type,
              vendor:         parsedBooking.vendor,
              confidence:     parsedBooking.confidence,
            })
            console.log(`[gmailScanner/trip] Saved pending_review: "${msg.subject}" (${parsedBooking.confidence})`)
          } else if (ingestError) {
            console.warn('[gmailScanner/trip] pending_review insert error:', ingestError.message)
          }
        } catch (err) {
          console.error(`[gmailScanner/trip] Error saving pending_review for ${msg.id}:`, err)
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[gmailScanner/trip] Error scanning ${conn.gmail_address}:`, errMsg)

      // Surface auth errors so the UI can show a reconnect prompt
      // rather than the misleading "no emails found" message
      const isAuthError =
        errMsg.includes('פג תוקף')      ||
        errMsg.includes('invalid_grant') ||
        errMsg.includes('Token refresh failed') ||
        errMsg.includes('401')           ||
        errMsg.includes('Unauthorized')
      if (isAuthError) {
        stats.connectionError = `חיבור Gmail ל-${conn.gmail_address} פג תוקף — יש להתחבר מחדש`
      }
    }
  }

  return stats
}
