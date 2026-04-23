import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { buildExpenseFingerprint, findDuplicateExpense } from '@/lib/dedup'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tripId = searchParams.get('trip_id')
  const category = searchParams.get('category')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (tripId) query = query.eq('trip_id', tripId)
  if (category) query = query.eq('category', category)
  if (from) query = query.gte('expense_date', from)
  if (to) query = query.lte('expense_date', to)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { force, ...expense } = body as Record<string, unknown> & { force?: boolean }

  if (!expense.trip_id || expense.amount == null || !expense.expense_date || !expense.title) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
  }

  // Enforce the product rule at the API layer (DB CHECK enforces it again
  // as a backstop). Zero-amount rows never belong on the Expenses page —
  // they come from failed OCR parses or multi-leg flight phantoms.
  const amountNumber = Number(expense.amount)
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return NextResponse.json(
      { error: 'invalid_amount', message: 'סכום חייב להיות גדול מ-0' },
      { status: 400 },
    )
  }

  // Two-layer dedup:
  //   1. Soft pre-check via fingerprint → return existing row with 409 when the
  //      client can offer a "save anyway" path (force=true bypasses).
  //   2. DB unique index on `content_hash` is the hard backstop against races.
  const fingerprint = buildExpenseFingerprint(
    String(expense.trip_id),
    Number(expense.amount),
    String(expense.expense_date),
    String(expense.title),
  )

  if (!force) {
    const duplicate = await findDuplicateExpense(fingerprint)
    if (duplicate) {
      return NextResponse.json(
        { error: 'duplicate', reason: 'content', duplicate },
        { status: 409 },
      )
    }
  }

  const payload = force
    ? expense
    : { ...expense, content_hash: fingerprint }

  const { data, error } = await supabase
    .from('expenses')
    .insert(payload)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      const duplicate = await findDuplicateExpense(fingerprint)
      return NextResponse.json(
        { error: 'duplicate', reason: 'content', duplicate },
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

  const { error } = await supabase.from('expenses').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
