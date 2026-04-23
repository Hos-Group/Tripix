-- ============================================================
-- 018_dedup_cleanup.sql
-- Apply the dedup rules from migrations 013 / 016 / 017 to all EXISTING data.
-- Runs once after 017 has added + backfilled idempotency_key.
--
-- Flow (per trip):
--   1. Backfill `dedup_key` for rows that are missing it (same logic as
--      src/lib/documentDedup.ts → buildDedupKey).
--   2. Delete duplicates, keeping the OLDEST row in each group:
--        a. by gmail_message_id   — same email (Gmail + Outlook via ms_ prefix)
--        b. by dedup_key          — same logical booking
--        c. by content_hash       — same file bytes
--   3. Report counts per step.
--
-- Safety:
--   - Scoped by trip_id — a booking that appears in two trips is kept in both.
--   - "Keeping the oldest" = lowest created_at, tiebreak by lowest id.
--   - Transactional: everything rolls back on any error.
--   - Idempotent: re-running after cleanup is a no-op.
--   - Does NOT touch expenses, storage files, or splits. Those are left to
--     subsequent cleanup if needed.
-- ============================================================

-- Guard: migration 016 must have run (columns must exist).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'dedup_key'
  ) THEN
    RAISE EXCEPTION 'Run migration 016 first — columns content_hash / dedup_key are missing';
  END IF;
END $$;

BEGIN;

-- ── 1. Backfill dedup_key ───────────────────────────────────────────────────
-- Mirrors buildDedupKey() in src/lib/documentDedup.ts.
-- Only backfills rows where it's currently NULL.

WITH backfilled AS (
  UPDATE documents d
  SET dedup_key = CASE
    -- With booking_ref
    WHEN d.booking_ref IS NOT NULL AND btrim(d.booking_ref) <> '' THEN
      CASE
        WHEN lower(d.doc_type) = 'flight' THEN
          lower(d.doc_type) || '|' ||
          lower(btrim(d.booking_ref)) || '|' ||
          lower(coalesce(d.traveler_id, 'all')) || '|' ||
          lower(coalesce(btrim(d.flight_number), '')) || '|' ||
          coalesce(to_char(d.valid_from, 'YYYY-MM-DD'), '')
        ELSE
          lower(d.doc_type) || '|' ||
          lower(btrim(d.booking_ref)) || '|' ||
          lower(coalesce(d.traveler_id, 'all'))
      END
    -- Without booking_ref — fall back to name + date
    WHEN d.name IS NOT NULL AND btrim(d.name) <> '' AND d.valid_from IS NOT NULL THEN
      lower(d.doc_type) || '|' ||
      lower(regexp_replace(btrim(d.name), '\s+', ' ', 'g')) || '|' ||
      to_char(d.valid_from, 'YYYY-MM-DD') || '|' ||
      lower(coalesce(d.traveler_id, 'all'))
    ELSE NULL
  END
  WHERE d.dedup_key IS NULL
  RETURNING 1
)
SELECT count(*) AS backfilled_rows FROM backfilled;

-- ── 2a. Delete duplicates by gmail_message_id ───────────────────────────────
-- Scoped by trip_id — the exact same email should only be attached once per trip.

WITH dupes AS (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY trip_id, gmail_message_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM documents
    WHERE gmail_message_id IS NOT NULL
      AND btrim(gmail_message_id) <> ''
      AND trip_id IS NOT NULL
  ) ranked
  WHERE rn > 1
),
deleted AS (
  DELETE FROM documents WHERE id IN (SELECT id FROM dupes)
  RETURNING 1
)
SELECT count(*) AS deleted_by_gmail_id FROM deleted;

-- ── 2b. Delete duplicates by dedup_key ──────────────────────────────────────

WITH dupes AS (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY trip_id, dedup_key
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM documents
    WHERE dedup_key IS NOT NULL
      AND trip_id IS NOT NULL
  ) ranked
  WHERE rn > 1
),
deleted AS (
  DELETE FROM documents WHERE id IN (SELECT id FROM dupes)
  RETURNING 1
)
SELECT count(*) AS deleted_by_dedup_key FROM deleted;

-- ── 2c. Delete duplicates by content_hash ───────────────────────────────────

WITH dupes AS (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY trip_id, content_hash
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM documents
    WHERE content_hash IS NOT NULL
      AND trip_id IS NOT NULL
  ) ranked
  WHERE rn > 1
),
deleted AS (
  DELETE FROM documents WHERE id IN (SELECT id FROM dupes)
  RETURNING 1
)
SELECT count(*) AS deleted_by_content_hash FROM deleted;

-- ── 2d. Delete duplicates by idempotency_key ────────────────────────────────

WITH dupes AS (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY trip_id, idempotency_key
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM documents
    WHERE idempotency_key IS NOT NULL
      AND trip_id IS NOT NULL
  ) ranked
  WHERE rn > 1
),
deleted AS (
  DELETE FROM documents WHERE id IN (SELECT id FROM dupes)
  RETURNING 1
)
SELECT count(*) AS deleted_by_idempotency_key FROM deleted;

COMMIT;
