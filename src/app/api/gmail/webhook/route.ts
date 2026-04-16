/**
 * POST /api/gmail/webhook
 *
 * Google Cloud Pub/Sub push endpoint for Gmail push notifications.
 *
 * When a new email arrives in a connected Gmail inbox, Google calls this
 * endpoint with a Pub/Sub message containing the Gmail address and a
 * historyId.  We then:
 *   1. Verify the request secret (query param)
 *   2. Decode the Pub/Sub envelope
 *   3. Look up the gmail_connections row for that address
 *   4. Call Gmail History API to get the new message IDs since our last historyId
 *   5. Run scanPushMessages → pre-filter → Claude parse → expense creation
 *   6. Update stored historyId for the next notification
 *   7. Always return 200 (Pub/Sub retries on non-2xx)
 *
 * Setup in Google Cloud Console:
 *   • Create a Pub/Sub topic:  projects/{proj}/topics/gmail-push
 *   • Create a push subscription pointing to:
 *       https://your-app.com/api/gmail/webhook?secret=GMAIL_WEBHOOK_SECRET
 *   • Set ack deadline to 60 seconds
 *   • Grant gmail-api-push@system.gserviceaccount.com the "Pub/Sub Publisher" role on the topic
 *
 * Required environment variables:
 *   GMAIL_WEBHOOK_SECRET       — random secret shared with GCP push URL
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getGmailHistory } from '@/lib/gmailClient'
import { scanPushMessages, GmailConnectionRow } from '@/lib/gmailScanner'

// Allow up to 60 seconds — Claude parsing can take time
export const maxDuration = 60

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface PubSubMessage {
  data:        string   // base64-encoded JSON
  messageId:   string
  publishTime: string
  attributes?: Record<string, string>
}

interface PubSubEnvelope {
  message:      PubSubMessage
  subscription: string
}

interface GmailPushPayload {
  emailAddress: string
  historyId:    number | string
}

export async function POST(req: NextRequest) {
  // ── 1. Verify webhook secret ──────────────────────────────────────────────
  const secret = process.env.GMAIL_WEBHOOK_SECRET
  if (secret) {
    const querySecret = req.nextUrl.searchParams.get('secret')
    if (querySecret !== secret) {
      console.warn('[gmail/webhook] Invalid secret — ignoring')
      // Return 200 so Pub/Sub doesn't retry (it's not a transient error)
      return NextResponse.json({ ignored: true })
    }
  }

  // ── 2. Parse the Pub/Sub envelope ─────────────────────────────────────────
  let envelope: PubSubEnvelope
  try {
    envelope = await req.json() as PubSubEnvelope
  } catch {
    console.warn('[gmail/webhook] Invalid JSON body')
    return NextResponse.json({ ignored: true })
  }

  // ── 3. Decode base64 data payload ─────────────────────────────────────────
  let payload: GmailPushPayload
  try {
    const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf-8')
    payload       = JSON.parse(decoded) as GmailPushPayload
  } catch {
    console.warn('[gmail/webhook] Cannot decode Pub/Sub payload:', envelope.message.data)
    return NextResponse.json({ ignored: true })
  }

  const { emailAddress, historyId: notificationHistoryId } = payload
  if (!emailAddress || !notificationHistoryId) {
    return NextResponse.json({ ignored: true })
  }

  console.log(
    `[gmail/webhook] Notification for ${emailAddress}, historyId=${notificationHistoryId}`,
  )

  const supabase = adminClient()

  // ── 4. Look up the gmail_connections row ─────────────────────────────────
  const { data: conn, error: connErr } = await supabase
    .from('gmail_connections')
    .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry, history_id')
    .eq('gmail_address', emailAddress.toLowerCase())
    .maybeSingle()

  if (connErr || !conn) {
    console.warn(`[gmail/webhook] No connection found for ${emailAddress}`)
    return NextResponse.json({ ignored: true })
  }

  // ── 5. Get new message IDs via Gmail History API ──────────────────────────
  // Use our stored history_id as the start point.
  // If we've never seen a historyId (just connected), use the notification's id minus 1
  // so we catch anything that arrived right at connection time.
  const storedHistoryId = conn.history_id || String(Number(notificationHistoryId) - 1)

  let newMessageIds: string[] = []
  let latestHistoryId = String(notificationHistoryId)

  try {
    const { data: connFull } = await supabase
      .from('gmail_connections')
      .select('access_token, refresh_token, token_expiry')
      .eq('id', conn.id)
      .single()

    const fullConn: GmailConnectionRow = {
      id:            conn.id,
      user_id:       conn.user_id,
      gmail_address: conn.gmail_address,
      access_token:  connFull?.access_token  || conn.access_token,
      refresh_token: connFull?.refresh_token || null,
      token_expiry:  connFull?.token_expiry  || null,
    }

    // getGmailHistory internally refreshes the token if needed
    // (handled inside scanPushMessages → getValidToken)
    const histResult = await getGmailHistory(fullConn.access_token, storedHistoryId)
    newMessageIds    = histResult.messageIds
    latestHistoryId  = histResult.latestHistoryId

    console.log(
      `[gmail/webhook] ${emailAddress}: ${newMessageIds.length} new messages ` +
      `since historyId=${storedHistoryId}`,
    )

    // ── 6. Update stored historyId first (idempotent — avoids re-processing on retry) ─
    await supabase
      .from('gmail_connections')
      .update({ history_id: latestHistoryId })
      .eq('id', conn.id)

    // ── 7. Process new messages (pre-filter → Claude → expense) ───────────
    if (newMessageIds.length > 0) {
      const stats = await scanPushMessages(supabase, conn.user_id, fullConn, newMessageIds)
      console.log(
        `[gmail/webhook] ${emailAddress}: ` +
        `scanned=${stats.scanned} parsed=${stats.parsed} created=${stats.created}`,
      )
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[gmail/webhook] Error processing ${emailAddress}:`, msg)

    // If it's an auth error, mark the watch as inactive so the UI can prompt reconnect
    if (msg.includes('401') || msg.includes('invalid_grant') || msg.includes('פג תוקף')) {
      await supabase
        .from('gmail_connections')
        .update({ watch_active: false })
        .eq('id', conn.id)
    }

    // Still return 200 — this is not a Pub/Sub delivery failure
  }

  // ── Always return 200 to acknowledge receipt ──────────────────────────────
  return NextResponse.json({ received: true })
}

// Pub/Sub health check (GET) — Google occasionally verifies the endpoint
export async function GET() {
  return NextResponse.json({ status: 'Gmail webhook active' })
}
