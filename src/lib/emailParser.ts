/**
 * emailParser.ts
 * Parses booking confirmation emails using Claude.
 * Extracts: booking type, destination, dates, amount, vendor, confirmation#
 */

import Anthropic from '@anthropic-ai/sdk'
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'

export interface ParsedBooking {
  booking_type: 'hotel' | 'flight' | 'car_rental' | 'activity' | 'tour' | 'insurance' | 'other'
  vendor: string               // "Booking.com", "El Al", "Airbnb" etc.
  destination_city: string     // "Barcelona", "Bangkok"
  destination_country: string  // "Spain", "Thailand"
  check_in?: string            // YYYY-MM-DD (hotel/car)
  check_out?: string           // YYYY-MM-DD (hotel/car)
  departure_date?: string      // YYYY-MM-DD (flight)
  return_date?: string         // YYYY-MM-DD (flight return)
  amount: number
  currency: string             // "EUR", "ILS", "USD"
  confirmation_number: string
  traveler_names: string[]
  hotel_name?: string
  flight_number?: string
  airline?: string
  num_guests?: number
  summary: string              // 1-line Hebrew summary
  confidence: number           // 0-1 how sure is the AI
}

const EMAIL_PARSE_PROMPT = `אתה מנתח מיילי אישור הזמנה בתחום הנסיעות והתיירות.

⚠️ ראשית החלט: האם זה מייל אישור הזמנה אמיתי?

מייל אישור אמיתי (confidence >= 0.6):
✅ מכיל מספר הזמנה / אישור ספציפי
✅ כרטיס טיסה — מספר טיסה, תאריך, שם נוסע
✅ אישור מלון — שם מלון, תאריכי צ'ק-אין/אאוט
✅ אישור נסיעה (Uber/Gett/Bolt/Taxi) — תאריך, מחיר, מסלול
✅ אישור פעילות — תאריך, שם האטרקציה, מחיר
✅ חשבונית/קבלה — סכום, שירות שניתן
✅ ביטוח נסיעות — תאריכי כיסוי, פוליסה

מייל שיווקי (confidence <= 0.2):
❌ "הצעות מיוחדות", "חסכו X%", "deal of the week"
❌ ניוזלטר, המלצות יעד, עדכוני מחירים
❌ "הנה המלצות בשבילך", "אל תפספסו", "עדיין לא הזמנת?"
❌ אין מספר הזמנה ואין שם נוסע ואין תאריך ספציפי

סוגי הזמנות:
- hotel = מלון, צימר, Airbnb, hostel, villa
- flight = טיסה (El Al, Ryanair, WizzAir, EasyJet, כולל low-cost)
- car_rental = השכרת רכב
- activity = אטרקציה, סיור, כרטיס כניסה, טיול מאורגן
- tour = חבילת נסיעה מאורגנת
- insurance = ביטוח נסיעות
- taxi = Uber, Gett, Bolt, Yango, מונית

⚠️ חשוב מאוד לשדה destination_city:
- עבור מלון / פעילות: העיר שבה נמצא המלון/הפעילות
- עבור טיסה: עיר ה-יעד (הגעה), לא עיר המוצא
  → דוגמה: טיסה TLV → BKK = destination_city: "Bangkok"
  → דוגמה: טיסה BCN → HKT = destination_city: "Phuket"
  → עבור טיסות חזרה, השתמש ביעד של טיסת ההלוך

החזר JSON בלבד (ללא markdown, ללא backticks):
{
  "booking_type": "hotel|flight|car_rental|activity|tour|insurance|taxi|other",
  "vendor": "שם הפלטפורמה/חברה",
  "destination_city": "עיר היעד (ראה הנחיות למעלה)",
  "destination_country": "מדינת היעד באנגלית (Thailand, Spain וכו')",
  "check_in": "YYYY-MM-DD או null",
  "check_out": "YYYY-MM-DD או null",
  "departure_date": "YYYY-MM-DD או null",
  "return_date": "YYYY-MM-DD או null",
  "amount": 0.00,
  "currency": "EUR|ILS|USD|GBP|THB|JPY",
  "confirmation_number": "מספר אישור/הזמנה — חובה אם קיים, אחרת N/A",
  "traveler_names": ["שמות הנוסעים"],
  "hotel_name": "שם המלון אם רלוונטי",
  "flight_number": "מספר טיסה",
  "airline": "חברת תעופה",
  "num_guests": 1,
  "summary": "תקציר קצר בעברית — מה הוזמן, מתי, כמה עלה",
  "confidence": 0.9
}

כללי confidence:
- 0.9-1.0: אישור ברור עם מספר הזמנה + תאריכים + סכום
- 0.7-0.8: אישור עם רוב הפרטים (גם אם חסרים כמה)
- 0.5-0.6: נראה כמו אישור, פרטים חסרים
- 0.3-0.4: לא ברור אם זה אישור
- 0.1-0.2: מייל שיווקי / לא רלוונטי

- amount = הסכום הסופי ששולם (Total), לא מחיר מוצע
- תחזיר null בשדות שלא נמצאו`

/**
 * Strip HTML tags and decode entities for a cleaner text version.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Extract and parse JSON from a Claude response text block */
function extractJson(raw: string): ParsedBooking | null {
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  return JSON.parse(cleaned) as ParsedBooking
}

/** Pick the result with higher confidence; fall back to whichever is non-null */
function mergeResults(
  a: ParsedBooking | null,
  b: ParsedBooking | null,
): ParsedBooking | null {
  if (!a && !b) return null
  if (!a) return b
  if (!b) return a
  return a.confidence >= b.confidence ? a : b
}

/**
 * Parse a booking confirmation email using Claude.
 *
 * @param emailText   Plain text or HTML of the email body
 * @param subject     Email subject line
 * @param pdfBase64   Optional standard-base64 PDF attachment to parse instead of / alongside the body
 */
export async function parseBookingEmail(
  emailText: string,
  subject: string,
  pdfBase64?: string,
): Promise<ParsedBooking | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[emailParser] No ANTHROPIC_API_KEY')
    return null
  }

  const anthropic = new Anthropic({ apiKey })

  // ── Parse from PDF (claude-opus-4-5 supports document blocks) ───────────────
  let pdfResult: ParsedBooking | null = null
  if (pdfBase64) {
    try {
      const docBlock: DocumentBlockParam = {
        type: 'document',
        source: {
          type:       'base64',
          media_type: 'application/pdf',
          data:       pdfBase64,
        },
      }
      const textBlock2: TextBlockParam = {
        type: 'text',
        text: `נושא המייל: ${subject}\n\n${EMAIL_PARSE_PROMPT}`,
      }

      const pdfResponse = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [docBlock, textBlock2],
        }],
      })

      const textBlock = pdfResponse.content.find(b => b.type === 'text')
      if (textBlock && textBlock.type === 'text') {
        pdfResult = extractJson(textBlock.text)
      }
    } catch (err) {
      console.error('[emailParser] PDF parse error:', err)
    }
  }

  // ── Parse from email body text ───────────────────────────────────────────────
  let bodyResult: ParsedBooking | null = null
  if (emailText) {
    // Keep first 8000 chars to avoid token limits
    const text = htmlToText(emailText).slice(0, 8000)
    try {
      const bodyResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `נושא המייל: ${subject}\n\nתוכן המייל:\n${text}\n\n${EMAIL_PARSE_PROMPT}`,
          },
        ],
      })

      const textBlock = bodyResponse.content.find(b => b.type === 'text')
      if (textBlock && textBlock.type === 'text') {
        bodyResult = extractJson(textBlock.text)
      }
    } catch (err) {
      console.error('[emailParser] Body parse error:', err)
    }
  }

  // Return whichever result has higher confidence (PDF preferred on tie)
  return mergeResults(pdfResult, bodyResult)
}
