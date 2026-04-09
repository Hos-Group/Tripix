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
import { parseBookingEmail, htmlToText } from './emailParser'
import { matchTripToBooking, TripRecord } from './tripMatcher'

export interface ScanStats {
  scanned:          number
  parsed:           number
  created:          number
  scannedWithPDF:   number
  scannedEmailOnly: number
}

export interface TripScanStats extends ScanStats {
  tripId:       string
  tripName:     string
  destination:  string
  daysSearched: number
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

  // ── 4. Build destination keywords with English transliterations ───────────
  const destParts = t.destination
    .toLowerCase().replace(/[,،]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2).slice(0, 6)
  // Map common Hebrew destination names to English equivalents
  const heToEn: Record<string, string[]> = {
    'תאילנד': ['thailand', 'thai'], 'פוקט': ['phuket'],
    'בנגקוק': ['bangkok', 'bkk'],   'קוסמוי': ['samui'],
    'קוסאמוי': ['samui', 'koh samui'], 'צ\'אנג': ['chiang mai'],
    'ישראל': ['israel'], 'פריז': ['paris'], 'לונדון': ['london'],
    'ניו': ['new york'], 'יורק': ['new york'], 'ברצלונה': ['barcelona'],
    'רומא': ['rome', 'roma'], 'אמסטרדם': ['amsterdam'],
  }
  const extraTerms: string[] = [...destParts]
  for (const [heb, eng] of Object.entries(heToEn)) {
    if (t.destination.includes(heb)) extraTerms.push(...eng)
  }
  const destQuery = extraTerms.length ? extraTerms.join(' OR ') : ''

  const stats: TripScanStats = {
    tripId: t.id, tripName: t.name, destination: t.destination, daysSearched,
    scanned: 0, parsed: 0, created: 0, scannedWithPDF: 0, scannedEmailOnly: 0,
  }

  // ── 5. Scan each connected Gmail account ─────────────────────────────────
  for (const conn of connections as GmailConnection[]) {
    try {
      const accessToken = await getValidToken(supabase, conn)
      const messages = await searchBookingEmails(accessToken, daysSearched, 15, destQuery)
      stats.scanned += messages.length
      console.log(`[gmailScanner/trip] ${conn.gmail_address}: ${messages.length} messages for trip ${t.name}`)

      // Use processMessages with forceTripId — but we need deduplication here
      // so we process inline with a confidence threshold of 0.5
      for (const msg of messages) {
        try {
          let body = ''
          try { body = await getEmailBody(accessToken, msg.id) } catch { continue }
          const emailContent = body || msg.snippet

          let pdfBase64: string | undefined
          try {
            const atts = await getEmailAttachments(accessToken, msg.id)
            if (atts.length > 0) {
              const pdf = atts.sort((a, b) => b.size - a.size)[0]
              pdfBase64 = await downloadAttachment(accessToken, msg.id, pdf.attachmentId)
              stats.scannedWithPDF++
            } else { stats.scannedEmailOnly++ }
          } catch { stats.scannedEmailOnly++ }

          const parsedBooking = await parseBookingEmail(emailContent, msg.subject, pdfBase64)
          if (!parsedBooking) continue
          stats.parsed++
          if (parsedBooking.confidence < 0.5) continue

          // Deduplication by confirmation number
          if (parsedBooking.confirmation_number && parsedBooking.confirmation_number !== 'N/A') {
            const { data: existing } = await supabase
              .from('email_ingests').select('id')
              .eq('trip_id', tripId)
              .contains('parsed_data', { confirmation_number: parsedBooking.confirmation_number })
              .maybeSingle()
            if (existing) continue
          }

          const rawText = htmlToText(emailContent).slice(0, 10000)
          const { data: ingestRecord } = await supabase
            .from('email_ingests')
            .insert({
              user_id: userId, from_address: msg.from, subject: msg.subject,
              raw_html: null, raw_text: rawText, parsed_data: parsedBooking,
              trip_id: tripId, match_score: 100, match_reason: 'ייבוא ידני לטיול',
              status: 'matched', source: 'gmail_trip_import',
            })
            .select('id').single()

          if (ingestRecord) {
            const categoryMap: Record<string, string> = {
              hotel: 'hotel', flight: 'flight', car_rental: 'taxi',
              activity: 'activity', tour: 'activity', insurance: 'other', other: 'other',
            }
            const expenseTitle =
              parsedBooking.hotel_name ||
              (parsedBooking.airline && parsedBooking.flight_number
                ? `${parsedBooking.airline} ${parsedBooking.flight_number}` : null) ||
              parsedBooking.summary || parsedBooking.vendor || msg.subject.slice(0, 60)

            const { data: expense, error: expenseError } = await supabase.from('expenses').insert({
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
            }).select('id').single()

            if (expenseError) {
              console.error('[gmailScanner/trip] Expense insert error:', expenseError)
            }

            if (expense) {
              // Best-effort: link email_ingest → expense (column may not exist on all deployments)
              await supabase.from('email_ingests')
                .update({ expense_id: expense.id, status: 'processed' })
                .eq('id', ingestRecord.id)
              stats.created++
            }
          }
        } catch (err) {
          console.error(`[gmailScanner/trip] Error processing ${msg.id}:`, err)
        }
      }
    } catch (err) {
      console.error(`[gmailScanner/trip] Error scanning ${conn.gmail_address}:`, err)
    }
  }

  return stats
}
