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

const EMAIL_PARSE_PROMPT = `אתה מנתח מיילי אישור הזמנה מפלטפורמות תיירות כגון Booking.com, Airbnb, אל-על, Ryanair, Expedia, Hotels.com, ועוד.

קרא את תוכן המייל וחלץ את כל המידע הרלוונטי. החזר JSON בלבד (ללא markdown, ללא backticks):

{
  "booking_type": "hotel|flight|car_rental|activity|tour|insurance|other",
  "vendor": "שם הפלטפורמה/חברה",
  "destination_city": "שם העיר",
  "destination_country": "שם המדינה",
  "check_in": "YYYY-MM-DD או null",
  "check_out": "YYYY-MM-DD או null",
  "departure_date": "YYYY-MM-DD או null",
  "return_date": "YYYY-MM-DD או null",
  "amount": 0.00,
  "currency": "EUR|ILS|USD|GBP|THB|JPY",
  "confirmation_number": "מספר אישור/הזמנה",
  "traveler_names": ["שמות הנוסעים אם מופיעים"],
  "hotel_name": "שם המלון אם רלוונטי",
  "flight_number": "מספר טיסה אם רלוונטי",
  "airline": "חברת תעופה אם רלוונטי",
  "num_guests": 1,
  "summary": "תקציר קצר בעברית של ההזמנה",
  "confidence": 0.9
}

הנחיות:
- amount = הסכום הסופי ששולם (Total/Grand Total)
- אם יש כמה סכומים, קח את הסכום הכולל
- destination_city = העיר הרלוונטית (עיר המלון, עיר היעד של הטיסה וכו')
- confidence = ציון 0-1 לפי כמה בטוח אתה בניתוח
- אם אין מספר אישור, כתוב "N/A"
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
