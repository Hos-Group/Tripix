-- ============================================================
-- 016_documents_dedup.sql
-- System-wide duplicate prevention for documents AND expenses.
--
-- ── documents ────────────────────────────────────────────────
-- Two layers, both scoped per trip:
--   content_hash — SHA-256 of file bytes (helpers in src/lib/documentDedup.ts).
--                  Catches the same PDF/HTML/image uploaded twice.
--   dedup_key    — logical signature (doc_type | booking_ref | traveler …).
--                  Catches the same booking arriving via different sources
--                  (Gmail scan → manual upload → email forward).
-- gmail_message_id (migration 013) already prevents same-email re-import.
--
-- ── expenses ─────────────────────────────────────────────────
-- Mirrors dedup.ts usage:
--   content_hash    — text fingerprint (tripId|amount|date|norm(title)).
--                     Soft dedup, bypassable via `force=true`.
--   idempotency_key — `<source>:<id>` (gmail:… / scan:<sha256> / import:…).
--                     Hard dedup; second insert blocked by DB.
-- ============================================================

-- ── documents ───────────────────────────────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS content_hash    TEXT,
  ADD COLUMN IF NOT EXISTS dedup_key       TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_content_hash_unique
  ON documents (trip_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_dedup_key_unique
  ON documents (trip_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_idempotency_key_unique
  ON documents (trip_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_content_hash_idx
  ON documents (content_hash)
  WHERE content_hash IS NOT NULL;

-- ── expenses ────────────────────────────────────────────────────────────────
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS content_hash    TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_trip_content_hash_unique
  ON expenses (trip_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_trip_idempotency_key_unique
  ON expenses (trip_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS expenses_idempotency_key_idx
  ON expenses (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
