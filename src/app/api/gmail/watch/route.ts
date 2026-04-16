/**
 * POST /api/gmail/watch
 *
 * Register (or renew) Gmail push notifications for the authenticated user's
 * connected Gmail accounts.
 *
 * Called automatically after OAuth connection and by the watch-renew cron.
 * Can also be called manually from the settings page to force-register.
 *
 * For each connected Gmail account:
 *   1. Get a valid access token
 *   2. Call gmail.users.watch() to register Pub/Sub push notifications
 *   3. Store the returned historyId + expiry in gmail_connections
 *   4. Mark watch_active = true
 *
 * Required environment variables:
 *   GMAIL_PUBSUB_TOPIC         — e.g. "projects/my-proj/topics/gmail-push"
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *
 * Also accepts an internal secret (CRON_SECRET) so the watch-renew cron
 * can call this without a user session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { registerGmailWatch, refreshAccessToken } from '@/lib/gmailClient'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface WatchResult {
  gmailAddress: string
  success:      boolean
  historyId?:   string
  expiresAt?:   string
  error?:       string
}

/**
 * Register watches for all Gmail accounts of a given user.
 * Returns per-account results.
 */
async function registerWatchesForUser(
  supabase: ReturnType<typeof adminClient>,
  userId:   string,
): Promise<WatchResult[]> {
  const { data: connections, error } = await supabase
    .from('gmail_connections')
    .select('id, gmail_address, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)

  if (error || !connections?.length) {
    return [{ gmailAddress: '(none)', success: false, error: 'No Gmail connections found' }]
  }

  const results: WatchResult[] = []

  for (const conn of connections) {
    try {
      // ── Refresh token if needed ─────────────────────────────────────────
      let accessToken = conn.access_token
      if (conn.token_expiry) {
        const isExpired = Date.now() >= new Date(conn.token_expiry).getTime() - 5 * 60 * 1000
        if (isExpired) {
          if (!conn.refresh_token) throw new Error('No refresh token — user must reconnect')
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

      // ── Register watch ────────────────────────────────────────────────
      const watchResult = await registerGmailWatch(accessToken)

      // expiration is a Unix timestamp in milliseconds (string)
      const expiresAt = new Date(Number(watchResult.expiration)).toISOString()

      await supabase
        .from('gmail_connections')
        .update({
          history_id:   watchResult.historyId,
          watch_expiry: expiresAt,
          watch_active: true,
        })
        .eq('id', conn.id)

      console.log(
        `[gmail/watch] Registered watch for ${conn.gmail_address}, ` +
        `historyId=${watchResult.historyId}, expires=${expiresAt}`,
      )

      results.push({
        gmailAddress: conn.gmail_address,
        success:      true,
        historyId:    watchResult.historyId,
        expiresAt,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[gmail/watch] Failed for ${conn.gmail_address}:`, msg)
      results.push({ gmailAddress: conn.gmail_address, success: false, error: msg })
    }
  }

  return results
}

// ── POST: called with user Bearer token (from settings page) ─────────────────
export async function POST(req: NextRequest) {
  const authHeader  = req.headers.get('authorization') || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()

  // Also accept CRON_SECRET for internal calls from watch-renew
  const cronSecret  = process.env.CRON_SECRET
  const isCron      = cronSecret && bearerToken === cronSecret

  const supabase = adminClient()

  // ── Resolve user ──────────────────────────────────────────────────────────
  if (isCron) {
    // Cron call: body should contain { user_id }
    let userId: string
    try {
      const body = await req.json() as { user_id: string }
      userId = body.user_id
    } catch {
      return NextResponse.json({ error: 'Missing user_id in body' }, { status: 400 })
    }

    const results = await registerWatchesForUser(supabase, userId)
    return NextResponse.json({ results })
  }

  // Regular user call: resolve from Bearer token
  if (!bearerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await registerWatchesForUser(supabase, user.id)
  return NextResponse.json({ results })
}
