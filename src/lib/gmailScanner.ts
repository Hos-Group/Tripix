/**
 * gmailScanner.ts
 * Core Gmail scanning logic extracted from the /api/gmail/scan route.
 * Called by both the manual scan API route and the daily auto-scan cron route.
 *
 * Flow:
 *   1. Load gmail_connections for the user
 *   2. Refresh access token if expired / near expiry
 *   3. Search last 30 days for booking confirmation emails
 *   4. For each email:
 *      a. Fetch body text
 *      b. Check for PDF attachments
 *      c. Parse with Claude (PDF-preferred, body as fallback/merge)
 *      d. Match to user's trips
 *      e. Auto-create expense if confidence >= 0.7
 *   5. Return extended stats
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

/**
 * Scan Gmail for booking emails and auto-create expenses.
 *
 * @param supabase  Supabase admin client (service-role)
 * @param userId    UUID of the user whose Gmail to scan
 * @returns         Stats about what was scanned and created
 * @throws          Error string if a fatal problem occurs (caller handles HTTP response)
 */
export async function scanUserGmail(
  supabase: SupabaseClient,
  userId:   string,
): Promise<ScanStats> {
  // ── 1. Load Gmail connection ───────────────────────────────────────────────
  const { data: connection, error: connError } = await supabase
    .from('gmail_connections')
    .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single()

  if (connError || !connection) {
    throw new Error('לא נמצא חיבור Gmail — יש להתחבר תחילה')
  }

  const conn = connection as GmailConnection

  // ── 2. Refresh token if expired or within 5 minutes of expiry ─────────────
  let accessToken = conn.access_token
  if (conn.token_expiry) {
    const expiryMs  = new Date(conn.token_expiry).getTime()
    const bufferMs  = 5 * 60 * 1000
    const isExpired = Date.now() >= expiryMs - bufferMs

    if (isExpired) {
      if (!conn.refresh_token) {
        throw new Error('חיבור Gmail פג תוקף — יש להתחבר מחדש')
      }

      try {
        accessToken = await refreshAccessToken(conn.refresh_token)
        const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString()
        await supabase
          .from('gmail_connections')
          .update({ access_token: accessToken, token_expiry: newExpiry })
          .eq('id', conn.id)
      } catch (err) {
        console.error('[gmailScanner] Token refresh failed:', err)
        throw new Error('נכשל בחידוש הגישה ל-Gmail — יש להתחבר מחדש')
      }
    }
  }

  // ── 3. Fetch user's trips for matching ────────────────────────────────────
  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })

  // ── 4. Search Gmail ────────────────────────────────────────────────────────
  let messages: Awaited<ReturnType<typeof searchBookingEmails>> = []
  try {
    messages = await searchBookingEmails(accessToken, 30)
  } catch (err) {
    console.error('[gmailScanner] searchBookingEmails failed:', err)
    throw new Error('שגיאה בחיפוש ב-Gmail')
  }

  const stats: ScanStats = {
    scanned:          messages.length,
    parsed:           0,
    created:          0,
    scannedWithPDF:   0,
    scannedEmailOnly: 0,
  }

  // ── 5. Process each email ─────────────────────────────────────────────────
  for (const msg of messages) {
    try {
      // a. Fetch body
      let body = ''
      try {
        body = await getEmailBody(accessToken, msg.id)
      } catch (err) {
        console.warn(`[gmailScanner] Could not fetch body for ${msg.id}:`, err)
        continue
      }

      const emailContent = body || msg.snippet

      // b. Check for PDF attachments
      let pdfBase64: string | undefined
      try {
        const attachments = await getEmailAttachments(accessToken, msg.id)
        if (attachments.length > 0) {
          // Use the first (largest if multiple) PDF
          const pdf = attachments.sort((a, b) => b.size - a.size)[0]
          pdfBase64 = await downloadAttachment(accessToken, msg.id, pdf.attachmentId)
          stats.scannedWithPDF++
        } else {
          stats.scannedEmailOnly++
        }
      } catch (err) {
        console.warn(`[gmailScanner] Could not check attachments for ${msg.id}:`, err)
        stats.scannedEmailOnly++
      }

      // c. Parse with Claude (PDF preferred, body as fallback/merge)
      const parsedBooking = await parseBookingEmail(emailContent, msg.subject, pdfBase64)
      if (!parsedBooking) continue

      stats.parsed++

      // Skip low-confidence results
      if (parsedBooking.confidence < 0.7) continue

      // d. Match to trip
      let matchedTripId: string | null = null
      let matchScore    = 0
      let matchReason   = 'לא נותח'

      if (trips?.length) {
        const result = matchTripToBooking(parsedBooking, trips as TripRecord[])
        matchedTripId = result.trip?.id || null
        matchScore    = result.score
        matchReason   = result.reason
      }

      // e. Store ingest record
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
          source:       'gmail_scan',
        })
        .select('id')
        .single()

      // Auto-create expense if trip matched
      if (matchedTripId && ingestRecord) {
        const categoryMap: Record<string, string> = {
          hotel:      'hotel',
          flight:     'flight',
          car_rental: 'taxi',
          activity:   'activity',
          tour:       'activity',
          insurance:  'other',
          other:      'other',
        }
        const expenseCategory = categoryMap[parsedBooking.booking_type] || 'other'

        const expenseTitle =
          parsedBooking.hotel_name ||
          (parsedBooking.airline && parsedBooking.flight_number
            ? `${parsedBooking.airline} ${parsedBooking.flight_number}`
            : null) ||
          parsedBooking.summary ||
          parsedBooking.vendor ||
          msg.subject.slice(0, 60)

        const { data: expense } = await supabase
          .from('expenses')
          .insert({
            trip_id:         matchedTripId,
            user_id:         userId,
            title:           expenseTitle,
            amount:          parsedBooking.amount || 0,
            currency:        parsedBooking.currency || 'ILS',
            category:        expenseCategory,
            date:
              parsedBooking.check_in ||
              parsedBooking.departure_date ||
              new Date().toISOString().split('T')[0],
            notes: `מספר אישור: ${parsedBooking.confirmation_number}\nיובא אוטומטית מ-Gmail: ${msg.from}`,
            source:          'gmail_scan',
            email_ingest_id: ingestRecord.id,
          })
          .select('id')
          .single()

        if (expense) {
          await supabase
            .from('email_ingests')
            .update({ expense_id: expense.id, status: 'processed' })
            .eq('id', ingestRecord.id)
          stats.created++
        }
      }
    } catch (err) {
      console.error(`[gmailScanner] Error processing message ${msg.id}:`, err)
      // Continue with remaining messages
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
 * Scan Gmail specifically for emails related to a given trip.
 * Searches further back in time (up to 1 year) so that early bookings
 * made before the user registered are included.
 *
 * All found emails are force-matched to the specified trip (skipping the
 * normal matching algorithm), since the user explicitly requested import for
 * this trip.
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

  if (tripError || !trip) {
    throw new Error('טיול לא נמצא')
  }
  const t = trip as TripRow

  // ── 2. Load Gmail connection + refresh token if needed ────────────────────
  const { data: connection, error: connError } = await supabase
    .from('gmail_connections')
    .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single()

  if (connError || !connection) {
    throw new Error('לא נמצא חיבור Gmail — יש לחבר Gmail תחילה')
  }

  const conn = connection as GmailConnection
  let accessToken = conn.access_token

  if (conn.token_expiry) {
    const expiryMs  = new Date(conn.token_expiry).getTime()
    const bufferMs  = 5 * 60 * 1000
    if (Date.now() >= expiryMs - bufferMs) {
      if (!conn.refresh_token) throw new Error('חיבור Gmail פג תוקף — יש להתחבר מחדש')
      accessToken = await refreshAccessToken(conn.refresh_token)
      const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString()
      await supabase
        .from('gmail_connections')
        .update({ access_token: accessToken, token_expiry: newExpiry })
        .eq('id', conn.id)
    }
  }

  // ── 3. Compute search range ───────────────────────────────────────────────
  // Search from 90 days before trip start (early bookings) to today
  const tripStartMs   = new Date(t.start_date).getTime()
  const daysToStart   = Math.ceil((Date.now() - tripStartMs) / 86400000)
  const daysSearched  = Math.min(daysToStart + 90, 365) // max 1 year

  // ── 4. Build destination search keywords ─────────────────────────────────
  // Split "Bangkok, Thailand" → "(bangkok OR thailand)"
  const destParts = t.destination
    .toLowerCase()
    .replace(/[,،]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4) // max 4 keywords to keep query sane

  const destQuery = destParts.length
    ? `(${destParts.join(' OR ')})`
    : ''

  // ── 5. Search Gmail ────────────────────────────────────────────────────────
  let messages: Awaited<ReturnType<typeof searchBookingEmails>> = []
  try {
    messages = await searchBookingEmails(accessToken, daysSearched, 100, destQuery)
  } catch (err) {
    console.error('[gmailScanner/trip] searchBookingEmails failed:', err)
    throw new Error('שגיאה בחיפוש ב-Gmail')
  }

  const stats: TripScanStats = {
    tripId:           t.id,
    tripName:         t.name,
    destination:      t.destination,
    daysSearched,
    scanned:          messages.length,
    parsed:           0,
    created:          0,
    scannedWithPDF:   0,
    scannedEmailOnly: 0,
  }

  // ── 6. Process each email ─────────────────────────────────────────────────
  for (const msg of messages) {
    try {
      // Fetch body
      let body = ''
      try {
        body = await getEmailBody(accessToken, msg.id)
      } catch {
        continue
      }
      const emailContent = body || msg.snippet

      // PDF attachments
      let pdfBase64: string | undefined
      try {
        const attachments = await getEmailAttachments(accessToken, msg.id)
        if (attachments.length > 0) {
          const pdf = attachments.sort((a, b) => b.size - a.size)[0]
          pdfBase64 = await downloadAttachment(accessToken, msg.id, pdf.attachmentId)
          stats.scannedWithPDF++
        } else {
          stats.scannedEmailOnly++
        }
      } catch {
        stats.scannedEmailOnly++
      }

      // Parse with Claude
      const parsedBooking = await parseBookingEmail(emailContent, msg.subject, pdfBase64)
      if (!parsedBooking) continue
      stats.parsed++

      // Lower confidence threshold for trip-specific scan (user explicitly requested)
      if (parsedBooking.confidence < 0.5) continue

      // Check for duplicate (same confirmation number for this trip)
      if (parsedBooking.confirmation_number && parsedBooking.confirmation_number !== 'N/A') {
        const { data: existing } = await supabase
          .from('email_ingests')
          .select('id')
          .eq('trip_id', tripId)
          .contains('parsed_data', { confirmation_number: parsedBooking.confirmation_number })
          .maybeSingle()
        if (existing) continue // already imported
      }

      // Store ingest record — force-matched to the trip
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
          trip_id:      tripId,
          match_score:  100,
          match_reason: 'ייבוא ידני לטיול',
          status:       'matched',
          source:       'gmail_trip_import',
        })
        .select('id')
        .single()

      // Auto-create expense
      if (ingestRecord) {
        const categoryMap: Record<string, string> = {
          hotel: 'hotel', flight: 'flight', car_rental: 'taxi',
          activity: 'activity', tour: 'activity', insurance: 'other', other: 'other',
        }
        const expenseTitle =
          parsedBooking.hotel_name ||
          (parsedBooking.airline && parsedBooking.flight_number
            ? `${parsedBooking.airline} ${parsedBooking.flight_number}`
            : null) ||
          parsedBooking.summary ||
          parsedBooking.vendor ||
          msg.subject.slice(0, 60)

        const { data: expense } = await supabase
          .from('expenses')
          .insert({
            trip_id:         tripId,
            user_id:         userId,
            title:           expenseTitle,
            amount:          parsedBooking.amount || 0,
            currency:        parsedBooking.currency || 'ILS',
            category:        categoryMap[parsedBooking.booking_type] || 'other',
            date:
              parsedBooking.check_in ||
              parsedBooking.departure_date ||
              t.start_date,
            notes: `מספר אישור: ${parsedBooking.confirmation_number}\nייובא מ-Gmail: ${msg.from}`,
            source:          'gmail_trip_import',
            email_ingest_id: ingestRecord.id,
          })
          .select('id')
          .single()

        if (expense) {
          await supabase
            .from('email_ingests')
            .update({ expense_id: expense.id, status: 'processed' })
            .eq('id', ingestRecord.id)
          stats.created++
        }
      }
    } catch (err) {
      console.error(`[gmailScanner/trip] Error processing ${msg.id}:`, err)
    }
  }

  return stats
}
