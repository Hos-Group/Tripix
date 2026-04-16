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
    // English — booking confirmations
    'confirmation', 'confirmed', 'reservation', 'itinerary', 'e-ticket', 'eticket',
    'voucher', 'receipt', 'invoice', 'boarding', 'check-in', 'checkin',
    'booking', 'order', 'ticket', 'payment',
    // Hebrew
    'אישור', 'הזמנה', 'כרטיס', 'טיסה', 'קבלה', 'חשבונית', 'תשלום',
  ].join(' OR ')

  // ── Known booking / travel sender domains ────────────────────────────────
  // Claude filters marketing vs confirmations — we cast a wide net here
  const senderDomains = [
    // OTAs & meta-search
    'booking.com', 'airbnb.com', 'expedia.com', 'hotels.com', 'agoda.com',
    'priceline.com', 'tripadvisor.com', 'kayak.com', 'skyscanner.com',
    // Israeli hotels/agencies
    'isrotel.co.il', 'danhotels.com', 'fattal.co.il', 'atlas.co.il',
    'traveltalm.co.il', 'diesenhaus.com', 'superhotel.co.il',
    // Israeli airlines
    'elal.co.il', 'elal.com', 'arkia.com', 'israir.co.il',
    // International airlines
    'ryanair.com', 'easyjet.com', 'wizzair.com', 'flydubai.com',
    'emirates.com', 'united.com', 'delta.com', 'lufthansa.com', 'klm.com',
    'britishairways.com', 'airfrance.com', 'turkishairlines.com',
    'etihadairways.com', 'singaporeair.com', 'thaiairways.com',
    'bangkokair.com', 'lionair.co.th', 'airasia.com',
    'pegasusairlines.com', 'sunexpress.com', 'tui.com',
    // Ride-hailing / transfers
    'uber.com', 'gett.com', 'bolt.eu', 'lyft.com', 'yango.com',
    // Tours / activities
    'klook.com', 'viator.com', 'getyourguide.com',
    // Multi-platform
    'trip.com', 'kiwi.com', 'almosafer.com', 'last.co.il',
    // Hotels direct
    'marriott.com', 'hilton.com', 'ihg.com', 'hyatt.com',
    'accor.com', 'radissonhotels.com', 'bestwestern.com', 'wyndham.com',
    // Car rental
    'hertz.com', 'avis.com', 'sixt.com', 'europcar.com', 'budget.com', 'enterprise.com',
    // Insurance
    'harel.co.il', 'phoenix.co.il', 'migdal.co.il',
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

/**
 * Recursively extract the best available body from the payload tree.
 * Prefers text/html so booking emails retain their full visual design
 * (logos, colors, tables) when saved as HTML snapshots and rendered
 * in the document viewer. Claude handles HTML perfectly for parsing.
 */
function extractBody(payload: GmailMessagePayload): string {
  // Direct HTML part — best for display
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  // Plain text — only if no HTML available
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Walk multipart/* children — prefer HTML child over plain text child
  if (payload.parts?.length) {
    // Check for HTML first (richer, visual)
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data)

    // Fallback to plain text
    const plainPart = payload.parts.find(p => p.mimeType === 'text/plain')
    if (plainPart?.body?.data) return decodeBase64Url(plainPart.body.data)

    // Recurse into nested multipart (e.g. multipart/related inside multipart/alternative)
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

// ── Gmail profile (current historyId) ────────────────────────────────────────

/**
 * Fetch the current Gmail historyId for a user's account.
 * Use this after an initial full scan to record a starting point
 * for future incremental scans.
 */
export async function getCurrentHistoryId(accessToken: string): Promise<string | null> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const profile = await res.json() as { historyId?: string }
  return profile.historyId || null
}

// ── Gmail Push Notifications (watch / history) ───────────────────────────────

export interface GmailWatchResult {
  /** Starting historyId — store this and use as startHistoryId in getGmailHistory */
  historyId:  string
  /** Unix timestamp in milliseconds (as string) — watch expires at this time */
  expiration: string
}

/**
 * Register Gmail push notifications via Google Cloud Pub/Sub.
 * Must be called once per connected Gmail account and renewed every <7 days.
 *
 * Required environment variable:
 *   GMAIL_PUBSUB_TOPIC — e.g. "projects/my-gcp-project/topics/gmail-push"
 *
 * The Pub/Sub subscription push endpoint must be configured to:
 *   https://your-app.com/api/gmail/webhook?secret=GMAIL_WEBHOOK_SECRET
 */
export async function registerGmailWatch(
  accessToken: string,
): Promise<GmailWatchResult> {
  const topicName = process.env.GMAIL_PUBSUB_TOPIC
  if (!topicName) throw new Error('[gmailClient] GMAIL_PUBSUB_TOPIC not set')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName,
      // Only notify for INBOX changes (new emails)
      labelIds:            ['INBOX'],
      labelFilterBehavior: 'INCLUDE',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[gmailClient] watch registration failed (${res.status}): ${err}`)
  }

  return await res.json() as GmailWatchResult
}

/**
 * Stop Gmail push notifications for the authenticated user.
 * Call this when the user disconnects their Gmail account.
 */
export async function stopGmailWatch(accessToken: string): Promise<void> {
  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/stop', {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export interface GmailHistoryResult {
  /** Message IDs that were added to INBOX since startHistoryId */
  messageIds:      string[]
  /** The latest historyId — store this for the next incremental scan */
  latestHistoryId: string
}

/**
 * Fetch Gmail history changes (new INBOX messages) since a given historyId.
 * Use this in the webhook handler to get only the emails that arrived since
 * the last notification.
 *
 * @param accessToken    Valid Gmail access token
 * @param startHistoryId The historyId stored from the previous notification
 */
export async function getGmailHistory(
  accessToken:    string,
  startHistoryId: string,
): Promise<GmailHistoryResult> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history')
  url.searchParams.set('startHistoryId', startHistoryId)
  url.searchParams.set('historyTypes',   'messageAdded')
  url.searchParams.set('labelId',        'INBOX')
  url.searchParams.set('maxResults',     '50')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[gmailClient] history list failed (${res.status}): ${text}`)
  }

  const data = await res.json() as {
    history?:  Array<{ messagesAdded?: Array<{ message: { id: string } }> }>
    historyId?: string
  }

  const seen       = new Set<string>()
  const messageIds: string[] = []

  for (const item of data.history || []) {
    for (const added of item.messagesAdded || []) {
      const id = added.message.id
      if (!seen.has(id)) {
        seen.add(id)
        messageIds.push(id)
      }
    }
  }

  return {
    messageIds,
    latestHistoryId: data.historyId || startHistoryId,
  }
}

/**
 * Fetch lightweight metadata for a single message (subject, from, date, snippet).
 * Used in the webhook handler to check messages before full body fetch + Claude parse.
 */
export async function getMessageMetadata(
  accessToken: string,
  messageId:   string,
): Promise<GmailMessage | null> {
  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
  )
  url.searchParams.set('format',          'metadata')
  url.searchParams.set('metadataHeaders', 'Subject')
  url.searchParams.set('metadataHeaders', 'From')
  url.searchParams.set('metadataHeaders', 'Date')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return null

  const msg = await res.json() as GmailMessageResource
  const headers  = msg.payload?.headers || []
  const getHeader = (name: string) =>
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  return {
    id:      msg.id,
    snippet: msg.snippet || '',
    subject: getHeader('Subject'),
    from:    getHeader('From'),
    date:    getHeader('Date'),
  }
}

// ── PDF Attachment helpers ────────────────────────────────────────────────────

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
