-- ============================================================
-- ROLLUP_dedup_and_idempotency.sql
-- One-click rollup of migrations 016_dedup, 016_documents_dedup,
-- 017_idempotency_keys — paste into Supabase SQL editor and run.
--
-- Fully idempotent (IF NOT EXISTS everywhere). Safe to re-run.
--
-- After this runs, hit:
--   GET /api/admin/apply-dedup?secret=<ADMIN_MIGRATE_SECRET>
-- to backfill legacy rows (expense.content_hash + auto-linked
-- expenses from existing documents with paid amounts).
-- ============================================================

-- ─── 016_dedup.sql ──────────────────────────────────────────
-- Expense fingerprint + booking-ref dedup on documents.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_content_hash_unique
  ON expenses (content_hash)
  WHERE content_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_passport_dedup
  ON documents (trip_id, booking_ref)
  WHERE doc_type = 'passport'
    AND booking_ref IS NOT NULL
    AND booking_ref <> '';

CREATE UNIQUE INDEX IF NOT EXISTS documents_booking_dedup
  ON documents (trip_id, doc_type, booking_ref, traveler_id)
  WHERE doc_type <> 'passport'
    AND booking_ref IS NOT NULL
    AND booking_ref <> ''
    AND traveler_id <> 'all';

-- ─── 016_documents_dedup.sql ────────────────────────────────
-- Multi-signal dedup on documents.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS dedup_key    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_content_hash_unique
  ON documents (trip_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_dedup_key_unique
  ON documents (trip_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_content_hash_idx
  ON documents (content_hash)
  WHERE content_hash IS NOT NULL;

-- ─── 017_idempotency_keys.sql ───────────────────────────────
-- Unified "<source>:<id>" key on both tables, with partial unique indexes
-- scoped to (trip_id, idempotency_key). NULL entries (manual) are exempt.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_idempotency_unique
  ON documents (trip_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

UPDATE documents
SET idempotency_key = CASE
  WHEN gmail_message_id LIKE 'ms\_%' ESCAPE '\' THEN 'ms:' || substring(gmail_message_id FROM 4)
  ELSE 'gmail:' || gmail_message_id
END
WHERE gmail_message_id IS NOT NULL
  AND idempotency_key IS NULL;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_trip_idempotency_unique
  ON expenses (trip_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

UPDATE expenses
SET idempotency_key = 'gmail:' || substring(notes FROM '^GMID:([^\n]+)')
WHERE notes LIKE 'GMID:%'
  AND idempotency_key IS NULL;

-- ─── exec_sql helper (enables future self-applying rollouts) ─
-- Only the service_role (used by /api/admin/*) can call it.
CREATE OR REPLACE FUNCTION exec_sql(query text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE query;
END;
$$;

REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM public;
REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION exec_sql(text) TO   service_role;

-- ─── Column documentation ───────────────────────────────────
COMMENT ON COLUMN expenses.content_hash IS
  'Logical fingerprint (trip|amount|date|normalized title). Partial UNIQUE.';
COMMENT ON COLUMN expenses.idempotency_key IS
  'Source key "<source>:<id>". Partial UNIQUE per trip. NULL = manual entry.';
COMMENT ON COLUMN documents.content_hash IS
  'SHA-256 of file bytes. Partial UNIQUE per trip — blocks re-upload of same file.';
COMMENT ON COLUMN documents.dedup_key IS
  'Logical signature (doc_type + booking_ref + traveler / name+date). Partial UNIQUE per trip.';
COMMENT ON COLUMN documents.idempotency_key IS
  'Source key "<source>:<id>". Partial UNIQUE per trip. NULL = manual upload.';

-- ─── Sanity check (returns the new columns) ─────────────────
SELECT
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('expenses', 'documents')
  AND column_name IN ('content_hash', 'dedup_key', 'idempotency_key')
ORDER BY table_name, column_name;
