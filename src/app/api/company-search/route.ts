import { NextRequest, NextResponse } from 'next/server'

const RESOURCE_ID = 'f004176c-b85f-4542-8901-7b3176f9a054'
const API_BASE    = 'https://data.gov.il/api/3/action/datastore_search'

export interface CompanyRecord {
  id:          number   // מספר חברה (ח.פ)
  name:        string   // שם חברה
  nameEn:      string   // שם באנגלית
  status:      string   // סטטוס חברה
  city:        string   // שם עיר
  street:      string   // שם רחוב
  houseNum:    string   // מספר בית
  zip:         string   // מיקוד
  address:     string   // computed full address
}

function toRecord(raw: Record<string, unknown>): CompanyRecord {
  const city    = String(raw['שם עיר']    ?? '')
  const street  = String(raw['שם רחוב']  ?? '')
  const houseNo = String(raw['מספר בית'] ?? '')

  // The API stores בע"מ as בע~מ — normalise
  const name = String(raw['שם חברה'] ?? '').replace(/~/g, '"')

  const addressParts = [street, houseNo, city].filter(Boolean)
  const address = addressParts.join(' ').trim()

  return {
    id:       Number(raw['מספר חברה'] ?? 0),
    name,
    nameEn:   String(raw['שם באנגלית'] ?? ''),
    status:   String(raw['סטטוס חברה']  ?? ''),
    city,
    street,
    houseNum: houseNo,
    zip:      String(raw['מיקוד'] ?? ''),
    address,
  }
}

/**
 * GET /api/company-search?q=<query>&limit=<n>
 * Searches active Israeli companies from data.gov.il (רשם החברות).
 */
export async function GET(req: NextRequest) {
  const q     = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '10'), 20)

  if (q.length < 2) {
    return NextResponse.json([])
  }

  try {
    const params = new URLSearchParams({
      resource_id: RESOURCE_ID,
      q,
      limit:  String(limit),
      fields: 'מספר חברה,שם חברה,שם באנגלית,סטטוס חברה,שם עיר,שם רחוב,מספר בית,מיקוד',
      filters: JSON.stringify({ 'סטטוס חברה': 'פעילה' }),
      sort:   'rank desc',
    })

    const res = await fetch(`${API_BASE}?${params}`, {
      next:    { revalidate: 3600 },   // cache 1 hour per query
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) {
      return NextResponse.json([], { status: 200 })
    }

    const data = await res.json()
    if (!data.success || !data.result?.records) {
      return NextResponse.json([])
    }

    const records: CompanyRecord[] = data.result.records.map(toRecord)
    return NextResponse.json(records)

  } catch (err) {
    console.error('[company-search] API error:', err)
    return NextResponse.json([])
  }
}
