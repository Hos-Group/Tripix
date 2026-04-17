import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/emailSender'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tripix-ruby.vercel.app'

function getServerClient(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

// ── GET /api/trips/[id]/members ──────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tripId = params.id
  const supabase = getServerClient(req)

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('trip_members')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with profile display names where possible
  const service = getServiceClient()
  const userIds = (data || [])
    .map((m: { user_id: string | null }) => m.user_id)
    .filter(Boolean) as string[]

  let profileMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    if (profiles) {
      profileMap = Object.fromEntries(
        profiles.map((p: { id: string; full_name?: string; email?: string }) => [
          p.id,
          p.full_name || p.email || p.id,
        ])
      )
    }
  }

  const enriched = (data || []).map((m: Record<string, unknown>) => ({
    ...m,
    display_name:
      (m.user_id && profileMap[m.user_id as string]) ||
      m.invited_name ||
      m.invited_email ||
      'משתמש לא ידוע',
  }))

  return NextResponse.json({ members: enriched })
}

// ── POST /api/trips/[id]/members ─────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tripId = params.id
  const supabase = getServerClient(req)
  const service = getServiceClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Must be owner/editor to invite
  const { data: myMembership } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const { data: tripRow } = await supabase
    .from('trips')
    .select('id, name, user_id')
    .eq('id', tripId)
    .single()

  const isOwner = tripRow?.user_id === user.id
  const canInvite = isOwner || myMembership?.role === 'editor' || myMembership?.role === 'owner'

  if (!canInvite) {
    return NextResponse.json({ error: 'אין הרשאה להזמין חברים' }, { status: 403 })
  }

  const body = await req.json()
  const { email, name, role = 'viewer' } = body as { email: string; name?: string; role?: string }

  if (!email) {
    return NextResponse.json({ error: 'נדרש אימייל' }, { status: 400 })
  }
  if (!['owner', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'תפקיד לא חוקי' }, { status: 400 })
  }

  // Check if already member
  const { data: existing } = await service
    .from('trip_members')
    .select('id, status')
    .eq('trip_id', tripId)
    .eq('invited_email', email.toLowerCase())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'המשתמש כבר הוזמן' }, { status: 409 })
  }

  // Resolve user_id if account exists
  const { data: authUsers } = await service.auth.admin.listUsers()
  const existingUser = (authUsers?.users || []).find(
    (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
  )

  const { data: member, error: insertErr } = await service
    .from('trip_members')
    .insert({
      trip_id: tripId,
      user_id: existingUser?.id || null,
      invited_email: email.toLowerCase(),
      invited_name: name || null,
      role,
      status: existingUser ? 'active' : 'pending',
      joined_at: existingUser ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Send invitation email
  const tripName = tripRow?.name || 'הטיול'
  const inviteLink = `${APP_URL}/invite?trip=${tripId}&email=${encodeURIComponent(email)}`

  await sendEmail({
    to: email,
    subject: `הוזמנת לטיול "${tripName}" ב-Tripix 🌍`,
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
        <h2 style="color:#6C47FF">הוזמנת לטיול! ✈️</h2>
        <p>שלום${name ? ` ${name}` : ''},</p>
        <p>הוזמנת להצטרף לטיול <strong>"${tripName}"</strong> ב-Tripix.</p>
        <p>תפקידך בטיול: <strong>${role === 'editor' ? 'עורך' : 'צופה'}</strong></p>
        <a href="${inviteLink}"
           style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6C47FF;color:white;border-radius:12px;text-decoration:none;font-weight:bold">
          הצטרף לטיול
        </a>
        <p style="margin-top:24px;color:#888;font-size:12px">
          אם אין לך חשבון Tripix, הקישור ייקח אותך להרשמה קצרה.
        </p>
      </div>
    `,
  })

  return NextResponse.json({ member }, { status: 201 })
}
