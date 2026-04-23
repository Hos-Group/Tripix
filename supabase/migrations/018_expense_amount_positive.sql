-- ============================================================
-- 018_expense_amount_positive.sql
-- Enforce "paid amount > 0" at the DB level so zero-amount rows
-- can NEVER appear on the Expenses page again, regardless of
-- which code path inserts them.
--
-- This is the belt-and-suspenders companion to the application-
-- layer guards in:
--   src/lib/gmailScanner.ts          (scanners)
--   src/lib/microsoftScanner.ts
--   src/lib/dedup.ts                 (shouldCreateExpenseFromDocument)
--   src/app/api/documents/route.ts   (document→expense auto-link)
--   src/app/api/expenses/route.ts    (manual create)
--   src/app/scan/page.tsx            (scan receipt/flight/hotel)
--
-- amount_ils is NOT constrained > 0 because FX lookups can
-- transiently return 0 on partial outages; the raw `amount`
-- column is the authoritative source-of-truth.
-- ============================================================

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_amount_positive;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_amount_positive
  CHECK (amount > 0);

COMMENT ON CONSTRAINT expenses_amount_positive ON expenses IS
  'Enforces the product rule: documents/scans with amount ≤ 0 must NOT produce expense rows. See migration 018 comment.';
