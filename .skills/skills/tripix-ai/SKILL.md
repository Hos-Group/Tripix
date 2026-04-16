---
name: tripix-ai
description: |
  Tripix AI & document processing skill. Use whenever working on Claude AI integration within the Tripix app — improving extraction prompts, fixing OCR accuracy, enhancing the AI assistant, tuning email parsing, or debugging AI-related issues. Trigger on: "פרומפט", "חילוץ נתונים", "סריקת קבלות", "עוזר חכם", "Claude", "AI", receipt scanning, document extraction, email parsing, confidence scoring, or any mention of improving how the app understands receipts, bookings, emails, or travel documents. Also trigger when the user complains about incorrect extraction results or the assistant giving wrong answers.
---

# Tripix AI & Document Processing Skill

This skill covers all AI-powered features in Tripix: receipt scanning, document extraction, the AI assistant, and Gmail email parsing. The goal is to help you improve accuracy, add new capabilities, and debug issues.

## System Architecture

Tripix uses Claude in three distinct pipelines:

```
┌──────────────────────────────────────────────────────┐
│  1. Receipt/Document Extraction (/api/extract)        │
│     User uploads photo/PDF → Claude Haiku → JSON      │
│     Two prompts: RECEIPT_PROMPT / DOCUMENT_PROMPT      │
├──────────────────────────────────────────────────────┤
│  2. AI Assistant (/api/assistant)                      │
│     User asks question → Context injected → Haiku      │
│     Trip data (expenses, docs) in system prompt        │
├──────────────────────────────────────────────────────┤
│  3. Email Parsing (lib/emailParser.ts)                 │
│     Gmail email → PDF→Opus + Body→Haiku → Merge       │
│     Confidence scoring (0-1) for auto-import           │
└──────────────────────────────────────────────────────┘
```

## Pipeline 1: Receipt & Document Extraction

**Location**: `src/app/api/extract/route.ts`

### How It Works
1. Client sends `{ base64, mediaType, context }` where context is `'receipt'` or `'document'`
2. Route selects the appropriate prompt
3. Sends to `claude-haiku-4-5-20251001` with image/PDF + text prompt
4. Parses JSON from response (strips markdown fences if present)
5. Returns structured data to client

### RECEIPT_PROMPT
Extracts from receipts/invoices: title, category, amount, currency, date, notes.

Key rules baked into the prompt:
- Take the **final total** (Grand Total / Total Due), not subtotals
- After discounts, including VAT
- Default currency: THB (currently hardcoded for Thailand trip)
- Categories: food, taxi, activity, shopping, hotel, flight, ferry, other

### DOCUMENT_PROMPT
Much more detailed — extracts from booking confirmations: flights (with legs, connections), hotels (check-in/out, room type, services), ferries, insurance, passports.

**Current issues with this prompt:**
- Trip dates hardcoded as `11.4–1.5.2026`
- Traveler names hardcoded as `אומר (Omer), אשתו, תינוקת`
- Default currency THB hardcoded
- Should be dynamic based on current trip data

### Improving Extraction Accuracy

When the AI extracts data incorrectly, the issue is almost always in the prompt. Here's how to debug:

1. **Amount wrong**: Check if it's grabbing subtotal instead of grand total. Add more explicit examples of what "total" looks like for that vendor type.

2. **Category wrong**: The category list with examples is in the prompt. Add more mappings if a vendor type keeps misclassifying (e.g., "Grab" should be taxi, not food).

3. **Date format**: The prompt expects YYYY-MM-DD. Some receipts have DD/MM/YYYY or Thai dates. Add explicit instructions for format conversion.

4. **Currency confusion**: Thai receipts may show ฿ or THB or just numbers. The prompt defaults to THB but this should be dynamic.

### Making Extraction Dynamic

To fix the hardcoded trip context, modify the extract route to:
1. Accept `tripId` in the request body
2. Fetch trip data from Supabase (destination, dates, travelers)
3. Inject into the prompt template dynamically

```typescript
// Example: Dynamic prompt injection
const tripContext = trip ? `
הטיול: ${trip.name}
יעד: ${trip.destination}
תאריכים: ${trip.start_date} עד ${trip.end_date}
נוסעים: ${trip.travelers.map(t => t.name).join(', ')}
` : ''
```

## Pipeline 2: AI Assistant

**Location**: `src/app/api/assistant/route.ts`

### Context Injection
The assistant gets a system prompt with:
- Trip name, destination, dates
- Total expenses + breakdown by category
- Last 5 expenses with amounts
- List of uploaded documents

### Current Limitations
- **500 token max**: Responses are short. Consider increasing for detailed itinerary planning.
- **No tool use**: The assistant can only answer questions, not take actions (e.g., can't add expenses).
- **No web search**: Can't look up current restaurant recommendations or prices.
- **No memory**: Each conversation doesn't persist across sessions.

### Improving the Assistant

**Better context**: Include more trip data in the system prompt:
- Packing list items (packed vs unpacked)
- Weather forecast data
- Itinerary events by day
- Budget remaining vs spent
- Upcoming flights/hotels from documents

**Add tool use**: Enable Claude to call functions:
- `add_expense(title, amount, currency, category)` — add expense from chat
- `search_nearby(type, location)` — find restaurants/activities
- `check_weather(date)` — weather for specific day
- `get_itinerary(day)` — what's planned for a specific day

**Conversation memory**: Store chat history in Supabase per trip, so conversations persist.

## Pipeline 3: Email Parsing

**Location**: `src/lib/emailParser.ts`

### Two-Stage Architecture
1. **PDF attachments** → Claude Opus (`claude-opus-4-5`) with document blocks — higher accuracy for structured booking PDFs
2. **Email body text** → Claude Haiku — faster, cheaper for freeform email text
3. **Merge**: `mergeResults()` picks higher-confidence values from each stage

### Confidence Scoring
The prompt instructs Claude to assign confidence:
- `0.9–1.0`: Clear booking confirmation with all details
- `0.5–0.6`: Partial info, uncertain
- `0.1–0.2`: Marketing email or unrelated

The scanner only auto-creates expenses when confidence >= 0.7.

### Email Classification
The parser classifies emails into booking types: flight, hotel, car, activity, restaurant, transport, insurance, other.

### Improving Email Parsing

**Common failures:**
- Marketing emails misclassified as bookings (lower the confidence threshold instruction)
- Multi-booking emails (one email confirms flight + hotel) — only one gets extracted
- Forwarded bookings with extra headers confusing the parser
- Hebrew emails with mixed RTL/LTR content

**Gmail search optimization** (`lib/gmailClient.ts`):
- Currently searches 40+ sender domains and subject keywords
- Add new domains by appending to the `BOOKING_SENDERS` array
- Search query is in `buildSearchQuery()` — uses Gmail's OR syntax

### Trip Matching (`lib/tripMatcher.ts`)

After parsing, bookings are matched to trips by:
1. **Destination match** (60 pts exact, 40 pts partial) using `COUNTRY_CITY_MAP` aliases
2. **Date overlap** (40 pts overlap, 20 pts within 3 days)
3. Minimum 40 pts to consider a match

To add new destination aliases, update `COUNTRY_CITY_MAP` in `gmailScanner.ts`.

## Model Selection Guide

| Task | Current Model | When to Consider Upgrading |
|------|--------------|---------------------------|
| Receipt OCR | Haiku 4.5 | If accuracy drops below 90% |
| Document extraction | Haiku 4.5 | Complex multi-page PDFs → Sonnet |
| Email body parsing | Haiku 4.5 | Good enough for text |
| PDF attachment parsing | Opus 4.5 | Already highest tier |
| AI Assistant | Haiku 4.5 | For complex itinerary planning → Sonnet |

## Prompt Engineering Best Practices for Tripix

1. **Always use Hebrew** in prompts that generate user-facing output
2. **JSON-only responses**: Include "ללא markdown, ללא backticks" instruction
3. **Amount extraction**: Be very explicit about Grand Total vs Subtotal — this is the #1 error source
4. **Provide examples**: When adding new extraction types, include 2-3 example inputs/outputs
5. **Confidence scoring**: Always ask Claude to self-assess confidence; it helps with automatic processing decisions
6. **Token limits**: Haiku is fast but less capable on complex reasoning. For multi-step logic (date overlap calculations, multi-leg flights), consider Sonnet
7. **Image quality**: Receipt photos from phone cameras can be blurry. Add instructions to handle partial/unclear text

## Testing AI Features

To test extraction changes:
1. Collect real receipts/documents (or create realistic test images)
2. Base64 encode them and send to `/api/extract` with the appropriate context
3. Compare extracted JSON against expected values
4. Pay special attention to: amounts (most common error), dates (format issues), categories (misclassification)

To test the assistant:
1. Create a trip with varied expenses and documents
2. Ask questions that require context: "כמה הוצאתי על אוכל?", "מתי הטיסה חזרה?"
3. Test edge cases: empty trip, trip with no expenses, questions about missing data
