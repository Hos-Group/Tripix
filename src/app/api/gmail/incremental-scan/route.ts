/**
 * GET /api/gmail/incremental-scan
 *
 * High-frequency cron job — runs every minute.
 * Uses Gmail's History API to fetch ONLY new emails since the last check,
 * so each run is extremely lightweight (one API call per connected account).
 *
 * This gives near-real-time email sync without requiring Google Pub/Sub:
 *   - Email arrives in user's Gmail
 *   - Within ≤60 seconds, this cron fires
 *   - History API returns only the new message(s)
 *   - Pre-filter discards non-booking emails instantly (no Claude)
 *   - Claude only runs for promising booking emails
 *   - Expense + document auto-created in user's trip
 *
 * On first run (no historyId stored): bootstraps with a 7-day scan
 * and saves the historyId for all future incremental runs.
 *
 * Security: CRON_SECRET header (injected by Vercel).
 *
 * Required environment variables:
 *   CRON_SECRET              — Vercel cron secret
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanIncrementalGmail } from '@/lib/gmailScanner'

// 55 seconds max — leaves margin before Vercel's 60s function timeout
export const maxDuration = 55

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

  const startedAt = new Date().toISOString()
  const supabase  = adminClient()

  // ── Get all distinct users with Gmail connected ───────────────────────────
  const { data: connections, error: listErr } = await supabase
    .from('gmail_connections')
    .select('user_id')

  if (listErr) {
    console.error('[incremental-scan] DB error:', listErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Unique user IDs
  const seen = new Map<string, true>()
  const userIds: string[] = []
  for (const c of connections || []) {
    if (!seen.has(c.user_id)) { seen.set(c.user_id, true); userIds.push(c.user_id) }
  }

  if (!userIds.length) {
    return NextResponse.json({ startedAt, usersChecked: 0, message: 'No Gmail connections' })
  }

  console.log(`[incremental-scan] Checking ${userIds.length} users`)

  let totalNew     = 0
  let totalScanned = 0
  let totalCreated = 0

  // Process users concurrently (lightweight — each run is just a History API call)
  const results = await Promise.allSettled(
    userIds.map(async userId => {
      const stats = await scanIncrementalGmail(supabase, userId)
      return { userId, stats }
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalNew     += result.value.stats.newEmailsFound
      totalScanned += result.value.stats.scanned
      totalCreated += result.value.stats.created
      if (result.value.stats.created > 0) {
        console.log(
          `[incremental-scan] user=${result.value.userId} ` +
          `new=${result.value.stats.newEmailsFound} ` +
          `booking=${result.value.stats.scanned} ` +
          `created=${result.value.stats.created}`,
        )
      }
    } else {
      console.error('[incremental-scan] User scan failed:', result.reason)
    }
  }

  return NextResponse.json({
    startedAt,
    finishedAt:   new Date().toISOString(),
    usersChecked: userIds.length,
    newEmails:    totalNew,
    scanned:      totalScanned,
    created:      totalCreated,
  })
}
