/**
 * POST /api/documents/reprocess
 * Re-runs Claude extraction on a document and updates extracted_data in Supabase.
 * Body: { documentId: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DOCUMENT_PROMPT = `אתה מנתח מסמכי הזמנה לטיול. הנוסעים: אומר (Omer), אשתו, תינוקת.
חלץ את כל המידע הרלוונטי ותחזיר JSON בלבד (ללא markdown, ללא backticks):
{
  "doc_type": "flight|hotel|ferry|activity|insurance|visa|passport|other",
  "traveler": "omer|wife|baby|all",
  "passenger_name": "שם הנוסע כפי שמופיע במסמך",
  "booking_ref": "מספר הזמנה/PNR",
  "total_amount": 0,
  "total_currency": "ILS|USD|THB|EUR|GBP",
  "legs": [
    {
      "flight_number": "XX123",
      "airline": "שם חברת תעופה",
      "departure_city": "עיר מוצא",
      "departure_airport": "קוד IATA",
      "arrival_city": "עיר יעד",
      "arrival_airport": "קוד IATA",
      "departure_date": "YYYY-MM-DD",
      "departure_time": "HH:MM",
      "arrival_date": "YYYY-MM-DD",
      "arrival_time": "HH:MM",
      "cabin_class": "Economy|Business|First",
      "is_connection": false
    }
  ],
  "has_connection": false,
  "connection_city": null,
  "connection_duration_minutes": 0,
  "hotel_name": "שם מלון",
  "room_type": "סוג החדר",
  "check_in": "YYYY-MM-DD",
  "check_out": "YYYY-MM-DD",
  "nights": 0,
  "additional_services": [
    {
      "service_type": "airport_transfer|vip_lounge|shuttle|meal|spa|activity|other",
      "name": "שם השירות",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "description": "תיאור קצר"
    }
  ],
  "valid_until": "YYYY-MM-DD",
  "passport_number": null,
  "full_name": null,
  "first_name": null,
  "last_name": null,
  "date_of_birth": null,
  "gender": null,
  "nationality": null,
  "issuing_country": null,
  "issue_date": null,
  "mrz": null,
  "raw_text": "טקסט חשוב מהמסמך"
}
חשוב — total_amount: קח את הסכום שהלקוח שילם בפועל (Grand Total / Amount Due). התעלם מ-Subtotal/Base Fare.
חשוב למלונות:
- hotel_name, check_in, check_out, nights (חשב מהפרש), room_type
- additional_services = כל שירות נוסף: airport_transfer, vip_lounge, shuttle, ארוחות, ספא וכד׳
  לכל שירות: service_type, name, date (תאריך השירות), time, description
חשוב לטיסות:
- legs = כל segments בנפרד כולל חזור. דוגמה: TLV→BKK→HKT ביום 11.4 + HKT→BKK→TLV ביום 1.5 = 4 legs.
השאר שדות לא רלוונטיים כ-null.`

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json()
    if (!documentId) return NextResponse.json({ error: 'חסר documentId' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'NO_API_KEY' }, { status: 500 })

    // Fetch document record
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('documents')
      .select('id, file_url, file_type, name')
      .eq('id', documentId)
      .single()

    if (docErr || !doc?.file_url) {
      return NextResponse.json({ error: 'מסמך לא נמצא או חסר קובץ' }, { status: 404 })
    }

    // Fetch the file from Supabase Storage URL
    const fileRes = await fetch(doc.file_url)
    if (!fileRes.ok) return NextResponse.json({ error: 'לא ניתן לטעון את הקובץ' }, { status: 400 })

    const arrayBuffer = await fileRes.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mediaType = (doc.file_type || 'application/pdf') as string

    // Build Claude content block
    type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    const isImage = (mt: string): mt is ImageMediaType =>
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mt)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fileContent: any
    if (mediaType === 'application/pdf') {
      fileContent = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    } else if (isImage(mediaType)) {
      fileContent = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }
    } else {
      fileContent = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } }
    }

    // Run Claude extraction
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: [fileContent, { type: 'text', text: DOCUMENT_PROMPT }] }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'לא התקבלה תשובה מ-Claude' }, { status: 500 })
    }

    const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(cleaned)

    // Update document in Supabase
    const { error: updateErr } = await supabaseAdmin
      .from('documents')
      .update({
        extracted_data: data,
        doc_type: data.doc_type || 'other',
        booking_ref: data.booking_ref || null,
        valid_from: data.check_in || data.legs?.[0]?.departure_date || null,
        valid_until: data.check_out || data.valid_until || data.legs?.at(-1)?.arrival_date || null,
      })
      .eq('id', documentId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
