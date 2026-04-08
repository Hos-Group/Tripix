const rateCache: Record<string, number> = {}

const FALLBACK_RATES: Record<string, number> = {
  USD: 3.70,
  THB: 0.105,
  EUR: 4.00,
  GBP: 4.65,
  ILS: 1,
}

export async function getHistoricalRate(currency: string, date: string): Promise<number> {
  if (currency === 'ILS') return 1

  const cacheKey = `${currency}_ILS_${date}`
  if (rateCache[cacheKey]) return rateCache[cacheKey]

  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=${currency}&to=ILS`)
    if (res.ok) {
      const data = await res.json()
      const rate = data.rates?.ILS
      if (rate) {
        rateCache[cacheKey] = rate
        return rate
      }
    }
  } catch {
    // Fallback
  }

  return FALLBACK_RATES[currency] || 1
}

export async function convertToILS(amount: number, currency: string, date: string): Promise<number> {
  const rate = await getHistoricalRate(currency, date)
  return Math.round(amount * rate * 100) / 100
}
