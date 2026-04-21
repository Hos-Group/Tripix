/**
 * documentDedup — document-specific deduplication utilities.
 *
 * Three dedup signals, checked in order of strength:
 *   1. gmail_message_id / idempotency_key  — set by email scanners (migration 013, 016)
 *   2. content_hash                        — SHA-256 of file bytes (migration 016)
 *   3. dedup_key                           — logical signature: type + booking_ref + … (migration 016)
 *
 * Usage:
 *   a. compute content_hash and dedup_key before insert
 *   b. call findDuplicate() — if a match exists, reuse it instead of inserting
 *   c. pass content_hash + dedup_key on insert so DB unique indexes guard race conditions
 *   d. catch 23505 with isDedupViolation() and treat as a graceful skip
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Hashing ──────────────────────────────────────────────────────────────────

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let hex = ''
  for (let i = 0; i < u8.length; i++) hex += u8[i].toString(16).padStart(2, '0')
  return hex
}

/** SHA-256 hex digest of a browser File / Blob. */
export async function computeFileHashFromBlob(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return toHex(digest)
}

/** SHA-256 hex digest of a Node Buffer / Uint8Array (server-side). */
export async function computeFileHashFromBuffer(buf: Buffer | Uint8Array): Promise<string> {
  const subtle = (globalThis.crypto && globalThis.crypto.subtle)
    ? globalThis.crypto.subtle
    : (await import('crypto')).webcrypto.subtle
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const ab = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
  const digest = await subtle.digest('SHA-256', ab)
  return toHex(digest)
}

/** SHA-256 hex digest of a base64-encoded payload (e.g. Gmail attachment body). */
export async function computeFileHashFromBase64(b64: string): Promise<string> {
  const buf = Buffer.from(b64, 'base64')
  return computeFileHashFromBuffer(buf)
}

// ─── Logical signature ────────────────────────────────────────────────────────

export interface DedupKeyInput {
  doc_type:      string
  booking_ref?:  string | null
  traveler_id?:  string | null
  valid_from?:   string | null
  name?:         string | null
  flight_number?: string | null
}

/**
 * Build a logical dedup_key for a document.
 * Returns null if there is not enough signal (lets the row through unchanged).
 *
 * Rules:
 *  - With booking_ref:
 *      flight → type|ref|traveler|flight_number|date
 *      other  → type|ref|traveler
 *  - Without booking_ref:
 *      name + date present → type|name|date|traveler
 *      otherwise           → null  (no dedup — too lossy)
 */
export function buildDedupKey(d: DedupKeyInput): string | null {
  const type      = (d.doc_type  || '').toLowerCase()
  const ref       = (d.booking_ref  || '').trim().toLowerCase()
  const traveler  = (d.traveler_id  || 'all').toLowerCase()
  const date      = (d.valid_from   || '').slice(0, 10)
  const flightNum = (d.flight_number || '').trim().toLowerCase()
  const name      = (d.name || '').trim().toLowerCase().replace(/\s+/g, ' ')

  if (ref) {
    if (type === 'flight') return `${type}|${ref}|${traveler}|${flightNum}|${date}`
    return `${type}|${ref}|${traveler}`
  }
  if (name && date) return `${type}|${name}|${date}|${traveler}`
  return null
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export type DuplicateReason = 'gmail_message_id' | 'idempotency_key' | 'content_hash' | 'dedup_key'

export interface DuplicateMatch {
  id:     string
  name:   string
  reason: DuplicateReason
}

/**
 * Check if a document with any of the supplied signals already exists in the
 * same trip. Returns the first match (by signal strength) or null.
 *
 * Signal priority: idempotency_key > gmail_message_id > content_hash > dedup_key
 */
export async function findDuplicate(
  supabase: SupabaseClient,
  tripId: string,
  params: {
    content_hash?:     string | null
    dedup_key?:        string | null
    gmail_message_id?: string | null
    idempotency_key?:  string | null
  },
): Promise<DuplicateMatch | null> {
  const { content_hash, dedup_key, gmail_message_id, idempotency_key } = params

  if (idempotency_key) {
    const { data } = await supabase
      .from('documents')
      .select('id, name')
      .eq('trip_id',          tripId)
      .eq('idempotency_key',  idempotency_key)
      .maybeSingle()
    if (data) return { id: data.id as string, name: data.name as string, reason: 'idempotency_key' }
  }

  if (gmail_message_id) {
    const { data } = await supabase
      .from('documents')
      .select('id, name')
      .eq('trip_id',          tripId)
      .eq('gmail_message_id', gmail_message_id)
      .maybeSingle()
    if (data) return { id: data.id as string, name: data.name as string, reason: 'gmail_message_id' }
  }

  if (content_hash) {
    const { data } = await supabase
      .from('documents')
      .select('id, name')
      .eq('trip_id',      tripId)
      .eq('content_hash', content_hash)
      .maybeSingle()
    if (data) return { id: data.id as string, name: data.name as string, reason: 'content_hash' }
  }

  if (dedup_key) {
    const { data } = await supabase
      .from('documents')
      .select('id, name')
      .eq('trip_id',   tripId)
      .eq('dedup_key', dedup_key)
      .maybeSingle()
    if (data) return { id: data.id as string, name: data.name as string, reason: 'dedup_key' }
  }

  return null
}

// ─── Error helpers ────────────────────────────────────────────────────────────

/**
 * True if a Supabase error is a Postgres unique-violation (23505) on one of
 * the document dedup indexes. Use to treat race-condition insert failures as
 * graceful skips rather than errors.
 */
export function isDedupViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string }
  if (e.code !== '23505') return false
  const m = e.message || ''
  return (
    m.includes('documents_trip_content_hash_unique') ||
    m.includes('documents_trip_dedup_key_unique')    ||
    m.includes('documents_trip_gmail_unique')        ||
    m.includes('documents_trip_idempotency_unique')
  )
}

/** Human-readable Hebrew label for why a document was deduplicated. */
export function dedupReasonLabel(reason: DuplicateReason): string {
  switch (reason) {
    case 'idempotency_key':  return 'מקור כפול'
    case 'gmail_message_id': return 'מייל כפול'
    case 'content_hash':     return 'קובץ זהה כבר קיים'
    case 'dedup_key':        return 'הזמנה זהה כבר קיימת'
  }
}
