-- Migration: Enable RLS on trips, expenses, documents
-- Each user sees only their own trips and related data.

-- ── trips ──────────────────────────────────────────────────────────────────
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- FK to Supabase auth (nullable — legacy trips may have no user_id)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS owned_by UUID REFERENCES auth.users(id);
-- Backfill owned_by from existing user_id where possible (noop if already same)
UPDATE trips SET owned_by = user_id::UUID WHERE user_id IS NOT NULL AND owned_by IS NULL;

CREATE POLICY "trips_select" ON trips FOR SELECT
  USING (owned_by IS NULL OR owned_by = auth.uid());

CREATE POLICY "trips_insert" ON trips FOR INSERT
  WITH CHECK (owned_by = auth.uid());

CREATE POLICY "trips_update" ON trips FOR UPDATE
  USING (owned_by = auth.uid());

CREATE POLICY "trips_delete" ON trips FOR DELETE
  USING (owned_by = auth.uid());

-- ── expenses ──────────────────────────────────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_all" ON expenses
  USING (trip_id IN (SELECT id FROM trips WHERE owned_by = auth.uid() OR owned_by IS NULL));

-- ── documents ──────────────────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_all" ON documents
  USING (trip_id IN (SELECT id FROM trips WHERE owned_by = auth.uid() OR owned_by IS NULL));

-- ── trip_members ───────────────────────────────────────────────────────────
-- Allow reading members if you are part of the trip
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_members_select" ON trip_members FOR SELECT
  USING (trip_id IN (SELECT id FROM trips WHERE owned_by = auth.uid() OR owned_by IS NULL));

CREATE POLICY "trip_members_insert" ON trip_members FOR INSERT
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE owned_by = auth.uid()));

CREATE POLICY "trip_members_delete" ON trip_members FOR DELETE
  USING (trip_id IN (SELECT id FROM trips WHERE owned_by = auth.uid()));
