/**
 * POST /api/gmail/scan
 *
 * Manual trigger: scans the authenticated user's Gmail for booking
 * confirmation emails, parses them with Claude (PDF-first), and
 * auto-creates expenses in matching trips.
 *
 * Returns: { scanned, parsed, created, scannedWithPDF, scannedEmailOnly }
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
import { scanUserGmail } from '@/lib/gmailScanner'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  // ── Auth: resolve user from Bearer token ──────────────────────────────────
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

  try {
    const stats = await scanUserGmail(supabase, user.id)
    return NextResponse.json(stats)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'שגיאה בסריקה'

    // Map known error messages to appropriate HTTP status codes
    if (message.includes('לא נמצא חיבור Gmail')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('פג תוקף') || message.includes('נכשל בחידוש')) {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message.includes('שגיאה בחיפוש')) {
      return NextResponse.json({ error: message }, { status: 502 })
    }

    console.error('[gmail/scan] Unexpected error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
