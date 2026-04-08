import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const tripId = req.nextUrl.searchParams.get('trip_id')
  if (!tripId) return NextResponse.json({ error: 'trip_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('trip_memories')
    .select('*')
    .eq('trip_id', tripId)
    .order('memory_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { trip_id, memory_date, text, rating, photo_url } = body

  // Upsert — one memory per day
  const { data: existing } = await supabase
    .from('trip_memories')
    .select('id')
    .eq('trip_id', trip_id)
    .eq('memory_date', memory_date)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('trip_memories')
      .update({ text, rating, photo_url, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } else {
    const { data, error } = await supabase
      .from('trip_memories')
      .insert({ trip_id, memory_date, text, rating, photo_url })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await supabase.from('trip_memories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
