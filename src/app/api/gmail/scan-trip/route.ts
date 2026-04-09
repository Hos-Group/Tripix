/**
 * POST /api/gmail/scan-trip
 *
 * Retroactive import: scans the user's Gmail for booking emails
 * related to a specific trip and auto-creates expenses.
 *
 * Body: { trip_id: string }
 *
 * Searches up to 1 year back so early bookings made before the user
 * registered are captured.
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
import { scanTripGmail } from '@/lib/gmailScanner'

// Allow up to 60 seconds — scanning + Claude parsing takes time
export const maxDuration = 60

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader  = req.headers.get('authorization') || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!bearerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let tripId: string
  try {
    const body = await req.json() as { trip_id?: string }
    tripId = body.trip_id?.trim() || ''
  } catch {
    return NextResponse.json({ error: 'גוף הבקשה אינו תקין' }, { status: 400 })
  }

  if (!tripId) {
    return NextResponse.json({ error: 'חסר trip_id' }, { status: 400 })
  }

  // ── Scan ──────────────────────────────────────────────────────────────────
  try {
    const stats = await scanTripGmail(supabase, user.id, tripId)
    return NextResponse.json(stats)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'שגיאה בסריקה'
    if (message.includes('לא נמצא')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('פג תוקף')) {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    console.error('[gmail/scan-trip] Unexpected error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
