import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SplitParticipant } from '@/types'

function getServerClient(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

// ── GET /api/trips/[id]/splits ────────────────────────────────
// Returns splits + computed debt summary
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

  const { data: splits, error } = await supabase
    .from('splits')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Compute debts ─────────────────────────────────────────
  // Balance map: name → net balance (positive = owed to them, negative = owes)
  const balanceMap: Record<string, number> = {}

  for (const split of splits || []) {
    const participants: SplitParticipant[] = split.participants || []
    const payer = split.paid_by_name

    if (!balanceMap[payer]) balanceMap[payer] = 0

    for (const p of participants) {
      const name = p.name
      if (!balanceMap[name]) balanceMap[name] = 0

      if (!p.paid) {
        // p owes payer their share
        balanceMap[name] -= p.amount
        balanceMap[payer] += p.amount
      }
    }
  }

  // Simplify debts: greedy algorithm
  const debtors = Object.entries(balanceMap)
    .filter(([, b]) => b < 0)
    .map(([name, balance]) => ({ name, balance }))
    .sort((a, b) => a.balance - b.balance)

  const creditors = Object.entries(balanceMap)
    .filter(([, b]) => b > 0)
    .map(([name, balance]) => ({ name, balance }))
    .sort((a, b) => b.balance - a.balance)

  const debts: Array<{ fromName: string; toName: string; amount: number; currency: string }> = []

  let di = 0
  let ci = 0
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di]
    const creditor = creditors[ci]
    const amount = Math.min(-debtor.balance, creditor.balance)

    if (amount > 0.01) {
      debts.push({
        fromName: debtor.name,
        toName: creditor.name,
        amount: Math.round(amount * 100) / 100,
        currency: (splits || [])[0]?.currency || 'ILS',
      })
    }

    debtor.balance += amount
    creditor.balance -= amount

    if (Math.abs(debtor.balance) < 0.01) di++
    if (Math.abs(creditor.balance) < 0.01) ci++
  }

  return NextResponse.json({ splits: splits || [], debts, balanceMap })
}

// ── POST /api/trips/[id]/splits ───────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tripId = params.id
  const supabase = getServerClient(req)

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    expense_id,
    paid_by_user_id,
    paid_by_name,
    total_amount,
    currency = 'ILS',
    description,
    split_type = 'equal',
    participants,
  } = body as {
    expense_id?: string
    paid_by_user_id?: string
    paid_by_name: string
    total_amount: number
    currency?: string
    description?: string
    split_type?: 'equal' | 'custom'
    participants: SplitParticipant[]
  }

  if (!paid_by_name || !total_amount || !participants?.length) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  // For equal split — recompute amounts
  let finalParticipants = participants
  if (split_type === 'equal') {
    const share = Math.round((total_amount / participants.length) * 100) / 100
    finalParticipants = participants.map(p => ({ ...p, amount: share }))
  }

  const { data: split, error } = await supabase
    .from('splits')
    .insert({
      trip_id: tripId,
      expense_id: expense_id || null,
      paid_by_user_id: paid_by_user_id || null,
      paid_by_name,
      total_amount,
      currency,
      description: description || null,
      split_type,
      participants: finalParticipants,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ split }, { status: 201 })
}

// ── PATCH /api/trips/[id]/splits — mark participant as paid ──
// Body: { split_id, participant_name, paid: true }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tripId = params.id
  const supabase = getServerClient(req)

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { split_id, participant_name, paid } = body as {
    split_id: string
    participant_name: string
    paid: boolean
  }

  // Fetch current split
  const { data: splitRow, error: fetchErr } = await supabase
    .from('splits')
    .select('*')
    .eq('id', split_id)
    .eq('trip_id', tripId)
    .single()

  if (fetchErr || !splitRow) {
    return NextResponse.json({ error: 'פיצול לא נמצא' }, { status: 404 })
  }

  const updatedParticipants: SplitParticipant[] = (splitRow.participants || []).map(
    (p: SplitParticipant) => (p.name === participant_name ? { ...p, paid } : p)
  )

  const { data: updated, error: updateErr } = await supabase
    .from('splits')
    .update({ participants: updatedParticipants })
    .eq('id', split_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ split: updated })
}
