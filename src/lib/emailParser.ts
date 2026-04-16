/**
 * emailParser.ts
 * Parses booking confirmation emails using Claude.
 * Extracts: booking type, destination, dates, amount, vendor, confirmation#
 *
 * Two modes:
 *  1. parseBookingEmail(text, subject)          — generic parse (no trip context)
 *  2. parseTripBookingEmail(text, subject, ctx) — context-aware parse (trip-aware)
 *
 * The context-aware parser passes the trip's destination, date range and
 * traveler names directly to Claude, so it can accurately determine relevance
 * and produce higher-confidence results with fewer false positives.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'

export interface ParsedBooking {
  booking_type: 'hotel' | 'flight' | 'car_rental' | 'activity' | 'tour' | 'insurance' | 'inflight' | 'taxi' | 'food' | 'sim' | 'other'
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
  trip_relevant?: boolean      // true if booking matches the given trip context
  // Business-specific fields
  is_business_expense?: boolean // true if it's a tax invoice / company-addressed bill
  tax_invoice_number?: string   // חשבונית מס number (Israeli VAT invoice)
  invoice_to?: string           // company/entity the invoice is addressed to
}

/** Optional trip context to feed Claude for context-aware parsing */
export interface TripContext {
  destination:    string    // e.g. "Thailand", "ספרד"
  startDate:      string    // YYYY-MM-DD
  endDate:        string    // YYYY-MM-DD
  travelerNames:  string[]  // ["Omer Halevy", "Noa Cohen"]
  // Extended context for higher-accuracy matching
  tripType?:      string    // 'business' | 'family' | 'solo' | 'friends' | 'couple' | 'beach' | 'ski'
  cities?:        string[]  // specific cities in the trip: ['Bangkok', 'Chiang Mai', 'Phuket']
  numTravelers?:  number    // total number of travelers
  currency?:      string    // expected currency: 'ILS', 'USD', 'EUR', 'THB'
  tripName?:      string    // trip name — helps match email subjects like "Your trip to Barcelona"
  companyName?:   string    // for business trips — match invoices addressed to this company
}

// ─── Known booking sender domains ────────────────────────────────────────────
// Emails from these domains get a confidence boost: lower auto-import threshold
// from 0.70 → 0.60, and lower pending-review floor from 0.35 → 0.25.
// This catches real booking confirmations that are light on text (short HTML).

export const KNOWN_BOOKING_DOMAINS: ReadonlySet<string> = new Set([
  // OTAs & meta-search
  'booking.com', 'airbnb.com', 'expedia.com', 'hotels.com', 'agoda.com',
  'priceline.com', 'tripadvisor.com', 'kayak.com', 'skyscanner.com',
  'trip.com', 'kiwi.com', 'last.co.il', 'almosafer.com',
  // Israeli travel
  'isrotel.co.il', 'danhotels.com', 'fattal.co.il', 'atlas.co.il',
  'traveltalm.co.il', 'diesenhaus.com', 'superhotel.co.il',
  // In-flight services
  'onboard.ryanair.com', 'shop.ryanair.com', 'easyjet.com/inflight',
  'buy.inflight.com', 'gogo.com', 'gogoair.com', 'inflight-wifi.com',
  'dutyfreeairline.com', 'elal-shop.co.il',
  // Israeli airlines
  'elal.co.il', 'elal.com', 'arkia.com', 'israir.co.il',
  // International airlines
  'ryanair.com', 'easyjet.com', 'wizzair.com', 'flydubai.com',
  'emirates.com', 'united.com', 'delta.com', 'lufthansa.com', 'klm.com',
  'britishairways.com', 'airfrance.com', 'turkishairlines.com',
  'etihadairways.com', 'singaporeair.com', 'thaiairways.com',
  'bangkokair.com', 'airasia.com', 'pegasusairlines.com', 'tui.com',
  // Ride-hailing / transfers
  'uber.com', 'gett.com', 'bolt.eu', 'lyft.com', 'yango.com',
  // Tours / activities
  'klook.com', 'viator.com', 'getyourguide.com',
  // Hotel chains direct
  'marriott.com', 'hilton.com', 'ihg.com', 'hyatt.com',
  'accor.com', 'radissonhotels.com', 'bestwestern.com', 'wyndham.com',
  // Car rental
  'hertz.com', 'avis.com', 'sixt.com', 'europcar.com', 'budget.com', 'enterprise.com',
  // Insurance — Israeli + international
  'harel.co.il', 'phoenix.co.il', 'migdal.co.il', 'clalbit.co.il',
  'menora.co.il', 'ayalon.co.il', 'allianz.com', 'worldnomads.com',
  'axa-travel.com', 'covertrip.com', 'heymondo.com',
  // Business travel management
  'travelperk.com', 'navan.com', 'concur.com', 'egencia.com',
  'cytric.com', 'amexgbt.com', 'cwt.com',
  // Israeli SIM / roaming
  'partner.co.il', 'hot.net.il', 'cellcom.co.il', 'pelephone.co.il',
  'golan.co.il', 'azi.co.il',
  // International SIM
  'airalo.com', 'truphone.com', 'flexiroam.com', 'simly.io',
  // Restaurant/food delivery receipts (for business expense reporting)
  'wolt.com', 'tenbis.co.il', '10bis.co.il', 'mishloha.co.il',
  // Israeli taxi apps
  'yango.com', 'gett.com', 'cabapp.co.il',
])

/** Return true if from-address contains a known booking domain */
export function isKnownBookingSender(fromAddress: string): boolean {
  const lower = fromAddress.toLowerCase()
  return Array.from(KNOWN_BOOKING_DOMAINS).some(domain => lower.includes(domain))
}

// ─── Quick pre-filter ─────────────────────────────────────────────────────────
// Runs BEFORE calling Claude — filters out obvious non-booking emails.
// This saves ~60-70% of Claude API calls.

const BOOKING_SUBJECT_KEYWORDS = [
  // English — bookings
  'confirmation', 'confirmed', 'reservation', 'itinerary', 'e-ticket', 'eticket',
  'voucher', 'receipt', 'invoice', 'boarding pass', 'check-in', 'checkin',
  'booking', 'order confirmed', 'ticket', 'payment received', 'booking ref',
  'your trip', 'your flight', 'your stay', 'your booking',
  // In-flight purchases
  'inflight purchase', 'onboard purchase', 'in-flight receipt', 'onboard receipt',
  'wifi purchase', 'in-flight wifi', 'duty free', 'duty-free', 'onboard order',
  'seat upgrade', 'baggage receipt', 'extra baggage', 'meal order',
  // Business travel
  'tax invoice', 'expense report', 'business receipt', 'sim activation',
  'data plan', 'roaming plan', 'travel insurance policy', 'policy document',
  'per diem', 'travel allowance', 'reimbursement',
  // Hebrew — bookings
  'אישור', 'הזמנה', 'כרטיס', 'טיסה', 'קבלה', 'צ\'ק-אין',
  'דיוטי פרי', 'שדרוג מושב', 'ווי-פיי בטיסה', 'קנייה בטיסה',
  // Hebrew — business
  'חשבונית מס', 'חשבונית', 'קבלה', 'תשלום', 'ביטוח נסיעות', 'פוליסת ביטוח',
  'כרטיס סים', 'רומינג', 'אשל', 'דמי שהייה', 'ניהול הוצאות',
]

const SPAM_SUBJECT_KEYWORDS = [
  'deal of the week', 'special offer', 'save up to', 'exclusive deal',
  'last minute', 'flash sale', 'unsubscribe', 'newsletter', 'subscribe',
  'הצעות מיוחדות', 'חסכו', 'מבצע', 'ניוזלטר', 'המלצות', 'אל תפספסו',
]

/**
 * Quick heuristic pre-filter — runs before calling Claude.
 * Returns:
 *   'definitely_booking'  — known sender OR strong subject keyword → send to Claude
 *   'maybe_booking'       — weak signals → send to Claude but expect lower confidence
 *   'skip'                — clear non-booking → don't waste Claude tokens
 */
export function quickPreFilter(
  subject:  string,
  from:     string,
  snippet:  string,
): 'definitely_booking' | 'maybe_booking' | 'skip' {
  const lower = (subject + ' ' + snippet).toLowerCase()

  // Definite spam signals → skip entirely
  const isSpam = SPAM_SUBJECT_KEYWORDS.some(k => lower.includes(k))
  if (isSpam && !isKnownBookingSender(from)) return 'skip'

  // Known booking sender → always try Claude
  if (isKnownBookingSender(from)) return 'definitely_booking'

  // Strong subject keyword → probably a booking
  const hasBookingKeyword = BOOKING_SUBJECT_KEYWORDS.some(k => lower.includes(k))
  if (hasBookingKeyword) return 'definitely_booking'

  // Weak signals — booking might be in body but not subject
  const weakSignals = ['ref:', 'ref #', '#', 'order', 'payment', 'paid'].filter(k =>
    lower.includes(k),
  )
  if (weakSignals.length >= 2) return 'maybe_booking'

  return 'skip'
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const BASE_BOOKING_FIELDS = `{
  "booking_type": "hotel|flight|car_rental|activity|tour|insurance|taxi|food|sim|inflight|other",
  "vendor": "שם הפלטפורמה/חברה",
  "destination_city": "עיר היעד",
  "destination_country": "מדינת היעד באנגלית",
  "check_in": "YYYY-MM-DD או null",
  "check_out": "YYYY-MM-DD או null",
  "departure_date": "YYYY-MM-DD או null",
  "return_date": "YYYY-MM-DD או null",
  "amount": 0.00,
  "currency": "EUR|ILS|USD|GBP|THB|JPY|AED|TRY",
  "confirmation_number": "מספר אישור — חובה אם קיים, אחרת N/A",
  "traveler_names": ["שמות הנוסעים"],
  "hotel_name": "שם המלון אם רלוונטי",
  "flight_number": "מספר טיסה",
  "airline": "חברת תעופה",
  "num_guests": 1,
  "summary": "תקציר קצר בעברית — מה הוזמן, מתי, כמה עלה",
  "confidence": 0.9,
  "trip_relevant": true,
  "is_business_expense": false,
  "tax_invoice_number": "מספר חשבונית מס — אם קיים, אחרת null",
  "invoice_to": "שם החברה/עוסק שאליו מופנית החשבונית — אם קיים, אחרת null"
}`

const BOOKING_TYPE_GUIDE = `
סוגי הזמנות:
- hotel = מלון, צימר, Airbnb, hostel, villa
- flight = טיסה (כולל low-cost: Ryanair, WizzAir, EasyJet וכו')
- car_rental = השכרת רכב (Hertz, Avis, Sixt, Europcar וכו')
- activity = אטרקציה, סיור, כרטיס כניסה, טיול מאורגן
- tour = חבילת נסיעה מאורגנת
- insurance = ביטוח נסיעות (פוליסה, אישור כיסוי)
- taxi = Uber, Gett, Bolt, Yango, מונית, נסיעה ספציפית
- food = מסעדה, קפה, קייטרינג, Wolt, deliveroo (קבלה על ארוחה)
- sim = כרטיס SIM, גלישה בחו"ל, רומינג, data plan, אירוטל
- inflight = רכישה במהלך הטיסה: WiFi, אוכל, duty-free, שדרוג מושב, כבודה עודפת

⚠️ זיהוי רכישות בטיסה (inflight):
- WiFi / internet בטיסה → inflight
- אוכל ומשקאות שהוזמנו בטיסה → inflight
- duty-free שנרכש על הסיפון → inflight
- שדרוג מושב שנרכש בטיסה → inflight
- כבודה עודפת שנשלמה בטיסה → inflight

⚠️ זיהוי חשבוניות עסקיות:
- is_business_expense = true אם: חשבונית מס (לא קבלה רגילה), מופנית לחברה/עוסק, VAT invoice
- tax_invoice_number = מספר חשבונית מס ישראלי (מספר רץ, בד"כ 6-9 ספרות)
- invoice_to = שם החברה/עוסק שאליו מופנית החשבונית (כפי שמופיע בחשבונית)

⚠️ destination_city:
- מלון/פעילות: העיר שבה נמצא המלון/הפעילות
- טיסה: עיר היעד (הגעה), לא עיר המוצא (TLV → BKK → "Bangkok")
- SIM/ביטוח: עיר/מדינת הנסיעה

כללי confidence:
- 0.9-1.0: אישור ברור — מספר הזמנה + תאריכים + סכום
- 0.7-0.8: אישור עם רוב הפרטים
- 0.5-0.6: נראה כמו אישור, חסרים פרטים
- 0.3-0.4: לא ברור
- 0.1-0.2: שיווקי / לא רלוונטי

- amount = הסכום הסופי ששולם (Total), לא מחיר מוצע
- תחזיר null בשדות שלא נמצאו`

/**
 * Generic email parse prompt — used when no trip context is available.
 */
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
❌ אין מספר הזמנה ואין שם נוסע ואין תאריך ספציפי
${BOOKING_TYPE_GUIDE}

החזר JSON בלבד (ללא markdown, ללא backticks):
${BASE_BOOKING_FIELDS}`

/**
 * Trip-context-aware prompt — used when we know the trip destination/dates.
 * Tells Claude exactly what we're looking for so it can determine relevance
 * directly, avoiding false positives and improving confidence accuracy.
 */
function buildTripAwarePrompt(ctx: TripContext): string {
  const names = ctx.travelerNames.length > 0
    ? ctx.travelerNames.join(', ')
    : 'לא ידוע'

  const citiesLine   = ctx.cities?.length   ? `  ערים:        ${ctx.cities.join(', ')}` : ''
  const typeLine     = ctx.tripType         ? `  סוג:         ${ctx.tripType}` : ''
  const countLine    = ctx.numTravelers     ? `  נוסעים:      ${ctx.numTravelers}` : ''
  const currLine     = ctx.currency         ? `  מטבע:        ${ctx.currency}` : ''
  const nameLine     = ctx.tripName         ? `  שם הנסיעה:   "${ctx.tripName}"` : ''
  const companyLine  = ctx.companyName      ? `  חברה/עוסק:   "${ctx.companyName}"` : ''

  const extras = [citiesLine, typeLine, countLine, currLine, nameLine, companyLine].filter(Boolean).join('\n')

  // Pre-trip booking window: visa/insurance can be bought 12 months before departure
  const windowStart = new Date(ctx.startDate)
  windowStart.setDate(windowStart.getDate() - 365)
  const windowStartStr = windowStart.toISOString().slice(0, 10)

  const isBusinessTrip = ctx.tripType === 'business'

  // Business-specific instructions
  const businessSection = isBusinessTrip ? `
══════════════════════════════════════════
💼 נסיעה עסקית — יש לזהות גם:
  ✅ חשבוניות מס (tax invoices) — is_business_expense: true
  ✅ קבלות מסעדות ובתי קפה — booking_type: "food"
  ✅ כרטיסי SIM / רומינג — booking_type: "sim"
  ✅ ביטוח עסקי לנסיעה — booking_type: "insurance"
  ✅ השכרת רכב עסקי — booking_type: "car_rental"
${ctx.companyName ? `  ✅ חשבוניות על שם "${ctx.companyName}" — invoice_to: "${ctx.companyName}"` : ''}
  ✅ כרטיסי אשראי חברה / הוצאות להחזר

  is_business_expense = true אם: מכיל מספר חשבונית מס, מופנה לחברה, VAT receipt
══════════════════════════════════════════` : ''

  return `אתה מנתח מיילי אישור הזמנה עבור נסיעה ספציפית.

══════════════════════════════════════════
🧳 פרטי הנסיעה שאנחנו מחפשים הזמנות עבורה:
  יעד:         ${ctx.destination}
  תאריכים:     ${ctx.startDate} עד ${ctx.endDate}
  נוסעים:      ${names}${extras ? '\n' + extras : ''}
══════════════════════════════════════════${businessSection}

שאלות שיש לענות עליהן:
1. האם זה מייל אישור הזמנה אמיתי? (לא שיווקי)
2. האם ההזמנה קשורה לנסיעה לעיל? (יעד + תאריכים + נוסעים)
3. חלץ את פרטי ההזמנה

ייתכן שהמייל הוא הזמנה אמיתית לנסיעה אחרת (trip_relevant: false אבל confidence גבוה).

מייל אישור אמיתי (confidence >= 0.6):
✅ מכיל מספר הזמנה ספציפי
✅ כרטיס טיסה — מספר טיסה, תאריך, שם נוסע
✅ אישור מלון — שם מלון, תאריכי צ'ק-אין/אאוט
✅ אישור פעילות/אטרקציה עם תאריך ומחיר
✅ חשבונית/קבלה — סכום ושירות${isBusinessTrip ? '\n✅ קבלת מסעדה/אוכל עם תאריך וסכום\n✅ קבלת SIM / רומינג' : ''}
✅ ביטוח נסיעות

מייל שיווקי (confidence <= 0.2, trip_relevant: false):
❌ "הצעות מיוחדות", "deal of the week", המלצות
❌ ניוזלטר, עדכוני מחירים, "אל תפספסו"
❌ אין מספר הזמנה ספציפי ואין שם נוסע
${BOOKING_TYPE_GUIDE}

trip_relevant = true אם מתקיים לפחות אחד מהבאים:
  • יעד ההזמנה תואם ל-"${ctx.destination}"${ctx.cities?.length ? ` או לאחת מהערים: ${ctx.cities.join(', ')}` : ''}
  • תאריכי ההזמנה בטווח ${windowStartStr} עד ${ctx.endDate}
    (365 ימים לפני הנסיעה — ויזה/ביטוח נרכשים חודשים מראש)
  • שם הנוסע מופיע בהזמנה: ${names}${ctx.currency ? `\n  • המטבע בהזמנה הוא ${ctx.currency}` : ''}${ctx.companyName ? `\n  • החשבונית מופנית ל-"${ctx.companyName}"` : ''}

החזר JSON בלבד (ללא markdown, ללא backticks):
${BASE_BOOKING_FIELDS}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Core parsers ─────────────────────────────────────────────────────────────

/**
 * Internal: call Claude with a single prompt string + optional PDF.
 * Returns the parsed booking or null on error.
 */
async function claudeParse(
  anthropic:  Anthropic,
  prompt:     string,
  pdfBase64?: string,
): Promise<ParsedBooking | null> {
  // ── With PDF (claude-opus-4-5 supports document blocks) ───────────────────
  if (pdfBase64) {
    try {
      const docBlock: DocumentBlockParam = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
      }
      const textBlock: TextBlockParam = { type: 'text', text: prompt }

      const resp = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [docBlock, textBlock] }],
      })

      const tb = resp.content.find(b => b.type === 'text')
      if (tb?.type === 'text') return extractJson(tb.text)
    } catch (err) {
      console.error('[emailParser] PDF parse error:', err)
    }
    return null
  }

  // ── Text-only (claude-haiku — fast + cheap) ───────────────────────────────
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const tb = resp.content.find(b => b.type === 'text')
    if (tb?.type === 'text') return extractJson(tb.text)
  } catch (err) {
    console.error('[emailParser] Body parse error:', err)
  }
  return null
}

/**
 * Parse a booking confirmation email using Claude — generic mode.
 * No trip context provided. Uses the generic booking-detection prompt.
 *
 * @param emailText   Plain text or HTML of the email body
 * @param subject     Email subject line
 * @param pdfBase64   Optional standard-base64 PDF attachment
 */
export async function parseBookingEmail(
  emailText: string,
  subject:   string,
  pdfBase64?: string,
): Promise<ParsedBooking | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { console.error('[emailParser] No ANTHROPIC_API_KEY'); return null }

  const anthropic = new Anthropic({ apiKey })
  const text = htmlToText(emailText).slice(0, 8000)

  const pdfResult  = pdfBase64 ? await claudeParse(anthropic, `נושא: ${subject}\n\n${EMAIL_PARSE_PROMPT}`, pdfBase64) : null
  const bodyResult = await claudeParse(anthropic, `נושא: ${subject}\n\nתוכן:\n${text}\n\n${EMAIL_PARSE_PROMPT}`)

  return mergeResults(pdfResult, bodyResult)
}

/**
 * Parse a booking confirmation email with TRIP CONTEXT.
 * Dramatically more accurate — Claude knows exactly what trip we're looking for
 * and can determine relevance in one shot.
 *
 * Returns a ParsedBooking with `trip_relevant` field set.
 *
 * @param emailText  Plain text or HTML of the email body
 * @param subject    Email subject line
 * @param ctx        Trip context (destination, dates, travelers)
 * @param pdfBase64  Optional standard-base64 PDF attachment
 */
export async function parseTripBookingEmail(
  emailText: string,
  subject:   string,
  ctx:       TripContext,
  pdfBase64?: string,
): Promise<ParsedBooking | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { console.error('[emailParser] No ANTHROPIC_API_KEY'); return null }

  const anthropic = new Anthropic({ apiKey })
  const text = htmlToText(emailText).slice(0, 8000)
  const prompt = buildTripAwarePrompt(ctx)

  const pdfResult  = pdfBase64 ? await claudeParse(anthropic, `נושא: ${subject}\n\n${prompt}`, pdfBase64) : null
  const bodyResult = await claudeParse(anthropic, `נושא: ${subject}\n\nתוכן:\n${text}\n\n${prompt}`)

  const merged = mergeResults(pdfResult, bodyResult)
  return merged
}
