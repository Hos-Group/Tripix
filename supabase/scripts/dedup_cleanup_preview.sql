-- ============================================================
-- 017_dedup_cleanup_preview.sql  (READ-ONLY)
--
-- Run this BEFORE 017_dedup_cleanup.sql to see exactly how many
-- duplicate rows will be removed. No data is modified.
--
-- Output columns:
--   total_documents         — count before cleanup
--   missing_dedup_key       — rows that would get a backfilled key
--   dup_by_gmail_message_id — dupes detected by email id
--   dup_by_dedup_key        — dupes detected by logical signature
--   dup_by_content_hash     — dupes detected by file hash
--   dup_by_idempotency_key  — dupes detected by source key
--   would_delete_total      — unique rows across all signals (best estimate)
-- ============================================================

WITH
  total AS (SELECT count(*) AS n FROM documents),

  missing_key AS (
    SELECT count(*) AS n FROM documents
    WHERE dedup_key IS NULL
      AND (
        (booking_ref IS NOT NULL AND btrim(booking_ref) <> '')
        OR (name IS NOT NULL AND btrim(name) <> '' AND valid_from IS NOT NULL)
      )
  ),

  dup_gmail AS (
    SELECT id FROM (
      SELECT id, row_number() OVER (
        PARTITION BY trip_id, gmail_message_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
      FROM documents
      WHERE gmail_message_id IS NOT NULL AND btrim(gmail_message_id) <> '' AND trip_id IS NOT NULL
    ) r WHERE rn > 1
  ),

  dup_dedup AS (
    SELECT id FROM (
      SELECT id, row_number() OVER (
        PARTITION BY trip_id, dedup_key
        ORDER BY created_at ASC, id ASC
      ) AS rn
      FROM documents
      WHERE dedup_key IS NOT NULL AND trip_id IS NOT NULL
    ) r WHERE rn > 1
  ),

  dup_content AS (
    SELECT id FROM (
      SELECT id, row_number() OVER (
        PARTITION BY trip_id, content_hash
        ORDER BY created_at ASC, id ASC
      ) AS rn
      FROM documents
      WHERE content_hash IS NOT NULL AND trip_id IS NOT NULL
    ) r WHERE rn > 1
  ),

  dup_idem AS (
    SELECT id FROM (
      SELECT id, row_number() OVER (
        PARTITION BY trip_id, idempotency_key
        ORDER BY created_at ASC, id ASC
      ) AS rn
      FROM documents
      WHERE idempotency_key IS NOT NULL AND trip_id IS NOT NULL
    ) r WHERE rn > 1
  ),

  union_all_dupes AS (
    SELECT id FROM dup_gmail
    UNION
    SELECT id FROM dup_dedup
    UNION
    SELECT id FROM dup_content
    UNION
    SELECT id FROM dup_idem
  )

SELECT
  (SELECT n FROM total)                    AS total_documents,
  (SELECT n FROM missing_key)              AS missing_dedup_key,
  (SELECT count(*) FROM dup_gmail)         AS dup_by_gmail_message_id,
  (SELECT count(*) FROM dup_dedup)         AS dup_by_dedup_key,
  (SELECT count(*) FROM dup_content)       AS dup_by_content_hash,
  (SELECT count(*) FROM dup_idem)          AS dup_by_idempotency_key,
  (SELECT count(*) FROM union_all_dupes)   AS would_delete_total;
