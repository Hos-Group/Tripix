/**
 * POST /api/email-ingest
 *
 * Webhook endpoint for inbound email processing.
 * Compatible with: Resend, Postmark, Mailgun (all send similar JSON).
 *
 * Flow:
 *  1. Verify webhook signature (if secret configured)
 *  2. Identify recipient → map to user via inbox_key
 *  3. Parse email body with Claude
 *  4. Match to existing trip
 *  5. Auto-create expense + document record
 *  6. Store raw + parsed data in email_ingests table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseBookingEmail, htmlToText, shouldCreateExpense } from '@/lib/emailParser'
import { matchTripToBooking, TripRecord } from '@/lib/tripMatcher'
import { buildDedupKey, findDuplicate, isDedupViolation } from '@/lib/documentDedup'
import crypto from 'crypto'

// ── Supabase admin client (bypasses RLS) ──────────────────────────────────────
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ── Verify Resend/Svix webhook signature ─────────────────────────────────────
// Resend uses Svix for webhook delivery.
// Signature header: "svix-signature" = "v1,<base64_hmac_sha256>"
// Secret format: "whsec_<base64>" — must be decoded before use
function verifySignature(
  body: string,
  req: NextRequest,
): boolean {
  const secret = process.env.EMAIL_WEBHOOK_SECRET
  if (!secret) return true   // skip verification if not configured

  const msgId        = req.headers.get('svix-id')
  const msgTimestamp = req.headers.get('svix-timestamp')
  const msgSignature = req.headers.get('svix-signature')

  // Fallback: old-style x-resend-signature (HMAC-SHA256 hex)
  const legacySig = req.headers.get('x-resend-signature')
  if (!msgSignature && legacySig) {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(legacySig.replace('sha256=', ''), 'hex'),
      )
    } catch { return false }
  }

  if (!msgId || !msgTimestamp || !msgSignature) return false

  // Svix verification: sign "{msgId}.{msgTimestamp}.{body}"
  try {
    // Decode whsec_ secret
    const secretBytes = Buffer.from(
      secret.startsWith('whsec_') ? secret.slice(6) : secret,
      'base64',
    )
    const toSign  = `${msgId}.${msgTimestamp}.${body}`
    const hmac    = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64')
    const sigs    = msgSignature.split(' ')    // may have multiple "v1,<sig>"
    return sigs.some(s => {
      const parts = s.split(',')
      if (parts[0] !== 'v1') return false
      try {
        return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(parts[1]))
      } catch { return false }
    })
  } catch { return false }
}

// ── Normalize inbound email payload ─────────────────────────────────────────
// Handles: Resend, Postmark, Mailgun raw formats
interface NormalizedEmail {
  to: string          // recipient (has the inbox_key)
  from: string
  subject: string
  html: string
  text: string
  attachments: Array<{ name: string; content: string; content_type: string }>
}

function normalizePayload(body: Record<string, unknown>): NormalizedEmail | null {
  // Resend inbound format
  if (body.type === 'email.received' && body.data) {
    const d = body.data as Record<string, unknown>
    return {
      to:          (d.to as string[] | undefined)?.[0] || '',
      from:        d.from as string || '',
      subject:     d.subject as string || '',
      html:        d.html as string || '',
      text:        d.text as string || '',
      attachments: (d.attachments as []) || [],
    }
  }

  // Postmark inbound format
  if (body.MessageID && body.TextBody !== undefined) {
    const b = body as Record<string, unknown>
    const toFull = (b.To as string) || ''
    const toAddr = toFull.match(/<(.+?)>/) ? toFull.match(/<(.+?)>/)![1] : toFull
    return {
      to:          toAddr,
      from:        b.From as string || '',
      subject:     b.Subject as string || '',
      html:        b.HtmlBody as string || '',
      text:        b.TextBody as string || '',
      attachments: (b.Attachments as []) || [],
    }
  }

  // Mailgun inbound format
  if (body.recipient || body['body-html']) {
    const b = body as Record<string, unknown>
    return {
      to:          b.recipient as string || '',
      from:        b.sender as string || '',
      subject:     b.subject as string || '',
      html:        b['body-html'] as string || '',
      text:        b['body-plain'] as string || '',
      attachments: [],
    }
  }

  // Generic fallback
  return {
    to:          (body.to as string) || '',
    from:        (body.from as string) || '',
    subject:     (body.subject as string) || '',
    html:        (body.html as string) || '',
    text:        (body.text as string) || '',
    attachments: (body.attachments as []) || [],
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Signature check (supports Svix/Resend + legacy HMAC formats)
  if (!verifySignature(rawBody, req)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = normalizePayload(body)
  if (!email || !email.to) {
    return NextResponse.json({ error: 'Cannot parse email payload' }, { status: 400 })
  }

  const supabase = adminClient()

  // ── Routing strategy: 3 ways to identify the user ────────────────────────
  //
  //  1. inbox_key in TO address  → {key}@in.tripix.app   (primary)
  //  2. verified email alias     → user forwarded from their personal/work email
  //  3. primary auth email match → user forwarded directly from their login email
  //
  let userId: string | null = null
  let routeMethod = 'unknown'

  // Strategy 1: inbox_key in TO address
  const inboxKey = email.to.split('@')[0]?.toLowerCase()
  if (inboxKey) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('inbox_key', inboxKey)
      .single()
    if (profile) { userId = profile.id as string; routeMethod = 'inbox_key' }
  }

  // Strategy 2: sender email is a verified alias
  if (!userId && email.from) {
    const senderEmail = email.from.match(/<(.+?)>/)
      ? email.from.match(/<(.+?)>/)![1].toLowerCase()
      : email.from.toLowerCase()

    const { data: alias } = await supabase
      .from('user_email_aliases')
      .select('user_id')
      .eq('email', senderEmail)
      .eq('verified', true)
      .single()
    if (alias) { userId = alias.user_id as string; routeMethod = 'email_alias' }
  }

  // Strategy 3: sender email matches a primary auth account (via profiles)
  if (!userId && email.from) {
    const senderEmail = email.from.match(/<(.+?)>/)
      ? email.from.match(/<(.+?)>/)![1].toLowerCase()
      : email.from.toLowerCase()

    // List users and find by email (admin API v2 uses listUsers with filter)
    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const match = userList?.users?.find(
      u => u.email?.toLowerCase() === senderEmail
    )
    if (match) { userId = match.id; routeMethod = 'primary_email' }
  }

  if (!userId) {
    console.warn('[email-ingest] Could not identify user from:', email.to, email.from)
    return NextResponse.json({ error: 'Unknown recipient' }, { status: 404 })
  }

  console.log(`[email-ingest] Routed via ${routeMethod} → user ${userId}`)

  // ── Parse email with Claude ───────────────────────────────────────────────
  const emailContent = email.html || email.text || ''
  const parsed = await parseBookingEmail(emailContent, email.subject)

  // ── Fetch user's trips for matching ───────────────────────────────────────
  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })

  // ── Match to trip ─────────────────────────────────────────────────────────
  let matchedTripId: string | null = null
  let matchScore = 0
  let matchReason = 'לא נותח'

  if (parsed && trips?.length) {
    const result = matchTripToBooking(parsed, trips as TripRecord[])
    matchedTripId = result.trip?.id || null
    matchScore    = result.score
    matchReason   = result.reason
  }

  // ── Store raw ingest record ───────────────────────────────────────────────
  const { data: ingestRecord, error: ingestError } = await supabase
    .from('email_ingests')
    .insert({
      user_id:        userId,
      from_address:   email.from,
      subject:        email.subject,
      raw_html:       email.html?.slice(0, 50000) || null,
      raw_text:       htmlToText(email.html || email.text || '').slice(0, 10000),
      parsed_data:    parsed || null,
      trip_id:        matchedTripId,
      match_score:    matchScore,
      match_reason:   matchReason,
      status:         matchedTripId ? 'matched' : 'unmatched',
    })
    .select('id')
    .single()

  if (ingestError) {
    console.error('[email-ingest] DB insert error:', ingestError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // ── Auto-create document + expense if matched with high confidence ───────
  if (parsed && matchedTripId && parsed.confidence >= 0.7) {
    const CATEGORY_MAP: Record<string, string> = {
      hotel:      'hotel',
      flight:     'flight',
      car_rental: 'car_rental',
      taxi:       'taxi',
      activity:   'activity',
      tour:       'activity',
      insurance:  'insurance',
      inflight:   'flight',
      food:       'food',
      sim:        'sim',
      visa:       'visa',
      ferry:      'ferry',
      train:      'train',
      other:      'other',
    }
    const DOC_TYPE_MAP: Record<string, string> = {
      hotel:      'hotel',
      flight:     'flight',
      car_rental: 'other',
      taxi:       'other',
      activity:   'activity',
      tour:       'activity',
      insurance:  'insurance',
      inflight:   'flight',
      food:       'other',
      sim:        'other',
      visa:       'visa',
      ferry:      'ferry',
      train:      'other',
      other:      'other',
    }

    const bookingTitle =
      parsed.hotel_name ||
      (parsed.airline && parsed.flight_number
        ? `${parsed.airline} ${parsed.flight_number}`
        : null) ||
      parsed.summary ||
      parsed.vendor ||
      email.subject.slice(0, 60)

    // ── 1. Document record — shows up in Documents page ─────────────────
    const eiDocType    = DOC_TYPE_MAP[parsed.booking_type] || 'other'
    const eiBookingRef = parsed.confirmation_number || null
    const eiValidFrom  = parsed.check_in || parsed.departure_date || null
    const eiDedupKey   = buildDedupKey({
      doc_type:      eiDocType,
      booking_ref:   eiBookingRef,
      traveler_id:   null,
      valid_from:    eiValidFrom,
      name:          bookingTitle,
      flight_number: parsed.flight_number || null,
    })

    const existingDup = await findDuplicate(supabase, matchedTripId, {
      dedup_key: eiDedupKey,
    })

    let docRecord: { id: string } | null = null
    if (existingDup) {
      console.log(`[email-ingest] skip dup (${existingDup.reason}): "${bookingTitle}"`)
      docRecord = { id: existingDup.id }
    } else {
      const { data, error: docError } = await supabase
        .from('documents')
        .insert({
          trip_id:        matchedTripId,
          user_id:        userId,
          name:           bookingTitle,
          doc_type:       eiDocType,
          file_url:       null,
          file_type:      'email',
          extracted_data: parsed,
          booking_ref:    eiBookingRef,
          flight_number:  parsed.flight_number || null,
          valid_from:     eiValidFrom,
          valid_until:    parsed.check_out || parsed.return_date || null,
          notes:          `מ: ${email.from}\nנושא: ${email.subject}`,
          dedup_key:      eiDedupKey,
        })
        .select('id')
        .single()

      if (docError) {
        if (isDedupViolation(docError)) {
          console.log(`[email-ingest] dup insert rejected: "${bookingTitle}"`)
        } else {
          console.error('[email-ingest] Document insert error:', docError.message)
        }
      } else {
        docRecord = data
      }
    }

    // ── 2. Expense record — shows up in Expenses page ───────────────────
    // Only invoices / receipts become expenses. Booking confirmations stay on
    // Documents only — the real charge arrives separately as an invoice.
    let expense: { id: string } | null = null
    if (shouldCreateExpense(parsed)) {
      const { data, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          trip_id:         matchedTripId,
          user_id:         userId,
          title:           bookingTitle,
          amount:          parsed.amount || 0,
          currency:        parsed.currency || 'ILS',
          amount_ils:      parsed.amount || 0,
          category:        CATEGORY_MAP[parsed.booking_type] || 'other',
          expense_date:    parsed.check_in || parsed.departure_date || new Date().toISOString().split('T')[0],
          notes:           `מספר אישור: ${parsed.confirmation_number || '—'}\nמ: ${email.from}`,
          source:          'scan',
          is_paid:         true,
          email_ingest_id: ingestRecord!.id,
        })
        .select('id')
        .single()

      if (expenseError) {
        console.error('[email-ingest] Expense insert error:', expenseError.message)
      } else {
        expense = data
      }
    } else {
      console.log(`[email-ingest] ✓ doc saved without expense (subtype="${parsed.document_subtype}"): "${bookingTitle}"`)
    }

    // ── 3. Link everything in email_ingests ──────────────────────────────
    await supabase
      .from('email_ingests')
      .update({
        expense_id: expense?.id || null,
        status:     'processed',
      })
      .eq('id', ingestRecord!.id)

    console.log(
      `[email-ingest] ✓ created doc="${bookingTitle}" ` +
      `doc_id=${docRecord?.id} expense_id=${expense?.id} ` +
      `trip=${matchedTripId} conf=${parsed.confidence}`,
    )
  }

  return NextResponse.json({
    success:   true,
    ingest_id: ingestRecord?.id,
    matched:   !!matchedTripId,
    trip_id:   matchedTripId,
    score:     matchScore,
    reason:    matchReason,
  })
}

// Allow GET for health check (Resend sends a verification GET first)
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'tripix-email-ingest' })
}
