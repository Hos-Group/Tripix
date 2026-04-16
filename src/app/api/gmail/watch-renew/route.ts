/**
 * GET /api/gmail/watch-renew
 *
 * Vercel Cron Job — runs every 6 days to renew Gmail push notification watches
 * before they expire (Gmail watches expire after exactly 7 days).
 *
 * For each gmail_connections row where watch_active=true (or no watch yet),
 * re-registers the watch and updates history_id + watch_expiry.
 *
 * Also renews watches that are expiring within the next 36 hours (safety buffer).
 *
 * Schedule: "0 8 * /6 * *" (every 6 days at 08:00 UTC)
 *
 * Required environment variables:
 *   CRON_SECRET                — Vercel-injected secret
 *   GMAIL_PUBSUB_TOPIC         — Pub/Sub topic name
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { registerGmailWatch, refreshAccessToken } from '@/lib/gmailClient'

export const maxDuration = 60

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  // ── Verify cron secret ────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization') || ''
    if (auth.replace(/^Bearer\s+/i, '').trim() !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const supabase = adminClient()
  const now      = new Date()

  // ── Find connections that need a watch renewal ────────────────────────────
  // Renew if:
  //   a) watch is not active (watch_active = false or null)
  //   b) watch expires within 36 hours
  //   c) GMAIL_PUBSUB_TOPIC is set (no point registering if Pub/Sub isn't configured)
  if (!process.env.GMAIL_PUBSUB_TOPIC) {
    console.log('[watch-renew] GMAIL_PUBSUB_TOPIC not set — skipping')
    return NextResponse.json({ skipped: true, reason: 'GMAIL_PUBSUB_TOPIC not configured' })
  }

  const renewBefore = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString()

  const { data: connections, error: listErr } = await supabase
    .from('gmail_connections')
    .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry, watch_expiry, watch_active, history_id')

  if (listErr) {
    console.error('[watch-renew] Failed to list connections:', listErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const toRenew = (connections || []).filter(conn => {
    if (!conn.watch_active) return true                            // no active watch
    if (!conn.watch_expiry) return true                            // never registered
    return new Date(conn.watch_expiry) < new Date(renewBefore)    // expiring soon
  })

  console.log(`[watch-renew] ${toRenew.length} of ${(connections || []).length} connections need renewal`)

  const results: Array<{
    gmail: string
    success: boolean
    historyId?: string
    expiresAt?: string
    error?: string
  }> = []

  for (const conn of toRenew) {
    try {
      // ── Refresh Gmail access token if needed ────────────────────────────
      let accessToken = conn.access_token
      if (conn.token_expiry) {
        const expired = Date.now() >= new Date(conn.token_expiry).getTime() - 5 * 60 * 1000
        if (expired) {
          if (!conn.refresh_token) throw new Error('No refresh token')
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

      // ── Register/renew watch ────────────────────────────────────────────
      const watchResult = await registerGmailWatch(accessToken)
      const expiresAt   = new Date(Number(watchResult.expiration)).toISOString()

      // Only update history_id if we didn't have one — keep existing so we don't miss messages
      const updates: Record<string, unknown> = {
        watch_expiry: expiresAt,
        watch_active: true,
      }
      if (!conn.history_id) {
        updates.history_id = watchResult.historyId
      }

      await supabase
        .from('gmail_connections')
        .update(updates)
        .eq('id', conn.id)

      console.log(
        `[watch-renew] ✓ ${conn.gmail_address} — ` +
        `historyId=${watchResult.historyId}, expires=${expiresAt}`,
      )
      results.push({ gmail: conn.gmail_address, success: true, historyId: watchResult.historyId, expiresAt })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[watch-renew] ✗ ${conn.gmail_address}:`, msg)
      results.push({ gmail: conn.gmail_address, success: false, error: msg })

      // Mark as inactive if auth error
      if (msg.includes('invalid_grant') || msg.includes('401')) {
        await supabase
          .from('gmail_connections')
          .update({ watch_active: false })
          .eq('id', conn.id)
      }
    }
  }

  return NextResponse.json({
    checkedAt:   now.toISOString(),
    total:       (connections || []).length,
    renewed:     toRenew.length,
    results,
  })
}
