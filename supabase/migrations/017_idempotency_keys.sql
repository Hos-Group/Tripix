-- ============================================================
-- 017_idempotency_keys.sql
-- Unified idempotency_key column on expenses + documents.
--
-- Complements the existing dedup columns:
--   documents.content_hash  (016) — SHA-256 of file bytes, unique per trip
--   documents.dedup_key     (016) — legacy logical signature, unique per trip
--   expenses.content_hash   (016) — logical fingerprint, globally unique
--
-- idempotency_key is the deterministic source key ("<source>:<id>") used by
-- every automated insert site (Gmail / Microsoft / scan). Format:
--   "gmail:<message_id>"   — one row per Gmail message per trip
--   "ms:<message_id>"      — one row per Outlook message per trip
--   "scan:<sha256>"        — one row per uploaded file per trip
--
-- Manual entries leave it NULL — the partial unique index excludes NULLs so
-- manual rows are never blocked by this constraint.
-- ============================================================

-- ─── DOCUMENTS ───────────────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_idempotency_unique
  ON documents (trip_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Backfill: gmail_message_id → "gmail:<id>" (or "ms:<id>" for the ms_ prefix
-- used by the Microsoft scanner before the unified scheme).
UPDATE documents
SET idempotency_key = CASE
  WHEN gmail_message_id LIKE 'ms\_%' ESCAPE '\' THEN 'ms:' || substring(gmail_message_id FROM 4)
  ELSE 'gmail:' || gmail_message_id
END
WHERE gmail_message_id IS NOT NULL
  AND idempotency_key IS NULL;

-- ─── EXPENSES ────────────────────────────────────────────────
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_trip_idempotency_unique
  ON expenses (trip_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Backfill from existing GMID:<id> tag in notes (pre-unified-scheme data)
UPDATE expenses
SET idempotency_key = 'gmail:' || substring(notes FROM '^GMID:([^\n]+)')
WHERE notes LIKE 'GMID:%'
  AND idempotency_key IS NULL;

-- ─── DOCUMENTATION ───────────────────────────────────────────
COMMENT ON COLUMN documents.idempotency_key IS
  'Deterministic source key for hard dedup. Format: "<source>:<id>". NULL for manual uploads.';
COMMENT ON COLUMN expenses.idempotency_key IS
  'Deterministic source key for hard dedup. Format: "<source>:<id>". NULL for manual entries.';
