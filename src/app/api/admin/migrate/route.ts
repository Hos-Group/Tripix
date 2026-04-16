/**
 * GET /api/admin/migrate?secret=tripix_migrate_2026
 * Runs migration 011 via Supabase Management API.
 * DELETE THIS FILE after running once.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== 'tripix_migrate_2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const projectRef   = supabaseUrl.replace('https://', '').replace('.supabase.co', '')

  // Use Supabase Management API to run SQL
  const sql = `
    ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS history_id TEXT;
    ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS watch_expiry TIMESTAMPTZ;
    ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS watch_active BOOLEAN DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS gmail_connections_address_idx ON gmail_connections (gmail_address);
  `

  // Try Management API
  const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  const mgmtData = await mgmtRes.text()

  // Verify
  const verifyRes = await fetch(
    `${supabaseUrl}/rest/v1/gmail_connections?select=history_id&limit=0`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )

  return NextResponse.json({
    mgmt_status: mgmtRes.status,
    mgmt_body:   mgmtData.slice(0, 300),
    verify_status: verifyRes.status,
    verify_ok: verifyRes.status === 200,
  })
}
