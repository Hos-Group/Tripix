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
import { parseBookingEmail, htmlToText } from '@/lib/emailParser'
import { matchTripToBooking, TripRecord } from '@/lib/tripMatcher'
import crypto from 'crypto'

// ── Supabase admin client (bypasses RLS) ──────────────────────────────────────
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ── Verify Resend webhook signature ──────────────────────────────────────────
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.EMAIL_WEBHOOK_SECRET
  if (!secret) return true  // if no secret configured, skip verification

  if (!signature) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature.replace('sha256=', ''), 'hex'),
  )
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
  const sig     = req.headers.get('x-resend-signature') ||
                  req.headers.get('x-postmark-signature') ||
                  req.headers.get('x-mailgun-signature')

  // Signature check
  if (!verifySignature(rawBody, sig)) {
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

  // ── Auto-create expense if matched ────────────────────────────────────────
  if (parsed && matchedTripId && parsed.confidence >= 0.7) {
    const expenseCategory = {
      hotel:       'hotel',
      flight:      'flight',
      car_rental:  'taxi',
      activity:    'activity',
      tour:        'activity',
      insurance:   'other',
      other:       'other',
    }[parsed.booking_type] || 'other'

    const expenseTitle =
      parsed.hotel_name ||
      (parsed.airline && parsed.flight_number
        ? `${parsed.airline} ${parsed.flight_number}`
        : null) ||
      parsed.summary ||
      parsed.vendor ||
      email.subject.slice(0, 60)

    const { data: expense } = await supabase
      .from('expenses')
      .insert({
        trip_id:     matchedTripId,
        user_id:     userId,
        title:       expenseTitle,
        amount:      parsed.amount || 0,
        currency:    parsed.currency || 'ILS',
        category:    expenseCategory,
        date:        parsed.check_in || parsed.departure_date || new Date().toISOString().split('T')[0],
        notes:       `מספר אישור: ${parsed.confirmation_number}\nיובא אוטומטית מ: ${email.from}`,
        source:      'email',
        email_ingest_id: ingestRecord!.id,
      })
      .select('id')
      .single()

    if (expense) {
      // Update ingest with expense link
      await supabase
        .from('email_ingests')
        .update({ expense_id: expense.id, status: 'processed' })
        .eq('id', ingestRecord!.id)
    }
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
