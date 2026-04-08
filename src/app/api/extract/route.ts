import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const RECEIPT_PROMPT = `אתה מנתח קבלות לטיול תאילנד. חלץ מהקבלה ותחזיר JSON בלבד (ללא markdown, ללא backticks):
{
  "title": "שם העסק או תיאור ההוצאה",
  "category": "food|taxi|activity|shopping|hotel|flight|ferry|other",
  "amount": 0,
  "currency": "THB|ILS|USD|EUR|GBP",
  "date": "YYYY-MM-DD",
  "notes": "פרטים נוספים"
}
אם אין מטבע מזוהה — THB. אם אין תאריך — השתמש בתאריך היום.
קטגוריות: food=מסעדות/אוכל, taxi=הסעות/grab, activity=סיורים/כניסה, shopping=קניות, hotel=לינה, flight=טיסה, ferry=מעבורת, other=אחר.`

const DOCUMENT_PROMPT = `אתה מנתח מסמכי הזמנה לטיול תאילנד 11.4–1.5.2026. הנוסעים: אומר (Omer), אשתו, תינוקת.
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
      "departure_airport": "קוד נמל תעופה (IATA)",
      "arrival_city": "עיר יעד",
      "arrival_airport": "קוד נמל תעופה (IATA)",
      "departure_date": "YYYY-MM-DD",
      "departure_time": "HH:MM",
      "arrival_date": "YYYY-MM-DD",
      "arrival_time": "HH:MM",
      "cabin_class": "Economy|Business|First",
      "is_connection": false
    }
  ],
  "has_connection": false,
  "connection_city": "עיר קונקשיין אם יש",
  "connection_duration_minutes": 0,
  "hotel_name": "שם מלון",
  "check_in": "YYYY-MM-DD",
  "check_out": "YYYY-MM-DD",
  "valid_until": "YYYY-MM-DD",
  "passport_number": "מספר דרכון",
  "full_name": "שם מלא באנגלית כפי שמופיע בדרכון",
  "first_name": "שם פרטי",
  "last_name": "שם משפחה",
  "date_of_birth": "YYYY-MM-DD",
  "gender": "M|F",
  "nationality": "לאומיות באנגלית",
  "issuing_country": "מדינה מנפיקה באנגלית",
  "issue_date": "YYYY-MM-DD תאריך הנפקה",
  "mrz": "שורות MRZ מתחתית הדרכון",
  "raw_text": "טקסט חשוב מהמסמך"
}
חשוב לטיסות:
- total_amount = הסכום הסופי בלבד (Total). התעלם מסכומי ביניים (מיסים, תוספות).
- legs = מערך של כל רגלי הטיסה בנפרד. טיסה עם קונקשיין = כמה legs.
- has_connection = true אם יש עצירת ביניים/קונקשיין.
- connection_duration_minutes = זמן המתנה בקונקשיין בדקות (חשב מזמן נחיתה לזמן המראה הבא).
- אם יש כמה נוסעים, ה-total_amount הוא הסכום הכולל לכל הנוסעים.
השאר שדות ריקים כ-null אם לא רלוונטיים. זהה נוסעים לפי שמות.`

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function isImageType(mediaType: string): mediaType is ImageMediaType {
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)
}

export async function POST(request: NextRequest) {
  try {
    const { base64, mediaType, context } = await request.json()

    if (!base64 || !mediaType) {
      return NextResponse.json({ error: 'חסרים נתונים' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'NO_API_KEY',
        message: 'מפתח Claude API לא הוגדר — מילוי ידני',
      }, { status: 200 })
    }

    const anthropic = new Anthropic({ apiKey })
    const prompt = context === 'receipt' ? RECEIPT_PROMPT : DOCUMENT_PROMPT

    // Build the content block based on file type
    let fileContent: Anthropic.Messages.ContentBlockParam

    if (mediaType === 'application/pdf') {
      // PDF — use document type
      fileContent = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      }
    } else if (isImageType(mediaType)) {
      // Image — use image type
      fileContent = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64,
        },
      }
    } else {
      // Unsupported type — try as image/jpeg fallback
      fileContent = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: base64,
        },
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'לא התקבלה תשובה מ-Claude' }, { status: 500 })
    }

    const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(cleaned)

    return NextResponse.json({ data, context })
  } catch (error) {
    console.error('Extract error:', error)
    const message = error instanceof Error ? error.message : 'שגיאה בעיבוד'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
