-- ============================================================
-- 019_hotel_tab.sql
-- "Hotel tab" — track incidentals charged to a hotel room during
-- a stay (room service, pool bar, spa, restaurant, etc.).
--
-- Architecture: reuse the existing `expenses.document_id` FK that
-- already links an expense to a booking document. Any expense whose
-- `document_id` points to a document with `doc_type='hotel'` is an
-- incidental charged to that hotel stay.
--
-- Only one new column — `location_tag` — so the end-of-stay report
-- can segment by physical area of the hotel.
-- ============================================================

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS location_tag TEXT;

COMMENT ON COLUMN expenses.location_tag IS
  'Where the charge happened inside a hotel (pool, lounge, room, spa, restaurant, bar). NULL for non-hotel or unspecified.';

-- Sanity constraint — keep the tag vocabulary small and consistent.
-- Extend this list if the UI adds more location chips.
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_location_tag_vocab;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_location_tag_vocab
  CHECK (
    location_tag IS NULL OR location_tag IN (
      'room', 'pool', 'lounge', 'restaurant', 'bar', 'spa', 'gym', 'shop', 'other'
    )
  );

-- Fast lookup for the running-total query on the Expenses page
CREATE INDEX IF NOT EXISTS expenses_document_id_idx
  ON expenses (document_id)
  WHERE document_id IS NOT NULL;
