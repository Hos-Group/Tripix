import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  computeFileHashFromBuffer,
  buildDedupKey,
  findDuplicate,
  isDedupViolation,
  dedupReasonLabel,
} from '@/lib/documentDedup'

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

  return NextResponse.json(data)
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
