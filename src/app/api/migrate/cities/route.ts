import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Security: only allow with secret header
  const auth = request.headers.get('x-migrate-secret')
  if (auth !== 'tripix-migrate-2026') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // Use the direct Supabase management API (pg-meta) via the supabase URL
    // This works via the service role at the API level for DDL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const projectRef  = supabaseUrl.split('//')[1].split('.')[0]

    // Supabase Management API - run SQL
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: "ALTER TABLE trips ADD COLUMN IF NOT EXISTS cities JSONB DEFAULT '[]'::jsonb;" })
    })

    const text = await res.text()

    if (res.ok) {
      return NextResponse.json({ success: true, projectRef, response: text })
    }

    // Fallback: try to create a helper function then call it
    // First, check if column already exists by attempting a select
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/trips?select=cities&limit=1`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      }
    })

    if (checkRes.ok) {
      return NextResponse.json({ success: true, message: 'column already exists!' })
    }

    return NextResponse.json({
      error: 'management api failed',
      status: res.status,
      response: text,
      fallback_check: checkRes.status,
    }, { status: 500 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
