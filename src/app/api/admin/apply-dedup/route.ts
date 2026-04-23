/**
 * GET /api/admin/apply-dedup?secret=<ADMIN_MIGRATE_SECRET>
 *
 * One-time rollout for the system-wide dedup + document→expense pipeline.
 * Idempotent — safe to re-run.
 *
 * Steps:
 *   1. Apply DB migrations (016_dedup, 016_documents_dedup, 017_idempotency_keys).
 *      All DDL uses IF NOT EXISTS so re-runs are no-ops.
 *   2. Backfill: for every existing `documents` row whose extracted_data.amount
 *      is a positive number AND which has no corresponding expense in the same
 *      trip (matched via content_hash fingerprint), insert the linked expense.
 *
 * Output: per-account counters + a sample of any errors encountered.
 *
 * SECURITY: gated behind the admin secret env var. Uses the service-role key
 * so RLS doesn't hide rows from the backfill sweep.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildExpenseFingerprint,
  shouldCreateExpenseFromDocument,
  findVendorExpense,
  type ExtractedAmountData,
} from '@/lib/dedup'

const ADMIN_SECRET = process.env.ADMIN_MIGRATE_SECRET || 'tripix_migrate_2026'

const EXPENSE_CATEGORY_MAP: Record<string, string> = {
  hotel: 'hotel', flight: 'flight', car_rental: 'car_rental',
  activity: 'activity', tour: 'activity', insurance: 'insurance',
  ferry: 'ferry', train: 'train', visa: 'visa', passport: 'other',
  other: 'other',
}

const MIGRATION_SQL = `
-- 016_dedup.sql (expenses.content_hash + document booking-ref unique indexes)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS content_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_content_hash_unique
  ON expenses (content_hash) WHERE content_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS documents_passport_dedup
  ON documents (trip_id, booking_ref)
  WHERE doc_type = 'passport' AND booking_ref IS NOT NULL AND booking_ref <> '';
CREATE UNIQUE INDEX IF NOT EXISTS documents_booking_dedup
  ON documents (trip_id, doc_type, booking_ref, traveler_id)
  WHERE doc_type <> 'passport' AND booking_ref IS NOT NULL AND booking_ref <> ''
    AND traveler_id <> 'all';

-- 016_documents_dedup.sql (documents.content_hash + dedup_key)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS dedup_key    TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_content_hash_unique
  ON documents (trip_id, content_hash) WHERE content_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_dedup_key_unique
  ON documents (trip_id, dedup_key) WHERE dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_content_hash_idx
  ON documents (content_hash) WHERE content_hash IS NOT NULL;

-- 017_idempotency_keys.sql (unified idempotency_key on both tables)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_idempotency_unique
  ON documents (trip_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
UPDATE documents
SET idempotency_key = CASE
  WHEN gmail_message_id LIKE 'ms\\_%' ESCAPE '\\' THEN 'ms:' || substring(gmail_message_id FROM 4)
  ELSE 'gmail:' || gmail_message_id
END
WHERE gmail_message_id IS NOT NULL AND idempotency_key IS NULL;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_trip_idempotency_unique
  ON expenses (trip_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
UPDATE expenses
SET idempotency_key = 'gmail:' || substring(notes FROM '^GMID:([^\\n]+)')
WHERE notes LIKE 'GMID:%' AND idempotency_key IS NULL;
`.trim()

interface BackfillStats {
  expenses_hash_backfilled: number
  documents_scanned:        number
  documents_zero_amount:    number
  documents_already_linked: number
  expenses_created:         number
  expenses_dup_skipped:     number
  errors:                   Array<{ id: string; stage: string; message: string }>
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'missing supabase env' }, { status: 500 })
  }

  // ── Step 1: apply DDL ────────────────────────────────────────────────────
  // Strategy (same fallbacks as the existing /api/run-migration-011 route):
  //   a. Supabase RPC `exec_sql` — present in most Tripix projects
  //   b. Direct pg connection via DATABASE_URL / SUPABASE_DB_URL (pooled 6543)
  //   c. Supabase Management API (requires PAT; only works when MGMT_PAT env set)
  //
  // Failing all three, we continue to the backfill — the schema check there
  // will raise a clear error if the required columns don't exist.
  const migrationAttempts: Array<{ step: string; ok: boolean; error?: string }> = []
  const dbClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const statements = MIGRATION_SQL.split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/m)
    .map(s => s.trim()).filter(s => s && !s.startsWith('--'))

  // Attempt (a): exec_sql RPC
  let rpcOk = true
  for (const sql of statements) {
    const { error } = await dbClient.rpc('exec_sql', { query: sql })
    if (error) { rpcOk = false; break }
  }
  migrationAttempts.push({ step: 'rpc_exec_sql', ok: rpcOk })

  // Attempt (b): direct pg connection
  let pgOk = false
  if (!rpcOk) {
    const dbUrl = process.env.DATABASE_URL
               || process.env.SUPABASE_DB_URL
               || process.env.PG_CONNECTION_STRING
    if (dbUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Client } = require('pg')
        const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
        await client.connect()
        try {
          await client.query(MIGRATION_SQL)
          pgOk = true
        } finally {
          await client.end()
        }
      } catch (pgErr) {
        migrationAttempts.push({ step: 'pg_client', ok: false, error: String(pgErr) })
      }
    } else {
      migrationAttempts.push({ step: 'pg_client', ok: false, error: 'no DATABASE_URL env' })
    }
    if (pgOk) migrationAttempts.push({ step: 'pg_client', ok: true })
  }

  // Attempt (c): management API (PAT required)
  let mgmtOk = false
  const mgmtPat = process.env.SUPABASE_MGMT_PAT
  if (!rpcOk && !pgOk && mgmtPat) {
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
    try {
      const mgmtRes = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${mgmtPat}`,
          },
          body: JSON.stringify({ query: MIGRATION_SQL }),
        },
      )
      mgmtOk = mgmtRes.ok
      migrationAttempts.push({
        step: 'mgmt_api',
        ok:   mgmtOk,
        error: mgmtOk ? undefined : `HTTP ${mgmtRes.status}: ${(await mgmtRes.text()).slice(0, 200)}`,
      })
    } catch (err) {
      migrationAttempts.push({ step: 'mgmt_api', ok: false, error: String(err) })
    }
  }

  const migrationStatus = {
    applied: rpcOk || pgOk || mgmtOk,
    attempts: migrationAttempts,
  }

  // ── Step 2: backfill linked expenses ─────────────────────────────────────
  const db = dbClient

  // Preflight — verify the columns exist. If they don't, bail with a clear
  // instruction to run the SQL manually in the Supabase dashboard.
  const preflight = await db.from('expenses').select('content_hash').limit(0)
  if (preflight.error) {
    return NextResponse.json({
      ok: false,
      migration: migrationStatus,
      preflight_error: preflight.error.message,
      hint: 'DDL did not apply via RPC/pg/MGMT. Open Supabase SQL editor and run migrations 016_dedup.sql, 016_documents_dedup.sql, 017_idempotency_keys.sql manually, then re-call this endpoint.',
    }, { status: 500 })
  }

  const stats: BackfillStats = {
    expenses_hash_backfilled: 0,
    documents_scanned:        0,
    documents_zero_amount:    0,
    documents_already_linked: 0,
    expenses_created:         0,
    expenses_dup_skipped:     0,
    errors:                   [],
  }

  const PAGE_SIZE = 500

  // ── Step 2a: backfill content_hash on legacy expenses ────────────────────
  // Legacy Gmail/Microsoft-scanned expenses predate migration 016 and have
  // `content_hash IS NULL`. If we skip this step, the document→expense loop
  // below will consider them "missing" and create duplicates.
  //
  // We page through all such rows, recompute the fingerprint, and UPDATE.
  // If two legacy rows collapse to the same fingerprint (true duplicates
  // that slipped in before the unique index existed) the UPDATE on the
  // second one will hit 23505 — we capture that in `expenses_dup_skipped`
  // and leave the row alone for manual review.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: legacy, error: legacyErr } = await db
      .from('expenses')
      .select('id, trip_id, amount, expense_date, title')
      .is('content_hash', null)
      .range(offset, offset + PAGE_SIZE - 1)

    if (legacyErr) {
      stats.errors.push({ id: '<legacy-query>', stage: 'hash_backfill', message: legacyErr.message })
      break
    }
    if (!legacy || legacy.length === 0) break

    for (const row of legacy) {
      if (!row.trip_id || row.amount == null || !row.expense_date || !row.title) continue
      const fp = buildExpenseFingerprint(
        row.trip_id, Number(row.amount), row.expense_date, row.title,
      )
      const { error: upErr } = await db
        .from('expenses')
        .update({ content_hash: fp })
        .eq('id', row.id)
      if (upErr) {
        if (upErr.code === '23505') {
          stats.expenses_dup_skipped++
        } else {
          stats.errors.push({ id: row.id, stage: 'hash_backfill', message: upErr.message })
        }
      } else {
        stats.expenses_hash_backfilled++
      }
    }
    if (legacy.length < PAGE_SIZE) break
  }

  // ── Step 2b: auto-create expenses from documents with paid amount > 0 ────
  // Service-role key bypasses RLS, so this covers every account in the system.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: docs, error: docsErr } = await db
      .from('documents')
      .select('id, trip_id, user_id, name, doc_type, valid_from, extracted_data, idempotency_key')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (docsErr) {
      stats.errors.push({ id: '<docs-query>', stage: 'doc_scan', message: docsErr.message })
      break
    }
    if (!docs || docs.length === 0) break

    for (const doc of docs) {
      stats.documents_scanned++

      const extracted = (doc.extracted_data as ExtractedAmountData | null) || null
      const amount    = shouldCreateExpenseFromDocument(extracted)
      if (amount === null) { stats.documents_zero_amount++; continue }

      const expenseDate =
        extracted?.check_in       ||
        extracted?.departure_date ||
        doc.valid_from            ||
        new Date().toISOString().split('T')[0]

      const fingerprint = buildExpenseFingerprint(
        doc.trip_id, amount, expenseDate, doc.name,
      )

      // After step 2a every legacy expense has `content_hash` set, so this
      // single check is sufficient. No more `notes LIKE '%doc:%'` fallback.
      const { data: existing } = await db
        .from('expenses')
        .select('id')
        .eq('trip_id',      doc.trip_id)
        .eq('content_hash', fingerprint)
        .maybeSingle()
      if (existing) { stats.documents_already_linked++; continue }

      const category = EXPENSE_CATEGORY_MAP[doc.doc_type]
                    || EXPENSE_CATEGORY_MAP[extracted?.booking_type || '']
                    || 'other'
      const currency = (extracted?.currency || 'ILS').toUpperCase()

      // Cross-date vendor check — the content_hash check above ties title +
      // amount + **date** together.  If the SAME vendor already has an
      // expense under a different date (same trip / title / amount / currency),
      // treat this document as already-linked instead of creating a sibling.
      const vendorMatch = await findVendorExpense(doc.trip_id, doc.name, amount, currency)
      if (vendorMatch) { stats.documents_already_linked++; continue }

      // amount_ils falls back to raw amount — we don't block the backfill
      // on FX lookups. The scanners / client will refresh it on next edit.
      const { error: insErr } = await db.from('expenses').insert({
        trip_id:         doc.trip_id,
        user_id:         doc.user_id,
        title:           doc.name,
        amount,
        currency,
        amount_ils:      amount,
        category,
        expense_date:    expenseDate,
        source:          'document',
        is_paid:         true,
        content_hash:    fingerprint,
        idempotency_key: doc.idempotency_key ? `${doc.idempotency_key}:exp` : `doc:${doc.id}`,
        notes:           `doc:${doc.id}\n[backfill] מסמך מקושר`,
      })

      if (insErr) {
        if (insErr.code === '23505') {
          stats.expenses_dup_skipped++
        } else {
          stats.errors.push({ id: doc.id, stage: 'expense_insert', message: insErr.message })
        }
      } else {
        stats.expenses_created++
      }
    }

    if (docs.length < PAGE_SIZE) break
  }

  return NextResponse.json({
    ok: migrationStatus.applied && stats.errors.length === 0,
    migration: migrationStatus,
    backfill: stats,
  })
}
