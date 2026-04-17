/**
 * microsoftScanner.ts
 * Outlook / Hotmail / Live email scanning via Microsoft Graph API.
 *
 * Mirrors gmailScanner.ts but uses Graph API instead of Gmail API.
 * Called by /api/microsoft/scan and /api/microsoft/auto-scan.
 *
 * Flow (per account):
 *   1. Load microsoft_connections for the user
 *   2. Refresh access token if expired
 *   3. Search last 30 days for booking confirmation emails
 *   4. For each email: parse with Claude (body + attachments)
 *   5. Match to trip, auto-create expense + document
 *   6. Return aggregated stats
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  parseBookingEmail,
  quickPreFilter,
  isKnownBookingSender,
  htmlToText,
  ParsedBooking,
} from './emailParser'
import { matchTripToBooking, TripRecord } from './tripMatcher'

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const clientId     = process.env.MICROSOFT_CLIENT_ID!
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         'offline_access Mail.Read User.Read',
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Token refresh failed: ${data.error} — ${data.error_description}`)
  return data
}

// ── Graph API helpers ─────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

async function graphGet(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string } }
    throw new Error(`Graph API error ${res.status}: ${err?.error?.code} — ${err?.error?.message}`)
  }
  return res.json()
}

interface GraphMessage {
  id:           string
  subject:      string
  from?:        { emailAddress?: { address?: string; name?: string } }
  receivedDateTime: string
  body?:        { contentType?: string; content?: string }
  hasAttachments?: boolean
}

interface GraphAttachment {
  id:            string
  name:          string
  contentType:   string
  contentBytes?: string  // base64 — only present on FileAttachment
  '@odata.type': string
}

/** Search Outlook for booking-related emails in the last 30 days */
async function searchBookingEmails(
  accessToken: string,
  searchQuery: string,
): Promise<GraphMessage[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Graph API: search across all folders using $search (works like Gmail's in:anywhere)
  // KQL: subject search + date filter
  const encodedQuery = encodeURIComponent(`"${searchQuery}" received>=${since.slice(0, 10)}`)

  try {
    const data = await graphGet(
      `/me/messages?$search=${encodedQuery}&$select=id,subject,from,receivedDateTime,body,hasAttachments&$top=50&$orderby=receivedDateTime+desc`,
      accessToken,
    ) as { value?: GraphMessage[] }
    return data.value || []
  } catch {
    // Fallback: search without $search, filter by date only
    const filter = encodeURIComponent(`receivedDateTime ge ${since}`)
    try {
      const data = await graphGet(
        `/me/messages?$filter=${filter}&$select=id,subject,from,receivedDateTime,body,hasAttachments&$top=100&$orderby=receivedDateTime+desc`,
        accessToken,
      ) as { value?: GraphMessage[] }
      return data.value || []
    } catch {
      return []
    }
  }
}

/** Download attachment bytes from Graph API */
async function getAttachmentContent(
  accessToken: string,
  messageId:   string,
  attachId:    string,
): Promise<Buffer | null> {
  try {
    const attachment = await graphGet(
      `/me/messages/${messageId}/attachments/${attachId}`,
      accessToken,
    ) as GraphAttachment

    if (attachment.contentBytes) {
      return Buffer.from(attachment.contentBytes, 'base64')
    }
    return null
  } catch {
    return null
  }
}

/** Fetch all attachments for a message */
async function getMessageAttachments(
  accessToken: string,
  messageId:   string,
): Promise<GraphAttachment[]> {
  try {
    const data = await graphGet(
      `/me/messages/${messageId}/attachments?$select=id,name,contentType,contentBytes`,
      accessToken,
    ) as { value?: GraphAttachment[] }
    return data.value || []
  } catch {
    return []
  }
}

// ── Main scanner ──────────────────────────────────────────────────────────────

export interface MicrosoftScanStats {
  scanned:          number
  parsed:           number
  created:          number
  scannedWithPDF:   number
  scannedEmailOnly: number
  revokedAccounts?: string[]
  scanError?:       string
}

interface MicrosoftConnection {
  id:            string
  user_id:       string
  email:         string
  access_token:  string
  refresh_token: string | null
  token_expiry:  string | null
  needs_reauth:  boolean
}

interface TripRow {
  id:         string
  name:       string
  destination: string
  start_date: string
  end_date:   string
  cities?:    string[]
  travelers?: Array<{ name: string; passport?: string }>
  businessInfo?: { companyName?: string }
}

const BOOKING_KEYWORDS = [
  'confirmation', 'booking', 'reservation', 'itinerary', 'ticket',
  'check-in', 'check in', 'hotel', 'flight', 'airline', 'rental',
  'receipt', 'invoice', 'order', 'booking.com', 'airbnb', 'expedia',
  'אישור הזמנה', 'הזמנה', 'כרטיס', 'מלון', 'טיסה',
]

function isLikelyBookingEmail(subject: string, fromAddress: string): boolean {
  const lower = subject.toLowerCase()
  const from  = fromAddress.toLowerCase()

  if (isKnownBookingSender(from)) return true
  return BOOKING_KEYWORDS.some(kw => lower.includes(kw))
}

export async function scanUserMicrosoft(
  supabase: SupabaseClient,
  userId:   string,
): Promise<MicrosoftScanStats> {
  const stats: MicrosoftScanStats = {
    scanned: 0, parsed: 0, created: 0,
    scannedWithPDF: 0, scannedEmailOnly: 0,
  }

  // ── Load connections ──────────────────────────────────────────────────────
  const { data: connections, error: connErr } = await supabase
    .from('microsoft_connections')
    .select('id, user_id, email, access_token, refresh_token, token_expiry, needs_reauth')
    .eq('user_id', userId)

  if (connErr || !connections?.length) {
    return stats
  }

  // Skip all-revoked
  const revokedUpfront = (connections as MicrosoftConnection[]).filter(c => c.needs_reauth)
  if (revokedUpfront.length === connections.length) {
    const addrs = revokedUpfront.map(c => c.email).join(', ')
    return {
      ...stats,
      revokedAccounts: revokedUpfront.map(c => c.email),
      scanError: `חיבור Outlook ל-${addrs} פג תוקף — יש להתחבר מחדש`,
    }
  }

  // ── Fetch trips ───────────────────────────────────────────────────────────
  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, cities, travelers, business_info')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(10)

  if (!trips?.length) return stats

  // ── Scan each account ─────────────────────────────────────────────────────
  for (const conn of connections as MicrosoftConnection[]) {
    if (conn.needs_reauth) continue

    let accessToken = conn.access_token

    // ── Refresh token if expired or near expiry ───────────────────────────
    const expiry = conn.token_expiry ? new Date(conn.token_expiry).getTime() : 0
    if (expiry < Date.now() + 5 * 60 * 1000) {
      if (!conn.refresh_token) {
        console.warn(`[microsoftScanner] No refresh token for ${conn.email}`)
        continue
      }
      try {
        const refreshed = await refreshAccessToken(conn.refresh_token)
        accessToken = refreshed.access_token
        const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        await supabase
          .from('microsoft_connections')
          .update({
            access_token:  refreshed.access_token,
            refresh_token: refreshed.refresh_token || conn.refresh_token,
            token_expiry:  newExpiry,
          })
          .eq('id', conn.id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('invalid_grant') || msg.toLowerCase().includes('expired')) {
          try {
            await supabase.from('microsoft_connections').update({ needs_reauth: true }).eq('id', conn.id)
          } catch { /* non-fatal */ }
          if (!stats.revokedAccounts) stats.revokedAccounts = []
          stats.revokedAccounts.push(conn.email)
          stats.scanError = `חיבור Outlook ל-${conn.email} פג תוקף — יש להתחבר מחדש`
        }
        continue
      }
    }

    try {
      // Scan all trips
      for (const trip of trips as TripRow[]) {
        const searchQuery = trip.destination.split(/[\s,]+/)[0] || 'booking confirmation'
        const messages = await searchBookingEmails(accessToken, searchQuery)

        for (const msg of messages) {
          const subject     = msg.subject || ''
          const fromAddress = msg.from?.emailAddress?.address || ''

          if (!isLikelyBookingEmail(subject, fromAddress)) continue
          if (!quickPreFilter(subject, fromAddress, '')) continue

          stats.scanned++

          // ── Check deduplification ────────────────────────────────────────
          const { data: existing } = await supabase
            .from('documents')
            .select('id')
            .eq('trip_id', trip.id)
            .eq('gmail_message_id', `ms_${msg.id}`)
            .maybeSingle()
          if (existing) continue

          // ── Get email body ───────────────────────────────────────────────
          const bodyContent = msg.body?.content || ''
          const bodyText    = msg.body?.contentType === 'html'
            ? htmlToText(bodyContent)
            : bodyContent

          // ── Get PDF attachments ──────────────────────────────────────────
          let pdfBuffers: Buffer[] = []
          if (msg.hasAttachments) {
            const attachments = await getMessageAttachments(accessToken, msg.id)
            for (const att of attachments) {
              if (att.contentType === 'application/pdf') {
                const buf = await getAttachmentContent(accessToken, msg.id, att.id)
                if (buf) pdfBuffers.push(buf)
              }
            }
          }

          const hasPDF = pdfBuffers.length > 0
          if (hasPDF) stats.scannedWithPDF++
          else stats.scannedEmailOnly++

          // ── Parse with Claude ────────────────────────────────────────────
          const pdfBase64 = hasPDF && pdfBuffers.length > 0
            ? pdfBuffers[0].toString('base64')
            : undefined
          const parsed: ParsedBooking | null = await parseBookingEmail(
            bodyContent || bodyText,
            subject,
            pdfBase64,
          )

          if (!parsed || parsed.confidence < 0.5) continue
          stats.parsed++

          // ── Match to trip ────────────────────────────────────────────────
          const tripRecords: TripRecord[] = trips.map(t => ({
            id:          t.id,
            name:        t.name,
            destination: t.destination,
            start_date:  t.start_date,
            end_date:    t.end_date,
          }))
          const matchResult = matchTripToBooking(parsed, tripRecords)
          if (!matchResult.trip || matchResult.score < 50) continue

          const matchedTripId = matchResult.trip.id

          // ── Build document name ──────────────────────────────────────────
          const bookingTitle =
            parsed.hotel_name ||
            (parsed.airline && parsed.flight_number
              ? `${parsed.airline} ${parsed.flight_number}` : null) ||
            parsed.summary || parsed.vendor || subject.slice(0, 60)

          const DOC_TYPE_MAP: Record<string, string> = {
            hotel: 'hotel', flight: 'flight', car_rental: 'other',
            activity: 'activity', tour: 'activity', insurance: 'insurance',
            ferry: 'ferry', train: 'other', other: 'other',
          }

          // ── Insert document ──────────────────────────────────────────────
          const { error: docErr } = await supabase.from('documents').insert({
            trip_id:         matchedTripId,
            user_id:         userId,
            name:            bookingTitle,
            doc_type:        DOC_TYPE_MAP[parsed.booking_type] || 'other',
            file_url:        null,
            file_type:       'email',
            extracted_data:  parsed,
            booking_ref:     parsed.confirmation_number || null,
            flight_number:   parsed.flight_number || null,
            valid_from:      parsed.check_in || parsed.departure_date || null,
            valid_until:     parsed.check_out || parsed.return_date || null,
            notes:           `מ: ${fromAddress}\nנושא: ${subject}`,
            gmail_message_id: `ms_${msg.id}`,   // prefix to distinguish from Gmail IDs
          })

          if (docErr) {
            if (docErr.code === '23505') continue // duplicate — race condition
            console.error('[microsoftScanner] doc insert error:', docErr.message)
            continue
          }

          // ── Insert expense ───────────────────────────────────────────────
          const CATEGORY_MAP: Record<string, string> = {
            hotel: 'hotel', flight: 'flight', car_rental: 'car_rental',
            activity: 'activity', tour: 'activity', insurance: 'insurance',
            ferry: 'ferry', train: 'train', other: 'other',
          }
          await supabase.from('expenses').insert({
            trip_id:      matchedTripId,
            user_id:      userId,
            title:        bookingTitle,
            amount:       parsed.amount || 0,
            currency:     parsed.currency || 'ILS',
            amount_ils:   parsed.amount || 0,
            category:     CATEGORY_MAP[parsed.booking_type] || 'other',
            expense_date: parsed.check_in || parsed.departure_date || new Date().toISOString().split('T')[0],
            notes:        `מספר אישור: ${parsed.confirmation_number || '—'}\nמ: ${fromAddress}`,
            source:       'scan',
            is_paid:      true,
          })

          stats.created++
          console.log(
            `[microsoftScanner] ✓ created doc="${bookingTitle}" ` +
            `trip=${matchedTripId} conf=${parsed.confidence}`,
          )
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('invalid_grant') || msg.toLowerCase().includes('expired')) {
        try {
          await supabase.from('microsoft_connections').update({ needs_reauth: true }).eq('id', conn.id)
        } catch { /* non-fatal */ }
        if (!stats.revokedAccounts) stats.revokedAccounts = []
        stats.revokedAccounts.push(conn.email)
        stats.scanError = `חיבור Outlook ל-${conn.email} פג תוקף — יש להתחבר מחדש`
      } else {
        stats.scanError = msg
      }
    }
  }

  return stats
}
