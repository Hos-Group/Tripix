-- ============================================================
-- 013_documents_gmail_dedup.sql
-- Add gmail_message_id to documents for DB-level deduplication.
--
-- Problem: dedup was done via `notes LIKE 'GMID:%'` text search
-- which is slow, unindexed, and allows race-condition duplicates.
--
-- Fix: proper column + partial unique index.
-- Manual uploads are always allowed (NULL is exempt from uniqueness).
-- ============================================================

-- 1. Add the column
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

-- 2. Partial unique index: one document per Gmail message per trip.
--    NULL values (manual uploads) are excluded from uniqueness check.
CREATE UNIQUE INDEX IF NOT EXISTS documents_trip_gmail_unique
  ON documents (trip_id, gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

-- 3. Backfill existing rows from the notes field.
--    Notes format is: "GMID:<message_id>\n…"
UPDATE documents
SET gmail_message_id = substring(notes FROM '^GMID:([^\n]+)')
WHERE notes LIKE 'GMID:%'
  AND gmail_message_id IS NULL;
