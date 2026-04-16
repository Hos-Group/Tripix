---
name: tripix-dev
description: |
  Tripix development & bug fixing skill. Use this skill whenever working on the Tripix travel management app codebase — adding features, fixing bugs, refactoring code, debugging errors, or understanding how the system works. Trigger on any mention of Tripix, trip management app, travel app, or when editing files under the Tripix project directory. Also trigger for Hebrew phrases like "תקן באג", "הוסף פיצ'ר", "שנה את הקוד", or any development task related to expenses, documents, trips, Gmail scanning, or the AI assistant within this project.
---

# Tripix Development Skill

You are working on **Tripix** — a Hebrew-first, mobile-first travel management PWA built with Next.js 14 (App Router), Supabase, Tailwind CSS, and Claude AI. The app helps users track trip expenses, scan receipts/documents with AI, manage travel documents, and plan itineraries.

## Architecture Overview

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # Backend API routes (serverless functions)
│   │   ├── assistant/      # Claude AI chat endpoint
│   │   ├── auth/           # Signup, Google OAuth
│   │   ├── documents/      # CRUD + file upload to Supabase storage
│   │   ├── email-aliases/  # Email forwarding aliases
│   │   ├── email-ingest/   # Inbound email processing
│   │   ├── expenses/       # CRUD for trip expenses
│   │   ├── extract/        # Claude-powered receipt/document OCR
│   │   ├── gmail/          # Gmail scanning (manual + auto cron)
│   │   ├── memories/       # Trip memories/photos
│   │   ├── rates/          # Currency exchange rates
│   │   ├── setup/          # One-time migration runner
│   │   ├── shared/         # Shared trip management
│   │   └── weather/        # Weather data for destinations
│   ├── dashboard/          # Main dashboard with expense summary
│   ├── expenses/           # Expense list & management
│   ├── documents/          # Document viewer & upload
│   ├── scan/               # Receipt scanning camera
│   ├── trips/              # Trip CRUD (new, edit, list)
│   ├── assistant/          # AI chat interface
│   ├── itinerary/          # Day-by-day itinerary
│   ├── timeline/           # Visual timeline view
│   ├── budget/             # Budget tracking & planning
│   ├── packing/            # Packing list
│   ├── weather/            # Destination weather
│   ├── emergency/          # Emergency contacts by destination
│   ├── community/          # Community features
│   ├── shared/             # Shared trip views
│   ├── memories/           # Photo memories
│   ├── onboarding/         # New user onboarding
│   ├── settings/           # User settings
│   └── tools/              # Utility tools
├── components/             # Reusable React components
│   ├── layout/             # GlobalHeader, BottomNav, HamburgerMenu
│   └── *.tsx               # Feature components
├── contexts/               # React Context providers
│   ├── AuthContext.tsx      # Auth state, profile, session
│   └── TripContext.tsx      # Trip list, current trip selection
├── lib/                    # Shared utilities & business logic
│   ├── supabase.ts         # Supabase client (singleton proxy)
│   ├── auth.ts             # Auth helper functions
│   ├── utils.ts            # Currency conversion, formatting, cn()
│   ├── rates.ts            # Historical exchange rate fetcher
│   ├── gmailClient.ts      # Gmail API wrapper (search, fetch, decode)
│   ├── gmailScanner.ts     # Gmail scanning orchestrator
│   ├── emailParser.ts      # Claude-powered email classification
│   ├── tripMatcher.ts      # Fuzzy trip matching by destination/date
│   └── destinations.ts     # 163 countries with meta (currency, timezone, emergency)
└── types/
    └── index.ts            # All TypeScript types, enums, metadata objects
```

## Key Conventions

### Language & Locale
- **All user-facing text is in Hebrew** (עברית). Labels, errors, prompts, metadata — everything.
- The app is **RTL** (`<html lang="he" dir="rtl">`).
- Use `he-IL` locale for number formatting.
- When adding new features, always use Hebrew for UI text. English is fine for code, variable names, and comments.

### TypeScript Patterns
- Types are centralized in `src/types/index.ts`. Add new types there, not scattered across files.
- Category, Currency, DocType, TravelerId, TripType are all string union types with corresponding `*_META` objects that map each value to `{ label, icon, color }`.
- When adding a new category or type, update both the union type AND its META object.

### Component Patterns
- All page components are `'use client'` (client-side rendering).
- Use `framer-motion` for animations (`motion.div` with `initial`, `animate`, `transition`).
- Use `lucide-react` for icons (not emojis in interactive elements).
- Card style: `bg-white rounded-2xl p-4 shadow-sm border border-gray-50`.
- Loading state: spinning border circle (`border-4 border-primary border-t-transparent rounded-full animate-spin`).
- Empty states: centered emoji + bold title + gray subtitle.

### Supabase Patterns
- **Client-side**: Import `supabase` from `@/lib/supabase` (anon key, uses proxy singleton).
- **Server-side (API routes)**: Create client with `createClient(URL, SERVICE_ROLE_KEY)` directly.
- Queries: `.from('table').select('*').eq('field', value).order('field', { ascending: false })`.
- File uploads: `supabase.storage.from('documents').upload(path, buffer)` + `getPublicUrl()`.
- The Supabase client uses a lazy-init proxy to prevent multiple instances.

### API Route Patterns
- All in `src/app/api/[endpoint]/route.ts`.
- Export async functions: `GET`, `POST`, `DELETE` (named exports).
- Parse body: `await req.json()`.
- Return: `NextResponse.json({ data })` or `NextResponse.json({ error }, { status: code })`.
- Error messages should be in Hebrew.

### State Management
- `AuthContext`: user, session, profile, isAdmin, displayName, signOut.
- `TripContext`: trips[], currentTrip, setCurrentTripId, refreshTrips.
- Current trip ID persisted in `localStorage` (key: `tripix_current_trip`).

### Styling
- Tailwind CSS with custom primary color (`#185FA5`).
- The primary gradient is: `bg-gradient-to-br from-[#185FA5] to-[#378ADD]`.
- Mobile-first: `max-w-lg mx-auto`, bottom nav with safe-area padding.
- Category colors are defined in `CATEGORY_META` — reuse those hex values, don't invent new ones.

## Known Issues to Be Aware Of

These are real issues in the codebase. When working on related areas, fix them proactively:

1. **RLS is disabled**: Row Level Security is commented out in migrations. API routes don't validate user ownership. When touching auth or data access, add `user_id` checks.

2. **Hardcoded exchange rates**: `src/lib/utils.ts` has hardcoded rates for currency conversion. The `rates.ts` file fetches live rates but the dashboard uses the hardcoded ones. Prefer using the rates API.

3. **Extract prompt has hardcoded trip info**: `/api/extract/route.ts` has trip dates and traveler names baked into the prompt. This should be dynamic based on the current trip.

4. **No input validation**: API routes accept any payload. Add validation for required fields, types, and ranges.

5. **localStorage hydration**: `TripContext` reads localStorage during render, which can cause SSR/hydration mismatches. Wrap in `useEffect` or check `typeof window`.

6. **Profile RLS allows any user to read/update any profile**: The `user_profiles` RLS policy is too permissive.

## Development Workflow

When adding a new feature:
1. Define types in `src/types/index.ts`
2. Create the API route in `src/app/api/`
3. Build the page component in `src/app/[feature]/page.tsx`
4. Extract reusable parts into `src/components/`
5. If it needs shared state, add to the relevant context

When fixing a bug:
1. Identify which layer the bug is in (API, component, lib, types)
2. Check if related known issues apply
3. Test with Hebrew text and RTL layout
4. Make sure currency amounts convert correctly (ILS is the base)

## Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Claude API for AI features |
| `@supabase/supabase-js` | Database, auth, storage |
| `recharts` | Charts (PieChart in dashboard) |
| `framer-motion` | Page transitions & animations |
| `lucide-react` | Icon library |
| `react-hot-toast` | Toast notifications |
| `leaflet` / `react-leaflet` | Maps |
| `date-fns` | Date formatting |
| `next-pwa` | PWA service worker |
| `clsx` + `tailwind-merge` | Class name utilities |

## Claude AI Integration

The app uses Claude in two ways:

1. **Document/Receipt Extraction** (`/api/extract`): Sends images/PDFs to Claude Haiku with detailed Hebrew prompts. Returns structured JSON with expense data or document metadata. The prompts are in `RECEIPT_PROMPT` and `DOCUMENT_PROMPT` constants.

2. **AI Assistant** (`/api/assistant`): Chat interface using Claude Haiku with trip context (expenses, documents, dates) injected into the system prompt. Limited to 500 tokens per response.

3. **Email Parsing** (`lib/emailParser.ts`): Two-stage parsing — PDF attachments go to Claude Opus, email body text goes to Haiku. Results merged by confidence score.

When modifying AI features, preserve the Hebrew language in prompts and keep the JSON-only response format.
