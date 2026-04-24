# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Tripix is a Hebrew-first, mobile-first travel-management PWA. Users track trip expenses, scan receipts/documents with Claude AI, import booking emails from Gmail/Outlook, and plan itineraries. Stack: Next.js 14 (App Router) + Supabase + Tailwind + Claude AI, deployed on Vercel.

All user-facing text is Hebrew (`<html lang="he" dir="rtl">`) and the app is sized for mobile (`max-w-lg mx-auto` with a bottom nav). Code/identifiers stay English.

## Commands

```bash
npm run dev      # next dev  (port 3000)
npm run build    # next build
npm run start    # next start

# Duplicate cleanup for documents table (service-role, reads .env.local)
DRY_RUN=1 node scripts/run-dedup-cleanup.mjs   # preview
node scripts/run-dedup-cleanup.mjs             # apply
```

There is no lint script, no test runner, and no single-test command — verify changes by running `npm run build` (which type-checks via `tsc --noEmit` through Next) and by exercising the feature manually in `npm run dev`.

Node 20 is pinned via `vercel.json`. `.npmrc` has `legacy-peer-deps=true` — keep it; several deps (lucide-react v1, react-is v19) would otherwise conflict.

## Deep-dive skill docs — read these first

When working on a specific subsystem, read the matching SKILL.md — they contain the real architectural detail, prompt contents, dedup rules, and known bugs you'll need. Do not duplicate them here.

| Area | File |
|------|------|
| General dev / bug fixing / conventions | `.skills/skills/tripix-dev/SKILL.md` |
| Claude prompts, extract/assistant/parser pipelines | `.skills/skills/tripix-ai/SKILL.md` |
| DB schema, RLS status, migrations, storage, auth | `.skills/skills/tripix-supabase/SKILL.md` |
| Gmail scanning pipeline (most complex subsystem) | `.skills/skills/tripix-gmail-scanner/SKILL.md` |
| Design system, RTL rules, component templates | `.skills/skills/tripix-ui/SKILL.md` |
| Marketing content | `.skills/skills/tripix-marketing/SKILL.md` |

## Architecture at a glance

```
src/
├── app/              Next.js App Router pages + API routes
│   ├── api/          Backend serverless handlers (route.ts per endpoint)
│   └── <feature>/    Client pages (all 'use client')
├── components/       Reusable UI; feature folders: trip/, hotel/, expenses/, scan/, ui/, layout/
├── contexts/         AuthContext, TripContext, LanguageContext
├── lib/              Business logic (supabase client, gmail/email/trip/currency helpers)
└── types/index.ts    ALL TypeScript types + *_META lookup objects
supabase/migrations/  Numeric-prefixed SQL migrations (NNN_name.sql)
.skills/skills/       Domain-specific SKILL.md guides (see table above)
```

Path alias: `@/*` → `./src/*` (see `tsconfig.json`).

### Three AI pipelines (all use `@anthropic-ai/sdk`)

1. **Receipt/document extraction** — `src/app/api/extract/route.ts`. Client posts `{ base64, mediaType, context: 'receipt' | 'document' }`; Haiku 4.5 returns JSON. Prompts `RECEIPT_PROMPT` / `DOCUMENT_PROMPT` are in the route file. Note: trip dates and traveler names are currently hardcoded into `DOCUMENT_PROMPT` — make dynamic before shipping per-trip behavior.
2. **AI assistant chat** — `src/app/api/assistant/route.ts`. Haiku 4.5, 500-token cap, trip context (expenses, docs) injected into system prompt.
3. **Gmail parsing** — `src/lib/emailParser.ts`. Two-stage: PDF attachments → Opus 4.5 (document blocks), body text → Haiku 4.5. `mergeResults()` keeps higher-confidence fields. See the gmail-scanner skill for the full flow — it's 5 files and has nuanced dedup.

### Gmail scan pipeline (the thing most likely to break)

Pipeline lives across `src/lib/{gmailClient,emailParser,tripMatcher,gmailScanner}.ts` plus three API routes: `/api/gmail/scan` (manual, 30d), `/api/gmail/scan-trip` (trip-specific, 365d, full dedup), `/api/gmail/auto-scan` (Vercel cron, `0 9 * * *` from `vercel.json`).

Iron rule — three dedup layers in `scanTripGmail`, in this order:
1. `email_ingests.gmail_message_id` (primary, deterministic — checked before any Claude call)
2. `documents.booking_ref` (+ title for flights, since flights are per-passenger)
3. `documents.name + valid_from` (catches repeat confirmation/reminder emails)

Never bypass these. Read the skill before touching the scanner.

### Supabase client rules

- **Client-side**: `import { supabase } from '@/lib/supabase'` — a lazy-init singleton **Proxy** (intentional — prevents multiple instances during HMR/hydration). Uses the anon key.
- **Server-side (API routes)**: `getServiceClient()` from the same file, or `createClient(URL, SERVICE_ROLE_KEY)` directly. Service role bypasses RLS.
- `amount_ils` is populated by the `calculate_amount_ils()` Postgres trigger on `expenses` — insert `amount + currency` only, never compute it in app code.

### State

- `AuthContext`: user/session/profile/isAdmin/displayName/signOut. Reacts to `onAuthStateChange`.
- `TripContext`: `trips`, `currentTrip`, `setCurrentTripId`, `refreshTrips`. Current trip persisted in `localStorage` key `tripix_current_trip`. The read happens during render — wrap new access in `useEffect` or `typeof window` checks to avoid SSR hydration mismatches.

## Conventions that matter

- **Hebrew UI text, including API error messages.** Code, comments, commit messages stay English.
- **Types are centralized** in `src/types/index.ts`. When adding a new `Category`, `DocType`, `Currency`, etc., update both the union type **and** its `*_META` lookup (label/icon/color). Don't scatter types across files.
- **Category colors** come from `CATEGORY_META` — reuse those hex values, don't invent new ones. Primary brand color is `#185FA5` (tailwind `primary`), with the hero gradient `from-[#185FA5] to-[#378ADD]`. (Note: `tailwind.config.ts` currently defines `primary` as `#6C47FF` — treat the `#185FA5` usage in pages/components as the source of truth for the brand color; reconcile before changing the Tailwind token.)
- **Pages** are `'use client'`, use `framer-motion` for entry animations, `lucide-react` for interactive icons, emojis only as decorative category indicators.
- **Standard card**: `bg-white rounded-2xl p-4 shadow-sm border border-gray-50`.
- **API routes**: `src/app/api/<endpoint>/route.ts`, export `GET`/`POST`/`DELETE`, parse with `await req.json()`, respond with `NextResponse.json(...)`.
- **Migrations**: next numeric prefix (highest current: `020`), idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`), include a rollback comment. Note that `018` is currently used by three files (`018_dedup_cleanup`, `018_document_expense_link`, `018_expense_amount_positive`) — new files should use `021+` to avoid ambiguity.

## Known hazards (don't regress these)

- **RLS is effectively disabled** on most tables; API routes use the service role key and do not always validate `user_id`. When writing new data-access paths, explicitly check ownership (`trip.user_id === auth.uid()` or membership via `trip_members`). See the supabase skill for the full set of policies that need to be added.
- **`src/lib/utils.ts` has hardcoded FX rates**; `src/lib/rates.ts` fetches live ones. Prefer `rates.ts` for new code.
- **`DOCUMENT_PROMPT` in `/api/extract/route.ts`** has trip dates and traveler names baked in — any change to extraction should thread the current trip through dynamically.
- **PWA service worker** (`next-pwa`) generates `public/sw.js` and `public/workbox-*.js`; these are gitignored. Disabled in dev.

## Git workflow for this environment

- Develop on branch `claude/add-claude-documentation-MGwoT` (already checked out).
- Push with `git push -u origin <branch>`. Do not open a PR unless explicitly asked.
- Do not interact with GitHub repos other than `hos-group/tripix`.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # server only
ANTHROPIC_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CRON_SECRET=                    # auths /api/gmail/auto-scan
```
