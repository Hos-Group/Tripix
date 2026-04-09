/**
 * POST /api/documents/delete
 *
 * Deletes one or more documents by ID using the service-role (admin) client
 * so it bypasses RLS. Also cleans up storage files and related expenses.
 *
 * Body: { ids: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  if (!bearerToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Body ──────────────────────────────────────────────────────────────────
  let ids: string[]
  try {
    const body = await req.json() as { ids?: string[] }
    ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!ids.length) return NextResponse.json({ deleted: 0 })

  // ── Fetch docs to verify ownership + get file URLs ────────────────────────
  const { data: docs, error: fetchErr } = await supabase
    .from('documents')
    .select('id, name, file_url, trip_id')
    .in('id', ids)

  if (fetchErr || !docs) {
    console.error('[documents/delete] Fetch error:', fetchErr)
    return NextResponse.json({ error: 'Could not fetch documents' }, { status: 500 })
  }

  if (!docs.length) {
    return NextResponse.json({ deleted: 0 })
  }

  // Verify each doc belongs to a trip owned by this user
  const tripIds = Array.from(new Set(docs.map(d => d.trip_id).filter(Boolean)))

  let authorizedIds: string[]

  if (tripIds.length === 0) {
    // Docs have no trip_id — allow deletion for any authenticated user
    authorizedIds = docs.map(d => d.id)
  } else {
    const { data: userTrips, error: tripsErr } = await supabase
      .from('trips')
      .select('id')
      .eq('user_id', user.id)
      .in('id', tripIds)

    if (tripsErr) {
      console.error('[documents/delete] Trips ownership check error:', tripsErr)
      return NextResponse.json({ error: 'Ownership check failed' }, { status: 500 })
    }

    const ownedTripIds = new Set((userTrips || []).map(t => t.id))

    // Authorize docs whose trip is owned by this user, OR docs with no trip_id
    authorizedIds = docs
      .filter(d => !d.trip_id || ownedTripIds.has(d.trip_id))
      .map(d => d.id)

    if (!authorizedIds.length) {
      console.warn(`[documents/delete] User ${user.id} tried to delete docs ${ids.join(',')} but owns none of trips ${tripIds.join(',')}`)
      return NextResponse.json({ error: 'No authorized documents found' }, { status: 403 })
    }
  }

  // ── Delete document records ───────────────────────────────────────────────
  const { error: deleteErr } = await supabase
    .from('documents')
    .delete()
    .in('id', authorizedIds)

  if (deleteErr) {
    console.error('[documents/delete] Delete error:', deleteErr)
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  // ── Clean up storage files (best-effort) ──────────────────────────────────
  for (const doc of docs.filter(d => authorizedIds.includes(d.id) && d.file_url)) {
    try {
      const url  = doc.file_url as string
      const path = url.split('/documents/')[1] || url.split('/receipts/')[1]
      if (path) {
        const bucket = url.includes('/documents/') ? 'documents' : 'receipts'
        await supabase.storage.from(bucket).remove([decodeURIComponent(path)])
      }
    } catch (e) {
      console.warn('[documents/delete] Storage cleanup error:', e)
    }
  }

  // ── Clean up related expenses (best-effort) ───────────────────────────────
  try {
    const names = docs.filter(d => authorizedIds.includes(d.id) && d.name).map(d => d.name as string)
    if (names.length) {
      await supabase.from('expenses').delete()
        .eq('source', 'document')
        .in('title', names)
    }
  } catch (e) {
    console.warn('[documents/delete] Expense cleanup error:', e)
  }

  console.log(`[documents/delete] Deleted ${authorizedIds.length} docs for user ${user.id}`)
  return NextResponse.json({ deleted: authorizedIds.length })
}
