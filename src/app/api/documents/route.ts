import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  computeFileHashFromBuffer,
  buildDedupKey,
  findDuplicate,
  isDedupViolation,
  dedupReasonLabel,
} from '@/lib/documentDedup'
import { insertExpenseFromDocument, type ExtractedAmountData } from '@/lib/dedup'
import { convertToILS } from '@/lib/rates'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tripId = searchParams.get('trip_id')
  const docType = searchParams.get('doc_type')
  const travelerId = searchParams.get('traveler_id')

  let query = supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (tripId) query = query.eq('trip_id', tripId)
  if (docType) query = query.eq('doc_type', docType)
  if (travelerId) query = query.eq('traveler_id', travelerId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * POST /api/documents
 *
 * Three-signal duplicate prevention (mirrors the scanner flows):
 *   1. content_hash  — SHA-256 of the uploaded file bytes
 *   2. dedup_key     — logical signature (doc_type + booking_ref + …)
 *   3. DB unique     — migration 016 enforces (trip_id, content_hash) and
 *                      (trip_id, dedup_key) as a race-safe backstop
 *
 * Soft pre-check runs BEFORE storage upload so a duplicate doesn't waste
 * a storage write. `force: true` in the JSON `data` payload overrides the
 * soft check (DB uniques still apply for programmatic safety).
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const parsedData = JSON.parse(formData.get('data') as string) as Record<string, unknown> & {
    force?:        boolean
    trip_id?:      string
    name?:         string
    doc_type?:     string
    booking_ref?:  string | null
    valid_from?:   string | null
    traveler_id?: string
    flight_number?: string | null
  }
  const { force, ...docData } = parsedData

  if (!docData.trip_id || !docData.name || !docData.doc_type) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
  }

  // Hash file bytes upfront (we need them either way for upload + dedup).
  let contentHash: string | null = null
  let fileBytes: Buffer | null = null
  if (file) {
    fileBytes   = Buffer.from(await file.arrayBuffer())
    contentHash = await computeFileHashFromBuffer(fileBytes)
  }

  const dedupKey = buildDedupKey({
    doc_type:      String(docData.doc_type),
    booking_ref:   (docData.booking_ref as string | null) || null,
    traveler_id:   (docData.traveler_id as string) || null,
    valid_from:    (docData.valid_from as string | null) || null,
    name:          String(docData.name),
    flight_number: (docData.flight_number as string | null) || null,
  })

  if (!force) {
    const duplicate = await findDuplicate(supabase, String(docData.trip_id), {
      content_hash: contentHash,
      dedup_key:    dedupKey,
    })
    if (duplicate) {
      return NextResponse.json(
        {
          error:     'duplicate',
          reason:    duplicate.reason,
          message:   dedupReasonLabel(duplicate.reason),
          duplicate,
        },
        { status: 409 },
      )
    }
  }

  let fileUrl: string | null = null
  if (file && fileBytes) {
    const fileName = `${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, new Uint8Array(fileBytes), { contentType: file.type })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(uploadData.path)
    fileUrl = urlData.publicUrl
  }

  const insertPayload = {
    ...docData,
    file_url:     fileUrl,
    file_type:    file?.type || null,
    content_hash: contentHash,
    dedup_key:    dedupKey,
  }

  const { data, error } = await supabase
    .from('documents')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    if (isDedupViolation(error)) {
      const duplicate = await findDuplicate(supabase, String(docData.trip_id), {
        content_hash: contentHash,
        dedup_key:    dedupKey,
      })
      return NextResponse.json(
        {
          error:     'duplicate',
          reason:    duplicate?.reason || 'content_hash',
          message:   duplicate ? dedupReasonLabel(duplicate.reason) : 'קובץ זהה כבר קיים',
          duplicate,
        },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Auto-create a linked expense when the document carries a paid amount ──
  // Rule: only when extracted_data.amount > 0 (passports / blank insurance /
  // zero-amount bookings stay on the Documents page only — no expense row).
  const doc           = data as Record<string, unknown>
  const extracted     = (doc.extracted_data as ExtractedAmountData | null | undefined) || null
  const rawAmount     = extracted?.amount
  const amountNumber  = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount)
  let   expenseStatus: { inserted: boolean; reason?: string; id?: string } = { inserted: false, reason: 'no_amount' }

  if (Number.isFinite(amountNumber) && amountNumber > 0) {
    const currency = (extracted?.currency || 'ILS').toUpperCase()
    const expenseDate =
      extracted?.check_in        ||
      extracted?.departure_date  ||
      (docData.valid_from as string | null) ||
      new Date().toISOString().split('T')[0]

    let amountIls = amountNumber
    try {
      amountIls = await convertToILS(amountNumber, currency, expenseDate)
    } catch (convErr) {
      console.warn('[documents] convertToILS failed — using raw amount:', convErr)
    }

    expenseStatus = await insertExpenseFromDocument({
      trip_id:         String(docData.trip_id),
      user_id:         (docData.user_id as string | null) || null,
      document_id:     String(doc.id),
      doc_type:        String(docData.doc_type),
      name:            String(docData.name),
      extracted_data:  extracted,
      amount_ils:      amountIls,
      fallback_date:   (docData.valid_from as string | null) || null,
      source:          'document',
      idempotency_key: `doc:${doc.id}`,   // stable source key → DB unique blocks re-run
    })
  }

  return NextResponse.json({
    ...doc,
    expense_created: expenseStatus.inserted,
    expense_skip_reason: expenseStatus.inserted ? undefined : expenseStatus.reason,
  })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'חסר id' }, { status: 400 })
  }

  const { error } = await supabase.from('documents').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
