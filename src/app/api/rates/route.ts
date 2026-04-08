import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Fetch historical exchange rate for a specific date
// Uses frankfurter.app (free, no API key needed)
async function fetchRate(from: string, to: string, date: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.rates?.[to] || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') || 'USD'
  const to = searchParams.get('to') || 'ILS'
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  // Check cache in currency_rates table
  const cacheKey = `${from}_${to}_${date}`
  const { data: cached } = await supabase
    .from('currency_rates')
    .select('rate_to_ils')
    .eq('currency', cacheKey)
    .single()

  if (cached) {
    return NextResponse.json({ rate: cached.rate_to_ils, from, to, date, cached: true })
  }

  // Fetch from API
  const rate = await fetchRate(from, to, date)
  if (!rate) {
    // Fallback to static rates
    const fallback: Record<string, number> = { USD: 3.70, THB: 0.105, EUR: 4.00, GBP: 4.65 }
    const fallbackRate = to === 'ILS' ? (fallback[from] || 1) : (1 / (fallback[to] || 1))
    return NextResponse.json({ rate: fallbackRate, from, to, date, cached: false, fallback: true })
  }

  // Cache the rate
  await supabase.from('currency_rates').upsert({
    currency: cacheKey,
    rate_to_ils: rate,
    updated_at: new Date().toISOString(),
  })

  return NextResponse.json({ rate, from, to, date, cached: false })
}

// Batch convert: get ILS rate for a currency on a date
export async function POST(request: NextRequest) {
  const { expenses } = await request.json() as { expenses: { amount: number; currency: string; date: string }[] }

  const results = await Promise.all(
    expenses.map(async (exp) => {
      if (exp.currency === 'ILS') return { ...exp, amount_ils: exp.amount }

      const res = await fetch(`https://api.frankfurter.app/${exp.date}?from=${exp.currency}&to=ILS`)
      if (!res.ok) {
        const fallback: Record<string, number> = { USD: 3.70, THB: 0.105, EUR: 4.00, GBP: 4.65 }
        return { ...exp, amount_ils: Math.round(exp.amount * (fallback[exp.currency] || 1) * 100) / 100 }
      }

      const data = await res.json()
      const rate = data.rates?.ILS || 1
      return { ...exp, amount_ils: Math.round(exp.amount * rate * 100) / 100, rate }
    })
  )

  return NextResponse.json({ results })
}
