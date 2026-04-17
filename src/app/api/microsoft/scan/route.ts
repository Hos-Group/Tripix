/**
 * POST /api/microsoft/scan
 *
 * Manual trigger: scans the authenticated user's Outlook / Microsoft email
 * for booking confirmation emails via Graph API.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanUserMicrosoft } from '@/lib/microsoftScanner'

export const maxDuration = 300

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
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
    const stats = await scanUserMicrosoft(supabase, user.id)
    return NextResponse.json(stats)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'שגיאה בסריקה'
    console.error('[microsoft/scan] Unexpected error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
