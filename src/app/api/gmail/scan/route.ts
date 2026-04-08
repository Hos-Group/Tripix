/**
 * POST /api/gmail/scan
 *
 * Scans the user's Gmail inbox for booking confirmation emails,
 * parses them with Claude, and auto-creates expenses in matching trips.
 *
 * Flow:
 *   1. Authenticate user via Bearer token
 *   2. Load gmail_connections row for the user
 *   3. Refresh access token if expired
 *   4. Search last 30 days for booking emails
 *   5. For each email: extract body → parseBookingEmail()
 *   6. If confidence >= 0.7: matchTripToBooking() → auto-create expense
 *   7. Return { scanned, parsed, created }
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshAccessToken, searchBookingEmails, getEmailBody } from '@/lib/gmailClient'
import { parseBookingEmail, htmlToText } from '@/lib/emailParser'
import { matchTripToBooking, TripRecord } from '@/lib/tripMatcher'

// ── Supabase admin client ─────────────────────────────────────────────────────
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface GmailConnection {
  id:            string
  user_id:       string
  gmail_address: string
  access_token:  string
  refresh_token: string | null
  token_expiry:  string | null
}

export async function POST(req: NextRequest) {
  // ── Auth: resolve user from Bearer token ──────────────────────────────────
  const authHeader = req.headers.get('authorization') || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!bearerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id

  // ── Load Gmail connection ─────────────────────────────────────────────────
  const { data: connection, error: connError } = await supabase
    .from('gmail_connections')
    .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single()

  if (connError || !connection) {
    return NextResponse.json(
      { error: 'לא נמצא חיבור Gmail — יש להתחבר תחילה' },
      { status: 404 },
    )
  }

  const conn = connection as GmailConnection

  // ── Refresh token if expired (or within 5 minutes of expiry) ─────────────
  let accessToken = conn.access_token
  if (conn.token_expiry) {
    const expiryMs  = new Date(conn.token_expiry).getTime()
    const bufferMs  = 5 * 60 * 1000  // 5 minutes
    const isExpired = Date.now() >= expiryMs - bufferMs

    if (isExpired) {
      if (!conn.refresh_token) {
        return NextResponse.json(
          { error: 'חיבור Gmail פג תוקף — יש להתחבר מחדש' },
          { status: 401 },
        )
      }

      try {
        accessToken = await refreshAccessToken(conn.refresh_token)

        // Persist new access token + updated expiry (1 hour from now)
        const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString()
        await supabase
          .from('gmail_connections')
          .update({ access_token: accessToken, token_expiry: newExpiry })
          .eq('id', conn.id)
      } catch (err) {
        console.error('[gmail/scan] Token refresh failed:', err)
        return NextResponse.json(
          { error: 'נכשל בחידוש הגישה ל-Gmail — יש להתחבר מחדש' },
          { status: 401 },
        )
      }
    }
  }

  // ── Fetch user's trips for matching ───────────────────────────────────────
  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })

  // ── Search Gmail for booking emails ──────────────────────────────────────
  let messages: Awaited<ReturnType<typeof searchBookingEmails>> = []
  try {
    messages = await searchBookingEmails(accessToken, 30)
  } catch (err) {
    console.error('[gmail/scan] searchBookingEmails failed:', err)
    return NextResponse.json({ error: 'שגיאה בחיפוש ב-Gmail' }, { status: 502 })
  }

  const scanned = messages.length
  let parsed    = 0
  let created   = 0

  // ── Process each email ────────────────────────────────────────────────────
  for (const msg of messages) {
    try {
      // Fetch full body
      let body = ''
      try {
        body = await getEmailBody(accessToken, msg.id)
      } catch (err) {
        console.warn(`[gmail/scan] Could not fetch body for ${msg.id}:`, err)
        continue
      }

      const emailContent = body || msg.snippet

      // Parse with Claude
      const parsedBooking = await parseBookingEmail(emailContent, msg.subject)
      if (!parsedBooking) continue

      parsed++

      // Skip low-confidence results
      if (parsedBooking.confidence < 0.7) continue

      // Match to trip
      let matchedTripId: string | null = null
      let matchScore    = 0
      let matchReason   = 'לא נותח'

      if (trips?.length) {
        const result = matchTripToBooking(parsedBooking, trips as TripRecord[])
        matchedTripId = result.trip?.id || null
        matchScore    = result.score
        matchReason   = result.reason
      }

      // Store ingest record
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
          created++
        }
      }
    } catch (err) {
      console.error(`[gmail/scan] Error processing message ${msg.id}:`, err)
      // Continue with remaining messages
    }
  }

  return NextResponse.json({ scanned, parsed, created })
}
