---
name: tripix-gmail-scanner
description: |
  Tripix Gmail email scanner & document importer skill. Use whenever working on the Gmail scanning pipeline — importing booking emails, parsing confirmations with Claude AI, matching emails to trips, deduplicating documents, or fixing issues with email import. Trigger on: "Gmail", "מייל", "ייבוא", "סריקה", "סריקת מיילים", "email import", "scan", "booking email", "confirmation email", "כפילויות", "duplicates", "dedup", "email parsing", "parseBookingEmail", "gmailScanner", "gmailClient", "emailParser", "tripMatcher", "scan-trip", "auto-scan", "email_ingests", "gmail_connections", or any mention of importing travel data from email. Also trigger when the user reports issues like: wrong trip matching, duplicate documents, missing bookings, low confidence scores, wrong amounts extracted, or emails not being found. This is THE reference for how emails flow from Gmail into Tripix's database.
---

# Tripix Gmail Scanner & Email Import Skill

This skill covers the entire pipeline of importing booking emails from Gmail into Tripix. It's the most complex subsystem in the app — 5 source files, 3 API routes, 2 frontend components, and a deduplication engine.

## Architecture Overview

The pipeline has 5 layers, each in its own file:

```
┌─────────────────────────────────────────────────────────────────┐
│  TRIGGER LAYER (3 entry points)                                 │
│  /api/gmail/scan         — manual scan all trips                │
│  /api/gmail/scan-trip    — retroactive import for 1 trip        │
│  /api/gmail/auto-scan    — daily Vercel cron (09:00 UTC)        │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  ORCHESTRATION — gmailScanner.ts                                │
│  Two main functions:                                            │
│  • scanUserGmail()  — general scan, 30 days back                │
│  • scanTripGmail()  — trip-specific, 365 days back,             │
│                       with FULL dedup + relevance + PDF storage  │
└───┬───────────┬───────────┬─────────────────────────────────────┘
    │           │           │
┌───▼───┐  ┌───▼───┐  ┌───▼───────┐
│Gmail  │  │Email  │  │Trip       │
│Client │  │Parser │  │Matcher    │
└───────┘  └───────┘  └───────────┘
```

### File Map

| File | Role | Size |
|------|------|------|
| `src/lib/gmailClient.ts` | Gmail API wrapper (OAuth, search, body, attachments) | ~375 lines |
| `src/lib/emailParser.ts` | Claude AI parsing (PDF + text, confidence scoring) | ~220 lines |
| `src/lib/tripMatcher.ts` | Fuzzy trip matching (destination aliases, date overlap) | ~155 lines |
| `src/lib/gmailScanner.ts` | Orchestrator (dedup, relevance filter, DB writes) | ~1100 lines |
| `src/components/TripGmailImport.tsx` | Frontend button for trip-specific import | ~155 lines |
| `src/components/GmailScanButton.tsx` | Dashboard quick-scan button | small |

### API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/gmail/scan` | POST | Bearer token | Manual scan — all connected Gmail accounts, 30 days |
| `/api/gmail/scan-trip` | POST | Bearer token | Trip-specific import — 365 days back, body: `{ trip_id }` |
| `/api/gmail/auto-scan` | GET | CRON_SECRET | Daily cron — scans all users sequentially |

### Database Tables

| Table | Key Fields | Role |
|-------|-----------|------|
| `gmail_connections` | user_id, gmail_address, access_token, refresh_token, token_expiry | OAuth tokens per account |
| `email_ingests` | user_id, gmail_message_id, trip_id, parsed_data, status, source | Audit trail + dedup key |
| `documents` | trip_id, name, doc_type, booking_ref, file_url, valid_from, extracted_data | Parsed booking records |
| `expenses` | trip_id, title, amount, currency, category, expense_date, source | Auto-created expenses |

---

## The Complete Email Flow (scanTripGmail)

This is the most important function. Here's every step in detail:

### Step 1: Load Trip + Gmail Connections
```typescript
const trip = await supabase.from('trips')
  .select('id, name, destination, start_date, end_date, travelers')
  .eq('id', tripId).eq('user_id', userId).single()

const connections = await supabase.from('gmail_connections')
  .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry')
  .eq('user_id', userId)
```

### Step 2: Build Gmail Search Query
The search uses two strategies combined with OR:
1. **Subject keywords**: 17 terms in English + 7 in Hebrew (confirmation, booking, אישור, הזמנה, etc.)
2. **Known sender domains**: 40+ travel/booking domains (booking.com, elal.co.il, uber.com, etc.)

Plus **destination boost** from trip data:
```typescript
// Adds destination aliases as extra search terms (OR'd, not required)
const destQuery = buildTripGmailQuery(trip, trip.travelers)
// e.g. "thailand OR bangkok OR bkk OR phuket OR omer"
```

The query searches `in:anywhere` (all folders) but excludes trash and spam.

### Step 3: Pre-filter by Gmail Message ID (Primary Dedup)
Before processing ANY email, check if its Gmail message ID was already processed:
```typescript
const { data: alreadyIngested } = await supabase
  .from('email_ingests')
  .select('gmail_message_id')
  .eq('trip_id', tripId)
  .eq('user_id', userId)
  .not('gmail_message_id', 'is', null)

const processedIds = new Set(alreadyIngested.map(r => r.gmail_message_id))
const newMessages = messages.filter(m => !processedIds.has(m.id))
```

This is the **iron rule** — `gmail_message_id` in `email_ingests` is the deterministic dedup key. Same email can never be processed twice for the same trip.

### Step 4: PASS 1 — Text-Only Parse (Fast)
Parse all new emails with Claude Haiku (text only, no PDF download yet):
```typescript
const parsedBooking = await parseBookingEmail(emailContent, msg.subject) // no PDF
```

Filter results:
- **confidence < 0.4** → drop (low confidence = probably not a booking)
- **checkRelevance()** → verify destination matches trip + dates within window
- **checkTravelerSoftMatch()** → log-only name check (never blocks)

### Step 5: PASS 2 — PDF Download (Only for Relevant Emails)
Only for the 1-5 emails that passed Pass 1, download PDF attachments:
```typescript
const pdf = attachments
  .filter(a => a.size > 0 && a.size < 4 * 1024 * 1024) // max 4MB
  .sort((a, b) => b.size - a.size)[0] // largest PDF

// Re-parse with PDF → higher quality extraction
const withPdf = await parseBookingEmail(emailContent, msg.subject, pdfBase64)
if (withPdf && withPdf.confidence >= parsedBooking.confidence) {
  finalBooking = withPdf
}
```

If no PDF, try extracting booking URLs from the HTML and fetching the page.

### Step 6: Deduplication Before DB Write

#### ⚡ IRON RULE: No Duplicate Documents

Three layers of deduplication protect against duplicates:

**Layer 1: Gmail Message ID** (Step 3)
- Stored in `email_ingests.gmail_message_id`
- Checked BEFORE any processing
- Deterministic — same email ID = same email, always skip

**Layer 2: Booking Reference**
```typescript
if (parsedBooking.confirmation_number && parsedBooking.confirmation_number !== 'N/A') {
  const refQuery = supabase.from('documents')
    .select('id')
    .eq('trip_id', tripId)
    .eq('booking_ref', parsedBooking.confirmation_number)

  // For flights: same ref + same passenger = duplicate
  // Different passenger = different ticket → allow
  if (isFlight && firstPassenger) {
    refQuery.eq('name', bookingTitle) // title includes passenger name
  }

  const { data: existingByRef } = await refQuery.maybeSingle()
  if (existingByRef) { stats.filteredDuplicate++; continue }
}
```

**Layer 3: Name + Date**
```typescript
if (bookingTitle && dedupDate) {
  const { data: existingByName } = await supabase.from('documents')
    .select('id')
    .eq('trip_id', tripId)
    .eq('name', bookingTitle)
    .eq('valid_from', dedupDate)
    .maybeSingle()
  if (existingByName) { stats.filteredDuplicate++; continue }
}
```

This catches cases where Booking.com/airlines send 10+ emails per reservation (confirmation, payment, modification, reminder) — they all have the same hotel name + check-in date, so only the first one creates a document.

### Step 7: Save to Database
Three records are created for each valid booking:

1. **Document** (main record shown in Documents page):
```typescript
await supabase.from('documents').insert({
  trip_id, name: bookingTitle,
  doc_type: docTypeMap[parsedBooking.booking_type],
  file_type: pdfBase64 ? 'pdf' : 'gmail',
  file_url: fileUrl,  // uploaded PDF or HTML snapshot
  booking_ref: parsedBooking.confirmation_number,
  valid_from: parsedBooking.check_in || parsedBooking.departure_date,
  valid_until: parsedBooking.check_out || parsedBooking.return_date,
  flight_number: parsedBooking.flight_number,
  extracted_data: parsedBooking,
})
```

2. **Expense** (auto-created, best-effort):
```typescript
await supabase.from('expenses').insert({
  trip_id, title: bookingTitle,
  amount: parsedBooking.amount || 0,
  currency: parsedBooking.currency || 'ILS',
  category: categoryMap[parsedBooking.booking_type],
  expense_date: parsedBooking.check_in || parsedBooking.departure_date,
  source: 'document', is_paid: true,
})
```

3. **Email Ingest** (audit trail + dedup key):
```typescript
await supabase.from('email_ingests').insert({
  user_id, from_address: msg.from,
  subject: msg.subject, raw_text: rawText,
  parsed_data: parsedBooking,
  trip_id, match_score: 100,
  status: 'processed', source: 'gmail_trip_import',
  gmail_message_id: msg.id,  // ← PRIMARY DEDUP KEY
})
```

---

## Flight Dedup — The Passenger Name Pattern

Flights have a special dedup rule because airlines issue one booking reference per GROUP but separate tickets per passenger:

```
Booking ref: ABC123
├── Omer Halevy → "EL AL LY008 – Omer Halevy"
├── Noa Halevy  → "EL AL LY008 – Noa Halevy"
└── Baby Halevy → "EL AL LY008 – Baby Halevy"
```

- `bookingTitle` for flights includes `– ${firstPassenger}`
- Dedup Layer 2 checks `booking_ref + name` (which includes passenger)
- So same ref + different passenger → different document (correct)
- Same ref + same passenger → skip (duplicate email)

For hotels/activities, `bookingTitle` does NOT include passenger name because one booking = one reservation.

---

## Relevance Checking (checkRelevance)

Determines if a parsed booking belongs to the given trip:

### Destination Match
1. Resolve trip destination to a country key using `HE_TO_COUNTRY` map (50+ Hebrew→English mappings) and `COUNTRY_CITY_MAP` (30+ countries × many aliases)
2. Compare parsed `destination_city` and `destination_country` against the country's alias list
3. If no destination extracted AND confidence < 0.8 → reject (prevents random high-confidence emails from slipping through)

### Date Window
- Acceptable range: **180 days before trip start** → **7 days after trip end**
- This captures early bookings made months in advance

### Traveler Name Match (Soft)
- Uses `HE_FIRST_NAME_HINTS` to map Hebrew first names → Latin equivalents
- Supports Latin names stored directly (split by spaces, match any token)
- **Log-only, never blocks** — just for debugging

---

## The Two Scan Modes

### scanUserGmail() — General Scan
- Triggered by: `/api/gmail/scan` (manual) or `/api/gmail/auto-scan` (cron)
- Searches: **30 days** back
- Trip matching: **automatic** via `matchTripToBooking()` (score ≥ 40)
- Dedup: Only `email_ingests` Gmail message ID check in `processMessages()`
- Creates: Expenses only (no documents)
- Simpler flow, used for daily automated scanning

### scanTripGmail() — Trip-Specific Import
- Triggered by: `/api/gmail/scan-trip` (user clicks "ייבוא הזמנות מ-Gmail")
- Searches: **365 days** back
- Trip matching: **forced** to the specified trip (user chose it)
- Dedup: **Full 3-layer** (Gmail ID → booking_ref → name+date)
- Creates: Documents + Expenses + Email Ingests
- Two-pass architecture (fast text parse → selective PDF download)
- Destination boost query from trip + traveler names
- Saves PDF or HTML snapshot to Supabase Storage
- Returns detailed `TripScanStats` with filter breakdowns

---

## Claude AI Parsing (emailParser.ts)

### Two Models Strategy
| Model | Used For | Cost | Speed |
|-------|----------|------|-------|
| `claude-opus-4-5` | PDF attachments (document blocks) | Higher | Slower |
| `claude-haiku-4-5-20251001` | Email body text (8000 char limit) | Lower | Faster |

### Merge Logic
When both PDF and text results exist, the one with **higher confidence** wins. On tie, PDF result wins (implicit from merge order).

### ParsedBooking Interface
```typescript
interface ParsedBooking {
  booking_type: 'hotel' | 'flight' | 'car_rental' | 'activity' | 'tour' | 'insurance' | 'other'
  vendor: string
  destination_city: string
  destination_country: string
  check_in?: string           // YYYY-MM-DD (hotel/car)
  check_out?: string
  departure_date?: string     // YYYY-MM-DD (flight)
  return_date?: string
  amount: number
  currency: string
  confirmation_number: string
  traveler_names: string[]
  hotel_name?: string
  flight_number?: string
  airline?: string
  summary: string             // 1-line Hebrew summary
  confidence: number          // 0-1
}
```

### Confidence Scale
| Range | Meaning |
|-------|---------|
| 0.9-1.0 | Clear confirmation with booking ref + dates + amount |
| 0.7-0.8 | Confirmation with most details (may miss some) |
| 0.5-0.6 | Looks like a confirmation, details incomplete |
| 0.3-0.4 | Unclear if it's a real booking |
| 0.1-0.2 | Marketing email / not relevant |

### Threshold Rules
- **confidence < 0.4** → dropped entirely in scanTripGmail
- **confidence < 0.7** → dropped in scanUserGmail (general scan is stricter)
- **confidence ≥ 0.7** → auto-create expense/document

---

## Trip Matching (tripMatcher.ts)

Scoring system (0-100):

| Factor | Score | Condition |
|--------|-------|-----------|
| Exact destination | +60 | Canonical names match exactly |
| Partial destination | +40 | One contains the other |
| Date overlap | +40 | Trip dates overlap booking dates |
| Date proximity | +20 | Within 3 days of trip start |

**Minimum threshold: 40 points** (requires at least one strong signal)

The matcher uses `DESTINATION_ALIASES` for fuzzy matching:
```typescript
bangkok: ['bangkok', 'בנגקוק', 'bkk', 'krung thep']
```

---

## Type Mappings

### Booking Type → Expense Category
```typescript
const categoryMap = {
  hotel: 'hotel', flight: 'flight', car_rental: 'taxi', taxi: 'taxi',
  activity: 'activity', tour: 'activity', insurance: 'other', other: 'other',
}
```

### Booking Type → Document Type
```typescript
const docTypeMap = {
  hotel: 'hotel', flight: 'flight', car_rental: 'other', taxi: 'other',
  activity: 'activity', tour: 'activity', insurance: 'insurance', other: 'other',
}
```

---

## Known Issues & Edge Cases

### The scanUserGmail vs scanTripGmail Gap
`scanUserGmail()` (general scan) creates expenses via `processMessages()` but does NOT create documents or use the full 3-layer dedup. It only has the email_ingests check. This means:
- The general scan can create duplicate expenses if Claude extracts slightly different titles
- The general scan doesn't store booking_ref in documents (it doesn't create documents at all)
- Consider unifying the two paths to use the same dedup logic

### Currency Conversion Issue
Auto-created expenses set `amount_ils = parsedBooking.amount` regardless of currency. The `calculate_amount_ils()` trigger in Supabase should handle conversion, but only if `currency_rates` table has the rate.

### HTML Snapshot Storage
When no PDF attachment exists, the raw email HTML is saved as a `.html` file to Supabase Storage. The `buildEmailHtml()` function wraps fragments in proper HTML5 shell with responsive CSS, or injects overrides into existing full documents.

### Booking URL Fallback
When there's no PDF and the email HTML contains booking links (e.g. "View your booking"), `scanTripGmail` fetches those URLs and re-parses the page content. This is timeout-protected (8s) and stops after finding one that improves confidence.

---

## Adding a New Dedup Rule

If you need to add a new deduplication check, here's the pattern:

1. **Identify the unique key** — what combination of fields makes a booking unique?
2. **Add the check BEFORE the DB write** in `scanTripGmail()` (after the existing dedup checks around line 917-958)
3. **Increment `stats.filteredDuplicate`** when a duplicate is found
4. **Log the skip** with a descriptive message for debugging
5. **If the check also needs to apply to scanUserGmail()**, add it in `processMessages()` too

Example — prevent duplicate expenses by amount + date:
```typescript
// Deduplication: same amount + same date + same category
const { data: existingExpense } = await supabase
  .from('expenses')
  .select('id')
  .eq('trip_id', tripId)
  .eq('amount', parsedBooking.amount)
  .eq('expense_date', dedupDate)
  .eq('category', categoryMap[parsedBooking.booking_type])
  .maybeSingle()
if (existingExpense) {
  console.log(`[gmailScanner/trip] skip dup expense: amount=${parsedBooking.amount} date=${dedupDate}`)
  stats.filteredDuplicate++; continue
}
```

---

## Adding Support for a New Email Provider

To add a new booking source (e.g. a new airline or hotel chain):

1. **Add sender domain** to `senderDomains` in `gmailClient.ts` (line ~117)
2. **Add destination aliases** if needed to `COUNTRY_CITY_MAP` in `gmailScanner.ts` (line ~41)
3. **Add Hebrew translations** to `HE_TO_COUNTRY` in `gmailScanner.ts` (line ~117)
4. **Test** with a real email from that provider — the Claude prompt is generic enough to handle most formats

---

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Claude AI (for parsing)
ANTHROPIC_API_KEY=

# Google OAuth (for Gmail access)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Vercel Cron (for auto-scan)
CRON_SECRET=
```

---

## Stats & Debugging

`TripScanStats` provides full transparency:
```typescript
interface TripScanStats {
  scanned: number           // total emails found
  parsed: number            // successfully parsed by Claude
  created: number           // documents + expenses created
  scannedWithPDF: number    // had PDF attachments
  scannedEmailOnly: number  // text-only parsing
  filteredLowConf: number   // dropped: AI confidence < 0.4
  filteredWrongDest: number // dropped: destination mismatch
  filteredWrongDate: number // dropped: dates outside window
  filteredDuplicate: number // dropped: already exists (any dedup layer)
  failedDB: number          // DB insert errors
  lastDbError?: string      // last error message
  createdDocs: CreatedDoc[] // list of created documents
}
```

Every filter decision is logged with `console.log('[gmailScanner/trip]')` for debugging. Look for these log prefixes:
- `✓ RELEVANT` — email passed all filters
- `✗ dest mismatch` — destination didn't match trip
- `✗ date mismatch` — date outside trip window
- `skip dup by ref` — duplicate by booking reference
- `skip dup by name+date` — duplicate by title + date
- `Skipped N already-processed message(s) by Gmail ID` — primary dedup
