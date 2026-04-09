import { NextResponse } from 'next/server'

/**
 * GET /api/rates/all
 * Returns live exchange rates for all major currencies vs ILS.
 * Source: exchangerate-api.com (free, no API key, updated every 24h).
 * Server-side to avoid CORS issues in the browser.
 * Cached for 30 minutes via Next.js revalidation.
 */

export const revalidate = 1800 // 30 min

const MAJOR_CODES = [
  'USD','EUR','GBP','JPY','THB','AED','SGD','TRY',
  'CHF','CAD','AUD','INR','EGP','IDR','MXN','CNY',
]

export async function GET() {
  try {
    // Primary: exchangerate-api (free, no key, 170+ currencies)
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/ILS', {
      next: { revalidate: 1800 },
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as {
      rates: Record<string, number>
      date: string
      time_last_updated?: number
    }

    // data.rates[X] = amount of X per 1 ILS
    // We want: 1 X = Y ILS → Y = 1 / data.rates[X]
    const result: Record<string, number> = {}
    for (const code of MAJOR_CODES) {
      const r = data.rates[code]
      if (r && r > 0) result[code] = 1 / r
    }

    return NextResponse.json({
      rates: result,
      base: 'ILS',
      date: data.date,
      source: 'exchangerate-api.com',
    })
  } catch (err) {
    // Fallback: try frankfurter.app (ECB data, fewer currencies)
    try {
      const codes = ['USD','EUR','GBP','JPY','THB','AED','SGD','TRY','CHF','CAD','AUD','INR'].join(',')
      const res2 = await fetch(`https://api.frankfurter.app/latest?from=ILS&to=${codes}`)
      if (!res2.ok) throw new Error('frankfurter failed')
      const data2 = await res2.json() as { rates: Record<string, number>; date: string }

      const result: Record<string, number> = {}
      for (const [code, r] of Object.entries(data2.rates)) {
        if (r > 0) result[code] = 1 / r
      }

      return NextResponse.json({
        rates: result,
        base: 'ILS',
        date: data2.date,
        source: 'frankfurter.app (fallback)',
      })
    } catch {
      // Static fallback
      return NextResponse.json({
        rates: {
          USD: 3.72, EUR: 4.05, GBP: 4.72, JPY: 0.025,
          THB: 0.108, AED: 1.01, SGD: 2.78, TRY: 0.11,
          CHF: 4.20, CAD: 2.70, AUD: 2.38, INR: 0.045,
        },
        base: 'ILS',
        date: new Date().toISOString().split('T')[0],
        source: 'static-fallback',
        error: String(err),
      })
    }
  }
}
