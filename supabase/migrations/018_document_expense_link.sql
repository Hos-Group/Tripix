-- ============================================================
-- 018_document_expense_link.sql
-- Proper FK from expenses → documents for bi-directional sync.
--
-- When a document is deleted (via documents/delete API or cascade),
-- the linked expense is also deleted (ON DELETE CASCADE).
--
-- The application handles the reverse: deleting an expense via
-- the expenses page also calls the document delete endpoint.
--
-- Backfill: parse existing "doc:<uuid>" from expense notes.
-- ============================================================

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS expenses_document_id_idx
  ON expenses (document_id)
  WHERE document_id IS NOT NULL;

-- Backfill existing rows that embed their document ID in notes
UPDATE expenses
SET document_id = (
  substring(notes FROM 'doc:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
)::uuid
WHERE notes LIKE 'doc:%'
  AND document_id IS NULL
  AND exists (
    SELECT 1 FROM documents
    WHERE id = (
      substring(expenses.notes FROM 'doc:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    )::uuid
  );

COMMENT ON COLUMN expenses.document_id IS
  'FK to the document that created this expense (ON DELETE CASCADE). NULL for manual/voice entries.';
