/**
 * Unified deduplication helpers — expenses + documents.
 *
 * Two independent strategies:
 *   1. idempotency_key  — deterministic "<source>:<id>" string.
 *                         DB unique index (migration 016) hard-blocks second
 *                         insert.  Callers catch 23505 or use insertWithDedup().
 *   2. content_hash     — semantic fingerprint (normalised title|amount|…).
 *                         App-level soft-block: manual entries can be forced
 *                         with `force: true`, scans silently skip.
 *
 * Document multi-signal dedup (file-bytes hash + logical key + gmail_id)
 * lives in ./documentDedup.ts and is imported by API routes + scanners.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultSupabase } from './supabase'

// ─── Text normalisation ──────────────────────────────────────────────────────

/**
 * Normalise free text for stable hashing across languages. ES5-compatible.
 *
 * Also strips passenger-name suffixes that the per-trip Gmail scanner
 * appends (e.g. "Bangkok Airways PG250 – Halevy Omer" → "bangkok airways pg250").
 * Without this strip, the generic scanner (`processMessages`) and the
 * per-passenger scanner (`processTripMessages`) produce different
 * fingerprints for the same booking and both rows survive the DB unique
 * index, leading to visible duplicates on the Expenses page.
 */
function normaliseTitle(input: string): string {
  // Strip " – <passenger>", " - <passenger>", " — <passenger>" at the end.
  // Keeps the pre-dash portion (which is the booking/flight identifier).
  // No /u flag (tsconfig target=es5); character class lists the 3 dash variants.
  const noPassenger = input.replace(/\s*[\u2013\u2014-]\s*[^\u2013\u2014-]+$/, '')
  return noPassenger
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Idempotency keys (hard dedup, DB-enforced) ──────────────────────────────

export type DedupSource = 'gmail' | 'ms' | 'scan' | 'voice' | 'import'

/** Build a deterministic idempotency key from a source + its native ID. */
export function idempotencyKey(source: DedupSource, sourceId: string): string {
  if (!sourceId) throw new Error('idempotencyKey: sourceId required')
  return source + ':' + sourceId
}

/** Build a scan-source idempotency key from a hex content hash. */
export function scanIdempotencyKey(contentHashHex: string): string {
  return idempotencyKey('scan', contentHashHex)
}

// ─── Expense fingerprint (soft dedup, app-enforced) ──────────────────────────

/**
 * Build a deterministic fingerprint for an expense.
 * Stored in expenses.content_hash; the DB index lets us check for soft dups.
 * Excludes notes/receipt_url so re-scanning the same receipt with a slightly
 * different annotation is still caught.
 */
export function buildExpenseFingerprint(
  tripId: string,
  amount: number,
  date: string,
  title: string,
): string {
  return tripId + '|' + Number(amount).toFixed(2) + '|' + date + '|' + normaliseTitle(title)
}

export interface DuplicateExpense {
  id:           string
  title:        string
  amount:       number
  currency:     string
  expense_date: string
  source:       string
}

/** Returns the existing expense that matches fingerprint, or null. */
export async function findDuplicateExpense(
  fingerprint: string,
  tripId?: string,
): Promise<DuplicateExpense | null> {
  let q = defaultSupabase
    .from('expenses')
    .select('id, title, amount, currency, expense_date, source')
    .eq('content_hash', fingerprint)
  if (tripId) q = q.eq('trip_id', tripId)
  const { data } = await q.maybeSingle()
  return data ?? null
}

/**
 * Same-booking lookup: finds an existing expense in the same trip with the
 * SAME exact title + currency + date AND an amount within a typical
 * net/gross tax ratio of the incoming amount.
 *
 * Used to detect "two amounts for one booking" — the classic parser failure
 * where a hotel invoice shows both net (pre-tax) and gross (post-tax) totals
 * and the scanner creates two rows (e.g. Anantara Koh Yao Yai: €1200 net +
 * €1330 gross on the same day). One booking = one payment.
 *
 * Ratio guard (ratio = max / min):
 *   - ≤ 1.30  → same booking (typical VAT/service tax is 7–25%)
 *   - > 1.30  → probably legitimately separate charges
 *              (e.g. 3 per-passenger tickets at 965 / 3850 / 7450 THB on the
 *              same flight — scanner couldn't attach passenger names)
 *
 * Important — uses the FULL title (no passenger suffix strip), so three
 * per-passenger tickets with identical prefix + distinct passenger suffixes
 * are never matched either (titles differ before the amount ratio even runs).
 */
export async function findSameBookingExpense(
  tripId:         string,
  title:          string,
  currency:       string,
  date:           string,
  incomingAmount: number,
): Promise<DuplicateExpense | null> {
  const trimmedTitle = title.trim()
  if (!trimmedTitle || !Number.isFinite(incomingAmount) || incomingAmount <= 0) return null
  const { data } = await defaultSupabase
    .from('expenses')
    .select('id, title, amount, currency, expense_date, source')
    .eq('trip_id',      tripId)
    .eq('expense_date', date)
    .eq('currency',     currency)
    .eq('title',        trimmedTitle)
  if (!data || data.length === 0) return null
  // Within rows that already share (trip, title, currency, date), only
  // treat as a same-booking match if the amount ratio is within the
  // net/gross band.  Otherwise the other row(s) are legitimate peers.
  const MAX_RATIO = 1.30
  const candidates = data.filter(r => {
    const a = Number(r.amount)
    if (!Number.isFinite(a) || a <= 0) return false
    const ratio = Math.max(a, incomingAmount) / Math.min(a, incomingAmount)
    return ratio <= MAX_RATIO
  })
  if (candidates.length === 0) return null
  // Largest-amount candidate wins (= keeps the gross total).
  candidates.sort((x, y) => Number(y.amount) - Number(x.amount))
  return candidates[0] as DuplicateExpense
}

/**
 * Cross-date vendor lookup: finds an existing expense in the same trip with
 * the same normalized title + amount + currency, regardless of the expense
 * date.
 *
 * Intended for document/scan-sourced inserts only — one booking confirmation
 * is one payment, so if the same "Anantara Layan Phuket" @ 28907.42 THB
 * already exists in the trip under ANY date, importing it again (even with
 * a different parsed date like 2026-04-22 vs 2026-04-11) is a duplicate.
 *
 * NOT called for manual entries: a user might legitimately spend 50 THB at
 * the same street-food stall on three different days.
 */
export async function findVendorExpense(
  tripId:   string,
  title:    string,
  amount:   number,
  currency: string,
): Promise<DuplicateExpense | null> {
  const normTitle = normaliseTitle(title)
  // PostgREST lets us filter by content_hash prefix to narrow the query;
  // then we match on the normalized title + amount + currency client-side
  // (the DB row's content_hash already encodes a date, so we can't index-
  // match directly — full scan on the trip's rows is fine at Tripix's scale).
  const { data } = await defaultSupabase
    .from('expenses')
    .select('id, title, amount, currency, expense_date, source')
    .eq('trip_id',  tripId)
    .eq('currency', currency)
    .eq('amount',   amount)
  if (!data || data.length === 0) return null
  const match = data.find(r => normaliseTitle(r.title) === normTitle)
  return (match as DuplicateExpense | undefined) ?? null
}

// ─── Document fingerprint ────────────────────────────────────────────────────

export interface DocumentFingerprintInput {
  trip_id:     string
  name:        string
  doc_type:    string
  booking_ref: string | null
  valid_from:  string | null
  traveler_id: string
}

/**
 * Build a deterministic content_hash string for a document.
 * booking_ref drives uniqueness when present; falls back to normalised name.
 * Passports dedupe on passport-number only (traveler ignored).
 */
export function buildDocumentFingerprint(fp: DocumentFingerprintInput): string {
  const refOrName = fp.booking_ref
    ? fp.booking_ref.toUpperCase().trim()
    : normaliseTitle(fp.name)
  const traveler = fp.doc_type === 'passport' ? 'all' : fp.traveler_id
  return [fp.trip_id, fp.doc_type, refOrName, fp.valid_from || '', traveler].join('|')
}

export interface DuplicateDocument {
  id:         string
  name:       string
  doc_type:   string
  created_at: string
}

/**
 * Returns the existing document matching booking_ref + type + traveler, or null.
 * New code should prefer findDuplicate() from ./documentDedup.ts which
 * checks all three signals (content_hash + dedup_key + gmail_message_id).
 */
export async function findDuplicateDocument(
  tripId:     string,
  bookingRef: string,
  docType:    string,
  travelerId: string,
): Promise<DuplicateDocument | null> {
  const trimmed = bookingRef.trim()
  if (!trimmed) return null

  let query = defaultSupabase
    .from('documents')
    .select('id, name, doc_type, created_at')
    .eq('trip_id', tripId)
    .eq('doc_type', docType)
    .eq('booking_ref', trimmed)

  if (docType !== 'passport' && travelerId !== 'all') {
    query = query.eq('traveler_id', travelerId)
  }

  const { data } = await query.maybeSingle()
  return data ?? null
}

// ─── Unified insert-with-dedup wrapper ───────────────────────────────────────

export interface DedupResult<T> {
  data:      T | null
  duplicate: boolean
  reason:    'idempotency' | 'content' | null
  existing:  T | null
}

/**
 * Insert a row with two-layer dedup.
 *
 * Flow:
 *   1. If softDedup + contentHash + !force: pre-check the content_hash index.
 *      Returns { duplicate: true, reason: 'content', existing } if found.
 *   2. Insert with idempotency_key + content_hash set on the payload.
 *   3. On 23505 unique violation with idempotencyKey set: fetch the existing
 *      row and return { duplicate: true, reason: 'idempotency', existing }.
 *   4. Other DB errors are re-thrown.
 */
export async function insertWithDedup<T extends { id: string }>(opts: {
  supabase?:       SupabaseClient
  table:           'expenses' | 'documents'
  trip_id:         string
  payload:         Record<string, unknown>
  idempotencyKey?: string | null
  contentHash?:    string | null
  softDedup?:      boolean
  force?:          boolean
}): Promise<DedupResult<T>> {
  const db = opts.supabase ?? defaultSupabase
  const {
    table, trip_id, payload,
    idempotencyKey: idemKey = null,
    contentHash             = null,
    softDedup               = true,
    force                   = false,
  } = opts

  // Soft pre-check (skip when force=true or idempotencyKey is present)
  if (contentHash && softDedup && !force && !idemKey) {
    const { data: existing } = await db
      .from(table)
      .select('*')
      .eq('trip_id',      trip_id)
      .eq('content_hash', contentHash)
      .maybeSingle()
    if (existing) {
      return { data: null, duplicate: true, reason: 'content', existing: existing as T }
    }
  }

  const fullPayload: Record<string, unknown> = Object.assign(
    {},
    payload,
    idemKey     ? { idempotency_key: idemKey }    : {},
    contentHash ? { content_hash:    contentHash } : {},
  )

  const { data, error } = await db
    .from(table)
    .insert(fullPayload)
    .select()
    .single()

  if (error) {
    // Race-condition hard-block on idempotency_key
    if (error.code === '23505' && idemKey) {
      const { data: existing } = await db
        .from(table)
        .select('*')
        .eq('trip_id',         trip_id)
        .eq('idempotency_key', idemKey)
        .maybeSingle()
      return {
        data:      null,
        duplicate: true,
        reason:    'idempotency',
        existing:  (existing as T) || null,
      }
    }
    throw error
  }

  return { data: data as T, duplicate: false, reason: null, existing: null }
}

// ─── Document → Expense auto-creation ────────────────────────────────────────

/**
 * Map from parsed booking_type / doc_type to the `expenses.category` enum.
 * Single source of truth used by all scanners + the manual-upload API route.
 */
const EXPENSE_CATEGORY_MAP: Record<string, string> = {
  hotel:       'hotel',
  flight:      'flight',
  car_rental:  'car_rental',
  activity:    'activity',
  tour:        'activity',
  insurance:   'insurance',
  ferry:       'ferry',
  train:       'train',
  visa:        'visa',
  passport:    'other',
  other:       'other',
}

export interface ExtractedAmountData {
  amount?:         number | string | null
  currency?:       string | null
  check_in?:       string | null
  departure_date?: string | null
  valid_from?:     string | null
  confirmation_number?: string | null
  booking_type?:   string | null
}

export interface DocumentExpenseInput {
  trip_id:        string
  user_id?:       string | null
  document_id?:   string | null
  doc_type:       string                    // e.g. 'flight', 'hotel'
  name:           string                    // becomes expense title
  extracted_data: ExtractedAmountData | null | undefined
  amount_ils:     number                    // pre-converted to ILS by caller
  fallback_date?: string | null             // used when extracted_data has no date
  source?:        'manual' | 'scan' | 'document' | 'voice'
  idempotency_key?: string | null           // propagated from the document for hard dedup
  notes?:         string | null
}

/**
 * Decide whether a parsed document should create a linked expense.
 *
 * Rule:  ONLY create an expense when the document has a clearly paid amount
 *        > 0. Passports / visas / insurance without an amount stay on the
 *        Documents page and do not inflate the expense totals.
 *
 * Returns the numeric amount on success, or `null` if no expense should be
 * created. Callers that receive `null` must skip the expense insert.
 */
export function shouldCreateExpenseFromDocument(
  extracted: ExtractedAmountData | null | undefined,
): number | null {
  if (!extracted) return null
  const raw = extracted.amount
  if (raw === null || raw === undefined || raw === '') return null
  const num = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

/**
 * Insert an expense linked to a document, with both dedup layers applied.
 *
 * No-op (returns null) when the extracted amount is missing/zero/negative —
 * this is intentional: documents without a paid amount (passport, blank
 * insurance PDF, etc.) must NOT surface on the Expenses page.
 *
 * The `idempotency_key` is propagated from the parent document so a re-run
 * of the same upload / email can't create a duplicate expense either.
 */
export async function insertExpenseFromDocument(
  input: DocumentExpenseInput,
  db: SupabaseClient = defaultSupabase,
): Promise<{ inserted: boolean; reason?: 'no_amount' | 'duplicate' | 'error'; id?: string }> {
  const amount = shouldCreateExpenseFromDocument(input.extracted_data)
  if (amount === null) {
    return { inserted: false, reason: 'no_amount' }
  }

  const expenseDate =
    input.extracted_data?.check_in       ||
    input.extracted_data?.departure_date ||
    input.extracted_data?.valid_from     ||
    input.fallback_date                   ||
    new Date().toISOString().split('T')[0]

  const category = EXPENSE_CATEGORY_MAP[input.doc_type]
             || EXPENSE_CATEGORY_MAP[input.extracted_data?.booking_type || '']
             || 'other'

  const currency = (input.extracted_data?.currency || 'ILS').toUpperCase()

  // Cross-date vendor check: if the SAME trip already has an expense for
  // the SAME normalized vendor + amount + currency under any other date,
  // treat this new import as a duplicate.  This catches the case where
  // one Gmail confirmation yields two "Anantara Layan Phuket @ 28907.42 THB"
  // rows dated on check-in vs booking-date.
  const vendorMatch = await findVendorExpense(input.trip_id, input.name, amount, currency)
  if (vendorMatch) {
    return { inserted: false, reason: 'duplicate', id: vendorMatch.id }
  }

  // Same-booking cross-amount check: if an expense already exists for the
  // exact same (trip, title, currency, date) with a DIFFERENT amount within
  // the typical net/gross tax ratio, it's almost certainly the same booking
  // parsed twice (net vs gross totals). Keep the larger amount.
  const bookingMatch = await findSameBookingExpense(
    input.trip_id, input.name, currency, expenseDate, amount,
  )
  if (bookingMatch) {
    if (Number(bookingMatch.amount) >= amount) {
      // Existing row is larger/equal → the incoming row is the lesser (net) amount.
      return { inserted: false, reason: 'duplicate', id: bookingMatch.id }
    }
    // Incoming row is larger (gross) → upgrade the canonical row to this
    // amount and skip inserting a new one.  Use the service-role client when
    // the caller passed one; otherwise fall back to the default.
    await db.from('expenses')
      .update({
        amount,
        amount_ils:   input.amount_ils,
        content_hash: buildExpenseFingerprint(input.trip_id, amount, expenseDate, input.name),
      })
      .eq('id', bookingMatch.id)
    return { inserted: false, reason: 'duplicate', id: bookingMatch.id }
  }

  const fingerprint = buildExpenseFingerprint(input.trip_id, amount, expenseDate, input.name)

  const payload: Record<string, unknown> = {
    trip_id:        input.trip_id,
    user_id:        input.user_id,
    title:          input.name,
    amount,
    currency,
    amount_ils:     input.amount_ils,
    category,
    expense_date:   expenseDate,
    source:         input.source || 'document',
    is_paid:        true,
    content_hash:   fingerprint,
    document_id:    input.document_id || null,
    notes: [
      input.extracted_data?.confirmation_number
        ? `מספר אישור: ${input.extracted_data.confirmation_number}`
        : null,
      input.notes || null,
    ].filter(Boolean).join('\n') || null,
  }
  if (input.idempotency_key) payload.idempotency_key = input.idempotency_key

  const { data, error } = await db
    .from('expenses')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { inserted: false, reason: 'duplicate' }
    console.error('[insertExpenseFromDocument] insert error:', error.message)
    return { inserted: false, reason: 'error' }
  }
  return { inserted: true, id: (data as { id: string }).id }
}
