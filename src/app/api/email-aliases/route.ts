/**
 * /api/email-aliases
 *
 * GET  — list all email aliases for the authenticated user
 * POST — add a new alias + send verification email
 * DELETE (via body) — remove an alias
 *
 * Architecture: uses service-role key for admin ops (token expiry update),
 * but validates the requesting user via their Supabase auth token first.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendVerificationEmail } from '@/lib/emailSender'
import crypto from 'crypto'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Extract user from Authorization: Bearer <access_token> header */
async function getSessionUser(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// ── GET: list aliases ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminClient()
  const { data, error } = await supabase
    .from('user_email_aliases')
    .select('id, email, label, verified, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ aliases: data })
}

// ── POST: add alias ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, label = 'personal' } = await req.json()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'כתובת מייל לא תקינה' }, { status: 400 })
  }

  // Reject if it's already the user's primary email
  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: 'זו כבר כתובת המייל הראשית שלך' },
      { status: 409 },
    )
  }

  const supabase = adminClient()

  // Check if already registered to another user
  const { data: existing } = await supabase
    .from('user_email_aliases')
    .select('id, user_id, verified')
    .eq('email', email.toLowerCase())
    .single()

  if (existing && existing.user_id !== user.id) {
    return NextResponse.json(
      { error: 'כתובת המייל הזו כבר משויכת לחשבון אחר' },
      { status: 409 },
    )
  }

  // Generate verification token (expires 24h)
  const token     = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  if (existing) {
    // Re-send verification for existing unverified alias
    await supabase
      .from('user_email_aliases')
      .update({ verification_token: token, token_expires_at: expiresAt })
      .eq('id', existing.id)
  } else {
    // Insert new alias
    const { error: insertError } = await supabase
      .from('user_email_aliases')
      .insert({
        user_id:             user.id,
        email:               email.toLowerCase(),
        label,
        verified:            false,
        verification_token:  token,
        token_expires_at:    expiresAt,
      })
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // Send verification email
  const sent = await sendVerificationEmail(email.toLowerCase(), token)

  return NextResponse.json({
    success:     true,
    email_sent:  sent,
    message:     sent
      ? `נשלח מייל אישור ל-${email}`
      : 'הכתובת נוספה — שירות המייל לא מוגדר, אנא בקש אישור ידני',
  })
}

// ── DELETE: remove alias ──────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = adminClient()
  const { error } = await supabase
    .from('user_email_aliases')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
