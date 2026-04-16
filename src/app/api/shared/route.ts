import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - fetch shared trip data with members and balances
export async function GET(req: NextRequest) {
  const tripId = req.nextUrl.searchParams.get('trip_id')

  if (!tripId) {
    return NextResponse.json({ error: 'trip_id required' }, { status: 400 })
  }

  // Get trip with members
  const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
  const { data: members } = await supabase.from('trip_members').select('*').eq('trip_id', tripId).order('joined_at')
  const { data: expenses } = await supabase.from('expenses').select('*').eq('trip_id', tripId).order('expense_date', { ascending: false })
  const { data: splits } = await supabase.from('expense_splits').select('*').in('expense_id', (expenses || []).map(e => e.id))
  const { data: settlements } = await supabase.from('settlements').select('*').eq('trip_id', tripId)

  // Calculate balances
  const balances: Record<string, { paid: number; owes: number }> = {}
  for (const m of members || []) {
    balances[m.id] = { paid: 0, owes: 0 }
  }

  for (const exp of expenses || []) {
    if (exp.paid_by && balances[exp.paid_by]) {
      balances[exp.paid_by].paid += Number(exp.amount_ils)
    }
    const expSplits = (splits || []).filter(s => s.expense_id === exp.id)
    for (const s of expSplits) {
      if (balances[s.member_id]) {
        balances[s.member_id].owes += Number(s.amount_ils)
      }
    }
  }

  // Account for settlements
  for (const s of settlements || []) {
    if (balances[s.from_member]) balances[s.from_member].paid += Number(s.amount_ils)
    if (balances[s.to_member]) balances[s.to_member].owes += Number(s.amount_ils)
  }

  const memberBalances = (members || []).map(m => ({
    member: m,
    totalPaid: balances[m.id]?.paid || 0,
    totalOwed: balances[m.id]?.owes || 0,
    balance: (balances[m.id]?.paid || 0) - (balances[m.id]?.owes || 0),
  }))

  // Calculate simplified debts
  const debts = simplifyDebts(memberBalances, members || [])

  return NextResponse.json({ trip, members, expenses, splits, settlements, memberBalances, debts })
}

// POST - add member or create expense with splits
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  if (action === 'add_member') {
    const { trip_id, display_name, email, role } = body
    const { data, error } = await supabase.from('trip_members').insert({
      trip_id,
      user_id: null,   // null for non-registered / guest members
      display_name,
      email: email || null,
      role: role || 'member',
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'remove_member') {
    const { member_id } = body
    const { error } = await supabase.from('trip_members').delete().eq('id', member_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'add_expense') {
    const { trip_id, title, category, amount, currency, expense_date, paid_by, split_type, split_members, notes } = body

    // Create expense
    const { data: expense, error } = await supabase.from('expenses').insert({
      trip_id,
      title,
      category: category || 'other',
      amount,
      currency: currency || 'ILS',
      expense_date,
      paid_by,
      split_type: split_type || 'equal',
      source: 'manual',
      notes,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Create splits
    if (split_members && split_members.length > 0 && expense) {
      const amountIls = expense.amount_ils || amount
      const splitAmount = amountIls / split_members.length

      const splitRows = split_members.map((memberId: string) => ({
        expense_id: expense.id,
        member_id: memberId,
        amount_ils: Number(splitAmount.toFixed(2)),
      }))

      await supabase.from('expense_splits').insert(splitRows)
    }

    return NextResponse.json(expense)
  }

  if (action === 'settle') {
    const { trip_id, from_member, to_member, amount_ils, notes } = body
    const { data, error } = await supabase.from('settlements').insert({
      trip_id,
      from_member,
      to_member,
      amount_ils,
      notes,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

function simplifyDebts(
  memberBalances: { member: { id: string; display_name: string }; balance: number }[],
  members: { id: string; display_name: string }[]
) {
  const debts: { from: string; fromName: string; to: string; toName: string; amount: number }[] = []

  // Positive balance = owed money, negative = owes money
  const positive = memberBalances.filter(m => m.balance > 0.01).map(m => ({ ...m }))
  const negative = memberBalances.filter(m => m.balance < -0.01).map(m => ({ ...m }))

  positive.sort((a, b) => b.balance - a.balance)
  negative.sort((a, b) => a.balance - b.balance)

  let i = 0, j = 0
  while (i < negative.length && j < positive.length) {
    const amount = Math.min(-negative[i].balance, positive[j].balance)
    if (amount > 0.01) {
      debts.push({
        from: negative[i].member.id,
        fromName: negative[i].member.display_name,
        to: positive[j].member.id,
        toName: positive[j].member.display_name,
        amount: Number(amount.toFixed(2)),
      })
    }
    negative[i].balance += amount
    positive[j].balance -= amount
    if (Math.abs(negative[i].balance) < 0.01) i++
    if (Math.abs(positive[j].balance) < 0.01) j++
  }

  return debts
}
