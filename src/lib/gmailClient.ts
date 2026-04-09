/**
 * gmailClient.ts
 * Thin wrapper around the Gmail REST API.
 *
 * Functions:
 *   refreshAccessToken  — use refresh token to get a new access token
 *   searchBookingEmails — list message IDs matching booking-email query
 *   getEmailBody        — fetch and decode the plain-text body of a message
 *
 * Required environment variables (server-side only):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

export interface GmailMessage {
  id:      string
  snippet: string
  subject: string
  from:    string
  date:    string
}

interface GoogleRefreshResponse {
  access_token: string
  expires_in:   number
  token_type:   string
  error?:       string
}

interface GmailListResponse {
  messages?:           Array<{ id: string; threadId: string }>
  nextPageToken?:      string
  resultSizeEstimate?: number
}

interface GmailMessagePayload {
  partId?:   string
  mimeType?: string
  filename?: string
  headers?:  Array<{ name: string; value: string }>
  body?:     { attachmentId?: string; size?: number; data?: string }
  parts?:    GmailMessagePayload[]
}

interface GmailMessageResource {
  id:        string
  threadId:  string
  snippet:   string
  payload?:  GmailMessagePayload
  internalDate?: string
}

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * Exchange a refresh token for a fresh access token.
 * Returns the new access_token string.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('[gmailClient] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
    }),
  })

  const data = await res.json() as GoogleRefreshResponse
  if (data.error || !data.access_token) {
    throw new Error(`[gmailClient] Token refresh failed: ${data.error}`)
  }

  return data.access_token
}

// ── Search for booking emails ─────────────────────────────────────────────────

/**
 * Search the user's Gmail for booking confirmation emails.
 * Returns an array of lightweight message objects (id + metadata).
 *
 * @param accessToken  Valid Gmail access token
 * @param daysBack     How many days back to search (default 30)
 * @param maxResults   Max number of messages to return (default 50)
 * @param extraQuery   Optional extra Gmail search terms appended to the base query
 *                     e.g. "(bangkok OR thailand)" to narrow to a destination
 */
export async function searchBookingEmails(
  accessToken: string,
  daysBack     = 30,
  maxResults   = 50,
  extraQuery   = '',
): Promise<GmailMessage[]> {
  // ── Subject keywords for booking confirmations ───────────────────────────
  // Single words (not quoted) so partial matches work across all languages/formats
  const subjectTerms = [
    // English
    'confirmation', 'reservation', 'itinerary', 'e-ticket', 'eticket',
    'voucher', 'receipt', 'invoice', 'boarding', 'check-in', 'checkin',
    // Hebrew
    'אישור', 'הזמנה', 'כרטיס', 'טיסה', 'קבלה', 'חשבונית',
  ].join(' OR ')

  // ── Known booking / travel sender domains ────────────────────────────────
  // Claude filters marketing vs confirmations — we cast a wide net here
  const senderDomains = [
    // OTAs & hotels
    'booking.com', 'airbnb.com', 'expedia.com', 'hotels.com', 'agoda.com',
    'isrotel.co.il', 'danhotels.com', 'fattal.co.il', 'atlas.co.il',
    // Israeli airlines
    'elal.co.il', 'arkia.com', 'israir.co.il',
    // International airlines
    'ryanair.com', 'easyjet.com', 'wizzair.com', 'flydubai.com',
    'emirates.com', 'united.com', 'delta.com', 'lufthansa.com', 'klm.com',
    'britishairways.com', 'airfrance.com', 'turkishairlines.com',
    'etihadairways.com', 'singaporeair.com', 'thaiairways.com',
    // Ride-hailing
    'uber.com', 'gett.com', 'bolt.eu', 'lyft.com', 'yango.com',
    // Tours / activities
    'klook.com', 'viator.com', 'getyourguide.com',
    // Multi-platform
    'trip.com', 'kiwi.com', 'almosafer.com',
  ].map(d => `from:${d}`).join(' OR ')

  const queryParts = [
    // Subject keyword OR known travel domain — wide net, Claude does the filtering
    `(subject:(${subjectTerms}) OR (${senderDomains}))`,
    // Search ALL folders (inbox, sent, promotions, updates, social, drafts…)
    // but explicitly exclude Trash and Spam
    'in:anywhere',
    '-in:trash',
    '-in:spam',
    `newer_than:${daysBack}d`,
  ]
  // Destination terms are truly optional — just boost relevance, don't block
  if (extraQuery.trim()) queryParts.push(`(${extraQuery.trim()} OR has:attachment)`)
  const query = queryParts.join(' ')

  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  listUrl.searchParams.set('q', query)
  listUrl.searchParams.set('maxResults', String(maxResults))

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!listRes.ok) {
    const err = await listRes.text()
    throw new Error(`[gmailClient] List messages failed (${listRes.status}): ${err}`)
  }

  const listData = await listRes.json() as GmailListResponse
  const messageRefs = listData.messages || []

  if (!messageRefs.length) return []

  // Fetch metadata for each message in parallel (batched to avoid rate limits)
  const BATCH = 10
  const results: GmailMessage[] = []

  for (let i = 0; i < messageRefs.length; i += BATCH) {
    const batch = messageRefs.slice(i, i + BATCH)
    const fetched = await Promise.all(
      batch.map(async ({ id }) => {
        const metaUrl = new URL(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
        )
        metaUrl.searchParams.set('format', 'metadata')
        metaUrl.searchParams.set('metadataHeaders', 'Subject')
        metaUrl.searchParams.set('metadataHeaders', 'From')
        metaUrl.searchParams.set('metadataHeaders', 'Date')

        const r = await fetch(metaUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!r.ok) return null

        const msg = await r.json() as GmailMessageResource
        const headers = msg.payload?.headers || []
        const getHeader = (name: string) =>
          headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

        return {
          id:      msg.id,
          snippet: msg.snippet || '',
          subject: getHeader('Subject'),
          from:    getHeader('From'),
          date:    getHeader('Date'),
        } satisfies GmailMessage
      }),
    )

    for (const m of fetched) {
      if (m) results.push(m)
    }
  }

  return results
}

// ── Get full email body ───────────────────────────────────────────────────────

/**
 * Fetch and decode the full body of a Gmail message.
 * Prefers text/plain, falls back to text/html.
 *
 * @param accessToken  Valid Gmail access token
 * @param messageId    Gmail message ID
 * @returns decoded body string (may be HTML)
 */
export async function getEmailBody(
  accessToken: string,
  messageId:   string,
): Promise<string> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[gmailClient] Get message failed (${res.status}): ${err}`)
  }

  const msg = await res.json() as GmailMessageResource

  if (!msg.payload) return msg.snippet || ''

  // Recursively find the best body part
  const body = extractBody(msg.payload)
  return body
}

/** Recursively extract the best available text from the payload tree */
function extractBody(payload: GmailMessagePayload): string {
  // Prefer text/plain, accept text/html as fallback
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Walk parts
  if (payload.parts?.length) {
    // Try text/plain first
    const plainPart = payload.parts.find(p => p.mimeType === 'text/plain')
    if (plainPart?.body?.data) return decodeBase64Url(plainPart.body.data)

    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data)

    // Recurse into nested multipart
    for (const part of payload.parts) {
      const found = extractBody(part)
      if (found) return found
    }
  }

  return ''
}

/** Decode Gmail's URL-safe base64 encoding */
function decodeBase64Url(encoded: string): string {
  // Replace URL-safe chars back to standard base64
  const standard = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded   = standard + '=='.slice((standard.length % 4) || 4)
  return Buffer.from(padded, 'base64').toString('utf-8')
}

// ── PDF Attachment helpers ────────────────────────────────────────────────────

export interface EmailAttachment {
  filename:     string
  mimeType:     string
  attachmentId: string
  size:         number
}

/** Recursively walk a payload tree and collect all PDF parts */
function collectPdfParts(payload: GmailMessagePayload): EmailAttachment[] {
  const results: EmailAttachment[] = []

  const isPdf =
    payload.mimeType === 'application/pdf' ||
    (payload.filename?.toLowerCase().endsWith('.pdf') ?? false)

  if (isPdf && payload.body?.attachmentId) {
    results.push({
      filename:     payload.filename || 'attachment.pdf',
      mimeType:     payload.mimeType || 'application/pdf',
      attachmentId: payload.body.attachmentId,
      size:         payload.body.size || 0,
    })
  }

  for (const part of payload.parts || []) {
    results.push(...collectPdfParts(part))
  }

  return results
}

/**
 * List PDF attachments on a Gmail message.
 * Fetches the full message and walks the MIME tree.
 */
export async function getEmailAttachments(
  accessToken: string,
  messageId:   string,
): Promise<EmailAttachment[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[gmailClient] getEmailAttachments failed (${res.status}): ${err}`)
  }

  const msg = await res.json() as GmailMessageResource
  if (!msg.payload) return []

  return collectPdfParts(msg.payload)
}

/**
 * Download a specific Gmail attachment and return standard base64.
 * Gmail returns URL-safe base64; this converts it to standard base64
 * so it can be used directly with Claude's document API.
 */
export async function downloadAttachment(
  accessToken:  string,
  messageId:    string,
  attachmentId: string,
): Promise<string> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[gmailClient] downloadAttachment failed (${res.status}): ${err}`)
  }

  const data = await res.json() as { data: string; size: number }

  // Convert URL-safe base64 → standard base64
  return data.data.replace(/-/g, '+').replace(/_/g, '/')
}
