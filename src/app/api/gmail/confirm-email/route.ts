/**
 * POST /api/gmail/confirm-email
 *
 * Called when the user confirms or dismisses a borderline email from
 * the "Pending Review" section in the documents page.
 *
 * Body:
 *   { ingest_id: string, action: 'add' | 'skip' }
 *
 * 'add'  → creates a Document record from the email_ingests parsed_data,
 *           creates an Expense record, and marks the ingest as 'processed'.
 * 'skip' → marks the ingest as 'dismissed' (won't appear again).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ParsedBooking, shouldCreateExpense } from '@/lib/emailParser'
import { buildDedupKey, findDuplicate, isDedupViolation, dedupReasonLabel } from '@/lib/documentDedup'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const docTypeMap: Record<string, string> = {
  hotel: 'hotel', flight: 'flight', car_rental: 'other', taxi: 'other',
  activity: 'activity', tour: 'activity', insurance: 'insurance', other: 'other',
}
const categoryMap: Record<string, string> = {
  hotel: 'hotel', flight: 'flight', car_rental: 'taxi', taxi: 'taxi',
  activity: 'activity', tour: 'activity', insurance: 'other', other: 'other',
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
  let ingestId: string
  let action: 'add' | 'skip'
  try {
    const body = await req.json() as { ingest_id?: string; action?: string }
    ingestId = body.ingest_id?.trim() || ''
    action   = body.action === 'add' ? 'add' : 'skip'
  } catch {
    return NextResponse.json({ error: 'גוף הבקשה אינו תקין' }, { status: 400 })
  }

  if (!ingestId) {
    return NextResponse.json({ error: 'חסר ingest_id' }, { status: 400 })
  }

  // ── Load ingest record ─────────────────────────────────────────────────────
  const { data: ingest, error: ingestError } = await supabase
    .from('email_ingests')
    .select('id, user_id, from_address, subject, parsed_data, trip_id, gmail_message_id')
    .eq('id', ingestId)
    .eq('user_id', user.id)
    .single()

  if (ingestError || !ingest) {
    return NextResponse.json({ error: 'רשומה לא נמצאה' }, { status: 404 })
  }

  // ── Handle 'skip' ─────────────────────────────────────────────────────────
  if (action === 'skip') {
    await supabase
      .from('email_ingests')
      .update({ status: 'dismissed' })
      .eq('id', ingestId)
    return NextResponse.json({ ok: true, action: 'dismissed' })
  }

  // ── Handle 'add' ──────────────────────────────────────────────────────────
  const parsedBooking = ingest.parsed_data as ParsedBooking
  const tripId        = ingest.trip_id as string

  if (!tripId) {
    return NextResponse.json({ error: 'חסר trip_id' }, { status: 400 })
  }

  const baseTitle =
    parsedBooking.hotel_name ||
    (parsedBooking.airline && parsedBooking.flight_number
      ? `${parsedBooking.airline} ${parsedBooking.flight_number}` : null) ||
    parsedBooking.vendor || (ingest.subject as string).slice(0, 60)

  const gmidKey = ingest.gmail_message_id ? `GMID:${ingest.gmail_message_id}` : `INGEST:${ingestId}`

  // Dedup — check before insert
  const ceDocType    = docTypeMap[parsedBooking.booking_type] || 'other'
  const ceBookingRef = parsedBooking.confirmation_number !== 'N/A'
    ? parsedBooking.confirmation_number : null
  const ceValidFrom  = parsedBooking.check_in || parsedBooking.departure_date || null
  const ceDedupKey   = buildDedupKey({
    doc_type:      ceDocType,
    booking_ref:   ceBookingRef,
    traveler_id:   null,
    valid_from:    ceValidFrom,
    name:          baseTitle,
    flight_number: parsedBooking.flight_number || null,
  })

  const ceExisting = await findDuplicate(supabase, tripId, {
    dedup_key:        ceDedupKey,
    gmail_message_id: ingest.gmail_message_id as string | null,
  })
  if (ceExisting) {
    // Already exists — mark ingest processed, return existing doc
    await supabase
      .from('email_ingests')
      .update({ status: 'processed' })
      .eq('id', ingestId)
    return NextResponse.json({
      ok:      true,
      action:  'skipped',
      reason:  dedupReasonLabel(ceExisting.reason),
      doc:     { id: ceExisting.id, name: ceExisting.name, doc_type: ceDocType },
    })
  }

  // Create Document record (metadata-only, no file)
  const { data: docRecord, error: docError } = await supabase
    .from('documents')
    .insert({
      trip_id:          tripId,
      name:             baseTitle,
      doc_type:         ceDocType,
      file_type:        'gmail',
      file_url:         null,
      booking_ref:      ceBookingRef,
      valid_from:       ceValidFrom,
      valid_until:      parsedBooking.check_out || parsedBooking.return_date || null,
      flight_number:    parsedBooking.flight_number || null,
      notes:            `${gmidKey}\nאושר ידנית מ-Gmail\nשולח: ${ingest.from_address}\n${parsedBooking.summary || ''}`,
      extracted_data:   parsedBooking as unknown as Record<string, unknown>,
      gmail_message_id: (ingest.gmail_message_id as string | null) || null,
      dedup_key:        ceDedupKey,
    })
    .select('id, name, doc_type')
    .single()

  if (docError || !docRecord) {
    if (isDedupViolation(docError)) {
      await supabase.from('email_ingests').update({ status: 'processed' }).eq('id', ingestId)
      return NextResponse.json({ ok: true, action: 'skipped', reason: 'כבר קיים' })
    }
    const errMsg = docError?.message || 'שגיאה ביצירת מסמך'
    console.error('[confirm-email] Document insert error:', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

  // Create Expense record (best-effort) — only when the email is an actual
  // charge (invoice / receipt). Booking confirmations stay on Documents only.
  if (shouldCreateExpense(parsedBooking)) {
    await supabase.from('expenses').insert({
      trip_id:      tripId,
      title:        baseTitle,
      amount:       parsedBooking.amount || 0,
      currency:     parsedBooking.currency || 'ILS',
      amount_ils:   parsedBooking.amount || 0,
      category:     categoryMap[parsedBooking.booking_type] || 'other',
      expense_date: parsedBooking.check_in || parsedBooking.departure_date || new Date().toISOString().split('T')[0],
      notes:        `מספר אישור: ${parsedBooking.confirmation_number}\nאושר ידנית מ-Gmail: ${ingest.from_address}`,
      source:       'document',
      is_paid:      true,
    })
  } else {
    console.log(`[confirm-email] ✓ doc saved without expense (subtype="${parsedBooking.document_subtype}"): "${baseTitle}"`)
  }

  // Mark ingest as processed
  await supabase
    .from('email_ingests')
    .update({ status: 'processed' })
    .eq('id', ingestId)

  return NextResponse.json({
    ok:     true,
    action: 'added',
    doc: {
      id:       docRecord.id,
      name:     docRecord.name,
      doc_type: docRecord.doc_type,
    },
  })
}
