/**
 * GET /api/gmail/auto-scan
 *
 * Vercel Cron Job endpoint — runs daily at 06:00 UTC.
 * Scans every connected user's Gmail for booking confirmation emails.
 *
 * Security: secured by CRON_SECRET environment variable.
 * Vercel automatically sends the secret in the `Authorization: Bearer <secret>` header.
 *
 * Required environment variables:
 *   CRON_SECRET              — random secret shared with Vercel
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanUserGmail, ScanStats } from '@/lib/gmailScanner'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface UserScanResult {
  userId:  string
  stats?:  ScanStats
  error?:  string
}

export async function GET(req: NextRequest) {
  // ── Verify cron secret ────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader  = req.headers.get('authorization') || ''
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (bearerToken !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    // If CRON_SECRET is not set, only allow in development
    if (process.env.NODE_ENV === 'production') {
      console.error('[auto-scan] CRON_SECRET not configured — rejecting request')
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }
  }

  const startedAt = new Date().toISOString()
  const supabase  = adminClient()

  // ── Get all connected users ────────────────────────────────────────────────
  const { data: connections, error: listError } = await supabase
    .from('gmail_connections')
    .select('user_id')

  if (listError) {
    console.error('[auto-scan] Failed to list gmail_connections:', listError)
    return NextResponse.json({ error: 'DB error listing connections' }, { status: 500 })
  }

  const users = connections || []
  console.log(`[auto-scan] Starting scan for ${users.length} users`)

  // ── Scan each user sequentially to avoid rate limit bursts ────────────────
  const results: UserScanResult[] = []
  let totalScanned = 0
  let totalParsed  = 0
  let totalCreated = 0

  for (const { user_id } of users) {
    try {
      const stats = await scanUserGmail(supabase, user_id)
      results.push({ userId: user_id, stats })
      totalScanned += stats.scanned
      totalParsed  += stats.parsed
      totalCreated += stats.created
      console.log(
        `[auto-scan] user=${user_id} scanned=${stats.scanned} parsed=${stats.parsed} created=${stats.created}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[auto-scan] user=${user_id} error:`, message)
      results.push({ userId: user_id, error: message })
    }
  }

  const finishedAt = new Date().toISOString()

  return NextResponse.json({
    startedAt,
    finishedAt,
    usersScanned: users.length,
    totalScanned,
    totalParsed,
    totalCreated,
    results,
  })
}
