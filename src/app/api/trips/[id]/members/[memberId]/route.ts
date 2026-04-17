import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

function getServerClient(req: NextRequest): AnySupabase {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

function getServiceClient(): AnySupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

async function canManageMembers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: AnySupabase,
  userId: string,
  tripId: string
): Promise<boolean> {
  const { data: trip } = await client
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single()
  if ((trip as { user_id: string } | null)?.user_id === userId) return true

  const { data: membership } = await client
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()
  const role = (membership as { role: string } | null)?.role
  return role === 'owner' || role === 'editor'
}

// ── PATCH /api/trips/[id]/members/[memberId] — change role ───
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  const { id: tripId, memberId } = params
  const supabase = getServerClient(req)
  const service = getServiceClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await canManageMembers(supabase as AnySupabase, user.id, tripId)
  if (!allowed) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const body = await req.json()
  const { role, status } = body as { role?: string; status?: string }

  const updates: Record<string, unknown> = {}
  if (role && ['editor', 'viewer'].includes(role)) updates.role = role
  if (status && ['active', 'declined'].includes(status)) {
    updates.status = status
    if (status === 'active') updates.joined_at = new Date().toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'אין שדות לעדכון' }, { status: 400 })
  }

  const { data, error } = await service
    .from('trip_members')
    .update(updates)
    .eq('id', memberId)
    .eq('trip_id', tripId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ member: data })
}

// ── DELETE /api/trips/[id]/members/[memberId] — remove member ─
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  const { id: tripId, memberId } = params
  const supabase = getServerClient(req)
  const service = getServiceClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch the member row first
  const { data: memberRow } = await service
    .from('trip_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('trip_id', tripId)
    .single()

  const typedRow = memberRow as { user_id: string | null; role: string } | null

  if (!typedRow) {
    return NextResponse.json({ error: 'חבר לא נמצא' }, { status: 404 })
  }

  // Prevent removing the owner
  if (typedRow.role === 'owner') {
    return NextResponse.json({ error: 'לא ניתן להסיר את הבעלים' }, { status: 403 })
  }

  // Allow: trip owner, admin, or self-removal
  const allowed =
    (await canManageMembers(supabase as AnySupabase, user.id, tripId)) ||
    typedRow.user_id === user.id

  if (!allowed) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const { error } = await service
    .from('trip_members')
    .delete()
    .eq('id', memberId)
    .eq('trip_id', tripId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
